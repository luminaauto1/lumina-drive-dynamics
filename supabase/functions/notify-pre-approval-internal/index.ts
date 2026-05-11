// Internal staff WhatsApp alert when an application is moved to "Pre-Approved".
// Mirrors notify-app-submitted's EasySocial template dispatch pattern, but
// fans out to a fixed pair of staff numbers and carries the lead summary in body1.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

const STAFF_NUMBERS = ["27836117792", "27716196071"];

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { client_name, client_phone, fni_notes } = await req.json();

    const time = new Date().toLocaleString("en-ZA", {
      timeZone: "Africa/Johannesburg",
      hour12: false,
    });
    const notesLine = (fni_notes && String(fni_notes).trim().length > 0)
      ? String(fni_notes).trim()
      : "None";

    const summary =
      `Pre-Approval Alert\n` +
      `Lead: ${client_name || "Unknown"}\n` +
      `Number: ${client_phone || "N/A"}\n` +
      `Time: ${time}\n` +
      `F&I Notes: ${notesLine}`;

    // EasySocial template config — defaults to the same template family as
    // notify-app-submitted; override via env if a dedicated internal-alert
    // template is provisioned later.
    const templateId = Deno.env.get("EASYSOCIAL_INTERNAL_TEMPLATE_ID") || "19069";
    const accountId  = Deno.env.get("EASYSOCIAL_ACCOUNT_ID") || "4026";
    const documentedToken = "cmoqxck4q0zsyezxpayafg220";
    const envToken = Deno.env.get("EASYSOCIAL_API_KEY")?.trim();
    const tokens = [...new Set([documentedToken, envToken].filter(Boolean))];

    const results: any[] = [];
    for (const phone of STAFF_NUMBERS) {
      let last: any = { phone, ok: false };
      for (const token of tokens) {
        const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/${token}/${templateId}/${accountId}/API/${phone}?body1=${encodeURIComponent(summary)}`;
        console.log("[notify-pre-approval-internal] →", phone, apiUrl);
        const resp = await fetch(apiUrl, { headers: { Accept: "application/json" } });
        const raw = await resp.text();
        let body: any;
        try { body = JSON.parse(raw); } catch { body = { raw }; }
        last = { phone, status: resp.status, body, url: apiUrl, ok: resp.ok && body?.success !== false };
        if (last.ok) break;
      }
      results.push(last);
    }

    const allOk = results.every(r => r.ok);
    return new Response(
      JSON.stringify({ success: allOk, results, summary }),
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
