import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

// Strip non-digits; convert local 0xxxxxxxxx -> 27xxxxxxxxx (ZA)
const sanitizePhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  let cleaned = String(raw).replace(/\D/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("0")) cleaned = "27" + cleaned.slice(1);
  if (cleaned.length < 10 || cleaned.length > 15) return null;
  return cleaned;
};

async function dispatchWhatsAppAfterDelay(sanitizedNumber: string) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const url = `${EASYSOCIAL_TEMPLATE_BASE}/${sanitizedNumber}?body1=1`;
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

  // TASK 3: Only dispatch WhatsApp if the DB step did not crash the function.
  if (dbStepCompleted) {
    scheduleBackground(dispatchWhatsAppAfterDelay(sanitizedPhone));
  } else {
    console.error("[make-receiver] skipping WhatsApp dispatch — DB step crashed");
  }

  return new Response(
    JSON.stringify({ success: true, message: "Processed" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
