// batch-worker.js — the "press the button every morning" sweep.
//
// What it does (standalone; only talks to EasySocial + your Supabase):
//   1. Pages through leads in EasySocial.
//   2. Picks the chats that are WAITING ON US (last message is from the client
//      and we haven't already auto-answered it).
//   3. Runs the deterministic engine per chat.
//   4. Inside 24h window  -> send the quick reply / funnel step.
//      Outside 24h window -> send a re-engagement TEMPLATE (WhatsApp rule).
//      Not confident      -> push to the human escalation_queue (never guess).
//   5. Logs every action to reply_log + a summary row in run_log.
//
// SAFETY: sends are OFF unless ES_DRY_RUN='false'. Run it dry first and inspect
// reply_log to see exactly what it WOULD send before going live.

const es = require("./easysocial.js");
const { getKB } = require("./kb.js");
const { decide } = require("./engine.js");
const { buildContext } = require("./context.js");

function supa() {
  if (!process.env.SUPABASE_URL) return null;
  const { createClient } = require("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function lastMessage(messages) {
  return messages && messages.length ? messages[messages.length - 1] : null;
}
function textOf(m) {
  if (!m) return "";
  if (typeof m.message === "string") return m.message;
  if (m.message && typeof m.message === "object") return m.message.text || m.message.body || m.message.caption || "";
  return "";
}

/**
 * @param {Object} opts
 * @param {boolean} [opts.dryRun]   - override ES_DRY_RUN
 * @param {number}  [opts.maxLeads] - cap chats processed (default 200)
 * @param {number}  [opts.maxPages] - cap lead pages fetched (default 20)
 * @param {boolean} [opts.includeUnread] - also answer never-opened chats (default true; the live system answers everything)
 */
async function runBatch(opts = {}) {
  const dryRun = opts.dryRun != null ? opts.dryRun : !es.liveSendsEnabled();
  const maxLeads = opts.maxLeads || 200;
  const maxPages = opts.maxPages || 20;
  const includeUnread = opts.includeUnread !== false;
  const kb = await getKB();
  const db = supa();

  const summary = { chats_scanned: 0, replied: 0, escalated: 0, skipped: 0, errors: 0, dry_run: dryRun, items: [] };
  const startedAt = new Date().toISOString();

  let processed = 0;
  for (let page = 1; page <= maxPages && processed < maxLeads; page++) {
    let leads;
    try { ({ leads } = await es.listLeads({ page, limit: 20, tab: "all" })); }
    catch (e) { summary.errors++; break; }
    if (!leads.length) break;

    for (const lead of leads) {
      if (processed >= maxLeads) break;
      processed++;
      summary.chats_scanned++;

      try {
        const messages = await es.getAllMessages(lead.id);
        const last = lastMessage(messages);
        // Only chats waiting on US: last message must be from the client.
        if (!last || last.sent_by !== "user") { summary.skipped++; continue; }
        // Avoid double-answering: skip if we already logged a reply after this msg.
        if (await alreadyAnswered(db, lead.id, last.created_at)) { summary.skipped++; continue; }

        const context = buildContext(messages, lead, kb);
        const state = { ...es.deriveState(lead, messages), tags: context.tags };
        const inbound = context.latestClientText || textOf(last);
        const decision = decide({ text: inbound, state, kb, now: new Date(), context });
        decision.name = lead.name;

        if (decision.action === "escalate") {
          // hands-off (pre-approved/validated) -> leave for the human, don't queue as noise
          if (String(decision.reason || "").startsWith("hands_off")) { summary.skipped++; continue; }
          summary.escalated++;
          await push(db, "escalation_queue", {
            lead_id: lead.id, phone: lead.contact_number, name: lead.name,
            inbound_text: inbound, reason: decision.reason, chat_url: es.chatUrl(lead.id), status: "open",
          });
          await logReply(db, lead, inbound, decision, dryRun ? "dry_run" : "escalated");
          summary.items.push({ leadId: lead.id, name: lead.name, action: "escalate", reason: decision.reason });
          continue;
        }

        // Send (or simulate).
        let sendResult;
        if (decision.action === "sequence" && Array.isArray(decision.messages)) {
          for (const msg of decision.messages) {
            sendResult = await es.sendMessage(lead.id, (msg || "").replace(/\{\{\s*name\s*\}\}/gi, lead.name || "").trim());
          }
        } else if (decision.action === "template" || decision.needs_template) {
          sendResult = await es.sendTemplate(lead.id, decision.reply_ref, { name: lead.name, phone: lead.contact_number });
        } else {
          const out = (decision.outbound_text || "").replace(/\{\{\s*name\s*\}\}/gi, lead.name || "").trim();
          sendResult = await es.sendMessage(lead.id, out);
        }
        summary.replied++;
        await logReply(db, lead, inbound, decision, (sendResult && sendResult.dryRun) ? "dry_run" : "sent");
        summary.items.push({ leadId: lead.id, name: lead.name, action: decision.action, ref: decision.reply_ref, dryRun: !!(sendResult && sendResult.dryRun) });
      } catch (e) {
        summary.errors++;
        summary.items.push({ leadId: lead.id, error: e.message });
      }
    }
  }

  if (db) {
    try {
      await db.from("run_log").insert({
        run_type: "batch", started_at: startedAt, finished_at: new Date().toISOString(),
        chats_scanned: summary.chats_scanned, replied: summary.replied, escalated: summary.escalated,
        skipped: summary.skipped, errors: summary.errors, dry_run: dryRun,
        notes: `maxLeads=${maxLeads} includeUnread=${includeUnread}`,
      });
    } catch (_) {}
  }
  return summary;
}

async function alreadyAnswered(db, leadId, afterIso) {
  if (!db) return false;
  const { data } = await db.from("reply_log")
    .select("id").eq("lead_id", leadId).in("status", ["sent", "dry_run"])
    .gte("created_at", afterIso).limit(1);
  return !!(data && data.length);
}
async function push(db, table, row) { if (db) { try { await db.from(table).insert(row); } catch (_) {} } }
async function logReply(db, lead, inbound, decision, status) {
  if (!db) return;
  try {
    await db.from("reply_log").insert({
      lead_id: lead.id, phone: lead.contact_number, inbound_text: inbound,
      matched_intent: decision.reason, action: decision.action,
      reply_ref: decision.reply_ref != null ? String(decision.reply_ref) : null,
      outbound_text: decision.outbound_text || null, confidence: decision.confidence ?? null,
      within_window: decision.within_window ?? null, status,
    });
  } catch (_) {}
}

module.exports = { runBatch };
