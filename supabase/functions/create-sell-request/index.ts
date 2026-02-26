import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeString(input: string, maxLength: number = 500): string {
  return input.trim().slice(0, maxLength);
}

function validatePhone(phone: string): boolean {
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

function validateName(name: string): boolean {
  return name.trim().length >= 2 && name.length <= 100;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { client_name, client_contact, client_email, vehicle_make, vehicle_model, vehicle_year, vehicle_mileage, desired_price, condition, photos_urls } = body;

    // Validate required fields
    if (!client_name || !client_contact || !vehicle_make || !vehicle_model) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: client_name, client_contact, vehicle_make, vehicle_model" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!validateName(client_name)) {
      return new Response(
        JSON.stringify({ error: "Invalid name (2-100 characters required)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!validatePhone(client_contact)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number (10-15 digits required)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate photos_urls array size
    if (photos_urls && Array.isArray(photos_urls) && photos_urls.length > 20) {
      return new Response(
        JSON.stringify({ error: "Maximum 20 photos allowed" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate photo URLs - only allow Supabase storage URLs
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const validatedPhotoUrls = Array.isArray(photos_urls)
      ? photos_urls
          .slice(0, 20)
          .filter((url: string) => typeof url === "string" && url.startsWith(supabaseUrl + "/storage/"))
      : [];

    const sanitizedData = {
      client_name: sanitizeString(client_name, 100),
      client_contact: sanitizeString(client_contact, 20),
      client_email: client_email ? sanitizeString(client_email, 255) : null,
      vehicle_make: sanitizeString(vehicle_make, 50),
      vehicle_model: sanitizeString(vehicle_model, 100),
      vehicle_year: vehicle_year ? Number(vehicle_year) : null,
      vehicle_mileage: vehicle_mileage ? Number(vehicle_mileage) : null,
      desired_price: desired_price ? Number(desired_price) : null,
      condition: condition ? sanitizeString(condition, 50) : null,
      photos_urls: validatedPhotoUrls,
      status: "new",
    };

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data, error } = await supabaseAdmin
      .from("sell_car_requests")
      .insert(sanitizedData)
      .select("id")
      .single();

    if (error) {
      console.error("Sell request creation failed:", error.message);
      return new Response(
        JSON.stringify({ error: "Failed to submit request" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sell request created: ${data.id}`);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in create-sell-request:", msg);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
