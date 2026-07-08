// api/answer.js — the "bot was unsure, a human types the answer" endpoint.
//
//   POST /api/answer
//   Header: x-admin-secret: <BATCH_SECRET>
//   Body: { leadId, phone, inbound_text, message, learn?:true, escalationId? }
//
// It (1) sends your typed message to the client via EasySocial, (2) if learn
// is true, stores it as an exact-message learned reply so next time the same
// message auto-answers, and (3) closes the escalation and logs it.
// Respects ES_DRY_RUN (won't actually send until you enable live sends).

const es = require("../engine/easysocial.js");
const { normKey } = require("../engine/engine.js");

function supa() {
  if (!process.env.SUPABASE_URL) return null;
  const { createClient } = require("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

module.exports = async (req, res) => {
  if (req.headers["x-admin-secret"] !== process.env.BATCH_SECRET) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "use POST" });

  const b = (typeof req.body === "object" && req.body) || {};
  const { leadId, phone, inbound_text, message, escalationId } = b;
  const learn = b.learn !== false; // default: remember it
  if (!leadId || !message) return res.status(400).json({ ok: false, error: "leadId and message required" });

  const db = supa();
  try {
    // 1) send to the client through EasySocial
    const sendResult = await es.sendMessage(leadId, message);
    const sent = !(sendResult && sendResult.dryRun);

    // 2) remember it (exact-message) so the bot answers this itself next time
    let learned = false;
    if (learn && inbound_text && db) {
      const key = normKey(inbound_text);
      if (key) {
        const { error } = await db.from("learned_reply").upsert(
          { match_key: key, sample_inbound: inbound_text, message, created_by: b.created_by || "dashboard", active: true },
          { onConflict: "match_key" }
        );
        learned = !error;
      }
    }

    // 3) close the escalation + log
    if (db) {
      if (escalationId) await db.from("escalation_queue").update({ status: "handled", handled_at: new Date().toISOString(), handled_by: b.created_by || "dashboard" }).eq("id", escalationId);
      await db.from("reply_log").insert({
        lead_id: Number(leadId), phone, inbound_text: inbound_text || null,
        matched_intent: "human_answer", action: "learned", reply_ref: "dashboard",
        outbound_text: message, confidence: 1, status: sent ? "sent" : "dry_run",
      });
    }

    return res.status(200).json({ ok: true, sent, learned, dryRun: !sent });
  } catch (e) {
    console.error("answer error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
