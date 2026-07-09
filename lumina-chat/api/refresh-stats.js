// api/refresh-stats.js — recompute the dashboard numbers from EasySocial and
// store a snapshot. The dashboard reads the snapshot via /api/stats (fast).
//
//   POST /api/refresh-stats   Header: x-admin-secret: <BATCH_SECRET>
//   Body (optional): { maxPages }   // default: all (~335). Uses a time budget.
//
// Counts leads by tag, credit profile, licence, income and journey. For ~6,700
// leads this can take a while; run it on a schedule (Vercel Cron) or on demand.
// If it hits the time budget it saves what it has and records `partial:true`.

const es = require("../engine/easysocial.js");

function supa() {
  if (!process.env.SUPABASE_URL) return null;
  const { createClient } = require("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
const inc = (o, k) => { k = (k == null || k === "") ? "(none)" : String(k).trim(); o[k] = (o[k] || 0) + 1; };

module.exports = async (req, res) => {
  if (req.headers["x-admin-secret"] !== process.env.BATCH_SECRET) return res.status(401).json({ ok: false, error: "unauthorized" });
  const started = Date.now();
  const budgetMs = 25000;
  const maxPages = (req.body && req.body.maxPages) || 400;

  const S = { total: 0, read: 0, unread: 0, tags: {}, credit: {}, licence: {}, income: {}, journey: {} };
  let page = 1, partial = false;
  try {
    for (; page <= maxPages; page++) {
      if (Date.now() - started > budgetMs) { partial = true; break; }
      const { leads } = await es.listLeads({ page, limit: 20, tab: "all" });
      if (!leads.length) break;
      for (const l of leads) {
        S.total++; (l.unread === 0) ? S.read++ : S.unread++;
        (l.latest_tags || []).forEach((t) => inc(S.tags, t.title || t.name));
        inc(S.journey, l.journey);
        const d = l.lead_data || {};
        if (d.credit_profile_status) inc(S.credit, d.credit_profile_status);
        if (d.licence_status) inc(S.licence, d.licence_status);
        if (d.income_status) inc(S.income, d.income_status);
      }
    }

    const db = supa();
    let openEscalations = 0;
    if (db) {
      const { count } = await db.from("escalation_queue").select("id", { count: "exact", head: true }).eq("status", "open");
      openEscalations = count || 0;
    }
    const snapshot = { ...S, openEscalations, pagesScanned: page - 1, partial, tookMs: Date.now() - started, at: new Date().toISOString() };
    if (db) await db.from("stats_snapshot").insert({ data: snapshot });

    return res.status(200).json({ ok: true, snapshot });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message, pagesScanned: page - 1 });
  }
};
