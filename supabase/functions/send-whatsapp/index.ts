// send-whatsapp — legacy "website submit confirmation" WhatsApp (fired from the
// public finance-application form alongside notify-app-submitted).
//
// SETTINGS-DRIVEN (2026-07-14): template link from whatsapp_templates key
// 'website_submit'. That row is seeded INACTIVE with no URL after the WhatsApp
// ban (its old template 18908 is dead and was never recreated) — so this
// function is a no-op until the owner pastes a new link + activates the row in
// Admin → Settings → WhatsApp Templates. The client still gets ONE submit
// message via notify-app-submitted ('app_submitted' template).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { sendTemplateByKey } from "../_shared/waTemplates.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { phone, client_name } = await req.json();
    if (!phone) throw new Error("No phone number provided.");

    const firstName = String(client_name ?? "").trim().split(/\s+/)[0] || "Client";
    const r = await sendTemplateByKey("website_submit", phone, {
      name: firstName,
      mobilenumber: String(phone),
    });
    console.log("[send-whatsapp] result:", JSON.stringify(r));

    if ("skipped" in r && r.skipped) {
      return new Response(JSON.stringify({ success: true, skipped: r.skipped }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const rr = r as any;
    return new Response(
      JSON.stringify({ success: rr.sent, status: rr.status, api_response: rr.body }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
