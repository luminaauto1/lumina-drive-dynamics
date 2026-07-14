// notify-client-cancelled — "sorry to see you go" WhatsApp to the client.
// Fired on status → client_cancelled (frontend sends application_id only;
// phone/name are fetched here).
//
// SETTINGS-DRIVEN (2026-07-14): template link from whatsapp_templates key
// 'client_cancelled' (Admin → Settings → WhatsApp Templates). Also hardened:
// now carries the same x-lumina-key guard as its siblings and reports the REAL
// send outcome instead of a blanket success. See _shared/waTemplates.ts.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { sendTemplateByKey } from "../_shared/waTemplates.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    let { application_id, phone_number, client_name } = body;

    // Failsafe: if frontend didn't send phone, fetch it from the application.
    if (!phone_number && application_id) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data } = await supabase.from("finance_applications").select("*").eq("id", application_id).maybeSingle();
      if (data) {
        phone_number = data.phone || data.client_phone || data.phone_number || data.mobile;
        client_name = data.full_name || data.client_name || data.first_name || data.name;
      }
    }
    if (!phone_number) throw new Error("Could not find phone number in payload or database.");

    const firstName = client_name ? String(client_name).trim().split(/\s+/)[0] : "Client";
    const r = await sendTemplateByKey("client_cancelled", phone_number, {
      name: firstName,
      mobilenumber: String(phone_number),
    });
    console.log("[notify-client-cancelled] result:", JSON.stringify(r));

    if ("skipped" in r && r.skipped) {
      return new Response(JSON.stringify({ success: true, skipped: r.skipped }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const rr = r as any;
    return new Response(
      JSON.stringify({ success: rr.sent, status: rr.status, api_response: rr.body, dispatched_url: rr.dispatched_url }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
