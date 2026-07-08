// normalize.ts — deterministic text normalisation for the smart layer (NO AI).
//
// Turns real-world South African WhatsApp text into a canonical token stream the
// matcher can score reliably:
//   • lowercase, strip emoji/punctuation, collapse whitespace
//   • expand chat shorthand ("hw mch" → "how much", "u" → "you", "pls" → "please")
//   • canonicalise domain vocabulary via the lexicon ("lisence/liscense/lisens"
//     → "licence", "blacklsted" → "blacklisted", "instalments" → "installment")
//   • fuzzy-correct unknown tokens against the KB vocabulary with a bounded
//     Damerau-Levenshtein distance (typos like "instalmints", "depossit")
//   • normalise money ("5k" → "5000", "R 8,500" → "r8500")
//
// The lexicon ships with a hand-built base and is EXTENDED from the database
// (lexicon table) at load time — editable without code changes.
// deno-lint-ignore-file no-explicit-any

export interface Lexicon { [variant: string]: string }

// ---- base lexicon (canonical ← variants) -----------------------------------
// Kept deliberately conservative: only unambiguous rewrites.
const BASE_LEXICON_GROUPS: Record<string, string[]> = {
  licence: [
    "license", "lisence", "liscence", "liscense", "lisense", "licens", "licenc",
    "licence's", "lincense", "lincence", "lisensie", "rybewys", "drivers licence",
    "drivers license", "driver's licence", "driver's license", "dl",
  ],
  learners: ["learner", "learner's", "leaners", "leners", "learnes", "learners licence", "learners license", "leerling lisensie"],
  blacklisted: ["blacklsted", "blaclisted", "blacklisted", "black listed", "blackliste", "blacklist", "blaklisted", "blacklested"],
  "debt review": ["debt-review", "debtreview", "det review", "dept review", "debt reveiw", "debt riview", "under review", "skuld hersiening"],
  arrears: ["arrears", "arears", "arrear", "areas payments", "in arreas", "agterstallig"],
  credit: ["credit", "creddit", "kredit", "cradit", "credt", "krediet"],
  score: ["score", "skore", "scor", "credit score", "telling"],
  installment: [
    "instalment", "installments", "instalments", "instaments", "instalmints",
    "installmet", "installement", "instolments", "paying monthly", "paaiement", "paaiemente",
  ],
  deposit: ["depossit", "deposite", "diposit", "depost", "deposito", "down payment", "downpayment"],
  vehicle: ["vehical", "vehicel", "vhicle", "voertuig", "whip"],
  car: ["kar", "motor", "carr", "moter"],
  bakkie: ["bakkie", "bakie", "bakky", "bakkies", "pickup", "pick-up", "pick up truck"],
  finance: ["finanse", "finace", "finence", "fianance", "fainance", "finansiering", "financing", "finanace"],
  qualify: ["qaulify", "qualifie", "quilify", "qualifi", "kwalifiseer", "qualifly", "quality for a car", "qualify"],
  documents: ["dokuments", "documants", "documets", "docs", "dokumente", "paperwork", "papers"],
  payslip: ["pay slip", "payslips", "pay slips", "salary slip", "salaris strokie", "payslp"],
  statement: ["statements", "statment", "statments", "bank statement", "bank statements", "staat"],
  salary: ["sallary", "salery", "salory", "salaris", "income", "earnings", "wage", "wages"],
  month: ["mnth", "mounth", "maand", "monthly"],
  delivery: ["delivary", "deliver", "delivered", "aflewering", "dilivery"],
  pretoria: ["pta", "pretoria", "tshwane"],
  johannesburg: ["jhb", "joburg", "jozi", "johanesburg", "johannesberg"],
  available: ["avail", "availble", "avaliable", "availabe", "beskikbaar", "stil available", "still avail"],
  interested: ["intrested", "intersted", "interessted", "keen", "belangstel"],
  approved: ["aproved", "approvd", "goedgekeur", "approve"],
  declined: ["decline", "declind", "afgekeur", "rejected", "turned down"],
  application: ["aplication", "applicaton", "app", "aansoek", "applictaion"],
  account: ["acount", "accont", "rekening", "acc"],
  settlement: ["setlement", "settelment", "settlment"],
  "trade in": ["tradein", "trade-in", "trade inn", "inruil"],
  referral: ["referal", "refferal", "refferral", "reffered", "verwysing"],
  spouse: ["spose", "spouce", "gade", "eggenoot"],
  married: ["maried", "getroud", "marred"],
  employed: ["employeed", "werk", "working", "emploid"],
  "self employed": ["self-employed", "selfemployed", "self imployed", "own boss", "eie besigheid"],
  business: ["bussiness", "busines", "bussines", "besigheid"],
  bank: ["bnk", "bank"],
  money: ["mony", "geld", "cash"],
  need: ["ned", "nee d", "benodig"],
  want: ["wnt", "wana", "wanna", "wil he", "soek"],
  scam: ["scamm", "skelm", "con"],
};

// Chat shorthand → full words (token-level, exact).
const SHORTHAND: Record<string, string> = {
  u: "you", ur: "your", r: "are", pls: "please", plz: "please", plse: "please",
  hw: "how", mch: "much", wat: "what", wht: "what", abt: "about", bt: "but",
  cn: "can", cnt: "cant", dnt: "dont", wnt: "want", gud: "good", gd: "good",
  mrng: "morning", mornin: "morning", aftn: "afternoon", eve: "evening",
  tnx: "thanks", thx: "thanks", tx: "thanks", ta: "thanks",
  yr: "year", yrs: "years", hrs: "hours", msg: "message", nmbr: "number", num: "number",
  bcoz: "because", bcz: "because", cos: "because", coz: "because",
  im: "im", ive: "i have", id: "i would", ill: "i will", iam: "i am",
  wil: "will", shud: "should", cud: "could", wud: "would",
  tel: "tell", noe: "know", knw: "know", dis: "this", dat: "that", de: "the",
  hie: "hi", helo: "hello", hallo: "hello", howzit: "hi", sharp: "ok",
  askies: "sorry", eish: "", mara: "but", futhi: "and",
};

// Build variant → canonical map from the base groups.
export function baseLexicon(): Lexicon {
  const lex: Lexicon = {};
  for (const [canon, variants] of Object.entries(BASE_LEXICON_GROUPS)) {
    for (const v of variants) lex[v.toLowerCase()] = canon;
  }
  return lex;
}

// ---- Damerau-Levenshtein (bounded) ------------------------------------------
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  const d: number[][] = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) d[i][0] = i;
  for (let j = 0; j <= lb; j++) d[0][j] = j;
  for (let i = 1; i <= la; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1; // early exit
  }
  return d[la][lb];
}

// ---- normaliser --------------------------------------------------------------

export interface Normalized {
  /** canonical lowercase text (tokens joined) */
  text: string;
  /** canonical tokens */
  tokens: string[];
  /** original (lowercased, de-emojied) for regex passes */
  loose: string;
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "it", "to", "of", "and", "or", "for", "on", "in", "at",
  "do", "does", "did", "be", "am", "are", "was", "were", "me", "my", "i", "we",
  "so", "if", "that", "this", "there", "with", "as", "by", "from", "please",
  "hi", "hello", "hey", "good", "morning", "afternoon", "evening", "thanks",
]);

/** Multi-word lexicon phrases sorted longest-first for greedy replacement. */
function phraseEntries(lex: Lexicon): Array<[string, string]> {
  return Object.entries(lex).filter(([v]) => v.includes(" ")).sort((a, b) => b[0].length - a[0].length);
}

export function normalizeText(raw: string, lex: Lexicon, vocab: Set<string>): Normalized {
  let s = (raw || "").toString().toLowerCase();
  // strip emoji & symbols, keep letters/digits/space/apostrophe
  s = s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ");
  s = s.replace(/[^\p{L}\p{N}\s']/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  const loose = s;

  // money: "5k"→5000, strip thousand separators inside numbers
  s = s.replace(/\b(\d{1,3})[ ,](\d{3})\b/g, "$1$2");
  s = s.replace(/\b(\d+(?:\.\d+)?)k\b/g, (_m, n) => String(Math.round(parseFloat(n) * 1000)));

  // multi-word lexicon phrases first (e.g. "debt reveiw" → "debt review")
  for (const [variant, canon] of phraseEntries(lex)) {
    if (s.includes(variant)) s = s.split(variant).join(canon);
  }

  // token pass
  const rawTokens = s.split(" ").filter(Boolean);
  const out: string[] = [];
  for (let tok of rawTokens) {
    const bare = tok.replace(/'/g, "");
    // shorthand expansion
    if (SHORTHAND[bare] !== undefined) {
      const exp = SHORTHAND[bare];
      if (exp) out.push(...exp.split(" "));
      continue;
    }
    // exact lexicon variant
    if (lex[bare]) { out.push(...lex[bare].split(" ")); continue; }
    if (lex[tok]) { out.push(...lex[tok].split(" ")); continue; }
    // fuzzy-correct against KB vocabulary (only meaningful lengths; never digits)
    if (bare.length >= 5 && !/\d/.test(bare) && !vocab.has(bare)) {
      const max = bare.length >= 8 ? 2 : 1;
      let best: string | null = null; let bestD = max + 1;
      for (const v of vocab) {
        if (Math.abs(v.length - bare.length) > max) continue;
        const dd = editDistance(bare, v, max);
        if (dd < bestD) { bestD = dd; best = v; if (dd === 1 && bare.length < 8) break; }
      }
      if (best && bestD <= max) {
        const canon = lex[best] || best;
        out.push(...canon.split(" "));
        continue;
      }
    }
    out.push(bare);
  }

  return { text: out.join(" "), tokens: out, loose };
}

/** Content tokens (stopwords removed) for scoring. */
export function contentTokens(tokens: string[]): string[] {
  return tokens.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Split an inbound blob into question-ish segments so each gets matched on its own. */
export function segments(raw: string): string[] {
  const parts = (raw || "")
    .split(/\|\||[\n\r]+|(?<=\?)\s+|(?:\.\s+)|\band also\b|\bas well as\b|\banother thing\b/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 2);
  return parts.length ? parts : [raw];
}

/** Build the fuzzy-correction vocabulary from the KB + lexicon canonicals. */
export function buildVocab(kb: any, lex: Lexicon): Set<string> {
  const vocab = new Set<string>();
  const add = (s: string) => {
    for (const w of (s || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)) {
      if (w.length >= 4) vocab.add(w);
    }
  };
  for (const canon of Object.values(lex)) add(canon);
  for (const it of kb.intents || []) for (const p of it.patterns || []) add(p.replace(/\\b|\{.*?\}|[.*+?^${}()|[\]\\]/g, " "));
  for (const u of kb.utterances || []) add(u.text);
  // domain constants
  ["licence", "learners", "blacklisted", "arrears", "credit", "score", "installment",
    "deposit", "vehicle", "bakkie", "finance", "qualify", "documents", "payslip",
    "statement", "salary", "delivery", "pretoria", "available", "interested",
    "approved", "declined", "application", "account", "settlement", "referral",
    "spouse", "married", "employed", "business", "nominated", "driver"].forEach((w) => vocab.add(w));
  return vocab;
}
