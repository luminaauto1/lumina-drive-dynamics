import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealId } = await req.json();

    if (!dealId || typeof dealId !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid deal ID" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(dealId)) {
      return new Response(
        JSON.stringify({ error: "Invalid deal ID format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch deal with minimal data - only what's needed for handover page
    const { data: deal, error } = await supabaseAdmin
      .from("deal_records")
      .select("id, delivery_photos, application_id")
      .eq("id", dealId)
      .maybeSingle();

    if (error || !deal) {
      return new Response(
        JSON.stringify({ error: "Deal not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch only the minimal application info needed
    let clientFirstName = "Valued Client";
    let vehicleInfo = null;

    if (deal.application_id) {
      const { data: app } = await supabaseAdmin
        .from("finance_applications")
        .select("first_name, full_name, vehicle_id")
        .eq("id", deal.application_id)
        .single();

      if (app) {
        clientFirstName = app.first_name || app.full_name?.split(" ")[0] || "Valued Client";

        if (app.vehicle_id) {
          const { data: vehicle } = await supabaseAdmin
            .from("vehicles")
            .select("make, model, year")
            .eq("id", app.vehicle_id)
            .single();

          if (vehicle) {
            vehicleInfo = vehicle;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        id: deal.id,
        delivery_photos: deal.delivery_photos || [],
        client_first_name: clientFirstName,
        vehicle: vehicleInfo,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("get-handover-data error:", msg);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
