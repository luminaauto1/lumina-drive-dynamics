// notify-pre-approval-internal — "client pre-approved" WhatsApp to the F&I STAFF
// numbers (NOT the client). Fired on status → pre_approved.
//
// SETTINGS-DRIVEN (2026-07-14): template link from whatsapp_templates key
// 'pre_approval_internal'. The recreated (post-ban) template takes TWO vars —
// body1=name (client's full name), body2=mobilenumber (client's phone) — the
// pasted URL's query declares them, so this sends exactly what the template
// expects (the old code pushed 4 vars at a dead template, which is why staff
// notifications went missing).
//
// RECIPIENTS ARE SETTINGS-DRIVEN (2026-07-15, owner: 081 was silent because
// the list was hardcoded): integration_settings key 'pre_approval_notify',
// config.staff_numbers — editable in Settings → WhatsApp Notifications.
// Falls back to the historical pair if the row is missing/empty.
//
// RELIABILITY: numbers are dispatched sequentially with a spacing delay
// (rapid back-to-back sends of the same template are the classic reason the
// second number stays silent), each with dispatchWa's built-in retry PLUS one
// extra retry when EasySocial answers but reports failure. Every attempt is
// recorded in client_audit_logs via logClientSend so "which number got it"
// is answerable from data.
//
// TESTING: pass { test_phone: "0816783511" } to send ONLY to that number —
// never to the staff list.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { getWaTemplate, buildWaSendUrl, dispatchWa, sanitizeWaPhone, logClientSend } from "../_shared/waTemplates.ts";

const FALLBACK_STAFF_NUMBERS = ["27836117792", "27716196071"];
const GAP_BETWEEN_NUMBERS_MS = 1500;

/** Settings-driven staff recipients (sanitized, deduped); fallback pair when unset. */
async function getStaffNumbers(): Promise<string[]> {
  try {
    const SU = Deno.env.get("SUPABASE_URL");
    const SK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SU || !SK) return FALLBACK_STAFF_NUMBERS;
    const res = await fetch(
      `${SU}/rest/v1/integration_settings?key=eq.pre_approval_notify&select=active,config`,
      { headers: { apikey: SK, Authorization: `Bearer ${SK}` } },
    );
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || row.active === false) return FALLBACK_STAFF_NUMBERS;
    const raw = Array.isArray(row?.config?.staff_numbers) ? row.config.staff_numbers : [];
    const cleaned = Array.from(new Set(
      raw.map((n: unknown) => sanitizeWaPhone(n)).filter(Boolean) as string[],
    ));
    return cleaned.length > 0 ? cleaned : FALLBACK_STAFF_NUMBERS;
  } catch (_e) {
    return FALLBACK_STAFF_NUMBERS;
  }
}

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const payload = await req.json();
    console.log("[notify-pre-approval-internal] incoming payload:", JSON.stringify(payload));
    const { client_name, first_name, last_name, client_phone, test_phone } = payload;

    let fullName = String(client_name ?? "").trim();
    if (!fullName) fullName = [first_name, last_name].filter(Boolean).join(" ").trim();
    if (!fullName) fullName = "Unknown Client";
    const clientMobile = String(client_phone ?? "").trim() || "N/A";

    const tpl = await getWaTemplate("pre_approval_internal");
    if (!tpl) return json(200, { success: true, skipped: "template_row_missing" });
    if (tpl.active === false) return json(200, { success: true, skipped: "disabled" });

    const recipients = test_phone
      ? [sanitizeWaPhone(test_phone)].filter(Boolean) as string[]
      : await getStaffNumbers();
    if (!recipients.length) return json(400, { success: false, error: "no valid recipient" });

    const results: Array<Record<string, unknown>> = [];
    for (let i = 0; i < recipients.length; i++) {
      const phone = recipients[i];
      // Spacing between numbers — EasySocial drops rapid consecutive sends of
      // the same template, which is how "the other number stays silent".
      if (i > 0) await new Promise((r) => setTimeout(r, GAP_BETWEEN_NUMBERS_MS));
      const url = buildWaSendUrl(tpl.send_url, phone, { name: fullName, mobilenumber: clientMobile });
      if (!url) { results.push({ phone, ok: false, skipped: "no_send_url" }); continue; }
      console.log("[notify-pre-approval-internal] dispatching to", phone);
      let r = await dispatchWa(url);
      if (!r.ok) {
        // dispatchWa retries network/5xx internally; this extra pass also
        // covers "answered but success:false" (throttle/soft-reject).
        console.warn("[notify-pre-approval-internal] first attempt failed, retrying", phone, r.status);
        await new Promise((res) => setTimeout(res, 1500));
        r = await dispatchWa(url);
      }
      console.log("[notify-pre-approval-internal] result", phone, r.status, JSON.stringify(r.body).slice(0, 300));
      await logClientSend({
        kind: `pre_approval_internal → staff${test_phone ? " (TEST)" : ""}`,
        rawPhone: phone,
        ok: r.ok,
        detail: r.ok ? `re: ${fullName}` : `re: ${fullName} — status ${r.status}`,
      });
      results.push({ phone, ok: r.ok, status: r.status, body: r.body });
    }

    const allOk = results.every((r) => r.ok === true);
    console.log("[notify-pre-approval-internal] FINAL allOk:", allOk);
    return json(allOk ? 200 : 207, {
      success: allOk,
      results,
      payload: { body1: fullName, body2: clientMobile },
      test_mode: !!test_phone,
    });
  } catch (error: any) {
    return json(500, { error: error.message });
  }
});
