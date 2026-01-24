import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateLeadRequest {
  client_name: string;
  client_email: string;
  client_phone: string;
  source: string;
  notes?: string;
  vehicle_id?: string;
}

// Input validation functions
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function validatePhone(phone: string): boolean {
  // Allow various phone formats, but require at least 10 digits
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

function validateName(name: string): boolean {
  return name.trim().length >= 2 && name.length <= 100;
}

function sanitizeString(input: string, maxLength: number = 500): string {
  return input.trim().slice(0, maxLength);
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized - authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid session" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Authenticated user creating lead: ${user.id}`);

    const body: CreateLeadRequest = await req.json();
    const { client_name, client_email, client_phone, source, notes, vehicle_id } = body;

    // Validate required fields
    if (!client_name || !client_email || !client_phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: client_name, client_email, client_phone" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate input formats
    if (!validateName(client_name)) {
      return new Response(
        JSON.stringify({ error: "Invalid name format (2-100 characters required)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!validateEmail(client_email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!validatePhone(client_phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format (10-15 digits required)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sanitize inputs
    const sanitizedData = {
      client_name: sanitizeString(client_name, 100),
      client_email: sanitizeString(client_email.toLowerCase(), 255),
      client_phone: sanitizeString(client_phone, 20),
      source: sanitizeString(source || "website", 50),
      status: "new",
      notes: notes ? sanitizeString(notes, 1000) : null,
      vehicle_id: vehicle_id || null,
    };

    // Use service role for insert (bypasses RLS - but we've already verified auth above)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data, error } = await supabaseAdmin
      .from("leads")
      .insert(sanitizedData)
      .select("id")
      .single();

    if (error) {
      console.error("Lead creation failed:", error.message);
      return new Response(
        JSON.stringify({ error: "Failed to create lead" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Lead created successfully: ${data.id}`);

    return new Response(
      JSON.stringify({ success: true, lead_id: data.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in create-lead function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
