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
// RELIABILITY: each staff number is dispatched with a built-in retry
// (dispatchWa in _shared/waTemplates.ts), sequentially so one hard failure
// can't starve the other, and the response reports per-number outcomes.
//
// TESTING: pass { test_phone: "0816783511" } to send ONLY to that number —
// never to the staff list.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { getWaTemplate, buildWaSendUrl, dispatchWa, sanitizeWaPhone } from "../_shared/waTemplates.ts";

const STAFF_NUMBERS = ["27836117792", "27716196071"];

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
      : STAFF_NUMBERS;
    if (!recipients.length) return json(400, { success: false, error: "no valid recipient" });

    const results: Array<Record<string, unknown>> = [];
    for (const phone of recipients) {
      const url = buildWaSendUrl(tpl.send_url, phone, { name: fullName, mobilenumber: clientMobile });
      if (!url) { results.push({ phone, ok: false, skipped: "no_send_url" }); continue; }
      console.log("[notify-pre-approval-internal] dispatching to", phone);
      const r = await dispatchWa(url);
      console.log("[notify-pre-approval-internal] result", phone, r.status, JSON.stringify(r.body).slice(0, 300));
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
