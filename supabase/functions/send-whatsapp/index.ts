import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone } = await req.json();
    if (!phone) throw new Error("No phone number provided.");

    // Clean the phone number: remove all non-numeric characters (including +)
    let cleanPhone = phone.replace(/\D/g, '');

    // Auto-format for South Africa: If the user entered a local number starting with '0', replace it with '27'
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '27' + cleanPhone.substring(1);
    }

    const waUrl = `https://api.easysocial.in/api/v1/wa-templates/send/cmoiw52ffaq1eiyxphla895wb/18908/4026/API/${cleanPhone}`;

    // Execute the webhook via backend server
    const response = await fetch(waUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    const responseText = await response.text();

    return new Response(JSON.stringify({ success: true, api_response: responseText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
