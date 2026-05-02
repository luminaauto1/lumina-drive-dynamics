import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

// Allowlist: only these fields can come from the client. Status / access_token /
// user_id are always set server-side.
const ALLOWED_FIELDS = new Set([
  "first_name", "last_name", "full_name", "email", "phone",
  "id_number", "gender", "marital_status", "kin_name", "kin_contact",
  "street_address", "area_code", "qualification", "has_drivers_license",
  "credit_score_status", "bank_name", "account_type", "account_number",
  "employment_status", "employer_name", "employer_address", "employer_postal_code",
  "job_title", "employment_period", "monthly_income", "additional_income",
  "gross_salary", "net_salary", "expenses_summary", "popia_consent",
  "buyer_type", "source_of_funds", "preferred_vehicle_text",
  "vehicle_id", "selected_vehicle_id", "deposit_amount", "loan_term_months",
  "deal_type", "signature_url", "handover_name", "notes",
  "utm_source", "utm_medium", "utm_campaign", "referrer",
]);

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { insertData } = await req.json();

    if (!insertData || typeof insertData !== "object") {
      return new Response(JSON.stringify({ error: "Missing insertData" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Whitelist filter: ignore client-supplied status/access_token/user_id
    const safe: Record<string, unknown> = {};
    for (const k of Object.keys(insertData)) {
      if (ALLOWED_FIELDS.has(k)) safe[k] = insertData[k];
    }

    // Required fields validation
    if (!safe.full_name || !safe.email || !safe.phone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Server-controlled fields
    safe.status = "pending";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data, error } = await supabaseAdmin
      .from("finance_applications")
      .insert([safe])
      .select()
      .maybeSingle();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
