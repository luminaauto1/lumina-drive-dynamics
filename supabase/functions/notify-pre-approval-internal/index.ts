import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

const STAFF_NUMBERS = ["27836117792", "27716196071"];

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { client_name, first_name, last_name, client_phone, bank_reference_code } = await req.json();
    const derivedFirst = first_name || (client_name ? client_name.split(/\s+/)[0] : "Unknown");
    const derivedLast = last_name || (client_name ? client_name.split(/\s+/).slice(1).join(" ") : "-");

    const b1 = encodeURIComponent(derivedFirst);
    const b2 = encodeURIComponent(derivedLast);
    const b3 = encodeURIComponent(client_phone || "N/A");
    const b4 = encodeURIComponent(bank_reference_code || "No Ref Code");

    const apiKey = Deno.env.get("EASYSOCIAL_API_KEY") || Deno.env.get("EASYSOCIAL_BEARER_TOKEN") || "";

    const promises = STAFF_NUMBERS.map(async (phone) => {
      const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/cmpdv8f1a06pl78xpgro1gaky/19513/4026/API/${phone}?body1=${b1}&body2=${b2}&body3=${b3}&body4=${b4}`;
      return fetch(apiUrl, { headers: { "Accept": "application/json", "Authorization": `Bearer ${apiKey}` } });
    });

    await Promise.all(promises);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
