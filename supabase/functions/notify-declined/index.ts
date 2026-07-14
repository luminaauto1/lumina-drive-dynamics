// notify-declined — "application declined" WhatsApp to the client.
// Fired on status → declined (hard decline only).
//
// SETTINGS-DRIVEN (2026-07-14): template link from whatsapp_templates key
// 'declined' (Admin → Settings → WhatsApp Templates). No hardcoded ids —
// see _shared/waTemplates.ts.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { sendTemplateByKey } from "../_shared/waTemplates.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { phone_number, client_name } = await req.json();
    if (!phone_number) throw new Error("No phone_number provided.");
    if (!client_name) throw new Error("No client_name provided.");

    const firstName = String(client_name).trim().split(/\s+/)[0] || "Client";
    const r = await sendTemplateByKey("declined", phone_number, {
      name: firstName,
      mobilenumber: String(phone_number),
    });
    console.log("[notify-declined] result:", JSON.stringify(r));

    if ("skipped" in r && r.skipped) {
      return new Response(JSON.stringify({ success: true, skipped: r.skipped }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const rr = r as any;
    return new Response(
      JSON.stringify({ success: rr.sent, status: rr.status, api_response: rr.body, dispatched_url: rr.dispatched_url }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("notify-declined error:", error?.message || error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
