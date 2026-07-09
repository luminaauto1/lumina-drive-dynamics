// api/stats.js — fast read of the latest dashboard numbers (from the snapshot
// written by /api/refresh-stats) plus the current open-escalation count.
//
//   GET /api/stats     Header: x-admin-secret: <BATCH_SECRET>
//
// Returns the most recent snapshot { total, read, unread, tags{}, credit{},
// licence{}, income{}, journey{}, openEscalations, at }. If none exists yet,
// returns the bundled point-in-time analytics.json as a fallback.

const fs = require("fs");
const path = require("path");

function supa() {
  if (!process.env.SUPABASE_URL) return null;
  const { createClient } = require("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

module.exports = async (req, res) => {
  if (req.headers["x-admin-secret"] !== process.env.BATCH_SECRET) return res.status(401).json({ ok: false, error: "unauthorized" });
  const db = supa();
  try {
    if (db) {
      const { data } = await db.from("stats_snapshot").select("data,created_at").order("created_at", { ascending: false }).limit(1);
      if (data && data.length) {
        // live open-escalation count on top of the snapshot
        const { count } = await db.from("escalation_queue").select("id", { count: "exact", head: true }).eq("status", "open");
        return res.status(200).json({ ok: true, source: "snapshot", stats: { ...data[0].data, openEscalations: count || 0, snapshotAt: data[0].created_at } });
      }
    }
    // fallback: bundled snapshot
    const a = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "analytics.json"), "utf8"));
    return res.status(200).json({ ok: true, source: "bundled", stats: { total: a.totals.total_leads, read: a.totals.read, unread: a.totals.unread, tags: a.tags, credit: a.credit_profile, licence: a.licence, income: a.income, journey: a.journey, openEscalations: 0, snapshotAt: a.generated } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
