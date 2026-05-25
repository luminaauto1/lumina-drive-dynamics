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

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ success: true, message: "Processed" }, 200);
  }

  const clientName = sanitizeText(payload.clientName, 120);
  const clientPhone = sanitizePhone(payload.clientPhone);
  const buyingPower = sanitizeText(payload.buyingPower, 200);

  if (!clientName || !clientPhone) {
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
      phone_number: clientPhone,
      source: "Make.com Integration",
      status: "Lead/Inquiry",
      notes,
      platform: "make.com",
      origin: "make_webhook",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("leads")
      .upsert(leadPayload, { onConflict: "phone_number" });

    if (error) {
      console.error("DB Error:", error);
    }
  } catch (error) {
    console.error("DB Error:", error);
  }

  return new Response(
    JSON.stringify({ success: true, message: "Processed" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
