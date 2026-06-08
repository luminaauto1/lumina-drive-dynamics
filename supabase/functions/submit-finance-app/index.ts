import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

// Allowlist: only these fields can come from the client. Status / access_token /
// user_id are always set server-side.
const ALLOWED_FIELDS = new Set([
    "first_name", "last_name", "full_name", "email", "phone",
    "id_number", "id_type", "nationality",
    "gender", "marital_status", "marriage_type",
    "spouse_first_name", "spouse_surname", "spouse_id", "spouse_contact",
    "kin_name", "kin_contact",
  "street_address", "area_code", "qualification", "has_drivers_license",
  "credit_score_status", "bank_name", "account_type", "account_number",
  "employment_status", "employer_name", "employer_address", "employer_postal_code",
  "job_title", "employment_period", "monthly_income", "additional_income",
  "gross_salary", "net_salary", "expenses_summary", "popia_consent",
  "buyer_type", "source_of_funds", "preferred_vehicle_text",
  "vehicle_id", "selected_vehicle_id", "deposit_amount", "loan_term_months",
  "deal_type", "signature_url", "handover_name", "notes",
  "utm_source", "utm_medium", "utm_campaign", "referrer",
  "employment_type", "has_6_months_statements", "workplace_cell_no", "business_address_auto",
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

    // Fire-and-log: notify client via WhatsApp + sync EasySocial tag.
    const internalKey = Deno.env.get("LUMINA_INTERNAL_API_KEY") ?? "";
    try {
      const { data: notifyData, error: notifyErr } = await supabaseAdmin.functions.invoke("notify-app-submitted", {
        body: { phone_number: safe.phone, client_name: safe.full_name },
        headers: { "x-lumina-key": internalKey },
      });
      console.log("[submit-finance-app] notify-app-submitted result:", notifyErr ? notifyErr.message : notifyData);
    } catch (e: any) {
      console.error("[submit-finance-app] notify-app-submitted invoke failed:", e?.message || e);
    }
    try {
      const { data: tagData, error: tagErr } = await supabaseAdmin.functions.invoke("easysocial-tag-sync", {
        body: { phone_number: safe.phone, new_status: "application_submitted" },
      });
      console.log("[submit-finance-app] easysocial-tag-sync result:", tagErr ? tagErr.message : tagData);
    } catch (e: any) {
      console.error("[submit-finance-app] easysocial-tag-sync invoke failed:", e?.message || e);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
