import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/publicGuard.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Per-notification on/off gate (Admin → Settings → WhatsApp). Fail-open: on error, send.
  try {
    const SU = Deno.env.get("SUPABASE_URL"); const SK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (SU && SK) {
      const gate = await fetch(`${SU}/rest/v1/whatsapp_templates?key=eq.client_cancelled&select=active`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
      const rows = await gate.json().catch(() => []);
      if (Array.isArray(rows) && rows[0] && rows[0].active === false) {
        return new Response(JSON.stringify({ success: true, skipped: "disabled" }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
    }
  } catch (_) { /* fail-open */ }

  try {
    const body = await req.json();
    let { application_id, phone_number, client_name } = body;

    // Failsafe: if frontend didn't send phone, fetch it from database
    if (!phone_number && application_id) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data } = await supabase.from('finance_applications').select('*').eq('id', application_id).maybeSingle();
        if (data) {
            phone_number = data.phone || data.client_phone || data.phone_number || data.mobile;
            client_name = data.full_name || data.client_name || data.first_name || data.name;
        }
    }

    if (!phone_number) throw new Error("Could not find phone number in payload or database.");

    // Format phone for SA (+27)
    let sanitizedPhone = String(phone_number).replace(/[\s\-+()]/g, "").replace(/\D/g, "");
    if (sanitizedPhone.startsWith("0")) sanitizedPhone = "27" + sanitizedPhone.substring(1);

    // Extract first name
    const firstName = client_name ? String(client_name).trim().split(/\s+/)[0] : "Client";

    // EXACT API LINK PROVIDED BY ADMIN
    const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/cmq507pmz2b8ck9xp4rto6u2c/20016/4026/API/${sanitizedPhone}?body1=${encodeURIComponent(firstName)}`;
    
    // Execute pure GET request
    const response = await fetch(apiUrl, { method: "GET" });
    const rawText = await response.text();

    return new Response(JSON.stringify({ success: true, api_response: rawText, dispatched_url: apiUrl }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
