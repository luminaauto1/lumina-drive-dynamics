// TikTok Lead Generation webhook
// - GET: verification handshake (echoes `challenge`)
// - POST: parses TikTok lead payload and inserts into `leads`
//
// Public endpoint: verify_jwt = false (see supabase/config.toml)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tt-signature, x-tiktok-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const sanitizePhone = (raw: string): string => {
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "").trim();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // ---------------------------------------------------------
    // 1. TikTok Webhook Verification (GET)
    // ---------------------------------------------------------
    if (req.method === "GET") {
      const challenge =
        url.searchParams.get("challenge") ||
        url.searchParams.get("hub.challenge") ||
        url.searchParams.get("echostr");

      if (challenge) {
        // Echo the raw challenge back as plain text (TikTok expects exact match)
        return new Response(challenge, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
          status: 200,
        });
      }
      return new Response("Webhook endpoint active.", {
        headers: corsHeaders,
        status: 200,
      });
    }

    // ---------------------------------------------------------
    // 2. Incoming Lead Data (POST)
    // ---------------------------------------------------------
    if (req.method === "POST") {
      const payload = await req.json();

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      let clientName = "";
      let clientPhone = "";
      let clientEmail = "";
      let buyingPower = "";
      let bankQualification = "";

      // TikTok wraps fields under various shapes — handle them all
      const formData: any[] =
        payload?.data?.form_data ||
        payload?.data?.field_data ||
        payload?.form_data ||
        payload?.field_data ||
        payload?.fields ||
        [];

      formData.forEach((field: any) => {
        const fieldName = String(field.name ?? field.field_name ?? field.key ?? "").toLowerCase();
        let value = field.value ?? field.values ?? field.answer ?? "";
        if (Array.isArray(value)) value = value.join(", ");
        value = String(value).trim();
        if (!fieldName || !value) return;

        if (fieldName.includes("email")) {
          clientEmail = value.toLowerCase();
        } else if (fieldName.includes("phone") || fieldName.includes("mobile") || fieldName.includes("number") || fieldName.includes("tel")) {
          clientPhone = sanitizePhone(value);
        } else if (fieldName.includes("name")) {
          clientName = value;
        } else if (fieldName.includes("bank") || fieldName.includes("qualif")) {
          bankQualification = value;
        } else if (fieldName.includes("power") || fieldName.includes("budget") || fieldName.includes("afford")) {
          buyingPower = value;
        }
      });

      const noteLines: string[] = ["📱 TikTok Instant Form"];
      if (bankQualification) noteLines.push(`Bank qualified: ${bankQualification}`);
      if (buyingPower) noteLines.push(`Buying power: ${buyingPower}`);
      noteLines.push("---", "Raw payload:", JSON.stringify(payload, null, 2));

      const isHot = bankQualification.toLowerCase().includes("yes");

      const { data, error } = await supabase
        .from("leads")
        .insert({
          source: "tiktok",
          platform: "tiktok",
          client_name: clientName || "Unknown",
          client_phone: clientPhone || null,
          client_email: clientEmail || null,
          notes: noteLines.join("\n"),
          status: "new",
          pipeline_stage: "new",
          lead_temperature: isHot ? "hot" : "warm",
          utm_source: "tiktok",
          utm_medium: "paid_social",
          utm_campaign: "tiktok_lead_gen",
        })
        .select("id")
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "Lead captured.", lead_id: data?.id ?? null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error("tiktok-webhook error", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
