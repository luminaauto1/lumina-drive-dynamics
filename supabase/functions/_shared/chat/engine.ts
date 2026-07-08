// engine.ts — FAITHFUL TypeScript port of lumina-chat/engine/engine.js
// (the Co-Work deterministic reply engine; NO AI, zero dependencies).
// Logic is intentionally byte-for-byte equivalent — do not "improve" this file;
// additive smarts live in brain.ts which wraps decide() without changing it.
// deno-lint-ignore-file no-explicit-any

export interface Decision {
  inbound: string;
  analyzed: string;
  within_window: boolean;
  now: string;
  action: string;
  reason: string;
  confidence: number;
  outbound_text: string | null;
  reply_ref?: string | number | null;
  escalation_reason?: string;
  candidate_intent?: string;
  intended_intent?: string;
  template_name?: string | null;
  needs_template?: boolean;
  buttons?: string[];
  set_state?: any;
  messages?: string[];
  steps?: string[];
  combined?: boolean;
  targets?: string[];
  name?: string;
  [k: string]: any;
}

const DEFAULTS = {
  freeFormHours: 24,
  confidenceThreshold: 0.6,
  longMessageChars: 220,
};

// ---- helpers ---------------------------------------------------------------

export function norm(s: any): string {
  return (s || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
}

// Normalized key for exact-message learned-reply matching.
export function normKey(s: any): string {
  return (s || "").toString().toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function groupMatches(text: string, patterns: string[]): boolean {
  for (const p of patterns || []) {
    let re: RegExp;
    try { re = new RegExp(p, "i"); } catch (_) { continue; }
    if (re.test(text)) return true;
  }
  return false;
}

function hoursBetween(aIso: string | null | undefined, bDate: Date | string): number {
  if (!aIso) return Infinity;
  const a = new Date(aIso).getTime();
  const b = (bDate instanceof Date ? bDate : new Date(bDate)).getTime();
  return (b - a) / 3.6e6;
}

function matchFunnelOption(text: string, funnel: any[]): { node: any; opt: any } | null {
  const t = norm(text);
  for (const node of funnel || []) {
    for (const opt of node.options || []) {
      if (norm(opt.title) === t) return { node, opt };
    }
  }
  return null;
}

// ---- main ------------------------------------------------------------------

export function decide(
  { text, state = {} as any, kb, now = new Date(), opts = {} as any, context = null as any }:
  { text: string; state?: any; kb: any; now?: Date; opts?: any; context?: any },
): Decision {
  const cfg = { ...DEFAULTS, ...opts };
  const ctx = context || {};
  const raw = (text || "").toString();
  const analyzeSrc = (ctx.effectiveInbound && ctx.effectiveInbound.length) ? ctx.effectiveInbound : raw;
  const t = norm(analyzeSrc);
  const tLatest = norm(raw);

  const qrByKeyword = Object.fromEntries((kb.quick_replies || []).map((q: any) => [q.keyword, q]));
  const funnelByCode = Object.fromEntries((kb.funnel || []).map((n: any) => [n.code, n]));
  const freeFormHours = (kb.window_policy && kb.window_policy.free_form_hours) || cfg.freeFormHours;

  const within = hoursBetween(state.last_user_message_at, now) <= freeFormHours;

  const base: any = {
    inbound: raw,
    analyzed: analyzeSrc,
    within_window: within,
    now: now.toISOString(),
  };

  if (!t) {
    return { ...base, action: "escalate", reason: "empty_or_media_message", confidence: 0, outbound_text: null };
  }

  // 1) HARD SAFETY
  for (const rule of kb.escalation || []) {
    if (rule.active === false || !rule.hard) continue;
    if (groupMatches(t, rule.patterns)) {
      return { ...base, action: "escalate", reason: rule.name, escalation_reason: rule.reason, confidence: 0, outbound_text: null };
    }
  }

  // 1b) Hands-off tags
  const _tags = (state.tags || []).map((x: any) => (typeof x === "string" ? x : (x && (x.title || x.name)) || "")).filter(Boolean);
  const _handsOff = (kb.hands_off_tags || []).filter((h: string) => _tags.includes(h));
  if (_handsOff.length) {
    return { ...base, action: "escalate", reason: "hands_off:" + _handsOff[0], confidence: 0, outbound_text: null };
  }

  // 1c) Learned replies (exact)
  const _key = normKey(tLatest);
  const _learned = (kb.learned_replies || []).find((L: any) => L.match_key === _key && L.active !== false);
  if (_learned) {
    return { ...base, action: "learned", reason: "learned_reply", reply_ref: "learned", outbound_text: personalize(_learned.message, base), confidence: 0.99 };
  }

  // 1d) SOFT escalation
  for (const rule of kb.escalation || []) {
    if (rule.active === false || rule.hard) continue;
    if (groupMatches(t, rule.patterns)) {
      return { ...base, action: "escalate", reason: rule.name, escalation_reason: rule.reason, confidence: 0, outbound_text: null };
    }
  }

  // 2) Exact funnel button reply
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

  // 3) INTENT MATCH by priority
  const intents = (kb.intents || [])
    .filter((i: any) => i.active !== false)
    .slice()
    .sort((a: any, b: any) => a.priority - b.priority);

  const matched: any[] = [];
  for (const it of intents) {
    if (groupMatches(t, it.patterns)) matched.push(it);
  }

  if (matched.length === 0) {
    return { ...base, action: "escalate", reason: "no_match", confidence: 0, outbound_text: null };
  }

  const primary = matched[0];

  // CONTEXT-AWARE COMPOSITION
  if (within && ctx && ctx.effectiveInbound) {
    const qrIntents = matched.filter((m: any) => m.action === "qr");
    if (qrIntents.length) {
      if (qrIntents[0].name === "bad_credit_arrears" && creditUnknown(ctx, base)) {
        const seq = (kb.sequences || []).find((x: any) => x.name === "credit_diagnostic");
        const sq = seq ? buildSequence(base, seq, ctx, kb, qrByKeyword) : null;
        if (sq) return sq;
      }
      const targets = qrIntents.map((m: any) => refineCreditTarget(m.target, ctx.profile));
      const composed = composeQr(base, qrByKeyword, targets, ctx, kb, qrIntents.length > 1 ? 0.9 : 0.85, "ctx:" + qrIntents.map((m: any) => m.name).join("+"));
      if (composed) return composed;
    }
  }

  let confidence = 0.82;
  const distinctTargets = new Set(matched.map((m: any) => `${m.action}:${m.target}`));
  if (distinctTargets.size > 1) confidence -= 0.12 * (distinctTargets.size - 1);
  if (t.length > cfg.longMessageChars && matched.length === 1) confidence -= 0.18;
  confidence = Math.max(0, Math.min(0.98, confidence));

  if (confidence < cfg.confidenceThreshold) {
    return { ...base, action: "escalate", reason: "low_confidence", candidate_intent: primary.name, confidence, outbound_text: null };
  }

  // 4) Outside the 24h window
  if (!within && primary.action !== "template") {
    const reTid = (kb.window_policy && kb.window_policy.reengage_templates && kb.window_policy.reengage_templates[0]) || null;
    const tpl = (kb.templates || []).find((x: any) => x.id === reTid) || null;
    return {
      ...base, action: "template", reason: "outside_24h_window", intended_intent: primary.name,
      reply_ref: reTid, template_name: tpl ? tpl.name : null, outbound_text: tpl ? tpl.body : null,
      confidence, needs_template: true,
    };
  }

  // 5) Act on the primary intent
  if (primary.action === "qr") {
    return buildQr(base, qrByKeyword, primary.target, confidence, primary.name, within, kb);
  }
  if (primary.action === "funnel") {
    const node = funnelByCode[primary.target];
    if (node) return renderFunnel(base, node, null, confidence, within, kb);
  }
  if (primary.action === "template") {
    const tpl = (kb.templates || []).find((x: any) => x.name === primary.target || x.id === Number(primary.target));
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

function buildQr(base: any, qrByKeyword: any, keyword: string, confidence: number, reason: string, _within: boolean, _kb: any): Decision {
  const qr = qrByKeyword[keyword];
  if (!qr) {
    return { ...base, action: "escalate", reason: "missing_quick_reply:" + keyword, confidence: 0, outbound_text: null };
  }
  return { ...base, action: "qr", reason, reply_ref: keyword, outbound_text: personalize(qr.message, base), confidence };
}

function renderFunnel(base: any, node: any, set: any, confidence: number, _within: boolean, _kb: any): Decision {
  return {
    ...base, action: "funnel", reason: "funnel:" + node.code, reply_ref: node.code,
    outbound_text: personalize(node.question, base),
    buttons: (node.options || []).map((o: any) => o.title),
    set_state: set || null, confidence,
  };
}

export function personalize(msg: string, base: any): string {
  const out = msg || "";
  const name = (base && base.name) || (base && base.state && base.state.name) || "";
  return out.replace(/\{\{\s*name\s*\}\}/gi, name || "").replace(/\s{2,}/g, " ").replace(/^ +| +$/gm, "");
}

// ---- context-aware composition helpers -------------------------------------

function refineCreditTarget(target: string, profile: any): string {
  if (!profile || !profile.credit) return target;
  const creditFam = new Set(["badcredit", "blacklisted", "debtreview", "nocredit", "creditscore", "arrears"]);
  if (!creditFam.has(target)) return target;
  if (profile.credit === "debt_review") return "debtreview";
  if (profile.credit === "missed") return "badcredit";
  if (profile.credit === "none") return "nocredit";
  return target;
}

export function dynamicFill(msg: string, base: any, context: any, kb: any): string {
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
      if (amt >= 1000 && drop > 0) out += "\n\nWith your R" + amt.toLocaleString() + " deposit, your monthly instalment would come down by about R" + drop + "pm. 🚗";
    }
  }
  return out.replace(/[ \t]{3,}/g, "  ").trim();
}

function creditUnknown(ctx: any, base: any): boolean {
  const c = ctx && ctx.profile && ctx.profile.credit;
  if (c) return false;
  const txt = norm((base && (base.analyzed || base.inbound)) || "");
  if (/arrears|missed|behind|debt ?review|black ?list|no credit|itc|judg/.test(txt)) return false;
  return true;
}

function buildSequence(base: any, seq: any, ctx: any, _kb: any, qrByKeyword: any): Decision | null {
  const sent = new Set((ctx && ctx.alreadySent) || []);
  let steps = (seq.steps || []).filter((k: string) => !sent.has(k));
  if (!steps.length) steps = seq.steps || [];
  const msgs = steps.map((k: string) => qrByKeyword[k] && qrByKeyword[k].message).filter(Boolean).map((m: string) => personalize(m, base));
  if (!msgs.length) return null;
  return { ...base, action: "sequence", reason: "sequence:" + seq.name, reply_ref: seq.name, messages: msgs, outbound_text: msgs.join("\n\n"), confidence: 0.9, steps };
}

export function composeQr(base: any, qrByKeyword: any, targets: string[], context: any, kb: any, confidence: number, reason: string): Decision | null {
  let list = [...new Set((targets || []).filter(Boolean))];
  const sent = new Set((context && context.alreadySent) || []);
  const fresh = list.filter((k) => !sent.has(k));
  if (list.length && !fresh.length) {
    return { ...base, action: "escalate", reason: "already_answered", confidence: 0, outbound_text: null };
  }
  list = fresh.length ? fresh : list;
  const parts: string[] = [];
  for (const k of list) { const q = qrByKeyword[k]; if (q && q.message) parts.push(q.message); }
  if (!parts.length) return null;
  const out = dynamicFill(parts.join("\n\n— — —\n\n"), base, context, kb);
  return { ...base, action: "qr", reason, reply_ref: list.join("+"), outbound_text: out, confidence, combined: list.length > 1, targets: list };
}

export const _internals = { groupMatches, hoursBetween, matchFunnelOption };
