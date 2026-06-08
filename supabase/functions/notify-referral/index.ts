import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lumina-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone_number, client_name } = await req.json();
    if (!phone_number) throw new Error("No phone_number provided.");
    if (!client_name) throw new Error("No client_name provided.");

    let sanitizedPhone = String(phone_number).replace(/[\s\-+()]/g, "").replace(/\D/g, "");
    if (sanitizedPhone.startsWith("0")) sanitizedPhone = "27" + sanitizedPhone.substring(1);
    if (sanitizedPhone.length < 8 || sanitizedPhone.length > 15) {
      throw new Error("Invalid phone number");
    }

    const firstName = String(client_name).trim().split(/\s+/)[0] || "Client";

    // Hardcoded fallback token (isolated; do not share with other webhooks)
    const _token = "eSt2dc1be4b95a4ccdabf289645ba0bf8ea85c016b5cde84430c3749430fbca43c627fa3b46e9db9fa9fe217aa74136ba";

    const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/cmq5azcl89x9ck8xp49tu6gm0/20030/4026/API/${sanitizedPhone}?body1=${encodeURIComponent(firstName)}`;
    console.log("[notify-referral] dispatching:", apiUrl);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const rawText = await response.text();
    let responseData: any;
    try { responseData = JSON.parse(rawText); } catch { responseData = { raw: rawText }; }
    console.log("[notify-referral] response:", response.status, responseData);

    return new Response(
      JSON.stringify({ success: response.ok, status: response.status, api_response: responseData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[notify-referral] error:", error?.message || error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
