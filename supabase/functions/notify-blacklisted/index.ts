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

    // Sanitize phone (mirror notify-app-submitted)
    let sanitizedPhone = String(phone_number).replace(/[\s\-+()]/g, "").replace(/\D/g, "");
    if (sanitizedPhone.startsWith("0")) {
      sanitizedPhone = "27" + sanitizedPhone.substring(1);
    }
    if (sanitizedPhone.length < 8 || sanitizedPhone.length > 15) {
      throw new Error("Invalid phone number");
    }

    const firstName = String(client_name).trim().split(/\s+/)[0] || "Client";

    // Use the SAME working EasySocial token + template route as notify-app-submitted
    const token = "cmoqxck4q0zsyezxpayafg220";
    const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/${token}/19069/4026/API/${sanitizedPhone}?body1=${encodeURIComponent(firstName)}`;
    console.log("Dispatching to EasySocial (blacklisted):", apiUrl);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const rawText = await response.text();
    let responseData: any;
    try { responseData = JSON.parse(rawText); } catch { responseData = { raw: rawText }; }
    console.log("EasySocial Response (blacklisted):", responseData);

    return new Response(
      JSON.stringify({
        success: response.ok && responseData?.success !== false,
        status: response.status,
        api_response: responseData,
        dispatched_url: apiUrl,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("notify-blacklisted error:", error?.message || error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
