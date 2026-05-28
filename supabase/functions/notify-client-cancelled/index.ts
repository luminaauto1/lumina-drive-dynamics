import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/publicGuard.ts";

const CAMPAIGN_ID = "cmpp930hx0ciqbvxp4exrg7t4";
const TEMPLATE_ID = "19768";
const ACCOUNT_ID = "4026";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let body: any = {};
  try { body = await req.json(); } catch { }

  try {
    const { application_id, phone_number, client_name } = body;
    let phone = phone_number;
    let name = client_name;

    if (!phone && application_id) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data } = await supabase.from('finance_applications').select('phone, full_name').eq('id', application_id).maybeSingle();
      if (data) {
        phone = data.phone;
        name = data.full_name;
      }
    }

    if (!phone) {
      return new Response(JSON.stringify({ error: "No phone number found" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    let cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = `27${cleanPhone.slice(1)}`;

    const firstName = name ? String(name).trim().split(/\s+/)[0] : "there";
    const b1 = encodeURIComponent(firstName);

    const apiKey = Deno.env.get("EASYSOCIAL_API_KEY") || Deno.env.get("EASYSOCIAL_BEARER_TOKEN") || "";
    const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/${CAMPAIGN_ID}/${TEMPLATE_ID}/${ACCOUNT_ID}/${apiKey}/${cleanPhone}?body1=${b1}`;

    const resp = await fetch(apiUrl, { headers: { Accept: "application/json" } });
    const raw = await resp.text();

    return new Response(JSON.stringify({ success: true, response: raw }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
