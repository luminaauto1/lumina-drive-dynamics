// Consolidated TikTok webhook:
//   1. Verify TikTok handshake (challenge)
//   2. Parse + sanitize lead
//   3. Insert into `leads` (source = 'TikTok')
//   4. Return 200 OK to TikTok immediately
//   5. Background: wait 10s, then dispatch EasySocial WhatsApp template
//
// Deployed with verify_jwt = false (TikTok cannot send Supabase JWTs).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-verify-token, x-tiktok-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const EASYSOCIAL_TEMPLATE_BASE =
  "https://api.easysocial.in/api/v1/wa-templates/send/cmoiymj99b30ciyxpdvtndj6n/18909/4026/API";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sanitizeText = (raw: unknown, max = 255): string | null => {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return null;
  return value.slice(0, max);
};

// Strip spaces, +, (), dashes; convert local 0xxxxxxxxx -> 27xxxxxxxxx
const sanitizePhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  let cleaned = String(raw).replace(/[\s()+\-]/g, "").replace(/\D/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("0")) cleaned = "27" + cleaned.slice(1);
  if (cleaned.length < 10 || cleaned.length > 15) return null;
  return cleaned;
};

const FIELD_ALIASES = {
  name: ["name", "full_name", "full name", "client_name", "customer_name", "lead_name"],
  phone: ["phone", "phone_number", "mobile", "mobile_number", "cell", "contact_number"],
  email: ["email", "email_address", "e-mail", "client_email"],
  buyingPower: ["buying_power", "buying power", "bank_qualification", "qualification", "approved_amount", "budget"],
  blacklisted: ["blacklisted", "is_blacklisted", "are you blacklisted"],
  employed: ["employed", "permanently_employed", "permanently employed", "employment"],
  licence: ["licence", "license", "drivers_licence", "drivers_license", "driver's licence", "driver's license"],
} as const;

// "Yes ..." -> true, "No ..." -> false, anything else -> null (unknown)
const yesNo = (raw: unknown): boolean | null => {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (/^yes\b/i.test(value)) return true;
  if (/^no\b/i.test(value)) return false;
  return null;
};

const matchesAlias = (key: string, aliases: readonly string[]) => {
  const normalized = key.toLowerCase().trim();
  return aliases.some((alias) => normalized === alias || normalized.includes(alias));
};

const firstScalar = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const scalar = firstScalar(item);
      if (scalar) return scalar;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["value", "values", "answer", "answers", "text", "label"]) {
      const scalar = firstScalar(record[key]);
      if (scalar) return scalar;
    }
  }
  return null;
};

function extractLeadFields(formData: unknown) {
  const extracted: Record<keyof typeof FIELD_ALIASES, string | null> = {
    name: null,
    phone: null,
    email: null,
    buyingPower: null,
    blacklisted: null,
    employed: null,
    licence: null,
  };

  if (Array.isArray(formData)) {
    for (const entry of formData) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const fieldName = [record.name, record.key, record.field_name, record.question, record.label]
        .map((value) => sanitizeText(value, 120))
        .find(Boolean);

      if (!fieldName) continue;

      const fieldValue = firstScalar(
        record.value ?? record.values ?? record.answer ?? record.answers ?? record.field_value,
      );

      if (!fieldValue) continue;

      for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
        if (!extracted[canonical as keyof typeof FIELD_ALIASES] && matchesAlias(fieldName, aliases)) {
          extracted[canonical as keyof typeof FIELD_ALIASES] = fieldValue;
        }
      }
    }

    return extracted;
  }

  if (formData && typeof formData === "object") {
    for (const [key, value] of Object.entries(formData as Record<string, unknown>)) {
      const scalar = firstScalar(value);
      if (!scalar) continue;

      for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
        if (!extracted[canonical as keyof typeof FIELD_ALIASES] && matchesAlias(key, aliases)) {
          extracted[canonical as keyof typeof FIELD_ALIASES] = scalar;
        }
      }
    }
  }

  return extracted;
}

async function dispatchWhatsAppAfterDelay(sanitizedNumber: string, clientName: string) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const url = `${EASYSOCIAL_TEMPLATE_BASE}/${sanitizedNumber}?body1=${encodeURIComponent(clientName)}`;
    console.log("[tiktok-receiver] dispatching WhatsApp →", url);
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
    const text = await res.text();
    console.log("[tiktok-receiver] EasySocial status:", res.status, "body:", text.slice(0, 500));
  } catch (err) {
    console.error("[tiktok-receiver] background dispatch failed:", err);
  }
}

function scheduleBackground(promise: Promise<unknown>) {
  // @ts-ignore — EdgeRuntime is provided by Supabase Edge runtime
  const ert: any = (globalThis as any).EdgeRuntime;
  if (ert && typeof ert.waitUntil === "function") {
    ert.waitUntil(promise);
  } else {
    // Fallback: fire-and-forget
    promise.catch((e) => console.error("[tiktok-receiver] bg fallback err:", e));
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // GET — verification handshake (TikTok / Meta-style): echo back ?challenge after
  // checking the verify token. Token is configurable via the TIKTOK_VERIFY_TOKEN
  // secret (the exact value is read from the TikTok console at setup). If the
  // secret is unset we still echo the challenge so the very first verify succeeds.
  if (req.method === "GET") {
    const expected = Deno.env.get("TIKTOK_VERIFY_TOKEN") || "";
    const token =
      url.searchParams.get("verify_token") ||
      url.searchParams.get("hub.verify_token") ||
      req.headers.get("x-verify-token") ||
      req.headers.get("x-tiktok-signature") ||
      "";
    const challenge =
      url.searchParams.get("challenge") || url.searchParams.get("hub.challenge") || "";
    if (expected && token && token !== expected) {
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }
    return new Response(challenge || "ok", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // TikTok verification handshake
  if (payload.challenge) {
    return json({ challenge: payload.challenge }, 200);
  }

  // 1) Try flat root-level keys first (Make.com / generic webhook style)
  let rawName: unknown =
    payload.name ?? payload.full_name ?? payload.client_name ?? payload.customer_name ?? payload.lead_name;
  let rawPhone: unknown =
    payload.phone ?? payload.phone_number ?? payload.mobile ?? payload.mobile_number ?? payload.cell ?? payload.contact_number;
  let rawEmail: unknown =
    payload.email ?? payload.email_address ?? payload.client_email;
  let rawBuyingPower: unknown =
    payload.buying_power ?? payload.buyingPower ?? payload.bank_qualification ?? payload.qualification ?? payload.approved_amount ?? payload.budget;
  let rawBlacklisted: unknown = payload.blacklisted ?? payload.is_blacklisted;
  let rawEmployed: unknown = payload.employed ?? payload.permanently_employed;
  let rawLicence: unknown = payload.licence ?? payload.license ?? payload.drivers_licence;
  // ttclid (TikTok click id) for CAPI attribution — lives in tracking, not the form.
  const rawTtclid: unknown =
    payload.ttclid ?? (payload as any).click_id ?? (payload as any).tt_click_id ??
    (payload.data as Record<string, unknown> | undefined)?.ttclid ??
    (payload.tracking as Record<string, unknown> | undefined)?.ttclid;

  // 2) Fallback to TikTok native nested form/field_data structure
  if (!rawName || !rawPhone || !rawEmail) {
    const d = payload.data as Record<string, unknown> | undefined;
    const formData = d?.form_data ?? d?.field_data ?? (payload as any).field_data ?? (payload as any).form_data;
    const fields = extractLeadFields(formData);
    rawName = rawName ?? fields.name;
    rawPhone = rawPhone ?? fields.phone;
    rawEmail = rawEmail ?? fields.email;
    rawBuyingPower = rawBuyingPower ?? fields.buyingPower;
    rawBlacklisted = rawBlacklisted ?? fields.blacklisted;
    rawEmployed = rawEmployed ?? fields.employed;
    rawLicence = rawLicence ?? fields.licence;
  }

  const clientName = sanitizeText(rawName, 120);
  const clientPhone = sanitizePhone(rawPhone);
  const clientEmail = sanitizeText(rawEmail, 255);
  const ttclid = sanitizeText(rawTtclid, 255);
  const buyingPower = sanitizeText(rawBuyingPower, 200);
  const blacklistedRaw = sanitizeText(rawBlacklisted, 60);
  const employedRaw = sanitizeText(rawEmployed, 120);
  const licenceRaw = sanitizeText(rawLicence, 160);

  if (!clientName || !clientPhone) {
    return json({ error: "Missing required lead fields (name, phone)" }, 400);
  }

  // Separated TikTok form answers (preferred). Legacy payloads concatenate all
  // answers into buyingPower; the first Yes/No there is the blacklist answer.
  let notes: string | null;
  let formAnswers: Record<string, string> | null = null;
  let isBlacklisted: boolean | null;

  if (blacklistedRaw || employedRaw || licenceRaw) {
    formAnswers = {};
    if (blacklistedRaw) formAnswers.blacklisted = blacklistedRaw;
    if (employedRaw) formAnswers.employed = employedRaw;
    if (licenceRaw) formAnswers.licence = licenceRaw;
    isBlacklisted = yesNo(blacklistedRaw);
    notes = `Blacklisted: ${blacklistedRaw ?? "?"} | Employed: ${employedRaw ?? "?"} | Licence: ${licenceRaw ?? "?"}`;
  } else {
    notes = buyingPower ? `Bank qualification / buying power: ${buyingPower}` : null;
    isBlacklisted = yesNo(buyingPower);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Idempotency — TikTok delivers "at least once" and retries for up to 72h until
  // it gets a 200, so the same lead can arrive twice. Dedupe by the TikTok lead id
  // via the shared webhook_events table so we never double-insert a lead or
  // double-fire the WhatsApp welcome. (Prefix 'tt:' — the PK is shared w/ EasySocial.)
  const ttLeadId = sanitizeText(
    (payload.data as Record<string, unknown> | undefined)?.lead_id ??
      (payload as Record<string, unknown>).lead_id ??
      (payload.data as Record<string, unknown> | undefined)?.leadgen_id ??
      (payload as Record<string, unknown>).leadgen_id,
    200,
  );
  if (ttLeadId) {
    const { error: dupErr } = await supabase
      .from("webhook_events")
      .insert({ event_id: `tt:${ttLeadId}`, source: "tiktok" });
    if (dupErr && (dupErr as { code?: string }).code === "23505") {
      console.log("[tiktok-receiver] duplicate lead ignored", ttLeadId);
      return json({ success: true, skipped: "duplicate", lead_id: ttLeadId }, 200);
    }
  }

  // notes / form_answers / is_blacklisted are spread conditionally so a repeat
  // submission (upsert on phone_number) never nulls out data we already have.
  const leadData = {
    client_name: clientName,
    client_phone: clientPhone,
    client_email: clientEmail,
    phone_number: clientPhone,
    source: "TikTok",
    status: "new",
    platform: "tiktok",
    origin: "tiktok_lead_ad",
    ...(ttclid ? { ttclid } : {}),
    updated_at: new Date().toISOString(),
    ...(notes ? { notes } : {}),
    ...(formAnswers ? { form_answers: formAnswers } : {}),
    ...(isBlacklisted !== null ? { is_blacklisted: isBlacklisted } : {}),
  };

  let leadId: string | null = null;

  try {
    const { data, error } = await supabase
      .from("leads")
      .upsert(leadData, { onConflict: "phone_number" })
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    leadId = data?.id ?? null;
  } catch (dbError) {
    console.error("Database insertion failed/duplicate:", dbError);
  }

  // Kick off the 10s delay + WhatsApp dispatch in the background — always.
  scheduleBackground(dispatchWhatsAppAfterDelay(clientPhone, clientName));

  // Always respond 200 OK so TikTok / Make.com don't enter retry loops.
  return new Response(JSON.stringify({ success: true, note: "Handled", lead_id: leadId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
