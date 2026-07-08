// context.js — reads the ENTIRE conversation (not just the last message) and
// distils the context the engine needs to answer well:
//   - profile: what we already know (licence / credit / income / etc.) from the
//     EasySocial lead fields (authoritative) — so we don't re-ask.
//   - effectiveInbound: EVERY client question still waiting on us, joined — so a
//     question buried above an automated reply still gets answered.
//   - alreadySent: which canned replies we've already sent (don't repeat them).
//   - lastBotQuestion: the last thing the bot asked (to read short answers in context).
// Pure/deterministic. No AI.

function textOf(m) {
  if (!m) return "";
  const v = m.message;
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    if (v.body && (v.body.text || typeof v.body === "string")) return v.body.text || v.body;
    if (v.text) return typeof v.text === "string" ? v.text : v.text.body || "";
    if (v.button_reply) return v.button_reply.title || "";
    if (v.list_reply) return v.list_reply.title || "";
    if (v.caption) return v.caption;
  }
  return "";
}
function norm(s) { return (s || "").toString().toLowerCase().replace(/\s+/g, " ").trim(); }

// EasySocial funnel answers -> our internal enums.
const CREDIT_MAP = {
  "blacklisted/debt review": "debt_review", "blacklisted": "debt_review",
  "missed many payments": "missed", "no credit record": "none",
  "good credit record": "good", "its looking better": "improving", "im not sure": "unsure",
};
const LICENCE_MAP = { "yes i do": "yes", "no licence yet": "no", "i only have learners": "learners" };
const INCOME_MAP = { "yes sir!": "yes", "not yet": "no", "it's complicated": "complicated" };
const pick = (map, v) => (v == null ? null : map[String(v).trim().toLowerCase()] || null);

/**
 * @param {Array}  messages - full transcript (from es.getAllMessages)
 * @param {Object} lead     - the EasySocial lead object (has lead_data + latest_tags)
 * @param {Object} kb       - knowledge base (for matching already-sent quick replies)
 */
function buildContext(messages, lead, kb) {
  const sorted = (messages || []).slice().sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const d = (lead && lead.lead_data) || {};

  const profile = {
    licence: pick(LICENCE_MAP, d.licence_status),
    credit: pick(CREDIT_MAP, d.credit_profile_status),
    income: pick(INCOME_MAP, d.income_status),
    net_income: d.net_income || null,
    marital: d.marital_status || null,
    bank: d.bank || null,
    name: (lead && lead.name) || d.name || "",
  };
  const tags = (lead && (lead.latest_tags || []).map((t) => t.title || t.name || t)) || [];

  // Index of the last REAL (human) reply. Automated funnel/template self-messages
  // (sender_id == null) do NOT count as answering the client.
  let lastHuman = -1;
  sorted.forEach((m, i) => { if (m.sent_by === "self" && m.sender_id != null) lastHuman = i; });

  // Every client free-text message since the last human reply = still unanswered.
  const unanswered = [];
  for (let i = lastHuman + 1; i < sorted.length; i++) {
    const m = sorted[i];
    if (m.sent_by === "user") {
      const t = textOf(m).trim();
      // ignore pure button/list selections that are funnel navigation (short, exact option titles)
      if (t && t.length > 1) unanswered.push(t);
    }
  }
  // Fallback: nothing found (e.g. no human ever replied) -> take the client's latest turn.
  if (!unanswered.length) {
    for (let i = sorted.length - 1; i >= 0 && unanswered.length < 3; i--) {
      const m = sorted[i];
      if (m.sent_by === "user") { const t = textOf(m).trim(); if (t) unanswered.unshift(t); }
      else if (m.sent_by === "self" && m.sender_id != null) break;
    }
  }

  // Last question the bot asked (self text containing '?').
  let lastBotQuestion = "";
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].sent_by === "self") { const t = textOf(sorted[i]); if (t && t.includes("?")) { lastBotQuestion = t; break; } }
  }

  // Which quick replies have we already sent? (so we don't repeat them)
  const alreadySent = new Set();
  const qr = (kb && kb.quick_replies) || [];
  for (const m of sorted) {
    if (m.sent_by !== "self") continue;
    const t = norm(textOf(m));
    if (!t) continue;
    for (const q of qr) {
      const head = norm(q.message).slice(0, 24);
      if (head && t.startsWith(head)) alreadySent.add(q.keyword);
    }
  }

  const uniqUnanswered = [...new Set(unanswered)].slice(-4);
  const effectiveInbound = uniqUnanswered.join("  ||  ");

  return {
    profile,
    tags,
    unanswered: uniqUnanswered,
    effectiveInbound,
    lastBotQuestion,
    alreadySent: [...alreadySent],
    messageCount: sorted.length,
    latestClientText: uniqUnanswered.length ? uniqUnanswered[uniqUnanswered.length - 1] : "",
  };
}

module.exports = { buildContext, _internals: { textOf, pick, CREDIT_MAP, LICENCE_MAP, INCOME_MAP } };
