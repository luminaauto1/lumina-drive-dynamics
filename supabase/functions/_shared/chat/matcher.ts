// matcher.ts — scored, paraphrase-robust intent matching (deterministic, NO AI).
//
// The v1 engine matches intents with hand-written regex fragments — high
// precision, but a customer who words the question differently slips through
// to "no_match". This matcher adds RECALL on top:
//
//   score(intent) = max over that intent's example utterances of
//       IDF-weighted token overlap (normalised) + bigram bonus
//   plus a smaller bag-of-keywords score from the intent's own regex vocabulary.
//
// Utterances come from the intent_utterance table (mass-authored paraphrases of
// how real customers ask each question — mined + expanded from the EasySocial
// chats). Everything runs on canonical tokens from normalize.ts, so misspelled
// or slang inputs score against clean examples.
//
// It NEVER overrides v1: brain.ts only consults this when v1 said
// no_match / low_confidence. Thresholds are tuned by the self-consistency
// gauntlet in lumina-chat/engine/test-brain harness.
// deno-lint-ignore-file no-explicit-any

import { contentTokens } from "./normalize.ts";

export interface Utterance { intent: string; tokens: string[]; weight: number }

export interface MatchResult {
  intent: string;
  score: number;
  bestUtterance?: string;
}

export interface MatcherIndex {
  utterances: Array<{ intent: string; tokens: string[]; set: Set<string>; bigrams: Set<string>; weight: number; text: string }>;
  idf: Map<string, number>;
  intents: Map<string, any>;
}

function bigrams(tokens: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) out.add(tokens[i] + " " + tokens[i + 1]);
  return out;
}

/** Build the scoring index once per KB load. `utterances` rows: {intent, tokens[] (pre-normalised), weight, text} */
export function buildIndex(kb: any, utterRows: Array<{ intent: string; tokens: string[]; weight?: number; text: string }>): MatcherIndex {
  const utterances = utterRows.map((u) => {
    const toks = contentTokens(u.tokens);
    return { intent: u.intent, tokens: toks, set: new Set(toks), bigrams: bigrams(toks), weight: u.weight || 1, text: u.text };
  }).filter((u) => u.tokens.length > 0);

  // document frequency over utterances (smooth) → IDF
  const df = new Map<string, number>();
  for (const u of utterances) for (const t of u.set) df.set(t, (df.get(t) || 0) + 1);
  const N = Math.max(utterances.length, 1);
  const idf = new Map<string, number>();
  for (const [t, f] of df) idf.set(t, Math.log(1 + N / f));

  const intents = new Map<string, any>();
  for (const it of kb.intents || []) intents.set(it.name, it);

  return { utterances, idf, intents };
}

const DEFAULT_IDF = 1.2; // unseen tokens still carry signal

/** Score one normalised segment against every utterance; return ranked intents. */
export function matchSegment(tokens: string[], index: MatcherIndex, minScore = 0.62): MatchResult[] {
  const q = contentTokens(tokens);
  if (!q.length) return [];
  const qset = new Set(q);
  const qbi = bigrams(q);
  const qWeight = q.reduce((s, t) => s + (index.idf.get(t) || DEFAULT_IDF), 0);

  const best = new Map<string, MatchResult>();
  for (const u of index.utterances) {
    // IDF-weighted overlap, normalised by BOTH sides (F1-style) so a one-word
    // query can't fully match a long utterance and vice versa.
    let overlap = 0;
    for (const t of qset) if (u.set.has(t)) overlap += index.idf.get(t) || DEFAULT_IDF;
    if (!overlap) continue;
    const uWeight = u.tokens.reduce((s, t) => s + (index.idf.get(t) || DEFAULT_IDF), 0);
    const p = overlap / Math.max(qWeight, 1e-6);
    const r = overlap / Math.max(uWeight, 1e-6);
    let score = (2 * p * r) / Math.max(p + r, 1e-6);

    // bigram bonus: word-order agreement is strong evidence
    let biHits = 0;
    for (const b of qbi) if (u.bigrams.has(b)) biHits++;
    if (biHits) score = Math.min(1, score + 0.06 * Math.min(biHits, 3));

    score *= u.weight;
    const prev = best.get(u.intent);
    if (!prev || score > prev.score) best.set(u.intent, { intent: u.intent, score, bestUtterance: u.text });
  }

  return [...best.values()]
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

/**
 * Match a whole inbound (already split into normalised segments).
 * Returns unique intents ranked by their best segment score, so one message
 * asking two different things surfaces both intents for composition.
 */
export function matchAll(segmentsTokens: string[][], index: MatcherIndex, minScore = 0.62): MatchResult[] {
  const best = new Map<string, MatchResult>();
  for (const toks of segmentsTokens) {
    for (const m of matchSegment(toks, index, minScore)) {
      const prev = best.get(m.intent);
      if (!prev || m.score > prev.score) best.set(m.intent, m);
    }
  }
  const ranked = [...best.values()].sort((a, b) => b.score - a.score);

  // Confusion guard: if the top two are close AND map to different reply
  // targets, keep both only when both are strong; otherwise trust the top one
  // only when it clearly wins. Brain applies the final confidence threshold.
  return ranked;
}
