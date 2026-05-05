import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { phone_number, client_name } = await req.json();
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

    // EasySocial logs showed the env token returning 404, so dispatch with the
    // documented Lumina account token first and only use env as a secondary retry.
    const documentedToken = "cmoqxck4q0zsyezxpayafg220";
    const envToken = Deno.env.get("EASYSOCIAL_API_KEY")?.trim();
    const tokens = [...new Set([documentedToken, envToken].filter(Boolean))];

    let responseStatus = 0;
    let responseData: any = null;
    let dispatchedUrl = "";

    for (const token of tokens) {
      const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/${token}/19069/4026/API/${sanitizedPhone}?body1=${encodeURIComponent(firstName)}`;
      dispatchedUrl = apiUrl;
      console.log("Dispatching to EasySocial:", apiUrl);

      const response = await fetch(apiUrl, {
        method: "POST",
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
