// Internal staff WhatsApp alert when an application is moved to "Pre-Approved".
// Uses a dedicated EasySocial template (19513) under campaign cmpdv8f1a06pl78xpgro1gaky,
// fanning the alert out to a fixed pair of staff numbers with body1/body2/body3
// mapped to first name, last name, and client phone respectively.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

const STAFF_NUMBERS = ["27836117792", "27716196071"];

const CAMPAIGN_ID = "cmpdv8f1a06pl78xpgro1gaky";
const TEMPLATE_ID = "19513";
const ACCOUNT_ID = "4026";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { client_name, first_name, last_name, client_phone } = await req.json();

    // Derive first / last name from whichever fields the caller provided.
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

    const b1 = encodeURIComponent(derivedFirst);
    const b2 = encodeURIComponent(derivedLast);
    const b3 = encodeURIComponent(phoneForBody);

    const results: any[] = [];
    for (const phone of STAFF_NUMBERS) {
      const apiUrl =
        `https://api.easysocial.in/api/v1/wa-templates/send/${CAMPAIGN_ID}/${TEMPLATE_ID}/${ACCOUNT_ID}/API/${phone}` +
        `?body1=${b1}&body2=${b2}&body3=${b3}`;
      console.log("[notify-pre-approval-internal] →", phone, apiUrl);
      const resp = await fetch(apiUrl, { headers: { Accept: "application/json" } });
      const raw = await resp.text();
      let body: any;
      try { body = JSON.parse(raw); } catch { body = { raw }; }
      results.push({
        phone,
        status: resp.status,
        body,
        url: apiUrl,
        ok: resp.ok && body?.success !== false,
      });
    }

    const allOk = results.every((r) => r.ok);
    return new Response(
      JSON.stringify({
        success: allOk,
        results,
        payload: { body1: derivedFirst, body2: derivedLast, body3: phoneForBody },
      }),
      { status: allOk ? 200 : 207, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("notify-pre-approval-internal error:", error?.message || error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
