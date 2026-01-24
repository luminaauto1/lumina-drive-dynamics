import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyTokenRequest {
  token: string;
}

interface UpdateStatusRequest {
  token: string;
  status: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key for server-side operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "verify";

    if (action === "verify") {
      // Verify token and return minimal data
      const { token }: VerifyTokenRequest = await req.json();

      if (!token || typeof token !== "string") {
        return new Response(
          JSON.stringify({ error: "Invalid token format" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(token)) {
        return new Response(
          JSON.stringify({ error: "Invalid token format" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("finance_applications")
        .select("id, first_name, last_name, full_name, status, access_token")
        .eq("access_token", token)
        .single();

      if (error || !data) {
        console.error("Token verification failed:", error?.message);
        return new Response(
          JSON.stringify({ valid: false, error: "Application not found or link expired" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Return minimal necessary data - no sensitive PII
      return new Response(
        JSON.stringify({
          valid: true,
          application_id: data.id,
          first_name: data.first_name || data.full_name?.split(" ")[0] || "Client",
          status: data.status,
          access_token: data.access_token,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else if (action === "update-status") {
      // Update application status with token verification
      const { token, status }: UpdateStatusRequest = await req.json();

      if (!token || typeof token !== "string") {
        return new Response(
          JSON.stringify({ error: "Invalid token format" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Validate allowed status transitions
      const allowedStatuses = ["documents_received"];
      if (!allowedStatuses.includes(status)) {
        return new Response(
          JSON.stringify({ error: "Invalid status" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(token)) {
        return new Response(
          JSON.stringify({ error: "Invalid token format" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("finance_applications")
        .update({ status })
        .eq("access_token", token)
        .select("id")
        .single();

      if (error || !data) {
        console.error("Status update failed:", error?.message);
        return new Response(
          JSON.stringify({ error: "Failed to update status" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, application_id: data.id }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in verify-upload-token function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
