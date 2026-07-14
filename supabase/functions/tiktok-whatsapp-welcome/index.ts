// Isolated TikTok → WhatsApp welcome dispatcher.
// Standalone: does NOT share code with any other webhook / function.
// Flow:
//   1. POST + ?token=... gate
//   2. Parse phone from TikTok lead payload
//   3. Sanitize (strip spaces/()/+, convert 0xxx → 27xxx)
//   4. Return 200 OK to TikTok IMMEDIATELY
//   5. In background: wait 10s, then GET EasySocial template URL

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SECRET_TOKEN = "tt_wa_lumina_9F3xQ2vK7pL4mN8r";
// SETTINGS-DRIVEN (2026-07-14): welcome template from whatsapp_templates key
// 'tiktok_lead_welcome' (Admin → Settings → WhatsApp Templates).
import { getWaTemplate, buildWaSendUrl } from "../_shared/waTemplates.ts";
const WELCOME_TEMPLATE_KEY = "tiktok_lead_welcome";

function sanitizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  // Remove spaces, parentheses, and '+'
  let cleaned = String(raw).replace(/[\s()+\-]/g, "");
  // Strip everything non-digit (defensive)
  cleaned = cleaned.replace(/\D/g, "");
  if (!cleaned) return null;
  // Local format 0xxxxxxxxx → 27xxxxxxxxx
  if (cleaned.startsWith("0")) cleaned = "27" + cleaned.slice(1);
  if (cleaned.length < 10 || cleaned.length > 15) return null;
  return cleaned;
}

function extractPhone(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;

  // Direct top-level keys
  const direct =
    payload.phone ??
    payload.phone_number ??
    payload.mobile ??
    payload.mobile_number ??
    payload.clientPhone;
  if (direct) return String(direct);

  // TikTok form_data shapes
  const formData = payload?.data?.form_data ?? payload?.form_data;

  if (Array.isArray(formData)) {
    for (const entry of formData) {
      const name = String(entry?.name ?? entry?.key ?? entry?.field_name ?? "").toLowerCase();
      if (/phone|mobile|cell|contact/.test(name)) {
        const v = entry?.value ?? entry?.values?.[0] ?? entry?.answer;
        if (v) return String(v);
      }
    }
  } else if (formData && typeof formData === "object") {
    for (const [k, v] of Object.entries(formData)) {
      if (/phone|mobile|cell|contact/i.test(k) && v) return String(v);
    }
  }

  return null;
}

async function dispatchWhatsAppAfterDelay(sanitizedNumber: string) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const tpl = await getWaTemplate(WELCOME_TEMPLATE_KEY);
    if (!tpl || tpl.active === false) {
      console.log("[tiktok-whatsapp-welcome] skipped — template missing/inactive:", WELCOME_TEMPLATE_KEY);
      return;
    }
    // This isolated dispatcher has no name in its payload → greet generically.
    const url = buildWaSendUrl(tpl.send_url, sanitizedNumber, { name: "there", mobilenumber: sanitizedNumber });
    if (!url) {
      console.log("[tiktok-whatsapp-welcome] skipped — no send_url on", WELCOME_TEMPLATE_KEY);
      return;
    }
    console.log("[tiktok-whatsapp-welcome] dispatching →", url);
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
    const text = await res.text();
    console.log("[tiktok-whatsapp-welcome] EasySocial status:", res.status, "body:", text);
  } catch (err) {
    console.error("[tiktok-whatsapp-welcome] background dispatch failed:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Custom token gate (TikTok cannot send Supabase JWTs)
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (token !== SECRET_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    // Acknowledge anyway so TikTok doesn't retry-spam, but log it.
    console.warn("[tiktok-whatsapp-welcome] invalid JSON body");
    return new Response(JSON.stringify({ success: true, note: "invalid json" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // TikTok webhook verification handshake (some setups still POST a challenge)
  if (payload?.challenge) {
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawPhone = extractPhone(payload);
  const sanitized = sanitizePhone(rawPhone);

  if (sanitized) {
    // @ts-ignore — EdgeRuntime is provided by Supabase Edge runtime
    const ert: any = (globalThis as any).EdgeRuntime;
    if (ert && typeof ert.waitUntil === "function") {
      ert.waitUntil(dispatchWhatsAppAfterDelay(sanitized));
    } else {
      // Fallback: fire-and-forget
      dispatchWhatsAppAfterDelay(sanitized);
    }
  } else {
    console.warn("[tiktok-whatsapp-welcome] could not extract/sanitize phone from payload");
  }

  // Always return 200 immediately so TikTok registers the handoff
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
