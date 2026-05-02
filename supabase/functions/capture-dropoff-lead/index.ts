import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

// Strict allowlist — never accept arbitrary blobs into the leads table.
const ALLOWED_FIELDS = new Set([
  "client_name",
  "client_email",
  "client_phone",
  "phone_number",
  "source",
  "notes",
  "vehicle_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "referrer",
  "traffic_source",
  "last_step_reached",
  "last_step_name",
  "deal_headline",
]);

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { leadData } = await req.json();
    if (!leadData || typeof leadData !== "object") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip everything not in the allowlist
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(leadData)) {
      if (ALLOWED_FIELDS.has(k)) sanitized[k] = v;
    }

    // Require at least one identifier
    const hasIdentifier =
      (typeof sanitized.client_email === "string" && sanitized.client_email.trim().length > 3) ||
      (typeof sanitized.client_phone === "string" && sanitized.client_phone.trim().length >= 6) ||
      (typeof sanitized.client_name === "string" && sanitized.client_name.trim().length > 1);

    if (!hasIdentifier) {
      return new Response(JSON.stringify({ error: "Missing identifier" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Always force-tag drop-off source
    sanitized.source = "dropoff";
    sanitized.status = "new";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error } = await supabaseAdmin.from("leads").insert([sanitized]);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("capture-dropoff-lead error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
