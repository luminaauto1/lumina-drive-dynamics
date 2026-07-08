// api/escalations.js — the dashboard's "needs you" queue.
//
//   GET /api/escalations?status=open&limit=100
//   Header: x-admin-secret: <BATCH_SECRET>
//
// Returns the chats the bot was unsure about, so you can type an answer
// (which POSTs to /api/answer). Newest first.

function supa() {
  if (!process.env.SUPABASE_URL) return null;
  const { createClient } = require("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

module.exports = async (req, res) => {
  if (req.headers["x-admin-secret"] !== process.env.BATCH_SECRET) return res.status(401).json({ ok: false, error: "unauthorized" });
  const db = supa();
  if (!db) return res.status(200).json({ ok: true, items: [], note: "Supabase not configured" });

  const status = (req.query && req.query.status) || "open";
  const limit = Math.min(Number((req.query && req.query.limit) || 100), 500);
  try {
    const { data, error } = await db.from("escalation_queue")
      .select("id,lead_id,phone,name,inbound_text,reason,chat_url,status,created_at")
      .eq("status", status).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return res.status(200).json({ ok: true, count: data.length, items: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
