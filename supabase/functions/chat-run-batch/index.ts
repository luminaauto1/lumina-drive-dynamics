// chat-run-batch — the "answer all waiting chats" sweep (port of
// lumina-chat/engine/batch-worker.js + api/run-batch.js, upgraded to
// decideSmart). Auth: staff JWT or the internal key. Sends respect the
// dry-run flag in integration_settings ('chat_responder') — simulated until
// the owner explicitly flips it in the Control Panel.
// deno-lint-ignore-file no-explicit-any

import { decideSmart, buildSmartKb } from "../_shared/chat/brain.ts";
import { getKB, getChatConfig, svc } from "../_shared/chat/kb.ts";
import * as es from "../_shared/chat/easysocial.ts";
import { buildContext } from "../_shared/chat/context.ts";
import { requireStaff, corsHeaders } from "../_shared/chat/authz.ts";

function lastMessage(messages: any[]) {
  return messages && messages.length ? messages[messages.length - 1] : null;
}
function textOf(m: any): string {
  if (!m) return "";
  if (typeof m.message === "string") return m.message;
  if (m.message && typeof m.message === "object") return m.message.text || m.message.body || m.message.caption || "";
  return "";
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const guard = await requireStaff(req, cors);
  if (guard) return guard;
  if (req.method !== "POST") return json(cors, 405, { ok: false, error: "use POST" });

  try {
    const body = await req.json().catch(() => ({}));
    const cfg = await getChatConfig();
    if (!cfg.es_token) return json(cors, 200, { ok: false, error: "no_es_token", note: "Paste the EasySocial token in Control Panel settings first." });

    const dryRun = body.dryRun != null ? !!body.dryRun : !es.liveSendsEnabled(cfg);
    const maxLeads = Math.min(Number(body.maxLeads) || cfg.max_leads_per_batch || 200, 500);
    const maxPages = 20;

    const kb = await getKB();
    const smart = buildSmartKb(kb);
    const db = svc();

    const summary: any = { chats_scanned: 0, replied: 0, escalated: 0, skipped: 0, errors: 0, dry_run: dryRun, items: [] };
    const startedAt = new Date().toISOString();

    let processed = 0;
    for (let page = 1; page <= maxPages && processed < maxLeads; page++) {
      let leads: any[];
      try { ({ leads } = await es.listLeads(cfg, { page, limit: 20, tab: "all" })); }
      catch (_e) { summary.errors++; break; }
      if (!leads.length) break;

      for (const lead of leads) {
        if (processed >= maxLeads) break;
        processed++;
        summary.chats_scanned++;
        try {
          const messages = await es.getAllMessages(cfg, lead.id);
          const last = lastMessage(messages);
          if (!last || last.sent_by !== "user") { summary.skipped++; continue; }
          if (await alreadyAnswered(db, lead.id, last.created_at)) { summary.skipped++; continue; }

          const context = buildContext(messages, lead, kb);
          const state = { ...es.deriveState(lead, messages), tags: context.tags };
          const inbound = context.latestClientText || textOf(last);
          const decision = decideSmart({ text: inbound, state, kb, smart, now: new Date(), context, leadKey: String(lead.id) });
          decision.name = lead.name;

          if (decision.action === "escalate") {
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

          let sendResult: any;
          const effectiveCfg = { ...cfg, dry_run: dryRun ? true : cfg.dry_run };
          if (decision.action === "sequence" && Array.isArray(decision.messages)) {
            for (const msg of decision.messages) {
              sendResult = await es.sendMessage(effectiveCfg, lead.id, (msg || "").replace(/\{\{\s*name\s*\}\}/gi, lead.name || "").trim());
            }
          } else if (decision.action === "template" || decision.needs_template) {
            sendResult = await es.sendTemplate(effectiveCfg, lead.id, decision.reply_ref, { name: lead.name, phone: lead.contact_number });
          } else {
            const out = (decision.outbound_text || "").replace(/\{\{\s*name\s*\}\}/gi, lead.name || "").trim();
            sendResult = await es.sendMessage(effectiveCfg, lead.id, out);
          }
          summary.replied++;
          await logReply(db, lead, inbound, decision, (sendResult && sendResult.dryRun) ? "dry_run" : "sent");
          summary.items.push({ leadId: lead.id, name: lead.name, action: decision.action, ref: decision.reply_ref, brain: decision.brain, dryRun: !!(sendResult && sendResult.dryRun) });
        } catch (e) {
          summary.errors++;
          summary.items.push({ leadId: lead.id, error: (e as Error).message });
        }
      }
    }

    try {
      await db.from("run_log").insert({
        run_type: "batch", started_at: startedAt, finished_at: new Date().toISOString(),
        chats_scanned: summary.chats_scanned, replied: summary.replied, escalated: summary.escalated,
        skipped: summary.skipped, errors: summary.errors, dry_run: dryRun,
        notes: `maxLeads=${maxLeads} smart=v2`,
      });
    } catch (_) { /* non-fatal */ }

    return json(cors, 200, { ok: true, summary });
  } catch (e) {
    console.error("chat-run-batch error:", e);
    return json(cors, 500, { ok: false, error: (e as Error).message });
  }
});

function json(cors: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function alreadyAnswered(db: any, leadId: any, afterIso: string): Promise<boolean> {
  const { data } = await db.from("reply_log")
    .select("id").eq("lead_id", leadId).in("status", ["sent", "dry_run"])
    .gte("created_at", afterIso).limit(1);
  return !!(data && data.length);
}
async function push(db: any, table: string, row: any) { try { await db.from(table).insert(row); } catch (_) { /* noop */ } }
async function logReply(db: any, lead: any, inbound: string, decision: any, status: string) {
  try {
    await db.from("reply_log").insert({
      lead_id: lead.id, phone: lead.contact_number, inbound_text: inbound,
      matched_intent: decision.reason, action: decision.action,
      reply_ref: decision.reply_ref != null ? String(decision.reply_ref) : null,
      outbound_text: decision.outbound_text || null, confidence: decision.confidence ?? null,
      within_window: decision.within_window ?? null, status,
    });
  } catch (_) { /* noop */ }
}
