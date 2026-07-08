// engine.js — Lumina Auto deterministic reply engine (NO AI, zero dependencies).
//
// decide() takes a client's inbound text + what we know about the lead + the
// knowledge base, and returns exactly ONE decision:
//   - send a quick reply   (action:'qr')
//   - send a funnel step    (action:'funnel')
//   - send a template       (action:'template')  [used outside the 24h window]
//   - escalate to a human   (action:'escalate')  [when unsure — never guesses]
//
// It is pure and synchronous so it can be unit-tested and run anywhere
// (Vercel function, Supabase Edge Function, Node script).

const DEFAULTS = {
  freeFormHours: 24,        // WhatsApp customer-service window
  confidenceThreshold: 0.60, // below this => escalate to a human
  longMessageChars: 220,     // long + single-intent => treat as ambiguous
};

// ---- helpers ---------------------------------------------------------------

function norm(s) {
  return (s || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
}

// Normalized key for exact-message learned-reply matching (dashboard uses the same rule).
function normKey(s) {
  return (s || "").toString().toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

// Does ANY regex fragment in the list match the text?
function groupMatches(text, patterns) {
  for (const p of patterns) {
    let re;
    try { re = new RegExp(p, "i"); } catch (_) { continue; }
    if (re.test(text)) return true;
  }
  return false;
}

function hoursBetween(aIso, bDate) {
  if (!aIso) return Infinity;
  const a = new Date(aIso).getTime();
  const b = (bDate instanceof Date ? bDate : new Date(bDate)).getTime();
  return (b - a) / 3.6e6;
}

// Is a funnel option title an exact/near match to the inbound text?
function matchFunnelOption(text, funnel) {
  const t = norm(text);
  for (const node of funnel) {
    for (const opt of node.options || []) {
      if (norm(opt.title) === t) return { node, opt };
    }
  }
  return null;
}

// ---- main ------------------------------------------------------------------

/**
 * @param {Object} args
 * @param {string} args.text     - client's inbound message (free text or button title)
 * @param {Object} args.state    - conversation_state row (licence/credit/income/last_user_message_at/...)
 * @param {Object} args.kb       - knowledge_base.json (quick_replies, templates, funnel, intents, escalation, window_policy)
 * @param {Date}   [args.now]    - current time (defaults to new Date())
 * @param {Object} [args.opts]   - overrides (confidenceThreshold, freeFormHours)
 * @returns {Object} decision
 */
function decide({ text, state = {}, kb, now = new Date(), opts = {}, context = null }) {
  const cfg = { ...DEFAULTS, ...opts };
  const ctx = context || {};
  const raw = (text || "").toString();
  const analyzeSrc = (ctx.effectiveInbound && ctx.effectiveInbound.length) ? ctx.effectiveInbound : raw;
  const t = norm(analyzeSrc);          // full unanswered context (buried questions included)
  const tLatest = norm(raw);           // just the latest message (for exact-memory)

  const qrByKeyword = Object.fromEntries((kb.quick_replies || []).map((q) => [q.keyword, q]));
  const funnelByCode = Object.fromEntries((kb.funnel || []).map((n) => [n.code, n]));
  const freeFormHours =
    (kb.window_policy && kb.window_policy.free_form_hours) || cfg.freeFormHours;

  const within =
    hoursBetween(state.last_user_message_at, now) <= freeFormHours;

  const base = {
    inbound: raw,
    analyzed: analyzeSrc,
    within_window: within,
    now: now.toISOString(),
  };

  // Empty / non-text payloads (image, audio, sticker with no caption) -> human.
  if (!t) {
    return {
      ...base,
      action: "escalate",
      reason: "empty_or_media_message",
      confidence: 0,
      outbound_text: null,
    };
  }

  // 1) HARD SAFETY: abuse / legal always escalate, even over a learned reply.
  for (const rule of kb.escalation || []) {
    if (rule.active === false || !rule.hard) continue;
    if (groupMatches(t, rule.patterns)) {
      return {
        ...base,
        action: "escalate",
        reason: rule.name,
        escalation_reason: rule.reason,
        confidence: 0,
        outbound_text: null,
      };
    }
  }

  // 1b) Hands-off tags: pre-approved / validated clients are handled by a human.
  const _tags = (state.tags || []).map((x) => (typeof x === "string" ? x : (x && (x.title || x.name)) || "")).filter(Boolean);
  const _handsOff = (kb.hands_off_tags || []).filter((h) => _tags.includes(h));
  if (_handsOff.length) {
    return { ...base, action: "escalate", reason: "hands_off:" + _handsOff[0], confidence: 0, outbound_text: null };
  }

  // 1c) Learned replies: exact answer a human taught us in the dashboard.
  const _key = normKey(tLatest);
  const _learned = (kb.learned_replies || []).find((L) => L.match_key === _key && L.active !== false);
  if (_learned) {
    return { ...base, action: "learned", reason: "learned_reply", reply_ref: "learned", outbound_text: personalize(_learned.message, base), confidence: 0.99 };
  }

  // 1d) SOFT escalation: no standard answer (rent-to-own, status, "call me").
  //     A learned reply above would have handled it; otherwise hand to a human.
  for (const rule of kb.escalation || []) {
    if (rule.active === false || rule.hard) continue;
    if (groupMatches(t, rule.patterns)) {
      return { ...base, action: "escalate", reason: rule.name, escalation_reason: rule.reason, confidence: 0, outbound_text: null };
    }
  }

  // 2) Exact funnel button reply -> advance the funnel deterministically.
  const fmatch = matchFunnelOption(raw, kb.funnel || []);
  if (fmatch) {
    const nxt = fmatch.opt.next;
    if (nxt && nxt.startsWith("qr:")) {
      return buildQr(base, qrByKeyword, nxt.slice(3), 0.97, "funnel_option", within, kb);
    }
    if (nxt === "ESCALATE" || nxt === "ESCALATE_OR_INTENT") {
      return { ...base, action: "escalate", reason: "funnel_needs_human", confidence: 0, outbound_text: null };
    }
    if (funnelByCode[nxt]) {
      return renderFunnel(base, funnelByCode[nxt], fmatch.opt.set, 0.97, within, kb);
    }
  }

  // 3) INTENT MATCH — evaluate by priority (lowest number first).
  const intents = (kb.intents || [])
    .filter((i) => i.active !== false)
    .slice()
    .sort((a, b) => a.priority - b.priority);

  const matched = [];
  for (const it of intents) {
    // patterns are OR-ed fragments; here each intent = one group.
    if (groupMatches(t, it.patterns)) matched.push(it);
  }

  if (matched.length === 0) {
    // Never guess. Hand to a human.
    return { ...base, action: "escalate", reason: "no_match", confidence: 0, outbound_text: null };
  }

  const primary = matched[0]; // highest priority

  // CONTEXT-AWARE COMPOSITION (only when full-chat context is supplied):
  // pick the profile-specific reply, answer every question asked, fill numbers.
  if (within && ctx && ctx.effectiveInbound) {
    const qrIntents = matched.filter((m) => m.action === "qr");
    if (qrIntents.length) {
      // Credit diagnostic sequence: vague bad/low credit + unknown specifics ->
      // ask "why is your score low?" then "/arrears" (mirrors human takeover).
      if (qrIntents[0].name === "bad_credit_arrears" && creditUnknown(ctx, base)) {
        const seq = (kb.sequences || []).find((x) => x.name === "credit_diagnostic");
        const sq = seq ? buildSequence(base, seq, ctx, kb, qrByKeyword) : null;
        if (sq) return sq;
      }
      const targets = qrIntents.map((m) => refineCreditTarget(m.target, ctx.profile));
      const composed = composeQr(base, qrByKeyword, targets, ctx, kb, qrIntents.length > 1 ? 0.9 : 0.85, "ctx:" + qrIntents.map((m) => m.name).join("+"));
      if (composed) return composed;
    }
  }
  // Confidence: strong for a clean single-intent hit; reduced when the message
  // is long (likely says more than the one thing) or several different intents fire.
  let confidence = 0.82;
  const distinctTargets = new Set(matched.map((m) => `${m.action}:${m.target}`));
  if (distinctTargets.size > 1) confidence -= 0.12 * (distinctTargets.size - 1);
  if (t.length > cfg.longMessageChars && matched.length === 1) confidence -= 0.18;
  confidence = Math.max(0, Math.min(0.98, confidence));

  if (confidence < cfg.confidenceThreshold) {
    return {
      ...base,
      action: "escalate",
      reason: "low_confidence",
      candidate_intent: primary.name,
      confidence,
      outbound_text: null,
    };
  }

  // 4) Outside the 24h window, WhatsApp forbids free text -> re-engage template.
  if (!within && primary.action !== "template") {
    const reTid =
      (kb.window_policy && kb.window_policy.reengage_templates && kb.window_policy.reengage_templates[0]) || null;
    const tpl = (kb.templates || []).find((x) => x.id === reTid) || null;
    return {
      ...base,
      action: "template",
      reason: "outside_24h_window",
      intended_intent: primary.name,
      reply_ref: reTid,
      template_name: tpl ? tpl.name : null,
      outbound_text: tpl ? tpl.body : null,
      confidence,
      needs_template: true,
    };
  }

  // 5) Act on the primary intent.
  if (primary.action === "qr") {
    return buildQr(base, qrByKeyword, primary.target, confidence, primary.name, within, kb);
  }
  if (primary.action === "funnel") {
    const node = funnelByCode[primary.target];
    if (node) return renderFunnel(base, node, null, confidence, within, kb);
  }
  if (primary.action === "template") {
    const tpl = (kb.templates || []).find((x) => x.name === primary.target || x.id === Number(primary.target));
    return {
      ...base, action: "template", reason: primary.name, reply_ref: tpl ? tpl.id : primary.target,
      template_name: tpl ? tpl.name : null, outbound_text: tpl ? tpl.body : null, confidence,
    };
  }
  if (primary.action === "escalate") {
    return { ...base, action: "escalate", reason: primary.name, confidence, outbound_text: null };
  }

  return { ...base, action: "escalate", reason: "unhandled_action", confidence: 0, outbound_text: null };
}

function buildQr(base, qrByKeyword, keyword, confidence, reason, within, kb) {
  const qr = qrByKeyword[keyword];
  if (!qr) {
    return { ...base, action: "escalate", reason: "missing_quick_reply:" + keyword, confidence: 0, outbound_text: null };
  }
  return {
    ...base,
    action: "qr",
    reason,
    reply_ref: keyword,
    outbound_text: personalize(qr.message, base),
    confidence,
  };
}

function renderFunnel(base, node, set, confidence, within, kb) {
  return {
    ...base,
    action: "funnel",
    reason: "funnel:" + node.code,
    reply_ref: node.code,
    outbound_text: personalize(node.question, base),
    buttons: (node.options || []).map((o) => o.title),
    set_state: set || null,
    confidence,
  };
}

// Replace {{name}}/{{phone}} placeholders when we know them.
function personalize(msg, base) {
  let out = msg || "";
  const name = (base && base.name) || (base && base.state && base.state.name) || "";
  return out.replace(/\{\{\s*name\s*\}\}/gi, name || "").replace(/\s{2,}/g, " ").replace(/^ +| +$/gm, "");
}


// ---- context-aware composition helpers (deterministic, no AI) --------------

// If we already KNOW the client's credit status from their profile, answer with
// the exact-right credit reply even when their message is vague.
function refineCreditTarget(target, profile) {
  if (!profile || !profile.credit) return target;
  const creditFam = new Set(["badcredit", "blacklisted", "debtreview", "nocredit", "creditscore", "arrears"]);
  if (!creditFam.has(target)) return target;
  if (profile.credit === "debt_review") return "debtreview";
  if (profile.credit === "missed") return "badcredit";
  if (profile.credit === "none") return "nocredit";
  return target; // good / improving / unsure -> keep what matched
}

// Fill dynamic values from the database + conversation (name, deposit math, thresholds).
function dynamicFill(msg, base, context, kb) {
  let out = msg || "";
  const name = (base && base.name) || (context && context.profile && context.profile.name) || "";
  out = out.replace(/\{\{\s*name\s*\}\}/gi, name);
  const src = (context && context.effectiveInbound) || (base && base.inbound) || "";
  if (/deposit|put down/i.test(src)) {
    const m = src.replace(/[,\s]/g, "").match(/r?(\d{4,7})/i);
    if (m) {
      const amt = parseInt(m[1], 10);
      const per = (kb && kb.business_rules && kb.business_rules.deposit_effect_per_10000_rands) || 200;
      const drop = Math.floor(amt / 10000) * per;
      if (amt >= 1000 && drop > 0) out += "\n\nWith your R" + amt.toLocaleString() + " deposit, your monthly instalment would come down by about R" + drop + "pm. \uD83D\uDE97";
    }
  }
  return out.replace(/[ \t]{3,}/g, "  ").trim();
}

// Do we still NOT know the client's credit specifics? (then run the diagnostic)
function creditUnknown(ctx, base) {
  const c = ctx && ctx.profile && ctx.profile.credit;
  if (c) return false;
  const txt = norm((base && (base.analyzed || base.inbound)) || "");
  if (/arrears|missed|behind|debt ?review|black ?list|no credit|itc|judg/.test(txt)) return false;
  return true;
}

// Build an ordered multi-message sequence (e.g. why-score -> arrears), skipping
// steps already sent. Returned as action:'sequence' with a messages[] array.
function buildSequence(base, seq, ctx, kb, qrByKeyword) {
  const sent = new Set((ctx && ctx.alreadySent) || []);
  let steps = (seq.steps || []).filter((k) => !sent.has(k));
  if (!steps.length) steps = seq.steps || [];
  const msgs = steps.map((k) => qrByKeyword[k] && qrByKeyword[k].message).filter(Boolean).map((m) => personalize(m, base));
  if (!msgs.length) return null;
  return { ...base, action: "sequence", reason: "sequence:" + seq.name, reply_ref: seq.name, messages: msgs, outbound_text: msgs.join("\n\n"), confidence: 0.9, steps };
}

// Combine 1..N quick replies into a single message, skipping ones we already sent.
function composeQr(base, qrByKeyword, targets, context, kb, confidence, reason) {
  let list = [...new Set((targets || []).filter(Boolean))];
  const sent = new Set((context && context.alreadySent) || []);
  const fresh = list.filter((k) => !sent.has(k));
  if (list.length && !fresh.length) {
    return { ...base, action: "escalate", reason: "already_answered", confidence: 0, outbound_text: null };
  }
  list = fresh.length ? fresh : list;
  const parts = [];
  for (const k of list) { const q = qrByKeyword[k]; if (q && q.message) parts.push(q.message); }
  if (!parts.length) return null;
  const out = dynamicFill(parts.join("\n\n\u2014 \u2014 \u2014\n\n"), base, context, kb);
  return { ...base, action: "qr", reason, reply_ref: list.join("+"), outbound_text: out, confidence, combined: list.length > 1, targets: list };
}

// UMD-ish export (works in Node CommonJS and can be imported in ESM builds).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { decide, normKey, _internals: { groupMatches, hoursBetween, matchFunnelOption, norm } };
}
