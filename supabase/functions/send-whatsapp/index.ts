import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { phone } = await req.json();
    if (!phone) throw new Error("No phone number provided.");

    // Clean the phone number: remove all non-numeric characters (including +)
    let cleanPhone = phone.replace(/\D/g, '');

    // Auto-format for South Africa: If the user entered a local number starting with '0', replace it with '27'
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '27' + cleanPhone.substring(1);
    }

    // Basic sanity check
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      throw new Error("Invalid phone number");
    }

    // EasySocial token now stored as a Supabase secret (no longer hardcoded)
    const easysocialToken = Deno.env.get("EASYSOCIAL_API_KEY");
    if (!easysocialToken) {
      throw new Error("EasySocial API key not configured");
    }

    const waUrl = `https://api.easysocial.in/api/v1/wa-templates/send/${easysocialToken}/18908/4026/API/${cleanPhone}`;

    const response = await fetch(waUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    const responseText = await response.text();

    return new Response(JSON.stringify({ success: true, api_response: responseText }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
