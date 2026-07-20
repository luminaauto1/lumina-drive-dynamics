// Consolidated TikTok webhook:
//   1. Capture the raw delivery verbatim (before parsing anything)
//   2. Verify TikTok's x-open-signature HMAC — shadow mode, not enforced
//   3. Parse the lead out of entry[].changes
//   4. Insert into `leads` (source = 'TikTok'), or enrich an existing row
//   5. Background: wait 10s, then dispatch EasySocial WhatsApp template
//
// Deployed with verify_jwt = false (TikTok cannot send Supabase JWTs).
//
// REAL PAYLOAD SHAPE (captured from a live delivery 2026-07-20 — not inferred):
//   { request_id, object, time, entry: [ {
//       id,                      <- lead id, used as the dedupe key
//       page_id, page_name, advertiser_id, advertiser_name,
//       campaign_id, campaign_name, adgroup_id, adgroup_name, ad_id, ad_name,
//       library_id, lead_source: "INSTANT_FORM", create_time,
//       changes: [ { field, value }, ... ]   <- the answers, inline
//   } ] }
//
// The answers arrive IN the webhook. There is no follow-up fetch, and no
// endpoint that turns a lead_id back into its answers — do not build one.
//
// This file previously looked for answers under data.form_data / field_data and
// read labels from record.name/key/field_name/question/label. TikTok uses
// entry[].changes with a `field` key and sends first_name/last_name separately,
// so every delivery was rejected with HTTP 400 and TikTok retried into the void.
// Fixed 2026-07-20; see supabase/migrations/20260720220000_tiktok_raw_events.sql.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getWaTemplate, buildWaSendUrl } from "../_shared/waTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-verify-token, x-tiktok-signature, x-open-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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

const svc = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

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

const yesNo = (raw: unknown): boolean | null => {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (/^yes\b/i.test(value)) return true;
  if (/^no\b/i.test(value)) return false;
  return null;
};

// TikTok ids (e.g. 7664713983311741191) exceed 2^53, so a plain JSON.parse
// silently rounds them to ...741000 — corrupting the dedupe key and every id
// you'd cross-reference against TikTok's console. Quote them before parsing.
const bigintSafe = (s: string): string =>
  s.replace(
    /"(id|lead_id|request_id|page_id|advertiser_id|library_id|campaign_id|adgroup_id|ad_id)"\s*:\s*(\d{16,})/g,
    '"$1":"$2"',
  );

// Custom questions arrive with the question TEXT as the field name, so these
// match on substrings. Anything unmatched still lands in form_answers verbatim.
const QUESTION_ALIASES: Record<string, string[]> = {
  blacklisted: ["blacklist", "debt review", "under debt", "underdebt", "judgement", "judgment"],
  licence: ["licence", "license"],
  employed: ["employed", "employment", "permanent", "job"],
  income: ["earn", "income", "salary", "payslip", "per month", "pm"],
  buyingPower: ["buying power", "bank qualification", "qualification", "approved amount", "budget", "deposit"],
};
const STANDARD_FIELDS = new Set([
  "first_name", "last_name", "name", "full_name", "phone_number", "phone", "tel",
  "email", "email_address", "city", "province", "region", "postcode", "zip_code",
]);

interface ParsedEntry {
  name: string | null;
  phone: string | null;
  email: string | null;
  answers: Record<string, string>;
  blacklisted: string | null;
  licence: string | null;
  employed: string | null;
  income: string | null;
  buyingPower: string | null;
}

function parseEntry(entry: any): ParsedEntry {
  const answers: Record<string, string> = {};
  const byField = new Map<string, string>();
  for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
    const field = sanitizeText(change?.field, 200);
    const value = sanitizeText(change?.value, 500);
    if (!field || !value) continue;
    answers[field] = value;
    byField.set(field.toLowerCase().trim(), value);
  }

  const get = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = byField.get(k);
      if (v) return v;
    }
    return null;
  };

  // TikTok sends first_name / last_name separately — there is no `name` field.
  const first = get("first_name", "firstname", "given_name");
  const last = get("last_name", "lastname", "surname", "family_name");
  const joined = [first, last].filter(Boolean).join(" ").trim();
  const name = joined || get("name", "full_name", "fullname");

  const qualified: Record<string, string | null> = {
    blacklisted: null, licence: null, employed: null, income: null, buyingPower: null,
  };
  for (const [field, value] of byField.entries()) {
    if (STANDARD_FIELDS.has(field)) continue;
    for (const [canonical, needles] of Object.entries(QUESTION_ALIASES)) {
      if (qualified[canonical]) continue;
      if (needles.some((n) => field.includes(n))) {
        qualified[canonical] = value;
        break;
      }
    }
  }

  return {
    name,
    phone: get("phone_number", "phone", "tel", "mobile", "mobile_number", "cell"),
    email: get("email", "email_address", "e-mail"),
    answers,
    ...qualified,
  } as ParsedEntry;
}

// TikTok's Instant Page preview "Test form → Submit" sends campaign_id 0 and
// "test lead: dummy data..." names. Never let those into the pipeline by default.
const isTestLead = (entry: any): boolean => {
  const campaignId = String(entry?.campaign_id ?? "");
  const names = [entry?.campaign_name, entry?.adgroup_name, entry?.ad_name]
    .map((s) => String(s ?? "").toLowerCase());
  return (campaignId === "0" || campaignId === "") && names.some((n) => n.includes("test lead"));
};

// DB-backed switch so an end-to-end test can be run without touching Supabase
// secrets: integration_settings.key='tiktok_api' -> config.allow_test_leads.
// TURN IT OFF AFTERWARDS. Env var TIKTOK_ALLOW_TEST_LEADS overrides.
async function allowTestLeads(supabase: any): Promise<boolean> {
  if (String(Deno.env.get("TIKTOK_ALLOW_TEST_LEADS") ?? "").toLowerCase() === "true") return true;
  try {
    const { data } = await supabase
      .from("integration_settings").select("config").eq("key", "tiktok_api").maybeSingle();
    return String(data?.config?.allow_test_leads ?? "").toLowerCase() === "true";
  } catch (e) {
    console.error("[tiktok-receiver] allow_test_leads lookup failed:", e);
    return false;
  }
}

// ---- signature verification (SHADOW MODE) ----------------------------------
// TikTok signs every delivery: x-open-signature (64 hex) with a companion
// x-open-signature-type: HMAC-SHA256, keyed on the app secret. Confirmed
// against live deliveries (sig_ok = true, variant "raw").
const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}
// TikTok signs an escaped-unicode form of the payload. Byte-identical to the
// raw body for ASCII, so the difference only appears on accented answers.
const escapeUnicode = (s: string) =>
  s.replace(/[^\x00-\x7F]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

const constantTimeEq = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

async function checkOpenSignature(req: Request, bodyText: string) {
  const got = (req.headers.get("x-open-signature") || "").trim().toLowerCase();
  const secret = Deno.env.get("TIKTOK_APP_SECRET") || "";
  if (!got) return { present: false, ok: null as boolean | null, variant: null as string | null };
  if (!secret) return { present: true, ok: null as boolean | null, variant: "no_secret_configured" };
  for (const [variant, message] of [["raw", bodyText], ["escaped_unicode", escapeUnicode(bodyText)]]) {
    try {
      if (constantTimeEq(await hmacSha256Hex(secret, message), got)) {
        return { present: true, ok: true, variant };
      }
    } catch (e) {
      console.error("[tiktok-receiver] hmac compute failed:", variant, e);
    }
  }
  return { present: true, ok: false, variant: null as string | null };
}
// ---------------------------------------------------------------------------

async function dispatchWhatsAppAfterDelay(sanitizedNumber: string, clientName: string | null) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const tpl = await getWaTemplate(WELCOME_TEMPLATE_KEY);
    if (!tpl || tpl.active === false) {
      console.log("[tiktok-receiver] welcome skipped — template missing/inactive:", WELCOME_TEMPLATE_KEY);
      return;
    }
    const url = buildWaSendUrl(tpl.send_url, sanitizedNumber, {
      name: clientName || "there",
      mobilenumber: sanitizedNumber,
    });
    if (!url) {
      console.log("[tiktok-receiver] welcome skipped — no send_url on", WELCOME_TEMPLATE_KEY);
      return;
    }
    console.log("[tiktok-receiver] dispatching WhatsApp →", url);
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
    const text = await res.text();
    console.log("[tiktok-receiver] EasySocial status:", res.status, "body:", text.slice(0, 500));
  } catch (err) {
    console.error("[tiktok-receiver] background dispatch failed:", err);
  }
}

function scheduleBackground(promise: Promise<unknown>) {
  const ert = (globalThis as any).EdgeRuntime;
  if (ert && typeof ert.waitUntil === "function") {
    ert.waitUntil(promise);
  } else {
    promise.catch((e) => console.error("[tiktok-receiver] bg fallback err:", e));
  }
}

// Returns the row id, or null on HARD FAILURE — the caller must then return 500
// so TikTok retries, rather than acknowledging a lead that was never stored.
async function captureRaw(
  req: Request, url: URL, bodyText: string | null, bodyJson: unknown, note: string | null,
): Promise<string | null> {
  try {
    const { data, error } = await svc().from("tiktok_raw_events").insert({
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      query: Object.fromEntries(url.searchParams.entries()),
      body_text: bodyText,
      body_json: bodyJson,
      note: note ?? null,
    }).select("id").maybeSingle();
    if (error) {
      console.error("[tiktok-receiver] raw capture insert failed:", error);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error("[tiktok-receiver] raw capture threw:", e);
    return null;
  }
}

async function markRaw(rawId: string | null, patch: Record<string, unknown>) {
  if (!rawId) return;
  try {
    await svc().from("tiktok_raw_events").update(patch).eq("id", rawId);
  } catch (e) {
    console.error("[tiktok-receiver] raw mark failed:", e);
  }
}

async function handleEntry(supabase: any, entry: any, allowTest: boolean) {
  const leadKey = sanitizeText(entry?.id ?? entry?.lead_id, 200);
  const parsed = parseEntry(entry);
  const clientName = sanitizeText(parsed.name, 120);
  const clientPhone = sanitizePhone(parsed.phone);
  const clientEmail = sanitizeText(parsed.email, 255);

  if (!clientName || !clientPhone) {
    console.log("[tiktok-receiver] entry missing name/phone", leadKey, Object.keys(parsed.answers));
    return { lead_key: leadKey, status: "unparsed", fields: Object.keys(parsed.answers) };
  }

  const noteParts: string[] = [];
  if (parsed.blacklisted) noteParts.push(`Blacklisted/debt review: ${parsed.blacklisted}`);
  if (parsed.employed) noteParts.push(`Employed: ${parsed.employed}`);
  if (parsed.income) noteParts.push(`Income: ${parsed.income}`);
  if (parsed.licence) noteParts.push(`Licence: ${parsed.licence}`);
  if (parsed.buyingPower) noteParts.push(`Buying power: ${parsed.buyingPower}`);
  const notes = noteParts.length ? noteParts.join(" | ") : null;
  const isBlacklisted = yesNo(parsed.blacklisted);

  const testLead = isTestLead(entry);
  if (testLead && !allowTest) {
    console.log("[tiktok-receiver] TEST lead parsed OK, not written to leads:", clientName, clientPhone);
    return {
      lead_key: leadKey,
      status: "test_lead_parsed_not_saved",
      parsed: { name: clientName, phone: clientPhone, email: clientEmail, notes, is_blacklisted: isBlacklisted, answers: parsed.answers },
    };
  }
  // While testing, force the welcome even on the enrich branch (normally silent)
  // so the whole chain can be observed on a number already in the pipeline.
  const forceWelcome = testLead && allowTest;

  if (leadKey) {
    const { error: dupErr } = await supabase
      .from("webhook_events").insert({ event_id: `tt:${leadKey}`, source: "tiktok" });
    if (dupErr && dupErr.code === "23505") {
      console.log("[tiktok-receiver] duplicate lead ignored", leadKey);
      return { lead_key: leadKey, status: "duplicate" };
    }
  }

  const enrich: Record<string, unknown> = {
    client_email: clientEmail,
    updated_at: new Date().toISOString(),
    ...(notes ? { notes } : {}),
    form_answers: parsed.answers,
    ...(isBlacklisted !== null ? { is_blacklisted: isBlacklisted } : {}),
  };
  for (const k of Object.keys(enrich)) if (enrich[k] === null) delete enrich[k];

  // `leads` is UNIQUE on phone_number. A blind upsert would reset a returning
  // customer's name, status and origin — enrich the existing row instead, and
  // stay quiet, because they are already in the pipeline.
  const { data: existingRows } = await supabase
    .from("leads").select("id, client_name, status").eq("phone_number", clientPhone).limit(1);
  const existing = Array.isArray(existingRows) && existingRows[0] ? existingRows[0] : null;

  if (existing) {
    const { error } = await supabase.from("leads").update(enrich).eq("id", existing.id);
    if (error) {
      console.error("[tiktok-receiver] enrich failed:", error);
      return { lead_key: leadKey, status: "db_error", detail: error.message };
    }
    if (forceWelcome) {
      console.log("[tiktok-receiver] TEST: forcing welcome on enrich path →", clientPhone);
      scheduleBackground(dispatchWhatsAppAfterDelay(clientPhone, clientName));
    } else {
      console.log("[tiktok-receiver] enriched existing lead", existing.id, "- no welcome sent");
    }
    return { lead_key: leadKey, status: "enriched_existing", lead_id: existing.id, welcome_sent: !!forceWelcome };
  }

  const { data, error } = await supabase.from("leads").insert({
    client_name: clientName,
    client_phone: clientPhone,
    phone_number: clientPhone,
    source: "TikTok",
    status: "new",
    platform: "tiktok",
    origin: testLead ? "tiktok_lead_ad_test" : "tiktok_lead_ad",
    ...enrich,
  }).select("id").maybeSingle();
  if (error) {
    console.error("[tiktok-receiver] insert failed:", error);
    return { lead_key: leadKey, status: "db_error", detail: error.message };
  }
  scheduleBackground(dispatchWhatsAppAfterDelay(clientPhone, clientName));
  return { lead_key: leadKey, status: "saved", lead_id: data?.id ?? null, welcome_sent: true };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method === "GET") {
    const expected = Deno.env.get("TIKTOK_VERIFY_TOKEN") || "";
    const token = url.searchParams.get("verify_token") ||
      url.searchParams.get("hub.verify_token") ||
      req.headers.get("x-verify-token") ||
      req.headers.get("x-tiktok-signature") || "";
    const challenge = url.searchParams.get("challenge") || url.searchParams.get("hub.challenge") || "";
    scheduleBackground(captureRaw(req, url, null, null, "GET verification probe"));
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
  // No legitimate TikTok delivery approaches this.
  if (Number(req.headers.get("content-length") || "0") > 1_000_000) {
    return json({ error: "payload too large" }, 413);
  }

  const bodyText = await req.text();
  console.log("[tiktok-receiver] RAW BODY:", bodyText.slice(0, 4000));

  const sig = await checkOpenSignature(req, bodyText);
  console.log("[tiktok-receiver] signature:", JSON.stringify(sig));

  let payload: any = null;
  let parseNote: string | null = null;
  try {
    payload = JSON.parse(bigintSafe(bodyText));
  } catch (e) {
    parseNote = `json_parse_failed: ${String(e).slice(0, 200)}`;
  }

  const rawId = await captureRaw(req, url, bodyText, payload, parseNote);
  if (!rawId) {
    // Never acknowledge a delivery we failed to store — let TikTok retry.
    console.error("[tiktok-receiver] capture failed, returning 500 so TikTok retries");
    return json({ error: "capture failed" }, 500);
  }
  await markRaw(rawId, { sig_ok: sig.ok, sig_variant: sig.variant });

  // ENFORCEMENT — deliberately disabled. Enable only once sig_ok is uniformly
  // true across real deliveries, including at least one with a non-ASCII answer.
  // The check must stay AFTER captureRaw so a wrong or rotated secret can never
  // destroy the evidence — the raw rows remain replayable.
  // if (sig.present && sig.ok === false) return json({ error: "bad signature" }, 401);

  if (!payload) {
    return json({ success: true, captured: true, raw_id: rawId, note: "body captured but not valid JSON" }, 200);
  }
  if (payload.challenge) {
    await markRaw(rawId, { note: "challenge handshake" });
    return json({ challenge: payload.challenge }, 200);
  }

  const supabase = svc();
  const allowTest = await allowTestLeads(supabase);

  // TikTok batches leads in `entry`. Fall back to treating the body as a single
  // lead so a future shape change degrades instead of throwing.
  const entries = Array.isArray(payload.entry) && payload.entry.length
    ? payload.entry
    : [payload.data ?? payload];

  const results: any[] = [];
  for (const entry of entries) {
    try {
      results.push(await handleEntry(supabase, entry, allowTest));
    } catch (e) {
      console.error("[tiktok-receiver] entry handling threw:", e);
      results.push({ status: "error", detail: String(e).slice(0, 300) });
    }
  }

  const anySaved = results.some((r) => r.status === "saved" || r.status === "enriched_existing");
  const anyParsed = anySaved ||
    results.some((r) => r.status === "test_lead_parsed_not_saved" || r.status === "duplicate");
  await markRaw(rawId, {
    parsed: anyParsed,
    lead_id: results.map((r) => r.lead_key).filter(Boolean).join(",") || null,
    note: results.map((r) => r.status).join(",").slice(0, 300),
  });

  return json({ success: true, raw_id: rawId, results }, 200);
});
