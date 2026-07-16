// notify-pre-approval-internal — "client pre-approved" WhatsApp to the STAFF
// numbers (NOT the client).
//
// QUEUE + DRAIN ARCHITECTURE (2026-07-16, owner: "marked 16 pre-approved, got
// 1 notification"). Burst sends die at EasySocial, so sends are never fired
// inline anymore:
//   1. A DB trigger (enqueue_pre_approval_notify) inserts one queue row per
//      staff recipient on EVERY transition into pre_approved — bulk actions,
//      raw SQL and closed browsers included. Recipients come from
//      integration_settings 'pre_approval_notify' (Settings-editable).
//   2. THIS function drains the queue: one global drainer at a time (DB
//      time-lock), one message every ~2s, dispatchWa retry + one extra pass,
//      up to 3 attempts per row, every attempt audit-logged.
//   3. Drains are kicked by the app's status hook (fast path) and by pg_cron
//      every minute (guaranteed path) via taskos_invoke → x-taskos-cron.
//
// TESTING: pass { test_phone: "0816783511" } for a DIRECT send to only that
// number (no queue involved).
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { checkCronSecret } from "../_shared/taskos/cron.ts";
import { getWaTemplate, buildWaSendUrl, dispatchWa, sanitizeWaPhone, logClientSend } from "../_shared/waTemplates.ts";

const GAP_MS = 2000;          // spacing between consecutive sends
const MAX_ATTEMPTS = 3;       // per queue row
const DRAIN_BUDGET_MS = 45_000; // leave headroom before the runtime limit

interface QueueRow {
  id: number;
  application_id: string | null;
  client_name: string;
  client_phone: string | null;
  staff_phone: string;
  attempts: number;
}

function svcHeaders(): Record<string, string> {
  const SK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": "application/json" };
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const SU = Deno.env.get("SUPABASE_URL")!;
  const res = await fetch(`${SU}/rest/v1/rpc/${name}`, {
    method: "POST", headers: svcHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`[rpc ${name}]`, res.status, (await res.text()).slice(0, 200)); return null; }
  return await res.json().catch(() => null);
}

async function patchRow(id: number, patch: Record<string, unknown>): Promise<void> {
  const SU = Deno.env.get("SUPABASE_URL")!;
  await fetch(`${SU}/rest/v1/pre_approval_notify_queue?id=eq.${id}`, {
    method: "PATCH", headers: { ...svcHeaders(), Prefer: "return=minimal" }, body: JSON.stringify(patch),
  }).catch((e) => console.error("[queue patch]", id, e));
}

/** Drain the queue: global lock → claim → send with spacing → mark. */
async function drain(): Promise<{ drained: number; failed: number; busy?: boolean }> {
  const gotLock = await rpc<boolean>("try_pre_approval_drain_lock", {});
  if (gotLock !== true) return { drained: 0, failed: 0, busy: true };

  const started = Date.now();
  let drained = 0, failed = 0;
  try {
    const tpl = await getWaTemplate("pre_approval_internal");
    if (!tpl || tpl.active === false || !tpl.send_url) {
      console.log("[drain] template missing/disabled — leaving queue untouched");
      return { drained: 0, failed: 0 };
    }

    while (Date.now() - started < DRAIN_BUDGET_MS) {
      const batch = (await rpc<QueueRow[]>("claim_pre_approval_notifies", { batch: 5 })) ?? [];
      if (batch.length === 0) break;

      for (const row of batch) {
        if (drained + failed > 0) await new Promise((r) => setTimeout(r, GAP_MS));

        const phone = sanitizeWaPhone(row.staff_phone);
        if (!phone) {
          await patchRow(row.id, { status: "failed", last_status: 0 });
          failed++;
          continue;
        }
        const url = buildWaSendUrl(tpl.send_url, phone, {
          name: row.client_name, mobilenumber: row.client_phone ?? "N/A",
        });
        if (!url) { await patchRow(row.id, { status: "failed", last_status: 0 }); failed++; continue; }

        let r = await dispatchWa(url);
        if (!r.ok) {
          await new Promise((res) => setTimeout(res, 1500));
          r = await dispatchWa(url);
        }
        console.log("[drain] row", row.id, "→", phone, "ok:", r.ok, "status:", r.status);
        await logClientSend({
          kind: `pre_approval_internal → staff (queue #${row.id}, attempt ${row.attempts})`,
          rawPhone: phone, ok: r.ok,
          applicationId: row.application_id,
          detail: r.ok ? `re: ${row.client_name}` : `re: ${row.client_name} — status ${r.status}`,
        });

        if (r.ok) {
          await patchRow(row.id, { status: "sent", sent_at: new Date().toISOString(), last_status: r.status });
          drained++;
        } else if (row.attempts >= MAX_ATTEMPTS) {
          await patchRow(row.id, { status: "failed", last_status: r.status });
          failed++;
        } else {
          // Back to queued — reclaimed (with spacing) later this run or next.
          await patchRow(row.id, { status: "queued", last_status: r.status });
          failed++;
        }

        if (Date.now() - started >= DRAIN_BUDGET_MS) break;
      }
    }
  } finally {
    await rpc("release_pre_approval_drain_lock", {});
  }
  return { drained, failed };
}

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  // Auth: internal key OR the TaskOS cron secret (pg_cron drains every minute).
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const keyGuard = checkInternalKey(req);
  if (keyGuard && !(await checkCronSecret(req, svc))) return keyGuard;

  try {
    const payload = await req.json().catch(() => ({}));

    // TEST MODE — direct send to exactly one number, queue untouched.
    if (payload?.test_phone) {
      const phone = sanitizeWaPhone(payload.test_phone);
      if (!phone) return json(400, { success: false, error: "invalid test_phone" });
      const tpl = await getWaTemplate("pre_approval_internal");
      if (!tpl) return json(200, { success: true, skipped: "template_row_missing" });
      if (tpl.active === false) return json(200, { success: true, skipped: "disabled" });
      let fullName = String(payload.client_name ?? "").trim()
        || [payload.first_name, payload.last_name].filter(Boolean).join(" ").trim()
        || "Unknown Client";
      const url = buildWaSendUrl(tpl.send_url, phone, {
        name: fullName, mobilenumber: String(payload.client_phone ?? "").trim() || "N/A",
      });
      if (!url) return json(200, { success: false, skipped: "no_send_url" });
      const r = await dispatchWa(url);
      await logClientSend({ kind: "pre_approval_internal → staff (TEST)", rawPhone: phone, ok: r.ok, detail: `re: ${fullName}` });
      return json(200, { success: r.ok, test_mode: true, results: [{ phone, ok: r.ok, status: r.status, body: r.body }] });
    }

    // DEFAULT + {action:'drain'} — drain the queue. The DB trigger already
    // enqueued the rows; the app's hook invoke just makes delivery immediate
    // instead of waiting for the next cron minute.
    const out = await drain();
    return json(200, { success: true, ...out });
  } catch (error: any) {
    return json(500, { error: error.message });
  }
});
