import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  // Per-notification on/off gate (Admin → Settings → WhatsApp). Fail-open: on error, send.
  try {
    const SU = Deno.env.get("SUPABASE_URL"); const SK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (SU && SK) {
      const gate = await fetch(`${SU}/rest/v1/whatsapp_templates?key=eq.app_submitted&select=active`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
      const rows = await gate.json().catch(() => []);
      if (Array.isArray(rows) && rows[0] && rows[0].active === false) {
        return new Response(JSON.stringify({ success: true, skipped: "disabled" }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
    }
  } catch (_) { /* fail-open */ }

  try {
    const rawBody = await req.json();
    console.log("[notify-app-submitted] incoming payload:", JSON.stringify(rawBody));
    const { phone_number, client_name } = rawBody;
    if (!phone_number) throw new Error("No phone_number provided.");
    if (!client_name) throw new Error("No client_name provided.");

    // Task 1: Sanitize phone number
    let sanitizedPhone = String(phone_number).replace(/[\s\-+()]/g, "").replace(/\D/g, "");
    if (sanitizedPhone.startsWith("0")) {
      sanitizedPhone = "27" + sanitizedPhone.substring(1);
    }
    if (sanitizedPhone.length < 8 || sanitizedPhone.length > 15) {
      throw new Error("Invalid phone number");
    }

    // Task 2: Extract first name + URL-encode
    const firstName = String(client_name).trim().split(/\s+/)[0] || "Client";

    // Hardcoded EasySocial campaign token with env fallback.
    const documentedToken = "cmq54c79e19lik8xp2rr341ge";
    const envToken = Deno.env.get("EASYSOCIAL_API_KEY")?.trim() || "eSt2dc1be4b95a4ccdabf289645ba0bf8ea85c016b5cde84430c3749430fbca43c627fa3b46e9db9fa9fe217aa74136ba";
    const tokens = [...new Set([documentedToken, envToken].filter(Boolean))];

    let responseStatus = 0;
    let responseData: any = null;
    let dispatchedUrl = "";

    for (const token of tokens) {
      const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/${token}/20022/4026/API/${sanitizedPhone}?body1=${encodeURIComponent(firstName)}`;
      dispatchedUrl = apiUrl;
      console.log("Dispatching to EasySocial:", apiUrl);

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      responseStatus = response.status;
      const rawText = await response.text();
      try {
        responseData = JSON.parse(rawText);
      } catch {
        responseData = { raw: rawText };
      }
      console.log("EasySocial Response:", responseData);

      if (response.ok && responseData?.success !== false) break;
    }

    return new Response(
      JSON.stringify({ success: responseStatus >= 200 && responseStatus < 300 && responseData?.success !== false, status: responseStatus, api_response: responseData, dispatched_url: dispatchedUrl }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("notify-app-submitted error:", error?.message || error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
