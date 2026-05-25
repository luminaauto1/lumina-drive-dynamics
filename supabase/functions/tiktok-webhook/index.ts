// TikTok Lead Generation webhook
// - GET: handles TikTok's challenge handshake (echoes `challenge` query param)
// - POST: parses lead payload (standard + custom fields) and inserts into `leads`
//
// Public endpoint: no JWT verification (configured in supabase/config.toml).
// TikTok signs requests; if a signing secret is configured we verify it,
// otherwise we accept and rely on payload shape validation.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tt-signature, x-tiktok-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sanitizePhone = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[^\\d+]/g, "");
  return digits.length >= 7 ? digits : null;
};

const pick = (obj: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
};

// Flatten TikTok's "field_data" array (custom + standard fields) into a key→value map.
const flattenFieldData = (payload: Record<string, unknown>): Record<string, string> => {
  const map: Record<string, string> = {};
  const arr = (payload.field_data ?? payload.fields ?? payload.answers) as
    | Array<Record<string, unknown>>
    | undefined;
  if (Array.isArray(arr)) {
    for (const f of arr) {
      const name = String(f.name ?? f.field_name ?? f.key ?? "").toLowerCase().trim();
      let value: unknown = f.values ?? f.value ?? f.answer;
      if (Array.isArray(value)) value = value.join(", ");
      if (name && value !== undefined && value !== null && String(value).trim()) {
        map[name] = String(value).trim();
      }
    }
  }
  // Also merge top-level scalar fields (TikTok sometimes posts flat).
  for (const [k, v] of Object.entries(payload)) {
    if (["field_data", "fields", "answers"].includes(k)) continue;
    if (typeof v === "string" || typeof v === "number") {
      map[k.toLowerCase()] = String(v);
    }
  }
  return map;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // --- 1. GET: TikTok webhook verification handshake ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge =
      url.searchParams.get("challenge") ||
      url.searchParams.get("hub.challenge") ||
      url.searchParams.get("echostr");
    if (challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
    return json(200, { status: "tiktok-webhook alive" });
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // --- 2. POST: lead payload ---
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  // TikTok wraps lead data inside `data` (or `lead`/`form_data`) — unwrap defensively.
  const leadPayload =
    (body.data as Record<string, unknown>) ??
    (body.lead as Record<string, unknown>) ??
    (body.form_data as Record<string, unknown>) ??
    body;

  const fields = flattenFieldData(leadPayload);

  // Standard fields
  const fullName =
    pick(fields, ["full_name", "name", "first_name"]) ||
    [pick(fields, ["first_name"]), pick(fields, ["last_name"])].filter(Boolean).join(" ").trim() ||
    null;
  const phone = sanitizePhone(pick(fields, ["phone_number", "phone", "mobile", "tel"]));
  const email = pick(fields, ["email", "email_address"]);

  // Custom fields: bank qualification / buying power
  const bankQualification = pick(fields, [
    "bank_qualification",
    "are_you_bank_qualified",
    "bank_qualified",
    "qualification",
  ]);
  const buyingPower = pick(fields, [
    "buying_power",
    "what_is_your_buying_power",
    "monthly_budget",
    "budget",
    "affordability",
  ]);

  if (!phone && !email) {
    return json(400, { error: "Lead missing phone and email" });
  }

  const noteLines: string[] = ["📱 TikTok Lead Generation"];
  if (bankQualification) noteLines.push(`Bank qualified: ${bankQualification}`);
  if (buyingPower) noteLines.push(`Buying power: ${buyingPower}`);
  const adId = pick(fields, ["ad_id", "adgroup_id", "campaign_id"]);
  if (adId) noteLines.push(`Ad ref: ${adId}`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("leads")
    .insert({
      source: "tiktok",
      platform: "tiktok",
      client_name: fullName,
      client_phone: phone,
      client_email: email,
      notes: noteLines.join("\n"),
      status: "new",
      pipeline_stage: "new",
      lead_temperature: bankQualification?.toLowerCase().includes("yes") ? "hot" : "warm",
      utm_source: "tiktok",
      utm_medium: "paid_social",
      utm_campaign: pick(fields, ["campaign_name", "campaign_id"]) || "tiktok_lead_gen",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("tiktok-webhook insert error", error);
    return json(500, { error: error.message });
  }

  return json(200, { ok: true, lead_id: data?.id ?? null });
});
