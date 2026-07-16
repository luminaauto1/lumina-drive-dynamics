// notify-reapplied-declined — CLIENT-facing WhatsApp when someone re-applies
// after a recent decline (owner ask 2026-07-16): "you were declined — has
// anything changed?". Template key 'reapplied_declined' (owner-supplied link,
// body1 = client first name).
//
// Fired by the DB trigger reapplied_declined_check on EVERY new
// finance_applications INSERT (via taskos_invoke); THIS function decides:
//   • the new app has a phone, AND
//   • the same client (matching phone digits or email) has an application in
//     status 'declined' whose last status change is within 6 MONTHS, AND
//   • we haven't sent this same template to that phone in the last 30 days
//     (bulk imports / duplicate submissions can't spam a client).
// Every send (ok or failed) lands in client_audit_logs via sendTemplateByKey.
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { checkCronSecret } from "../_shared/taskos/cron.ts";
import { sendTemplateByKey, sanitizeWaPhone } from "../_shared/waTemplates.ts";

const SIX_MONTHS_MS = 183 * 24 * 3600 * 1000;
const DEDUPE_DAYS = 30;

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const keyGuard = checkInternalKey(req);
  if (keyGuard && !(await checkCronSecret(req, svc))) return keyGuard;

  try {
    const { application_id } = await req.json().catch(() => ({}));
    if (!application_id) return json(400, { ok: false, error: "missing application_id" });

    const { data: app } = await svc.from("finance_applications")
      .select("id, phone, email, first_name, full_name, created_at")
      .eq("id", application_id)
      .maybeSingle();
    if (!app) return json(200, { ok: true, skipped: "application_not_found" });

    const a: any = app;
    const phone27 = sanitizeWaPhone(a.phone);
    if (!phone27) return json(200, { ok: true, skipped: "no_phone" });
    // Match both stored formats (0-prefix and 27-prefix).
    const phone0 = "0" + phone27.slice(2);
    const email = String(a.email ?? "").trim().toLowerCase();

    // Prior DECLINED application for the same client (exclude this new row).
    const orParts = [`phone.in.("${phone27}","${phone0}")`];
    if (email && email.includes("@")) orParts.push(`email.eq.${email}`);
    const { data: priors } = await svc.from("finance_applications")
      .select("id, status, status_updated_at, updated_at")
      .neq("id", application_id)
      .eq("status", "declined")
      .or(orParts.join(","))
      .limit(20);
    const cutoff = Date.now() - SIX_MONTHS_MS;
    const recentDecline = (priors ?? []).find((p: any) => {
      const t = p.status_updated_at || p.updated_at;
      return t && new Date(t).getTime() >= cutoff;
    });
    if (!recentDecline) return json(200, { ok: true, skipped: "no_recent_decline" });

    // Anti-spam: one of these per phone per 30 days.
    const since = new Date(Date.now() - DEDUPE_DAYS * 24 * 3600 * 1000).toISOString();
    const { data: prevSends } = await svc.from("client_audit_logs")
      .select("id")
      .eq("action_type", "client_message")
      .ilike("note", "%reapplied_declined%")
      .in("client_phone", [phone27, phone0, String(a.phone ?? "")])
      .gte("created_at", since)
      .limit(1);
    if ((prevSends ?? []).length > 0) return json(200, { ok: true, skipped: "recently_sent" });

    const firstName = String(a.first_name ?? "").trim()
      || String(a.full_name ?? "").trim().split(/\s+/)[0]
      || "there";
    const r = await sendTemplateByKey("reapplied_declined", a.phone, { name: firstName }, {
      applicationId: application_id, clientEmail: a.email ?? null,
    });
    console.log("[notify-reapplied-declined] result:", JSON.stringify(r).slice(0, 300));
    return json(200, { ok: true, prior_decline: recentDecline.id, result: r });
  } catch (e: any) {
    console.error("[notify-reapplied-declined]", e?.message || e);
    return json(500, { ok: false, error: e?.message || "unknown" });
  }
});
