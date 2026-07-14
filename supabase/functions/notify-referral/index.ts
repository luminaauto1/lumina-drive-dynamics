// notify-referral — welcome WhatsApp to a newly referred person.
// Fired from the public Refer page / referral modal / useReferrals.
//
// SETTINGS-DRIVEN (2026-07-14): template link from whatsapp_templates key
// 'referral' (Admin → Settings → WhatsApp Templates). No hardcoded ids or
// tokens (the old plaintext token constant is gone). Stays unauthenticated —
// the public referral pages call it without the internal key.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendTemplateByKey } from "../_shared/waTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lumina-key, x-supabase-api-version, x-region, x-application-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone_number, client_name } = await req.json();
    if (!phone_number) throw new Error("No phone_number provided.");
    if (!client_name) throw new Error("No client_name provided.");

    const firstName = String(client_name).trim().split(/\s+/)[0] || "Client";
    const r = await sendTemplateByKey("referral", phone_number, {
      name: firstName,
      mobilenumber: String(phone_number),
    });
    console.log("[notify-referral] result:", JSON.stringify(r));

    if ("skipped" in r && r.skipped) {
      return new Response(JSON.stringify({ success: true, skipped: r.skipped }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const rr = r as any;
    return new Response(
      JSON.stringify({ success: rr.sent, status: rr.status, api_response: rr.body }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[notify-referral] error:", error?.message || error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
