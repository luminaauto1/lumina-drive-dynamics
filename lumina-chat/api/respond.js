// api/respond.js  —  Vercel serverless function (REALTIME path).
//
// This is the standalone "brain". EasySocial's built-in API node (in your
// chatflow) calls this endpoint for every incoming WhatsApp message:
//   GET  https://<your-site>/api/respond?leadId=[leadId]&message=[user_input]&name=[name]&phone=[phone]
// We run the deterministic engine and return EasySocial's expected JSON, which
// EasySocial then delivers to the user on WhatsApp. No third-party tools.
//
// Response shapes (EasySocial "API Basic Message" / "API Interactive Button"):
//   text     -> { data: { body_text: "..." } }
//   buttons  -> { data: { interactive: { type:"button", body:{text}, action:{buttons:[...]} } } }
//
// When the engine is not confident, we DO NOT guess: we return a soft holding
// line and record an escalation so a human answers. (Optional: return empty to
// let EasySocial fall through to a human-handoff node.)

const { decide } = require("../engine/engine.js");
const { getKB } = require("../engine/kb.js");
const es = require("../engine/easysocial.js");
const { buildContext } = require("../engine/context.js");

let sb = null;
function supa() {
  if (sb) return sb;
  if (!process.env.SUPABASE_URL) return null;
  const { createClient } = require("@supabase/supabase-js");
  sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return sb;
}

// A neutral holding line when we must hand to a human (kept human & on-brand).
const HOLDING = "Thanks for the message! Let me get that sorted for you and I’ll be right back with you shortly. 🙏";

module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const text = (q.message || q.text || "").toString();
    const leadId = q.leadId || q.lead_id || null;
    const name = q.name || "";
    const phone = q.phone || "";

    const kb = await getKB();

    // Read the WHOLE conversation so a question buried above an auto-reply still gets answered.
    let messages = [];
    try { if (leadId) messages = await es.getAllMessages(leadId); } catch (_) {}
    const leadObj = {
      id: leadId, name, contact_number: phone,
      lead_data: { licence_status: q.licence, credit_profile_status: q.credit, income_status: q.income, net_income: q.net_income, marital_status: q.marital, bank: q.bank, name },
      latest_tags: q.tags ? String(q.tags).split(",").map((x) => ({ title: x.trim() })) : [],
    };
    const context = buildContext(messages, leadObj, kb);

    // Realtime: the user just messaged, so we are inside the 24h window.
    const state = {
      lead_id: leadId, name, phone, tags: context.tags,
      last_user_message_at: new Date().toISOString(),
      last_inbound_text: text,
    };

    const decision = decide({ text, state, kb, now: new Date(), context });
    decision.name = name; // for {{name}} personalization in output

    await logDecision({ leadId, phone, text, decision });

    // Build EasySocial response.
    if (decision.action === "funnel" && Array.isArray(decision.buttons) && decision.buttons.length) {
      return res.status(200).json(interactive(decision.outbound_text, decision.buttons));
    }
    if ((decision.action === "qr" || decision.action === "template" || decision.action === "funnel" || decision.action === "learned" || decision.action === "sequence") && decision.outbound_text) {
      return res.status(200).json({ data: { body_text: fill(decision.outbound_text, name) } });
    }

    // Escalate: record + return a holding message so the client isn't left hanging.
    await queueEscalation({ leadId, phone, name, text, reason: decision.reason, chat_url: es.chatUrl(leadId) });
    return res.status(200).json({ data: { body_text: HOLDING } });
  } catch (e) {
    console.error("respond error:", e);
    // Fail safe: never break EasySocial's flow; hand to human.
    return res.status(200).json({ data: { body_text: HOLDING } });
  }
};

function fill(msg, name) {
  return (msg || "").replace(/\{\{\s*name\s*\}\}/gi, name || "").trim();
}

function interactive(bodyText, buttonTitles) {
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

async function logDecision({ leadId, phone, text, decision }) {
  const db = supa(); if (!db) return;
  try {
    await db.from("reply_log").insert({
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
  } catch (e) { console.error("logDecision:", e.message); }
}

async function queueEscalation({ leadId, phone, name, text, reason, chat_url }) {
  const db = supa(); if (!db) return;
  try {
    await db.from("escalation_queue").insert({
      lead_id: leadId ? Number(leadId) : null,
      phone, name, inbound_text: text, reason, chat_url, status: "open",
    });
  } catch (e) { console.error("queueEscalation:", e.message); }
}
