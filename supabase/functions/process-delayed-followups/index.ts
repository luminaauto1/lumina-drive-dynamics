// Daily CRON: scans declined/blacklisted finance applications that have been
// in that terminal state for >= 3 months and have not yet received the
// 3-month re-engagement WhatsApp, dispatches via EasySocial, and stamps
// `followup_sent = true` only on HTTP 200 to guarantee idempotency.
//
// Triggered by pg_cron once per 24h. No external callers — JWT not required,
// but we accept POST/GET from any source: the function is harmless to invoke
// (only acts on the queried, time-gated subset).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const TEMPLATE_URL_PREFIX =
  "https://api.easysocial.in/api/v1/wa-templates/send/cmpdvm23v0bzs78xpcv0qgov0/19514/4026/API/";

const sanitizePhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "27" + d.slice(1);
  if (d.startsWith("27") === false && d.length === 9) d = "27" + d;
  if (d.length < 10 || d.length > 15) return null;
  return d;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const threeMonthsAgoIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();

  const { data: rows, error } = await supabase
    .from("finance_applications")
    .select("id, full_name, first_name, phone, status, updated_at, followup_sent")
    .in("status", ["declined", "blacklisted"])
    .eq("followup_sent", false)
    .lte("updated_at", threeMonthsAgoIso)
    .not("updated_at", "is", null)
    .not("phone", "is", null)
    .limit(250);

  if (error) {
    console.error("[process-delayed-followups] query failed", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<Record<string, unknown>> = [];
  for (const row of rows ?? []) {
    const phone = sanitizePhone(row.phone);
    const name =
      (row.first_name && String(row.first_name).trim()) ||
      (row.full_name && String(row.full_name).trim().split(/\s+/)[0]) ||
      "Client";

    if (!phone) {
      results.push({ id: row.id, skipped: "invalid_phone" });
      continue;
    }

    const url = `${TEMPLATE_URL_PREFIX}${phone}?body1=${encodeURIComponent(name)}`;
    console.log("[process-delayed-followups] →", row.id, url);

    let httpStatus = 0;
    let body: any = null;
    try {
      const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
      httpStatus = res.status;
      const text = await res.text();
      try { body = JSON.parse(text); } catch { body = { raw: text }; }
    } catch (e) {
      console.error("[process-delayed-followups] fetch failed", row.id, e);
      results.push({ id: row.id, error: String((e as Error).message ?? e) });
      continue;
    }

    const ok = httpStatus === 200 && body?.success !== false;
    if (ok) {
      const { error: upErr } = await supabase
        .from("finance_applications")
        .update({ followup_sent: true })
        .eq("id", row.id);
      if (upErr) {
        console.error("[process-delayed-followups] update failed", row.id, upErr);
        results.push({ id: row.id, dispatched: true, flag_update_failed: upErr.message });
      } else {
        results.push({ id: row.id, dispatched: true });
      }
    } else {
      results.push({ id: row.id, dispatched: false, status: httpStatus, body });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, scanned: rows?.length ?? 0, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
