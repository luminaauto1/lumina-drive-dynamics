// WhatsApp Status-Apply Auto-send — config-driven curated-template dispatch.
//
// ZTC-parity: when a finance application moves into a status that has a curated
// WhatsApp template configured (status_overrides.whatsapp_template_key →
// whatsapp_templates.send_url), GET that EasySocial hosted send URL (the URL is
// the credential — campaign token + numeric template/lang ids baked in, no auth
// header) with body1/2/3 filled from the resolved body-source mapping.
//
// BODY-SOURCE PRECEDENCE (per slot N, independently — 2026-07-20):
//   1. status_overrides.wa_bodyN_source   — the PER-STATUS OVERRIDE. Wins whenever
//      it is non-empty (including an explicit 'none', which blanks that slot for
//      this status only).
//   2. whatsapp_templates.bodyN_source    — the TEMPLATE's own mapping. This is the
//      normal, live mapping; it is what Settings → WhatsApp Templates configures.
//   3. nothing                            — slot omitted from the query string.
// Both vocabularies are understood by resolveBodySource, so a status override and
// a template mapping can use whichever token set they were authored in.
//
// Mirrors whatsapp-test-send's proven GET shape, but driven by status/template
// config and the live application instead of an admin Test-send. This is a PUBLIC
// dispatch (verify_jwt=false) invoked fire-and-forget from useUpdateFinanceApplication;
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
// Request body: { application_id, new_status, comment?, wa_client_info? }
// Side effects: NONE on Supabase data — only fires the external send URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { logClientSend } from "../_shared/waTemplates.ts";

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
 * Values resolved once per request and shared by all three body slots. The three
 * "expensive" ones (vehicle / dealership / agent) are looked up LAZILY — only when
 * some slot actually asks for them — so the common name/comment templates still
 * cost exactly one round trip.
 */
interface BodyContext {
  comment: string;
  clientInfo: string;
  vehicleLabel: string;
  dealershipName: string;
  agentName: string;
  reference: string;
}

/**
 * Resolve a single BodySource token against the application row.
 * Ported from ZTC resolveBody → mapped to Lumina finance_applications columns.
 *
 * Understands BOTH vocabularies:
 *   (A) status_overrides.wa_bodyN_source  — full_name | first_name | comment |
 *       wa_client_info | vehicle | email | phone | bank | static:<text> | none
 *   (B) whatsapp_templates.bodyN_source   — applicant_full_name | applicant_first_name |
 *       applicant_mobile | vehicle | dealership_name | reference | agent_name |
 *       wa_client_info | custom:<text> | none
 *
 * Returns '' for an unresolved/none source (the caller omits blank params).
 */
const resolveBodySource = (
  source: string | null | undefined,
  app: Record<string, any>,
  ctx: BodyContext,
): string => {
  const src = String(source ?? "").trim();
  if (!src || src === "none" || src === "Not used") return "";
  // Literal-text forms: (A) uses `static:`, (B) uses `custom:`. Same handling.
  if (src.startsWith("static:")) return src.slice("static:".length).trim();
  if (src.startsWith("custom:")) return src.slice("custom:".length).trim();
  switch (src) {
    // --- (A) + (B) applicant name -------------------------------------------
    case "full_name":
    case "applicant_full_name":
      return (
        [app.first_name, app.last_name].filter(Boolean).join(" ").trim() ||
        String(app.full_name ?? "").trim() ||
        "Valued Client"
      );
    case "first_name":
    case "applicant_first_name":
      return (
        String(app.first_name ?? "").trim() ||
        String(app.full_name ?? "").trim().split(/\s+/)[0] ||
        "Valued Client"
      );
    // --- (A) only ------------------------------------------------------------
    case "comment":
      return ctx.comment || "";
    case "email":
      return String(app.email ?? "").trim();
    case "bank":
      return String(app.bank_name ?? "").trim();
    // --- shared --------------------------------------------------------------
    case "wa_client_info":
      return ctx.clientInfo || "";
    case "vehicle":
      return ctx.vehicleLabel || "";
    // (A) `phone` and (B) `applicant_mobile` are the same value: the client's
    // number as captured (human-readable, NOT the 27-normalised dial string).
    case "phone":
    case "applicant_mobile":
      return String(app.phone ?? "").trim();
    // --- (B) only ------------------------------------------------------------
    case "dealership_name":
      return ctx.dealershipName || "";
    case "reference":
      return ctx.reference || "";
    case "agent_name":
      return ctx.agentName || "";
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
    // Dedicated "WhatsApp To Client Info" text (separate from `comment`). Fills the
    // wa_client_info BodySource; omitted => that source resolves to "".
    const clientInfo = typeof payload?.wa_client_info === "string" ? payload.wa_client_info.trim() : "";

    if (!applicationId || !newStatus) {
      return json(400, { ok: false, error: "missing application_id / new_status" });
    }

    // Defense-in-depth (mirrors the hook gate): never double-send a notify-owned slug.
    if (NOTIFY_OWNED_STATUSES.has(newStatus)) {
      console.log("[wa-status-send] skipped — notify-owned slug", { newStatus });
      return json(200, { ok: true, skipped: "notify_owned", status: newStatus });
    }

    // 1. Per-status config (template key + body-source overrides + internal flag) and
    //    the application row (3.) are independent lookups — fetch them in ONE round
    //    trip. Only the template row (2.) depends on the config, so it waits.
    const [{ data: ov }, { data: app }] = await Promise.all([
      svc.from("status_overrides")
        .select("whatsapp_template_key, wa_body1_source, wa_body2_source, wa_body3_source, is_internal")
        .eq("slug", newStatus)
        .maybeSingle(),
      svc.from("finance_applications")
        .select("first_name, last_name, full_name, email, phone, bank_name, vehicle_id, selected_vehicle_id, bank_reference, assigned_f_and_i")
        .eq("id", applicationId)
        .maybeSingle(),
    ]);
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

    // 2. Curated template row → send_url is the credential, bodyN_source is the
    //    default (template-level) body mapping.
    const { data: tpl } = await svc
      .from("whatsapp_templates")
      .select("key, title, send_url, active, body1_source, body2_source, body3_source")
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

    // 3. Application row (already fetched above in parallel with the status config).
    if (!app) return json(200, { ok: false, error: "application_not_found", application_id: applicationId });
    const a: any = app;

    const phone = sanitisePhone(a.phone);
    if (phone.length < 8 || phone.length > 15) {
      console.warn("[wa-status-send] skipped — invalid phone", { application_id: applicationId });
      return json(200, { ok: true, skipped: "bad_phone", status: newStatus });
    }

    // 3b. Effective body source per slot: the per-status override wins when set,
    //     otherwise the template's own mapping. See the header comment.
    const pickSource = (override: unknown, fromTemplate: unknown): string => {
      const ovSrc = String(override ?? "").trim();
      if (ovSrc) return ovSrc;
      return String(fromTemplate ?? "").trim();
    };
    const src1 = pickSource(o.wa_body1_source, t.body1_source);
    const src2 = pickSource(o.wa_body2_source, t.body2_source);
    const src3 = pickSource(o.wa_body3_source, t.body3_source);
    const sources = [src1, src2, src3];
    const wants = (token: string) => sources.some((s) => s === token);

    // Resolve a human vehicle label ("year make model") only if any source asks
    // for it — avoids a needless lookup on the common name/comment templates.
    let vehicleLabel = "";
    if (wants("vehicle")) {
      const vid = a.vehicle_id ?? a.selected_vehicle_id ?? null;
      if (vid) {
        const { data: veh } = await svc.from("vehicles").select("year, make, model").eq("id", vid).maybeSingle();
        const v: any = veh ?? {};
        vehicleLabel = [v.year, v.make, v.model].filter(Boolean).join(" ").trim();
      }
    }

    // Dealership trading name — same lazy pattern. Trading name is what clients
    // know us by; fall back to the legal entity name, then to nothing.
    let dealershipName = "";
    if (wants("dealership_name")) {
      const { data: ss } = await svc.from("site_settings").select("document_settings").limit(1).maybeSingle();
      const ds: any = (ss as any)?.document_settings ?? {};
      dealershipName = String(ds.companyTradingName ?? "").trim() || String(ds.companyLegalName ?? "").trim();
    }

    // Agent (assigned F&I) display name — assigned_f_and_i is a USER uuid, so the
    // join is on profiles.user_id (mirrors useFinanceApplications' manual join).
    // Lazy: only when a slot asks for it.
    let agentName = "";
    if (wants("agent_name") && a.assigned_f_and_i) {
      const { data: prof } = await svc
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", a.assigned_f_and_i)
        .maybeSingle();
      const p: any = prof ?? {};
      agentName =
        String(p.full_name ?? "").trim() ||
        String(p.email ?? "").trim().split("@")[0] ||
        "";
    }

    // Client-facing reference: the bank reference when we have one, else the short
    // application id the admin UI/PDFs show ("Application ID: <first 8>").
    const reference = String(a.bank_reference ?? "").trim() || applicationId.slice(0, 8).toUpperCase();

    const ctx: BodyContext = { comment, clientInfo, vehicleLabel, dealershipName, agentName, reference };
    const body1 = resolveBodySource(src1, a, ctx);
    const body2 = resolveBodySource(src2, a, ctx);
    const body3 = resolveBodySource(src3, a, ctx);

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
      await logClientSend({
        kind: `status:${newStatus} (${templateKey})`, rawPhone: a.phone, ok: false,
        applicationId, clientEmail: a.email ?? null, detail: String((e as Error).message ?? e),
      });
      return json(200, { ok: false, error: "dispatch_failed", detail: String((e as Error).message ?? e), status: newStatus });
    }

    const ok = status >= 200 && status < 300 && (apiResponse as any)?.success !== false;
    console.log("[wa-status-send] result", { status, ok, newStatus, templateKey });
    // Comms log (P4): record what was actually dispatched to the client so the
    // per-application timeline shows it. Logging only — never blocks the response.
    await logClientSend({
      kind: `status:${newStatus} (${templateKey})`, rawPhone: a.phone, ok,
      applicationId, clientEmail: a.email ?? null, detail: ok ? null : `status ${status}`,
    });
    return json(200, { ok, status, template_key: templateKey, dispatched_url: dispatchedUrl, api_response: apiResponse });
  } catch (e: any) {
    console.error("[wa-status-send] error", e?.message || e);
    return json(500, { ok: false, error: e?.message || "Unknown error" });
  }
});
