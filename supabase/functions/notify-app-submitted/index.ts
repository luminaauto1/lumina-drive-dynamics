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

    let cleanPhone = String(phone_number).replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "27" + cleanPhone.substring(1);
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      throw new Error("Invalid phone number");
    }

    const easysocialToken = Deno.env.get("EASYSOCIAL_API_KEY");
    if (!easysocialToken) throw new Error("EasySocial API key not configured");

    // Distinct template (cmoqxck4q0zsyezxpayafg220 / 19069) for "Submitted to Bank"
    const safeName = encodeURIComponent(String(client_name).trim());
    const waUrl = `https://api.easysocial.in/api/v1/wa-templates/send/${easysocialToken}/19069/4026/API/${cleanPhone}?body1=${safeName}`;

    const response = await fetch(waUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const responseText = await response.text();

    return new Response(
      JSON.stringify({ success: true, api_response: responseText }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
