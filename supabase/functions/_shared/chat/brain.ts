// brain.ts — the smart layer orchestrator (deterministic, NO AI at runtime).
//
// STRICT RECALL-EXPANSION around the Co-Work engine:
//   1. v1 decide() runs first, completely unchanged. If it answers, that answer
//      stands (its 50-case replay behaviour is preserved by construction).
//      Its output is optionally wrapped by the composer (ack/connector/closer
//      variants) — quick-reply BODIES stay verbatim.
//   2. Only when v1 escalates with no_match / low_confidence does v2 try to
//      rescue: normalise → segment → fuzzy-learned recall → scored utterance
//      matching → compose. Guardrails (abuse/legal, hands-off tags, soft
//      escalations like talk_to_human / application_status) run INSIDE v1
//      BEFORE intent matching, so a rescue can never override an
//      escalate-by-design decision.
//   3. "Answer-the-answer": when the bot's last question was one of the known
//      diagnostic questions (arrears / why-score / 6-months-statements), short
//      client answers are mapped deterministically to the right advice —
//      mirroring the human takeover flow the sequence table encodes.
// deno-lint-ignore-file no-explicit-any

import { decide, Decision, normKey, dynamicFill, personalize } from "./engine.ts";
import { baseLexicon, buildVocab, normalizeText, segments, contentTokens, Lexicon } from "./normalize.ts";
import { buildIndex, matchAll, MatcherIndex } from "./matcher.ts";
import { composeAnswers, holdingLine, openedWithGreeting, PhraseVariants, BASE_VARIANTS } from "./composer.ts";

export interface SmartKb {
  lexicon: Lexicon;
  vocab: Set<string>;
  index: MatcherIndex;
  variants: PhraseVariants;
  minScoreSingle: number;
  minScoreMulti: number;
}

/** Build the smart index from the KB + smart tables (utterances/lexicon/phrases). */
export function buildSmartKb(kb: any): SmartKb {
  const lexicon: Lexicon = { ...baseLexicon() };
  for (const row of kb.lexicon || []) {
    const canon = String(row.canonical || "").toLowerCase().trim();
    for (const v of row.variants || []) {
      const vv = String(v || "").toLowerCase().trim();
      if (vv && canon && vv !== canon) lexicon[vv] = canon;
    }
  }
  const vocab = buildVocab(kb, lexicon);

  // Normalise every utterance ONCE with the same pipeline inbound text gets.
  const utterRows = (kb.utterances || []).map((u: any) => ({
    intent: u.intent,
    text: u.text,
    weight: u.weight || 1,
    tokens: normalizeText(u.text, lexicon, vocab).tokens,
  }));
  const index = buildIndex(kb, utterRows);

  const variants: PhraseVariants = { ...BASE_VARIANTS };
  for (const row of kb.phrase_variants || []) {
    if (row.slot && Array.isArray(row.variants) && row.variants.length) variants[row.slot] = row.variants;
  }

  const brainCfg = (kb.business_rules && kb.business_rules.brain_config) || {};
  return {
    lexicon, vocab, index, variants,
    minScoreSingle: brainCfg.min_score_single ?? 0.66,
    minScoreMulti: brainCfg.min_score_multi ?? 0.62,
  };
}

// ---- answer-the-answer follow-up maps (mirrors the mined human flow) --------
const FOLLOWUPS: Array<{ question: RegExp; branches: Array<{ answer: RegExp; target: string }> }> = [
  {
    // "Do you have accounts in arrears or are you under debt review?" / "Why is your credit score low?"
    question: /(accounts in arrears|under debt review|why is your credit score low)/i,
    branches: [
      { answer: /(debt\s*review|black\s*list|under review|debt counsel)/i, target: "debtreview" },
      { answer: /(arrears|missed|behind|late payment|skipped|defaulted|owe)/i, target: "badcredit" },
      { answer: /(no credit|never had credit|no record|no history|no score)/i, target: "nocredit" },
    ],
  },
  {
    // "Do you have 6 months of bank statements that consistently reflects that income?"
    question: /6 months of bank statements/i,
    branches: [
      { answer: /^\s*(yes|yebo|ja|yeah|yep|i do|sure|correct|affirmative)\b/i, target: "docs" },
    ],
  },
];

function followupTarget(ctx: any, rawLatest: string): string | null {
  const q = (ctx && ctx.lastBotQuestion) || "";
  if (!q) return null;
  for (const f of FOLLOWUPS) {
    if (!f.question.test(q)) continue;
    for (const b of f.branches) {
      if (b.answer.test(rawLatest)) return b.target;
    }
  }
  return null;
}

// ---- fuzzy learned-reply recall ---------------------------------------------
function tokenSet(s: string): Set<string> {
  return new Set(normKey(s).split(" ").filter((t) => t.length > 1));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function fuzzyLearned(kb: any, latestRaw: string): any | null {
  const q = tokenSet(latestRaw);
  if (q.size < 3) return null; // too short to trust fuzzily — exact match handles those
  let best: any = null; let bestJ = 0;
  for (const L of kb.learned_replies || []) {
    if (L.active === false) continue;
    const l = tokenSet(L.sample_inbound || L.match_key || "");
    const j = jaccard(q, l);
    if (j > bestJ) { bestJ = j; best = L; }
  }
  return best && bestJ >= 0.8 ? { learned: best, similarity: bestJ } : null;
}

// ---- credit-family refinement (mirror of v1's private helper) ---------------
const CREDIT_FAM = new Set(["badcredit", "blacklisted", "debtreview", "nocredit", "creditscore", "arrears"]);
function refineCredit(target: string, profile: any): string {
  if (!profile || !profile.credit || !CREDIT_FAM.has(target)) return target;
  if (profile.credit === "debt_review") return "debtreview";
  if (profile.credit === "missed") return "badcredit";
  if (profile.credit === "none") return "nocredit";
  return target;
}

export interface SmartDecision extends Decision {
  brain?: string;                    // 'v1' | 'v1+composed' | 'v2:utterance' | 'v2:learned_fuzzy' | 'v2:followup'
  brain_scores?: Array<{ intent: string; score: number }>;
  holding_text?: string;             // varied holding line for escalations
}

/**
 * The full smart pipeline. Same signature spirit as decide(), plus a leadKey
 * for stable phrasing variety and a smart KB (from buildSmartKb).
 */
export function decideSmart(
  { text, state = {} as any, kb, smart, now = new Date(), context = null as any, leadKey = "" }:
  { text: string; state?: any; kb: any; smart: SmartKb; now?: Date; context?: any; leadKey?: string },
): SmartDecision {
  const d1: SmartDecision = decide({ text, state, kb, now, context });
  const ctx = context || {};
  const name = (state && state.name) || (ctx.profile && ctx.profile.name) || "";
  const key = leadKey || String(state.lead_id || state.phone || name || "anon");
  const greeted = openedWithGreeting(text);

  // ---------- v1 answered → optionally dress the answer ----------
  if (d1.action !== "escalate") {
    d1.brain = "v1";
    // Only single free-text answers get wrapped; funnels (buttons), templates
    // (approved WhatsApp copy) and sequences stay untouched. Combined v1
    // answers ("a — — — b") are re-joined with natural connectors.
    if ((d1.action === "qr" || d1.action === "learned") && d1.outbound_text) {
      const answers = d1.combined
        ? d1.outbound_text.split(/\n\n— — —\n\n/)
        : [d1.outbound_text];
      const composed = composeAnswers(answers, {
        leadKey: key, name, now, variants: smart.variants, greeted,
        plain: d1.reason === "greeting" || d1.action === "learned",
      });
      if (composed) { d1.outbound_text = composed; d1.brain = "v1+composed"; }
    }
    return d1;
  }

  // ---------- v1 escalated. Rescue ONLY the unsure reasons. ----------
  const rescuable = d1.reason === "no_match" || d1.reason === "low_confidence";
  if (!rescuable) {
    d1.brain = "v1";
    d1.holding_text = holdingLine({ leadKey: key, now, variants: smart.variants });
    return d1;
  }

  const analyzed = d1.analyzed || text || "";
  const latestRaw = (ctx.latestClientText || text || "").toString();

  // (a) answer-the-answer: short reply to a known diagnostic bot question.
  const fTarget = followupTarget(ctx, latestRaw);
  if (fTarget) {
    const qr = (kb.quick_replies || []).find((q: any) => q.keyword === fTarget);
    if (qr) {
      const out = composeAnswers([personalize(qr.message, { name })], {
        leadKey: key, name, now, variants: smart.variants, greeted: false, plain: true,
      });
      return {
        ...d1, action: "qr", reason: "brain:followup:" + fTarget, reply_ref: fTarget,
        outbound_text: out, confidence: 0.88, brain: "v2:followup",
      };
    }
  }

  // (b) fuzzy learned recall: a human taught us a near-identical question.
  const fl = fuzzyLearned(kb, latestRaw);
  if (fl) {
    return {
      ...d1, action: "learned", reason: "brain:learned_fuzzy", reply_ref: "learned",
      outbound_text: personalize(fl.learned.message, { name }),
      confidence: Math.min(0.95, 0.8 + fl.similarity * 0.15),
      brain: "v2:learned_fuzzy",
    };
  }

  // (c) scored utterance matching over normalised segments.
  const segs = segments(analyzed);
  const segTokens = segs.map((s) => normalizeText(s, smart.lexicon, smart.vocab).tokens);
  // whole-message pass too (short messages often ARE one segment)
  segTokens.push(normalizeText(analyzed, smart.lexicon, smart.vocab).tokens);

  const results = matchAll(segTokens, smart.index, smart.minScoreMulti);
  const strong = results.filter((r) => r.score >= smart.minScoreSingle);
  const usable = strong.length ? strong : results.filter((r) => r.score >= smart.minScoreMulti);

  if (usable.length) {
    // v2 only answers with quick-reply intents; funnel/template/escalate
    // intents from the matcher fall back to their v1 semantics.
    const qrByKeyword = Object.fromEntries((kb.quick_replies || []).map((q: any) => [q.keyword, q]));
    const picked: Array<{ intent: string; target: string; score: number }> = [];
    for (const r of usable.slice(0, 3)) {
      const it = smart.index.intents.get(r.intent);
      if (!it || it.active === false) continue;
      if (it.action === "funnel") {
        // single strong funnel intent → run the funnel exactly like v1 would.
        if (picked.length === 0 && r.score >= smart.minScoreSingle) {
          const node = (kb.funnel || []).find((n: any) => n.code === it.target);
          if (node) {
            return {
              ...d1, action: "funnel", reason: "brain:utterance:" + r.intent, reply_ref: node.code,
              outbound_text: personalize(node.question, { name }),
              buttons: (node.options || []).map((o: any) => o.title),
              confidence: Math.min(0.9, r.score), brain: "v2:utterance",
              brain_scores: usable.map((u) => ({ intent: u.intent, score: +u.score.toFixed(3) })),
            };
          }
        }
        continue;
      }
      if (it.action !== "qr") continue;
      const target = refineCredit(it.target, ctx.profile);
      if (!picked.find((p) => p.target === target)) picked.push({ intent: r.intent, target, score: r.score });
    }

    // don't repeat answers already sent in this conversation
    const already = new Set(ctx.alreadySent || []);
    const fresh = picked.filter((p) => !already.has(p.target));
    const finalPicks = fresh.length ? fresh : picked;

    if (finalPicks.length) {
      const bodies = finalPicks
        .map((p) => qrByKeyword[p.target] && qrByKeyword[p.target].message)
        .filter(Boolean)
        .map((m: string) => dynamicFill(m, { name, inbound: analyzed }, ctx, kb));
      if (bodies.length) {
        const sensitivePlain = finalPicks.some((p) => CREDIT_FAM.has(p.target));
        const out = composeAnswers(bodies, {
          leadKey: key, name, now, variants: smart.variants, greeted, plain: sensitivePlain,
        });
        const top = finalPicks[0].score;
        const conf = Math.min(0.9, finalPicks.length > 1 ? Math.min(top, 0.85) : top);
        return {
          ...d1, action: "qr", reason: "brain:utterance:" + finalPicks.map((p) => p.intent).join("+"),
          reply_ref: finalPicks.map((p) => p.target).join("+"),
          outbound_text: out, confidence: conf,
          combined: finalPicks.length > 1, targets: finalPicks.map((p) => p.target),
          brain: "v2:utterance",
          brain_scores: usable.map((u) => ({ intent: u.intent, score: +u.score.toFixed(3) })),
        };
      }
    }
  }

  // ---------- still unsure → keep v1's escalation, with a varied holding line.
  d1.brain = "v1";
  d1.brain_scores = results.slice(0, 3).map((u) => ({ intent: u.intent, score: +u.score.toFixed(3) }));
  d1.holding_text = holdingLine({ leadKey: key, now, variants: smart.variants });
  return d1;
}
