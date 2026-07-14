import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getWaTemplate, buildWaSendUrl } from "../_shared/waTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// SETTINGS-DRIVEN (2026-07-14): the lead-welcome template link lives in
// whatsapp_templates key 'tiktok_lead_welcome' (Admin → Settings → WhatsApp
// Templates) — the ban wiped the old hardcoded template, never hardcode again.
const WELCOME_TEMPLATE_KEY = "tiktok_lead_welcome";

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

// "Yes ..." -> true, "No ..." -> false, anything else -> null (unknown)
const yesNo = (raw: unknown): boolean | null => {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (/^yes\b/i.test(value)) return true;
  if (/^no\b/i.test(value)) return false;
  return null;
};

// Strip non-digits; convert local 0xxxxxxxxx -> 27xxxxxxxxx (ZA)
const sanitizePhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  let cleaned = String(raw).replace(/\D/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("0")) cleaned = "27" + cleaned.slice(1);
  if (cleaned.length < 10 || cleaned.length > 15) return null;
  return cleaned;
};

async function dispatchWhatsAppAfterDelay(sanitizedNumber: string, clientName: string) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const tpl = await getWaTemplate(WELCOME_TEMPLATE_KEY);
    if (!tpl || tpl.active === false) {
      console.log("[make-receiver] welcome skipped — template missing/inactive:", WELCOME_TEMPLATE_KEY);
      return;
    }
    const url = buildWaSendUrl(tpl.send_url, sanitizedNumber, {
      name: clientName || "there",
      mobilenumber: sanitizedNumber,
    });
    if (!url) {
      console.log("[make-receiver] welcome skipped — no send_url on", WELCOME_TEMPLATE_KEY);
      return;
    }
    console.log("[make-receiver] dispatching WhatsApp →", url);
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
    const text = await res.text();
    console.log("[make-receiver] EasySocial status:", res.status, "body:", text.slice(0, 500));
  } catch (err) {
    console.error("[make-receiver] background dispatch failed:", err);
  }
}

function scheduleBackground(promise: Promise<unknown>) {
  // @ts-ignore EdgeRuntime provided by Supabase
  const ert: any = (globalThis as any).EdgeRuntime;
  if (ert && typeof ert.waitUntil === "function") {
    ert.waitUntil(promise);
  } else {
    promise.catch((e) => console.error("[make-receiver] bg fallback err:", e));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    console.error("DB_INSERT_ERROR: invalid JSON body");
    return json({ success: true, message: "Processed" }, 200);
  }

  console.log("[make-receiver] incoming payload:", JSON.stringify(payload));

  const clientName = sanitizeText(
    payload.clientName ?? payload.name ?? payload.full_name ?? payload.fullName,
    120,
  );
  const sanitizedPhone = sanitizePhone(
    payload.clientPhone ?? payload.phone ?? payload.phone_number ?? payload.mobile,
  );
  const clientEmail = sanitizeText(payload.clientEmail ?? payload.email, 255);
  const sourceRaw = sanitizeText(payload.source, 120) ?? "TikTok";
  const buyingPower = sanitizeText(payload.buyingPower ?? payload.buying_power, 200);

  // Separated TikTok form answers (preferred). Legacy scenarios concatenate all
  // answers into buyingPower; the first Yes/No there is the blacklist answer.
  const blacklistedRaw = sanitizeText(payload.blacklisted ?? payload.is_blacklisted, 60);
  const employedRaw = sanitizeText(payload.employed ?? payload.permanently_employed, 120);
  const licenceRaw = sanitizeText(payload.licence ?? payload.license ?? payload.drivers_licence, 160);

  if (!clientName || !sanitizedPhone) {
    console.error("DB_INSERT_ERROR: missing required fields", { clientName, sanitizedPhone });
    return json({ success: true, message: "Processed" }, 200);
  }

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

  // Track whether the DB step completed without a fatal system crash.
  // Duplicate-key / RLS / validation errors are non-fatal — we still dispatch WhatsApp.
  let dbStepCompleted = false;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // notes / form_answers / is_blacklisted are spread conditionally so a repeat
    // submission (upsert on phone_number) never nulls out data we already have.
    const leadPayload = {
      client_name: clientName,
      client_phone: sanitizedPhone,
      client_email: clientEmail,
      phone_number: sanitizedPhone,
      source: sourceRaw,
      status: "Lead Received",
      platform: "make.com",
      origin: "make_webhook",
      updated_at: new Date().toISOString(),
      ...(notes ? { notes } : {}),
      ...(formAnswers ? { form_answers: formAnswers } : {}),
      ...(isBlacklisted !== null ? { is_blacklisted: isBlacklisted } : {}),
    };

    const { data: upsertData, error: upsertError } = await supabase
      .from("leads")
      .upsert(leadPayload, { onConflict: "phone_number" })
      .select();

    if (upsertError) {
      // Log but DO NOT throw — allow execution to continue.
      console.error("DB_RESPONSE_ERROR:", JSON.stringify(upsertError));
    } else {
      console.log("[make-receiver] upsert ok:", JSON.stringify(upsertData));
    }

    dbStepCompleted = true;
  } catch (error) {
    // Catastrophic failure (e.g. SDK init, network to DB). Swallow & log.
    console.error("DB_INSERT_ERROR:", error);
  }

  // TASK 3: Only dispatch WhatsApp if the DB step did not crash the function.
  if (dbStepCompleted) {
    scheduleBackground(dispatchWhatsAppAfterDelay(sanitizedPhone, clientName));
  } else {
    console.error("[make-receiver] skipping WhatsApp dispatch — DB step crashed");
  }

  return new Response(
    JSON.stringify({ success: true, message: "Processed" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
