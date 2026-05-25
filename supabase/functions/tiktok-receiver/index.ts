// Consolidated TikTok webhook:
//   1. Verify TikTok handshake (challenge)
//   2. Parse + sanitize lead
//   3. Insert into `leads` (source = 'TikTok')
//   4. Return 200 OK to TikTok immediately
//   5. Background: wait 10s, then dispatch EasySocial WhatsApp template
//
// Deployed with verify_jwt = false (TikTok cannot send Supabase JWTs).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-verify-token, x-tiktok-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EASYSOCIAL_TEMPLATE_BASE =
  "https://api.easysocial.in/api/v1/wa-templates/send/cmoiymj99b30ciyxpdvtndj6n/18909/4026/API";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sanitizeText = (raw: unknown, max = 255): string | null => {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return null;
  return value.slice(0, max);
};

// Strip spaces, +, (), dashes; convert local 0xxxxxxxxx -> 27xxxxxxxxx
const sanitizePhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  let cleaned = String(raw).replace(/[\s()+\-]/g, "").replace(/\D/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("0")) cleaned = "27" + cleaned.slice(1);
  if (cleaned.length < 10 || cleaned.length > 15) return null;
  return cleaned;
};

const FIELD_ALIASES = {
  name: ["name", "full_name", "full name", "client_name", "customer_name", "lead_name"],
  phone: ["phone", "phone_number", "mobile", "mobile_number", "cell", "contact_number"],
  buyingPower: ["buying_power", "buying power", "bank_qualification", "qualification", "approved_amount", "budget"],
} as const;

const matchesAlias = (key: string, aliases: readonly string[]) => {
  const normalized = key.toLowerCase().trim();
  return aliases.some((alias) => normalized === alias || normalized.includes(alias));
};

const firstScalar = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const scalar = firstScalar(item);
      if (scalar) return scalar;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["value", "values", "answer", "answers", "text", "label"]) {
      const scalar = firstScalar(record[key]);
      if (scalar) return scalar;
    }
  }
  return null;
};

function extractLeadFields(formData: unknown) {
  const extracted: Record<keyof typeof FIELD_ALIASES, string | null> = {
    name: null,
    phone: null,
    buyingPower: null,
  };

  if (Array.isArray(formData)) {
    for (const entry of formData) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const fieldName = [record.name, record.key, record.field_name, record.question, record.label]
        .map((value) => sanitizeText(value, 120))
        .find(Boolean);

      if (!fieldName) continue;

      const fieldValue = firstScalar(
        record.value ?? record.values ?? record.answer ?? record.answers ?? record.field_value,
      );

      if (!fieldValue) continue;

      for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
        if (!extracted[canonical as keyof typeof FIELD_ALIASES] && matchesAlias(fieldName, aliases)) {
          extracted[canonical as keyof typeof FIELD_ALIASES] = fieldValue;
        }
      }
    }

    return extracted;
  }

  if (formData && typeof formData === "object") {
    for (const [key, value] of Object.entries(formData as Record<string, unknown>)) {
      const scalar = firstScalar(value);
      if (!scalar) continue;

      for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
        if (!extracted[canonical as keyof typeof FIELD_ALIASES] && matchesAlias(key, aliases)) {
          extracted[canonical as keyof typeof FIELD_ALIASES] = scalar;
        }
      }
    }
  }

  return extracted;
}

async function dispatchWhatsAppAfterDelay(sanitizedNumber: string) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const url = `${EASYSOCIAL_TEMPLATE_BASE}/${sanitizedNumber}?body1=1`;
    console.log("[tiktok-receiver] dispatching WhatsApp →", url);
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
    const text = await res.text();
    console.log("[tiktok-receiver] EasySocial status:", res.status, "body:", text.slice(0, 500));
  } catch (err) {
    console.error("[tiktok-receiver] background dispatch failed:", err);
  }
}

function scheduleBackground(promise: Promise<unknown>) {
  // @ts-ignore — EdgeRuntime is provided by Supabase Edge runtime
  const ert: any = (globalThis as any).EdgeRuntime;
  if (ert && typeof ert.waitUntil === "function") {
    ert.waitUntil(promise);
  } else {
    // Fallback: fire-and-forget
    promise.catch((e) => console.error("[tiktok-receiver] bg fallback err:", e));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // TikTok verification handshake
  if (payload.challenge) {
    return json({ challenge: payload.challenge }, 200);
  }

  const formData = (payload.data as Record<string, unknown> | undefined)?.form_data;
  const fields = extractLeadFields(formData);

  const clientName = sanitizeText(fields.name, 120);
  const clientPhone = sanitizePhone(fields.phone);
  const buyingPower = sanitizeText(fields.buyingPower, 200);

  if (!clientName || !clientPhone) {
    return json({ error: "Missing required lead fields in payload.data.form_data" }, 400);
  }

  const notes = buyingPower ? `Bank qualification / buying power: ${buyingPower}` : null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const leadData = {
    client_name: clientName,
    client_phone: clientPhone,
    phone_number: clientPhone,
    source: "TikTok",
    status: "new",
    notes,
    platform: "tiktok",
    origin: "tiktok_lead_ad",
    updated_at: new Date().toISOString(),
  };

  let leadId: string | null = null;

  try {
    const { data, error } = await supabase
      .from("leads")
      .upsert(leadData, { onConflict: "phone_number" })
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    leadId = data?.id ?? null;
  } catch (dbError) {
    console.error("Database insertion failed/duplicate:", dbError);
  }

  // Kick off the 10s delay + WhatsApp dispatch in the background — always.
  scheduleBackground(dispatchWhatsAppAfterDelay(clientPhone));

  // Always respond 200 OK so TikTok / Make.com don't enter retry loops.
  return new Response(JSON.stringify({ success: true, note: "Handled", lead_id: leadId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
