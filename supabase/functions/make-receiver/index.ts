import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

// Strip non-digits; convert local 0xxxxxxxxx -> 27xxxxxxxxx (ZA)
const sanitizePhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  let cleaned = String(raw).replace(/\D/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("0")) cleaned = "27" + cleaned.slice(1);
  if (cleaned.length < 10 || cleaned.length > 15) return null;
  return cleaned;
};

// Send the EasySocial WhatsApp welcome INLINE (awaited before the response) so it
// reliably fires. A previous version deferred this behind a 10s setTimeout in a
// background task — but the edge instance is torn down right after the ~1s response,
// which killed the timer before EasySocial was ever called. Returns a diagnostic
// object so the HTTP response (and Make's history) shows exactly what happened.
async function dispatchWhatsApp(sanitizedNumber: string, clientName: string) {
  const url = `${EASYSOCIAL_TEMPLATE_BASE}/${sanitizedNumber}?body1=${encodeURIComponent(clientName)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    console.log("[make-receiver] dispatching WhatsApp →", url);
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
    const text = await res.text();
    console.log("[make-receiver] EasySocial status:", res.status, "body:", text.slice(0, 500));
    return { sent: res.ok, status: res.status, body: text.slice(0, 300) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[make-receiver] WhatsApp dispatch failed:", msg);
    return { sent: false, error: msg };
  } finally {
    clearTimeout(timer);
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

  if (!clientName || !sanitizedPhone) {
    console.error("DB_INSERT_ERROR: missing required fields", { clientName, sanitizedPhone });
    return json({ success: true, message: "Processed" }, 200);
  }

  const notes = buyingPower ? `Bank qualification / buying power: ${buyingPower}` : null;

  // Track whether the DB step completed without a fatal system crash.
  // Duplicate-key / RLS / validation errors are non-fatal — we still dispatch WhatsApp.
  let dbStepCompleted = false;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const leadPayload = {
      client_name: clientName,
      client_phone: sanitizedPhone,
      client_email: clientEmail,
      phone_number: sanitizedPhone,
      source: sourceRaw,
      status: "Lead Received",
      notes,
      platform: "make.com",
      origin: "make_webhook",
      updated_at: new Date().toISOString(),
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

  // Dispatch WhatsApp inline (awaited) unless the DB step catastrophically crashed.
  let whatsapp: Record<string, unknown> = { sent: false, skipped: "db_crashed" };
  if (dbStepCompleted) {
    whatsapp = await dispatchWhatsApp(sanitizedPhone, clientName);
  } else {
    console.error("[make-receiver] skipping WhatsApp dispatch — DB step crashed");
  }

  return new Response(
    JSON.stringify({ success: true, message: "Processed", whatsapp }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
