// notify-blacklisted — "blacklisted / bad credit" WhatsApp to the client.
// Fired on status → blacklisted.
//
// SETTINGS-DRIVEN (2026-07-14): template link from whatsapp_templates key
// 'blacklisted' (Admin → Settings → WhatsApp Templates). The pasted URL's own
// query declares the body params — this template has NONE, so no name is sent.
// See _shared/waTemplates.ts.

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

    const firstName = String(client_name ?? "").trim().split(/\s+/)[0] || "Client";
    const r = await sendTemplateByKey("blacklisted", phone_number, {
      name: firstName,
      mobilenumber: String(phone_number),
    });
    console.log("[notify-blacklisted] result:", JSON.stringify(r));

    if ("skipped" in r && r.skipped) {
      return new Response(JSON.stringify({ success: true, skipped: r.skipped }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const rr = r as any;
    return new Response(
      JSON.stringify({ success: rr.sent, status: rr.status, api_response: rr.body, dispatched_url: rr.dispatched_url }),
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
