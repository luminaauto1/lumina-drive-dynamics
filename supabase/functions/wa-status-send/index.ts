// WhatsApp Status-Apply Auto-send — config-driven curated-template dispatch.
//
// ZTC-parity: when a finance application moves into a status that has a curated
// WhatsApp template configured (status_overrides.whatsapp_template_key →
// whatsapp_templates.send_url), GET that EasySocial hosted send URL (the URL is
// the credential — campaign token + numeric template/lang ids baked in, no auth
// header) with body1/2/3 filled from the per-status BodySource mapping.
//
// Mirrors whatsapp-test-send's proven GET shape, but driven by status config and
// the live application instead of an admin Test-send. This is a PUBLIC dispatch
// (verify_jwt=false) invoked fire-and-forget from useUpdateFinanceApplication;
// guarded by the LUMINA_INTERNAL_API_KEY shared secret like the notify-* flows.
//
// NO-DOUBLE-SEND: the 5 notify-* owned slugs already auto-send via their own
// functions. They are EXCLUDED here (defense-in-depth re-check after the DB read)
// so exactly ONE path ever fires for those statuses.
//
// OFF-SWITCHES (each returns skipped, never an error — a missing config or send
// URL is the normal "do nothing" path, byte-for-byte as before this feature):
//   1. no whatsapp_template_key on the status        → skipped:'no_template'
//   2. status flagged is_internal                     → skipped:'internal'
//   3. status is a notify-* owned slug                → skipped:'notify_owned'
//   4. linked template row missing / send_url blank   → skipped:'no_send_url'
//
// Request body: { application_id, new_status, comment? }
// Side effects: NONE on Supabase data — only fires the external send URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

// Slugs whose WhatsApp client notification is already owned by a dedicated
// notify-* function. These MUST NOT auto-send here (no double messaging).
// Kept in sync with the hook's NOTIFY_OWNED_STATUSES guard (defense-in-depth).
const NOTIFY_OWNED_STATUSES = new Set<string>([
  "application_submitted",
  "ready_to_submit",
  "declined",
  "blacklisted",
  "client_cancelled",
  "pre_approved",
]);

// Sanitise a phone number the same way notify-app-submitted / whatsapp-test-send do.
const sanitisePhone = (raw: unknown): string => {
  let p = String(raw ?? "").replace(/[\s\-+()]/g, "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "27" + p.substring(1);
  return p;
};

/**
 * Resolve a single BodySource token against the application row.
 * Ported from ZTC resolveBody → mapped to Lumina finance_applications columns.
 * Returns '' for an unresolved/none source (the caller omits blank params).
 */
const resolveBodySource = (
  source: string | null | undefined,
  app: Record<string, any>,
  comment: string,
  vehicleLabel: string,
): string => {
  const src = String(source ?? "").trim();
  if (!src || src === "none" || src === "Not used") return "";
  if (src.startsWith("static:")) return src.slice("static:".length).trim();
  switch (src) {
    case "full_name":
      return (
        [app.first_name, app.last_name].filter(Boolean).join(" ").trim() ||
        String(app.full_name ?? "").trim() ||
        "Valued Client"
      );
    case "first_name":
      return (
        String(app.first_name ?? "").trim() ||
        String(app.full_name ?? "").trim().split(/\s+/)[0] ||
        "Valued Client"
      );
    case "comment":
      return comment || "";
    case "vehicle":
      return vehicleLabel || "";
    case "email":
      return String(app.email ?? "").trim();
    case "phone":
      return String(app.phone ?? "").trim();
    case "bank":
      return String(app.bank_name ?? "").trim();
    default:
      return "";
  }
};

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  // Shared-secret gate (same as notify-*).
  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { ok: false, error: "server_misconfig" });
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    const payload = await req.json().catch(() => ({}));
    const applicationId = String(payload?.application_id ?? "").trim();
    const newStatus = String(payload?.new_status ?? "").toLowerCase().trim();
    const comment = typeof payload?.comment === "string" ? payload.comment.trim() : "";

    if (!applicationId || !newStatus) {
      return json(400, { ok: false, error: "missing application_id / new_status" });
    }

    // Defense-in-depth (mirrors the hook gate): never double-send a notify-owned slug.
    if (NOTIFY_OWNED_STATUSES.has(newStatus)) {
      console.log("[wa-status-send] skipped — notify-owned slug", { newStatus });
      return json(200, { ok: true, skipped: "notify_owned", status: newStatus });
    }

    // 1. Per-status config (template key + body sources + internal flag).
    const { data: ov } = await svc
      .from("status_overrides")
      .select("whatsapp_template_key, wa_body1_source, wa_body2_source, wa_body3_source, is_internal")
      .eq("slug", newStatus)
      .maybeSingle();
    const o: any = ov ?? {};

    if (o.is_internal === true) {
      console.log("[wa-status-send] skipped — internal status", { newStatus });
      return json(200, { ok: true, skipped: "internal", status: newStatus });
    }

    const templateKey = typeof o.whatsapp_template_key === "string" ? o.whatsapp_template_key.trim() : "";
    if (!templateKey) {
      console.log("[wa-status-send] skipped — no template configured", { newStatus });
      return json(200, { ok: true, skipped: "no_template", status: newStatus });
    }

    // 2. Curated template row → send_url is the credential.
    const { data: tpl } = await svc
      .from("whatsapp_templates")
      .select("key, title, send_url, active")
      .eq("key", templateKey)
      .maybeSingle();
    const t: any = tpl ?? {};
    const sendUrlRaw = typeof t.send_url === "string" ? t.send_url.trim() : "";
    if (!sendUrlRaw || !/^https?:\/\//i.test(sendUrlRaw)) {
      console.log("[wa-status-send] skipped — no/invalid send_url", { newStatus, templateKey });
      return json(200, { ok: true, skipped: "no_send_url", status: newStatus, template_key: templateKey });
    }
    if (t.active === false) {
      console.log("[wa-status-send] skipped — template inactive", { newStatus, templateKey });
      return json(200, { ok: true, skipped: "template_inactive", status: newStatus, template_key: templateKey });
    }

    // 3. Application row for body-var sourcing + destination phone.
    const { data: app } = await svc
      .from("finance_applications")
      .select("first_name, last_name, full_name, email, phone, bank_name, vehicle_id, selected_vehicle_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app) return json(200, { ok: false, error: "application_not_found", application_id: applicationId });
    const a: any = app;

    const phone = sanitisePhone(a.phone);
    if (phone.length < 8 || phone.length > 15) {
      console.warn("[wa-status-send] skipped — invalid phone", { application_id: applicationId });
      return json(200, { ok: true, skipped: "bad_phone", status: newStatus });
    }

    // Resolve a human vehicle label ("year make model") only if any source asks
    // for it — avoids a needless lookup on the common name/comment templates.
    let vehicleLabel = "";
    const wantsVehicle = [o.wa_body1_source, o.wa_body2_source, o.wa_body3_source]
      .some((s) => String(s ?? "").trim() === "vehicle");
    if (wantsVehicle) {
      const vid = a.vehicle_id ?? a.selected_vehicle_id ?? null;
      if (vid) {
        const { data: veh } = await svc.from("vehicles").select("year, make, model").eq("id", vid).maybeSingle();
        const v: any = veh ?? {};
        vehicleLabel = [v.year, v.make, v.model].filter(Boolean).join(" ").trim();
      }
    }

    const body1 = resolveBodySource(o.wa_body1_source, a, comment, vehicleLabel);
    const body2 = resolveBodySource(o.wa_body2_source, a, comment, vehicleLabel);
    const body3 = resolveBodySource(o.wa_body3_source, a, comment, vehicleLabel);

    // 4. Normalise the curated URL exactly like the ZTC test-send / notify-* shape.
    // Strip any pasted /API/:mobile?... placeholder + query + trailing slashes,
    // then rebuild as `${base}/API/${phone}?body1..`. Each body param only when truthy.
    let base = sendUrlRaw;
    // Drop query string.
    const qIdx = base.indexOf("?");
    if (qIdx >= 0) base = base.slice(0, qIdx);
    // Drop a trailing /API/<placeholder> segment if present (e.g. /API/:mobile, /API/{phone}).
    base = base.replace(/\/API\/[^/]*\/?$/i, "");
    // Drop any remaining trailing slashes.
    base = base.replace(/\/+$/, "");

    const params: string[] = [];
    if (body1) params.push(`body1=${encodeURIComponent(body1)}`);
    if (body2) params.push(`body2=${encodeURIComponent(body2)}`);
    if (body3) params.push(`body3=${encodeURIComponent(body3)}`);
    const query = params.length ? `?${params.join("&")}` : "";
    const dispatchedUrl = `${base}/API/${encodeURIComponent(phone)}${query}`;

    console.log("[wa-status-send] dispatching", { application_id: applicationId, newStatus, templateKey, phone });

    // 5. Fire the send URL (GET; URL is the credential, no auth header). 6s timeout.
    let status = 0;
    let apiResponse: unknown = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(dispatchedUrl, { method: "GET", headers: { Accept: "application/json" }, signal: ctrl.signal });
      clearTimeout(timer);
      status = res.status;
      const text = await res.text();
      try { apiResponse = JSON.parse(text); } catch { apiResponse = { raw: text.slice(0, 500) }; }
    } catch (e) {
      console.error("[wa-status-send] dispatch failed", String((e as Error).message ?? e));
      return json(200, { ok: false, error: "dispatch_failed", detail: String((e as Error).message ?? e), status: newStatus });
    }

    const ok = status >= 200 && status < 300 && (apiResponse as any)?.success !== false;
    console.log("[wa-status-send] result", { status, ok, newStatus, templateKey });
    return json(200, { ok, status, template_key: templateKey, dispatched_url: dispatchedUrl, api_response: apiResponse });
  } catch (e: any) {
    console.error("[wa-status-send] error", e?.message || e);
    return json(500, { ok: false, error: e?.message || "Unknown error" });
  }
});
