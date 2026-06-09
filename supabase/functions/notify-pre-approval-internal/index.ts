import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

const STAFF_NUMBERS = ["27836117792", "27716196071"];
const CAMPAIGN_ID = "cmq6u7szu234vhfxp8s1c7igi";
const TEMPLATE_ID = "20060";
const ACCOUNT_ID = "4026";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { client_name, first_name, last_name, client_phone, bank_reference_code } = await req.json();

    let derivedFirst = (first_name || "").toString().trim();
    let derivedLast = (last_name || "").toString().trim();
    if (!derivedFirst && !derivedLast && client_name) {
      const parts = String(client_name).trim().split(/\s+/);
      derivedFirst = parts.shift() || "";
      derivedLast = parts.join(" ");
    }
    if (!derivedFirst) derivedFirst = "Unknown";
    if (!derivedLast) derivedLast = "-";

    const phoneForBody = (client_phone || "N/A").toString();
    const refCode = bank_reference_code ? String(bank_reference_code).trim() : "No Ref Code";

    const b1 = encodeURIComponent(derivedFirst);
    const b2 = encodeURIComponent(derivedLast);
    const b3 = encodeURIComponent(phoneForBody);
    const b4 = encodeURIComponent(refCode);

    // Parallel execution to prevent sequential blocking
    const dispatchPromises = STAFF_NUMBERS.map(async (phone) => {
      const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/${CAMPAIGN_ID}/${TEMPLATE_ID}/${ACCOUNT_ID}/API/${phone}?body1=${b1}&body2=${encodeURIComponent(phoneForBody)}`;
      try {
        const resp = await fetch(apiUrl, { headers: { Accept: "application/json" } });
        const raw = await resp.text();
        let body;
        try { body = JSON.parse(raw); } catch { body = { raw }; }
        return { phone, status: resp.status, body, ok: resp.ok && body?.success !== false };
      } catch (err: any) {
        return { phone, status: 500, error: err.message, ok: false };
      }
    });

    const results = await Promise.all(dispatchPromises);
    const allOk = results.every((r) => r.ok);

    return new Response(
      JSON.stringify({ success: allOk, results, payload: { body1: derivedFirst, body2: derivedLast, body3: phoneForBody, body4: refCode } }),
      { status: allOk ? 200 : 207, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
