// TikTok Lead Generation webhook.
// GET  -> verification: echo back ?challenge=<token> (after verifying secret).
// POST -> ingest lead payload, insert into public.leads (source = 'TikTok').
//
// Security: TikTok's verification secret is checked on every request via:
//   - ?verify_token=... (TikTok-style challenge handshake), or
//   - X-Verify-Token / X-Tiktok-Signature header on POST.
// We do NOT use Supabase Auth here — this is a public webhook.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VERIFY_TOKEN = "mrJ1tlZfXp9rqt9zPmQ9znfEParwfxCO";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-verify-token, x-tiktok-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sanitizePhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 20) return null;
  return digits;
};

const sanitizeText = (raw: unknown, max = 500): string | null => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.slice(0, max);
};

const tokenFromRequest = (req: Request, url: URL): string => {
  return (
    url.searchParams.get("verify_token") ||
    url.searchParams.get("hub.verify_token") ||
    req.headers.get("x-verify-token") ||
    req.headers.get("x-tiktok-signature") ||
    ""
  );
};

// TikTok Lead form payloads vary by integration. We walk the object and pick
// the first plausible value for each canonical field. This handles both
// flat payloads and the standard `field_data: [{name, values: []}]` shape.
const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "full_name", "full name", "client_name", "first_name", "lead_name"],
  phone: ["phone", "phone_number", "mobile", "mobile_number", "cell", "contact_number"],
  email: ["email", "email_address", "e-mail"],
  qualification: [
    "bank_qualification",
    "qualification",
    "buying_power",
    "buying power",
    "approved_amount",
    "loan_amount",
    "budget",
  ],
};

const matchAlias = (key: string, aliases: string[]) => {
  const k = key.toLowerCase().trim();
  return aliases.some((a) => k === a || k.includes(a));
};

function extractFields(payload: any) {
  const out: Record<string, string | null> = {
    name: null,
    phone: null,
    email: null,
    qualification: null,
  };

  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;

    // field_data: [{ name, values: [..] }] (Meta/TikTok lead-ads style)
    if (Array.isArray(node.field_data)) {
      for (const f of node.field_data) {
        const fname = String(f?.name ?? "").toLowerCase();
        const fval = Array.isArray(f?.values) ? f.values[0] : f?.value;
        for (const [canon, aliases] of Object.entries(FIELD_ALIASES)) {
          if (!out[canon] && matchAlias(fname, aliases)) out[canon] = fval ?? null;
        }
      }
    }

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === "object") {
        visit(v);
        continue;
      }
      for (const [canon, aliases] of Object.entries(FIELD_ALIASES)) {
        if (!out[canon] && matchAlias(k, aliases) && (typeof v === "string" || typeof v === "number")) {
          out[canon] = String(v);
        }
      }
    }
  };

  visit(payload);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  // ── 1. VERIFICATION HANDSHAKE ────────────────────────────────────────────
  if (req.method === "GET") {
    const provided = tokenFromRequest(req, url);
    const challenge =
      url.searchParams.get("challenge") ||
      url.searchParams.get("hub.challenge") ||
      "";

    if (provided !== VERIFY_TOKEN) {
      console.warn("[tiktok-webhook] verification failed: bad token");
      return json({ error: "Forbidden" }, 403);
    }

    // Echo the challenge back as plain text (TikTok/Meta style).
    return new Response(challenge, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  // ── 2. LEAD INGESTION ────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  console.log("[tiktok-webhook] payload received:", JSON.stringify(payload).slice(0, 2000));

  const fields = extractFields(payload);
  const name = sanitizeText(fields.name, 120);
  const phone = sanitizePhone(fields.phone);
  const email = sanitizeText(fields.email, 255);
  const qualification = sanitizeText(fields.qualification, 200);

  if (!name && !phone && !email) {
    return json({ error: "No usable lead fields found in payload" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const notes = qualification ? `Bank qualification / buying power: ${qualification}` : null;

  const { data, error } = await supabase
    .from("leads")
    .insert({
      source: "TikTok",
      status: "new",
      client_name: name,
      client_phone: phone,
      client_email: email,
      phone_number: phone,
      notes,
      platform: "tiktok",
      origin: "tiktok_lead_ad",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[tiktok-webhook] insert failed:", error);
    return json({ error: error.message }, 500);
  }

  console.log("[tiktok-webhook] lead inserted:", data?.id);
  return json({ ok: true, lead_id: data?.id });
});
