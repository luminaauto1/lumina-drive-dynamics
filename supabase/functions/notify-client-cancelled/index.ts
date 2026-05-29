import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/publicGuard.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    let { application_id, phone_number, client_phone, client_name, full_name } = body;

    let finalPhone = phone_number || client_phone;
    let finalName = client_name || full_name;

    // If phone wasn't passed in the request body, fetch the entire row from the DB
    if (!finalPhone && application_id) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data, error } = await supabase.from('finance_applications').select('*').eq('id', application_id).maybeSingle();
        
        if (data) {
            // Intelligently check all possible column names for the phone number and name
            finalPhone = data.client_phone || data.phone_number || data.phone || data.mobile;
            finalName = data.client_name || data.full_name || data.first_name || data.name;
        }
    }

    if (!finalPhone) throw new Error("No phone number could be found in the payload or database.");

    // Sanitize and format for South Africa (+27)
    let sanitizedPhone = String(finalPhone).replace(/[\s\-+()]/g, "").replace(/\D/g, "");
    if (sanitizedPhone.startsWith("0")) sanitizedPhone = "27" + sanitizedPhone.substring(1);

    // Extract first name
    const firstName = finalName ? String(finalName).trim().split(/\s+/)[0] : "Client";
    
    // The exact API endpoint
    const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/cmpp930hx0ciqbvxp4exrg7t4/19768/4026/API/${sanitizedPhone}?body1=${encodeURIComponent(firstName)}`;
    
    console.log("Dispatching to EasySocial:", apiUrl);

    // Execute GET request
    const response = await fetch(apiUrl, { method: "GET", headers: { Accept: "application/json" } });
    const rawText = await response.text();
    
    console.log("EasySocial Response:", rawText);

    return new Response(JSON.stringify({ success: response.ok, response: rawText, dispatched_url: apiUrl }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("notify-client-cancelled error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
