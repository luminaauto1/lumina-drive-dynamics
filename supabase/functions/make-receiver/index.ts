import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

const sanitizePhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 20) return null;
  return digits;
};

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

  // Accept multiple flat key shapes from Make.com / TikTok
  const clientName = sanitizeText(
    payload.clientName ?? payload.name ?? payload.full_name ?? payload.fullName,
    120,
  );
  const clientPhone = sanitizePhone(
    payload.clientPhone ?? payload.phone ?? payload.phone_number ?? payload.mobile,
  );
  const clientEmail = sanitizeText(payload.clientEmail ?? payload.email, 255);
  const sourceRaw = sanitizeText(payload.source, 120) ?? "TikTok";
  const buyingPower = sanitizeText(payload.buyingPower ?? payload.buying_power, 200);

  if (!clientName || !clientPhone) {
    console.error("DB_INSERT_ERROR: missing required fields", { clientName, clientPhone });
    return json({ success: true, message: "Processed" }, 200);
  }

  const notes = buyingPower ? `Bank qualification / buying power: ${buyingPower}` : null;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const leadPayload = {
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail,
      phone_number: clientPhone,
      source: sourceRaw,
      status: "Lead Received",
      notes,
      platform: "make.com",
      origin: "make_webhook",
      updated_at: new Date().toISOString(),
    };

    const { data, error: dbError } = await supabase
      .from("leads")
      .upsert(leadPayload, { onConflict: "phone_number" })
      .select();

    if (dbError) {
      console.error("DB_RESPONSE_ERROR:", JSON.stringify(dbError));
    } else {
      console.log("[make-receiver] upsert ok:", JSON.stringify(data));
    }
  } catch (error) {
    console.error("DB_INSERT_ERROR:", error);
  }

  return new Response(
    JSON.stringify({ success: true, message: "Processed" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
