// chat-respond — REALTIME reply endpoint for the EasySocial API node.
// Port of lumina-chat/api/respond.js upgraded to the smart brain (decideSmart):
// EasySocial's chatbot calls
//   GET /functions/v1/chat-respond?leadId=[leadId]&message=[user_input]&name=[name]&phone=[phone]&licence=..&credit=..&income=..&tags=..
// and receives { data: { body_text } } (or an interactive-button block) which it
// sends to the client on WhatsApp. No auth by design (mirrors the original
// /api/respond) — the endpoint holds no secrets and only returns reply text;
// every decision is logged to reply_log and unsure ones to escalation_queue.
// deno-lint-ignore-file no-explicit-any

import { decideSmart, buildSmartKb } from "../_shared/chat/brain.ts";
import { getKB, getChatConfig, svc } from "../_shared/chat/kb.ts";
import * as es from "../_shared/chat/easysocial.ts";
import { buildContext } from "../_shared/chat/context.ts";
import { holdingLine } from "../_shared/chat/composer.ts";

const FALLBACK_HOLDING = "Thanks for the message! Let me get that sorted for you and I’ll be right back with you shortly. 🙏";

let _smart: any = null;
let _smartAt = 0;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const q = Object.fromEntries(url.searchParams.entries());
    const text = (q.message || q.text || "").toString();
    const leadId = q.leadId || q.lead_id || null;
    const name = q.name || "";
    const phone = q.phone || "";

    const cfg = await getChatConfig();
    if (!cfg.active) {
      // Responder disabled in settings → hand everything to a human quietly.
      await queueEscalation({ leadId, phone, name, text, reason: "responder_disabled", chat_url: es.chatUrl(leadId || "") });
      return json({ data: { body_text: FALLBACK_HOLDING } });
    }

    const kb = await getKB();
    if (!_smart || Date.now() - _smartAt > 5 * 60 * 1000) {
      _smart = buildSmartKb(kb);
      _smartAt = Date.now();
    }

    // Read the WHOLE conversation so buried questions still get answered.
    let messages: any[] = [];
    try { if (leadId && cfg.es_token) messages = await es.getAllMessages(cfg, leadId); } catch (_) { /* reads best-effort */ }
    const leadObj = {
      id: leadId, name, contact_number: phone,
      lead_data: {
        licence_status: q.licence, credit_profile_status: q.credit, income_status: q.income,
        net_income: q.net_income, marital_status: q.marital, bank: q.bank, name,
      },
      latest_tags: q.tags ? String(q.tags).split(",").map((x) => ({ title: x.trim() })) : [],
    };
    const context = buildContext(messages, leadObj, kb);

    const state = {
      lead_id: leadId, name, phone, tags: context.tags,
      last_user_message_at: new Date().toISOString(),
      last_inbound_text: text,
    };

    const decision = decideSmart({ text, state, kb, smart: _smart, now: new Date(), context, leadKey: String(leadId || phone || name) });
    decision.name = name;

    await logDecision({ leadId, phone, text, decision });

    if (decision.action === "funnel" && Array.isArray(decision.buttons) && decision.buttons.length) {
      return json(interactive(fill(decision.outbound_text || "", name), decision.buttons));
    }
    if ((decision.action === "qr" || decision.action === "template" || decision.action === "funnel" || decision.action === "learned" || decision.action === "sequence") && decision.outbound_text) {
      return json({ data: { body_text: fill(decision.outbound_text, name) } });
    }

    // Escalate: record + return a varied holding line so the client isn't left hanging.
    await queueEscalation({ leadId, phone, name, text, reason: decision.reason, chat_url: es.chatUrl(leadId || "") });
    const hold = decision.holding_text || holdingLine({ leadKey: String(leadId || phone || "x") }) || FALLBACK_HOLDING;
    return json({ data: { body_text: hold } });
  } catch (e) {
    console.error("chat-respond error:", e);
    return json({ data: { body_text: FALLBACK_HOLDING } });
  }
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function fill(msg: string, name: string): string {
  return (msg || "").replace(/\{\{\s*name\s*\}\}/gi, name || "").trim();
}

function interactive(bodyText: string, buttonTitles: string[]) {
  return {
    data: {
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttonTitles.slice(0, 3).map((t, i) => ({
            type: "reply",
            reply: { id: "opt_" + (i + 1), title: t.slice(0, 20) },
          })),
        },
      },
    },
  };
}

async function logDecision({ leadId, phone, text, decision }: any) {
  try {
    await svc().from("reply_log").insert({
      lead_id: leadId ? Number(leadId) : null,
      phone, inbound_text: text,
      matched_intent: decision.reason,
      action: decision.action,
      reply_ref: decision.reply_ref != null ? String(decision.reply_ref) : null,
      outbound_text: decision.outbound_text || null,
      confidence: decision.confidence ?? null,
      within_window: decision.within_window ?? null,
      status: decision.action === "escalate" ? "escalated" : "sent",
    });
  } catch (e) { console.error("logDecision:", (e as Error).message); }
}

async function queueEscalation({ leadId, phone, name, text, reason, chat_url }: any) {
  try {
    await svc().from("escalation_queue").insert({
      lead_id: leadId ? Number(leadId) : null,
      phone, name, inbound_text: text, reason, chat_url, status: "open",
    });
  } catch (e) { console.error("queueEscalation:", (e as Error).message); }
}
