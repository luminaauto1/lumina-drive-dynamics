// api/run-batch.js — the endpoint your website BUTTON (or a cron) calls to
// sweep the backlog and auto-answer every waiting chat.
//
//   POST https://<your-site>/api/run-batch
//   Header:  x-batch-secret: <BATCH_SECRET>       (protects the endpoint)
//   Body (optional): { "dryRun": true, "maxLeads": 200 }
//
// Wire your on-site "Answer all chats" button to POST here. Start with
// dryRun:true, review the reply_log table, then set ES_DRY_RUN=false to go live.

const { runBatch } = require("../engine/batch-worker.js");

module.exports = async (req, res) => {
  // Simple shared-secret auth so only your site can trigger it.
  const secret = req.headers["x-batch-secret"];
  if (!process.env.BATCH_SECRET || secret !== process.env.BATCH_SECRET) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "use POST" });
  }
  try {
    const body = typeof req.body === "object" && req.body ? req.body : {};
    const summary = await runBatch({
      dryRun: body.dryRun,
      maxLeads: body.maxLeads,
      includeUnread: body.includeUnread,
    });
    return res.status(200).json({ ok: true, summary });
  } catch (e) {
    console.error("run-batch error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
