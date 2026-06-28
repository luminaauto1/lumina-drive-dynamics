// WhatsApp Test-send — admin-only curated-template test fire.
//
// ZTC-parity "Test send": GETs an EasySocial hosted send URL (the URL itself is
// the credential — campaign token + numeric template/lang IDs baked in, no auth
// header) with the body1/2/3 query params filled in. Mirrors the dispatch shape
// of notify-app-submitted (GET, Accept: application/json, body vars as URL-
// encoded query params), but the URL is supplied per-call from the curated
// whatsapp_templates.send_url instead of being hardcoded.
//
// Auth: Supabase user JWT, verified is_admin via the service client (user_roles
// role='admin') — same gate as easysocial-list-tags. This is an authenticated
// admin-settings action, NOT a public capture/notify flow.
//
// Request body: { send_url, test_phone, body1?, body2?, body3? }
//   • send_url   — the EasySocial send URL to fire (required).
//   • test_phone — destination MSISDN; sanitised like notify-app-submitted
//                  (strip separators, leading 0 → 27). Required.
//   • body1/2/3  — optional values for the template vars; blank → sample value.
//
// Response: { ok, status, dispatched_url? , api_response? } or { ok:false, error }
//
// Side effects: NONE on Supabase data — this only fires the external send URL.
// It does NOT touch notify-*, the active on/off gate, or any application data.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Reflect whatever headers the browser asks for in the CORS preflight (mirrors
// easysocial-list-tags — supabase-js sends headers beyond a fixed allow-list).
const buildCors = (req: Request) => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    req.headers.get("access-control-request-headers") ??
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

// Sample fill-ins for blank body vars (so a Test-send always renders something).
const SAMPLE_BODY: Record<"body1" | "body2" | "body3", string> = {
  body1: "Test Client",
  body2: "Demo Vehicle",
  body3: "Lumina Auto",
};

// Sanitise a phone number the same way notify-app-submitted does.
const sanitisePhone = (raw: string): string => {
  let p = String(raw).replace(/[\s\-+()]/g, "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "27" + p.substring(1);
  return p;
};

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // --- Admin JWT gate -------------------------------------------------------
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json(401, { error: "Missing auth" });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: "Invalid token" });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json(403, { error: "Forbidden — admin only" });

    // --- Parse + validate the request ----------------------------------------
    const payload = await req.json().catch(() => ({}));
    const sendUrlRaw = String(payload?.send_url ?? "").trim();
    const testPhoneRaw = String(payload?.test_phone ?? "").trim();

    if (!sendUrlRaw) return json(200, { ok: false, error: "no_send_url", detail: "This template has no send URL configured." });
    if (!/^https?:\/\//i.test(sendUrlRaw)) return json(200, { ok: false, error: "bad_send_url", detail: "Send URL must be an http(s) URL." });
    if (!testPhoneRaw) return json(200, { ok: false, error: "no_test_phone", detail: "A test phone number is required." });

    const phone = sanitisePhone(testPhoneRaw);
    if (phone.length < 8 || phone.length > 15) {
      return json(200, { ok: false, error: "bad_test_phone", detail: "Invalid phone number." });
    }

    // --- Build the dispatch URL ----------------------------------------------
    // The send URL's final path segment is the destination number placeholder in
    // the notify-* pattern (.../API/{phone}). We treat the supplied send_url as
    // the full template URL and (a) ensure the body vars are present and (b)
    // append the phone if the URL doesn't already carry it. To stay faithful to
    // the notify-* shape WITHOUT guessing path structure, we parse the URL and:
    //   • set/override body1..body3 query params with the (sampled) values,
    //   • if the path ends in a non-numeric segment commonly used as a phone
    //     placeholder, leave the path as-is and rely on query params.
    let url: URL;
    try {
      url = new URL(sendUrlRaw);
    } catch {
      return json(200, { ok: false, error: "bad_send_url", detail: "Send URL could not be parsed." });
    }

    const body1 = String(payload?.body1 ?? "").trim() || SAMPLE_BODY.body1;
    const body2 = String(payload?.body2 ?? "").trim() || SAMPLE_BODY.body2;
    const body3 = String(payload?.body3 ?? "").trim() || SAMPLE_BODY.body3;

    // Always set body1 (every template uses at least one var). Only set body2/3
    // if the source URL already references them OR a non-blank value was passed,
    // so we don't inject vars a single-var template doesn't expect.
    url.searchParams.set("body1", body1);
    const wantsBody2 = url.searchParams.has("body2") || (payload?.body2 != null && String(payload.body2).trim() !== "");
    const wantsBody3 = url.searchParams.has("body3") || (payload?.body3 != null && String(payload.body3).trim() !== "");
    if (wantsBody2) url.searchParams.set("body2", body2);
    if (wantsBody3) url.searchParams.set("body3", body3);

    // Substitute the phone placeholder if the path's last segment is a sample/
    // placeholder number; otherwise leave the URL's path untouched. The owner
    // pastes a send URL whose {phone} slot already points where they want, so we
    // replace ONLY a clearly-templated trailing token like {phone}/PHONE/0/etc.
    const PHONE_PLACEHOLDER = /\{?\s*(phone|msisdn|number|to)\s*\}?$/i;
    const segs = url.pathname.split("/");
    if (segs.length && PHONE_PLACEHOLDER.test(segs[segs.length - 1])) {
      segs[segs.length - 1] = phone;
      url.pathname = segs.join("/");
    }

    const dispatchedUrl = url.toString();
    console.log("[whatsapp-test-send] dispatching", { by: userData.user.id, phone, host: url.host });

    // --- Fire the send URL (GET; URL is the credential, no auth header) -------
    let status = 0;
    let apiResponse: unknown = null;
    try {
      const res = await fetch(dispatchedUrl, { method: "GET", headers: { Accept: "application/json" } });
      status = res.status;
      const text = await res.text();
      try { apiResponse = JSON.parse(text); } catch { apiResponse = { raw: text.slice(0, 500) }; }
    } catch (e) {
      console.error("[whatsapp-test-send] dispatch failed", String((e as Error).message ?? e));
      return json(200, { ok: false, error: "dispatch_failed", detail: String((e as Error).message ?? e) });
    }

    const ok = status >= 200 && status < 300 && (apiResponse as any)?.success !== false;
    console.log("[whatsapp-test-send] result", { status, ok });
    return json(200, { ok, status, dispatched_url: dispatchedUrl, api_response: apiResponse });
  } catch (e: any) {
    return json(500, { error: e?.message || "Unknown error" });
  }
});
