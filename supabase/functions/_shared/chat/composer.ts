// composer.ts — natural reply assembly (deterministic, NO AI).
//
// The owner's quick-reply bodies are kept VERBATIM (they are the business's
// real words — facts must never be paraphrased by a machine). What varies is
// the connective tissue AROUND them, so two different customers asking the
// same thing in different words don't receive robotically identical messages:
//
//   [ack variant]  +  answer  ( + connector variant + answer … )  [+ closer]
//
// Variant selection is a stable hash of (leadId, slot, dayBucket): the same
// client sees consistent phrasing within a conversation, different clients get
// different-but-equally-correct wording. Zero randomness at runtime — fully
// reproducible for any given lead/day.
//
// Variants ship with a hand-built base and are EXTENDED from the phrase_variant
// table (editable in the DB without code changes).
// deno-lint-ignore-file no-explicit-any

export interface PhraseVariants { [slot: string]: string[] }

export const BASE_VARIANTS: PhraseVariants = {
  // short acknowledgement placed before the first answer when the client
  // greeted / asked politely (never before hard advice like debt review).
  ack: [
    "Great question!",
    "Thanks for asking! 🙌",
    "Happy to help with that!",
    "Sure thing —",
    "Good question, let me explain 👇",
    "Of course!",
  ],
  // between two combined answers
  connector: [
    "And about your other question —",
    "Also, since you asked:",
    "On your second question 👇",
    "And to answer the rest:",
    "Plus —",
  ],
  // gentle closer inviting follow-up (applied only when the answer doesn't
  // already end with a question)
  closer: [
    "Anything else you'd like to know? 😊",
    "Let me know if there's anything else!",
    "Shout if you have more questions! 🙌",
    "Any other questions, just ask!",
    "",
    "",
  ],
  // holding line variants for escalations (the human follows up)
  holding: [
    "Thanks for the message! Let me get that sorted for you and I’ll be right back with you shortly. 🙏",
    "Got it! Let me look into that for you — I’ll come back to you just now. 🙏",
    "Thanks! I’m checking on that for you and will get back to you shortly. 🤝",
    "Let me double-check that for you real quick — I’ll be back with you soon! 🙌",
  ],
  // greeting-with-name openers when the client just greets
  greet_name: [
    "Hi {{name}}! 😊",
    "Hey {{name}}! 👋",
    "Hello {{name}}!",
  ],
};

// FNV-1a — tiny stable string hash.
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickVariant(slot: string, variants: PhraseVariants, leadKey: string, now: Date): string {
  const list = variants[slot] && variants[slot].length ? variants[slot] : BASE_VARIANTS[slot] || [];
  if (!list.length) return "";
  const dayBucket = Math.floor(now.getTime() / 86400000);
  const idx = stableHash(`${leadKey}|${slot}|${dayBucket}`) % list.length;
  return list[idx];
}

export interface ComposeOpts {
  leadKey: string;
  name?: string;
  now?: Date;
  variants?: PhraseVariants;
  /** the client's message opened with a greeting */
  greeted?: boolean;
  /** suppress ack/closer entirely (e.g. sensitive credit advice) */
  plain?: boolean;
}

const SENSITIVE_HEAD = /unfortunately|cannot|can't|declined|debt review|blacklist/i;

/** Wrap 1..N verbatim answers with natural, deterministic connective tissue. */
export function composeAnswers(answers: string[], opts: ComposeOpts): string {
  const now = opts.now || new Date();
  const variants = opts.variants || BASE_VARIANTS;
  const parts = (answers || []).map((a) => (a || "").trim()).filter(Boolean);
  if (!parts.length) return "";

  const sensitive = SENSITIVE_HEAD.test(parts[0].slice(0, 120));
  const pieces: string[] = [];

  // greeting-by-name when the client greeted us and we know their name
  if (opts.greeted && opts.name) {
    const g = pickVariant("greet_name", variants, opts.leadKey, now).replace(/\{\{\s*name\s*\}\}/gi, opts.name);
    if (g) pieces.push(g);
  }

  // ack before friendly answers only
  if (!opts.plain && !sensitive && !(opts.greeted && opts.name)) {
    const ack = pickVariant("ack", variants, opts.leadKey, now);
    if (ack) pieces.push(ack);
  }

  parts.forEach((p, i) => {
    if (i > 0) {
      const conn = pickVariant("connector", variants, opts.leadKey + ":" + i, now);
      pieces.push(conn || "— — —");
    }
    pieces.push(p);
  });

  // closer only when the last answer doesn't already end on a question
  if (!opts.plain && !/[?]\s*$/.test(parts[parts.length - 1])) {
    const closer = pickVariant("closer", variants, opts.leadKey, now);
    if (closer) pieces.push(closer);
  }

  return pieces.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** A varied holding line for escalations (so "let me check" doesn't repeat verbatim). */
export function holdingLine(opts: ComposeOpts): string {
  return pickVariant("holding", opts.variants || BASE_VARIANTS, opts.leadKey, opts.now || new Date());
}

/** Did the inbound open with a greeting? */
export function openedWithGreeting(raw: string): boolean {
  return /^\s*(hi|hey|hello|good\s*(morning|afternoon|evening)|molo|sawubona|dumela|goeie|hallo|greetings|howzit)\b/i.test(raw || "");
}
