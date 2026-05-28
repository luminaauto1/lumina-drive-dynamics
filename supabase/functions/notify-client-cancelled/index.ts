import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/publicGuard.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    let { application_id, phone_number, client_name } = body;

    if (!phone_number && application_id) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data } = await supabase.from('finance_applications').select('phone, full_name').eq('id', application_id).maybeSingle();
        if (data) { phone_number = data.phone; client_name = data.full_name; }
    }

    if (!phone_number) throw new Error("No phone number");
    let cleanPhone = String(phone_number).replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = `27${cleanPhone.slice(1)}`;

    const firstName = client_name ? String(client_name).trim().split(/\s+/)[0] : "there";
    const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/cmpp930hx0ciqbvxp4exrg7t4/19768/4026/API/${cleanPhone}?body1=${encodeURIComponent(firstName)}`;

    const apiKey = Deno.env.get("EASYSOCIAL_API_KEY") || Deno.env.get("EASYSOCIAL_BEARER_TOKEN") || "";
    const resp = await fetch(apiUrl, { headers: { "Accept": "application/json", "Authorization": `Bearer ${apiKey}` } });

    return new Response(JSON.stringify({ success: true, response: await resp.text() }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
