// Consolidated TikTok webhook:
//   1. Verify TikTok handshake (challenge) + Business API X-Open-Signature (HMAC)
//   2. Parse + sanitize lead — native entry[]/changes[], Make flat keys, or form_data
//   3. Insert into `leads` (source = 'TikTok')
//   4. Return 200 OK to TikTok immediately
//   5. Dispatch EasySocial WhatsApp welcome (inline, awaited)
//
// Deployed with verify_jwt = false (TikTok cannot send Supabase JWTs).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-verify-token, x-tiktok-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// EasySocial "new lead / welcome" WhatsApp template. Campaign token + template id
// (cmr51yngl0lx7vsxp9htlbr7o / 20704) verified live 2026-07-03 — the previous
// cmoiymj99b30ciyxpdvtndj6n / 18909 template was deleted on EasySocial's side
// (404 "Campaign not found"), which is why the welcome silently never sent.
const EASYSOCIAL_TEMPLATE_BASE =
  "https://api.easysocial.in/api/v1/wa-templates/send/cmr51yngl0lx7vsxp9htlbr7o/20704/4026/API";

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
} as const;

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

// Fire the EasySocial WhatsApp welcome immediately (no artificial delay). The old
// version waited 10s inside a waitUntil() background task, but the edge instance is
// torn down right after the ~1s response — so the timer never fired and the welcome
// silently never sent. Awaited inline so it reliably completes. Returns a diagnostic.
async function dispatchWhatsApp(sanitizedNumber: string, clientName: string) {
  const url = `${EASYSOCIAL_TEMPLATE_BASE}/${sanitizedNumber}?body1=${encodeURIComponent(clientName)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    console.log("[tiktok-receiver] dispatching WhatsApp →", url);
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
    const text = await res.text();
    console.log("[tiktok-receiver] EasySocial status:", res.status, "body:", text.slice(0, 500));
    return { sent: res.ok, status: res.status, body: text.slice(0, 300) };
  } catch (err) {
    console.error("[tiktok-receiver] WhatsApp dispatch failed:", err instanceof Error ? err.message : err);
    return { sent: false, error: String(err) };
  } finally {
    clearTimeout(timer);
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

  // Read the RAW body first — TikTok Business API signs the exact payload text it
  // sends (HMAC-SHA256 with the App Secret, lowercase hex, X-Open-Signature header).
  // Verification only enforced once TIKTOK_APP_SECRET is configured.
  const rawBody = await req.text();
  const appSecret = Deno.env.get("TIKTOK_APP_SECRET") || "";
  const signature = req.headers.get("x-open-signature") || "";
  if (appSecret && signature) {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(appSecret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex !== signature.toLowerCase()) {
      console.error("[tiktok-receiver] X-Open-Signature mismatch — rejecting");
      return new Response("invalid signature", { status: 403, headers: corsHeaders });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // TikTok verification handshake
  if (payload.challenge) {
    return json({ challenge: payload.challenge }, 200);
  }

  const supabaseNative = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 0) TikTok Business API NATIVE webhook (subscription/subscribe, subscribe_entity=LEAD).
  // Shape: { request_id, object: 1, time, entry: [{ id, lead_source, page_id, page_name,
  // advertiser_id, ..., create_time, changes: [{field, value}, ...] }] }.
  // Full form answers arrive inline in changes[]; batched up to 1000 entries;
  // at-least-once delivery -> dedupe per entry.id. Always answer 200.
  if (Array.isArray((payload as any).entry)) {
    const entries = (payload as any).entry as Record<string, unknown>[];
    let inserted = 0, duplicates = 0, skipped = 0;
    const whatsapp: unknown[] = [];
    for (const entry of entries.slice(0, 1000)) {
      const changes = Array.isArray(entry.changes) ? (entry.changes as Record<string, unknown>[]) : [];
      let name: string | null = null, phone: string | null = null, email: string | null = null;
      const extras: string[] = [];
      for (const c of changes) {
        const field = sanitizeText(c.field, 120) ?? "";
        const value = firstScalar(c.value ?? (c as any).values) ?? "";
        if (!field || !value) continue;
        if (!name && matchesAlias(field, FIELD_ALIASES.name)) name = sanitizeText(value, 120);
        else if (!phone && matchesAlias(field, FIELD_ALIASES.phone)) phone = sanitizePhone(value);
        else if (!email && matchesAlias(field, FIELD_ALIASES.email)) email = sanitizeText(value, 255);
        else extras.push(`${field}: ${sanitizeText(value, 200)}`);
      }
      if (!name || !phone) { skipped++; continue; }

      // Idempotency by TikTok lead id (entry.id can arrive as number or string).
      const entryLeadId = sanitizeText(entry.id, 200);
      if (entryLeadId) {
        const { error: dupErr } = await supabaseNative
          .from("webhook_events")
          .insert({ event_id: `tt:${entryLeadId}`, source: "tiktok" });
        if (dupErr && (dupErr as { code?: string }).code === "23505") { duplicates++; continue; }
      }

      const { data: ins, error: insErr } = await supabaseNative
        .from("leads")
        .upsert({
          client_name: name,
          client_phone: phone,
          client_email: email,
          phone_number: phone,
          source: "TikTok",
          status: "new",
          notes: extras.length ? extras.join(" | ") : null,
          platform: "tiktok",
          origin: "tiktok_lead_ad",
          updated_at: new Date().toISOString(),
        }, { onConflict: "phone_number" })
        .select("id")
        .maybeSingle();
      if (insErr) { console.error("[tiktok-receiver] native insert failed:", insErr); continue; }
      inserted++;
      console.log("[tiktok-receiver] native lead", ins?.id, name, "form", entry.page_name ?? entry.page_id);
      whatsapp.push(await dispatchWhatsApp(phone, name));
    }
    return json({ success: true, mode: "tiktok_native", inserted, duplicates, skipped, whatsapp }, 200);
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
  }

  const clientName = sanitizeText(rawName, 120);
  const clientPhone = sanitizePhone(rawPhone);
  const clientEmail = sanitizeText(rawEmail, 255);
  const ttclid = sanitizeText(rawTtclid, 255);
  const buyingPower = sanitizeText(rawBuyingPower, 200);

  if (!clientName || !clientPhone) {
    return json({ error: "Missing required lead fields (name, phone)" }, 400);
  }

  const notes = buyingPower ? `Bank qualification / buying power: ${buyingPower}` : null;

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

  const leadData = {
    client_name: clientName,
    client_phone: clientPhone,
    client_email: clientEmail,
    phone_number: clientPhone,
    source: "TikTok",
    status: "new",
    notes,
    platform: "tiktok",
    origin: "tiktok_lead_ad",
    ...(ttclid ? { ttclid } : {}),
    updated_at: new Date().toISOString(),
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

  // Fire the WhatsApp welcome inline (awaited) so it reliably sends.
  const whatsapp = await dispatchWhatsApp(clientPhone, clientName);

  // Always respond 200 OK so TikTok / Make.com don't enter retry loops.
  return new Response(JSON.stringify({ success: true, note: "Handled", lead_id: leadId, whatsapp }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
