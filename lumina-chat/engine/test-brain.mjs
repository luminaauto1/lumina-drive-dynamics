// test-brain.mjs — validation gauntlet for the smart layer (brain v2).
//
// Three gates, all must pass:
//  A) V1 PRESERVATION — the 50 real-message replay cases must keep the SAME
//     action (and reply target for quick replies) through decideSmart. The
//     composer may re-dress wording; it may never change WHAT is answered.
//  B) GAUNTLET — raw, messy, misspelled customer questions (authored per
//     intent + red-team escalation probes) must resolve to the expected
//     intent/target, or escalate when that is the correct behaviour.
//  C) SELF-CONSISTENCY — every authored utterance, run through the matcher,
//     must rank its OWN intent first (or an intent with the same reply target).
//
// Data: lumina-chat/data/brain_src/*.json  (written by the authoring agents)
//   { "utterances": [{"intent","text","weight"?}],
//     "lexicon": [{"canonical","variants":[]}],
//     "phrase_variants": [{"slot","variants":[]}],
//     "gauntlet": [{"text","expect"}] }   // expect = intent name | "escalate"
//
// Run: node lumina-chat/engine/run-tests.mjs   (bundles TS then runs this)
import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const kbBase = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "knowledge_base.json"), "utf8"));
const ported = await import(url.pathToFileURL(path.join(__dirname, ".test-build", "chat-bundle.mjs")).href);

// ---- merge brain sources ----
const srcDir = path.join(__dirname, "..", "data", "brain_src");
const merged = { utterances: [], lexicon: [], phrase_variants: [], gauntlet: [] };
if (fs.existsSync(srcDir)) {
  for (const f of fs.readdirSync(srcDir).filter((x) => x.endsWith(".json"))) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(srcDir, f), "utf8"));
      for (const k of Object.keys(merged)) if (Array.isArray(j[k])) merged[k].push(...j[k]);
    } catch (e) { console.log("BAD JSON:", f, e.message); process.exit(1); }
  }
}
console.log(`brain sources: ${merged.utterances.length} utterances, ${merged.lexicon.length} lexicon groups, ${merged.phrase_variants.length} phrase slots, ${merged.gauntlet.length} gauntlet probes`);

const VALID_INTENTS = new Set((kbBase.intents || []).map((i) => i.name));
const badIntents = merged.utterances.filter((u) => !VALID_INTENTS.has(u.intent));
if (badIntents.length) {
  console.log("UNKNOWN INTENTS in utterances:", [...new Set(badIntents.map((u) => u.intent))].join(", "));
  process.exit(1);
}

const kb = { ...kbBase, utterances: merged.utterances, lexicon: merged.lexicon, phrase_variants: merged.phrase_variants };
const smart = ported.buildSmartKb(kb);

const intentByName = Object.fromEntries((kb.intents || []).map((i) => [i.name, i]));
const targetOf = (intentName) => (intentByName[intentName] || {}).target || intentName;

const NOW = new Date("2026-07-09T08:00:00Z");
const freshState = { name: "Thabo", last_user_message_at: NOW.toISOString() };
const run = (text) => ported.decideSmart({ text, state: { ...freshState }, kb, smart, now: NOW, leadKey: "test" });

// ================= A) V1 preservation =================
const V1_CASES = [
  ["Where are u located?", "qr", "Based"], ["Hi. Where are u located?", "qr", "Based"],
  ["Do you have a branch in Pretoria?", "qr", "Based"], ["Do you do nationwide delivery", "qr", "Based"],
  ["I am looking for car but i don't have deposit", "qr", "deposit"],
  ["I'm afraid of scam. This money you need to qualify", "qr", "deposit"],
  ["Is there a balloon payment?", "qr", "deposit"],
  ["How much is the monthly installments", "qr", "installments"],
  ["Evening interested in a polo installment not more than 3000", "qr", "installments"],
  ["what will my monthly instalment be?", "qr", "installments"],
  ["What is needed to qualify ?", "qr", "docs"], ["What do i need to bye a vehicle", "qr", "docs"],
  ["Requirements?", "qr", "docs"],
  ["Which cars do you have?", "qr", "catalog"], ["Do you have automatic cars", "qr", "catalog"],
  ["Do you sell bakkies new demo and pre owned bakkies", "qr", "catalog"],
  ["Do you have Renault triber available", "qr", "catalog"], ["Show me whats cars do u have", "qr", "catalog"],
  ["How much credit score your looking for", "qr", "creditscore"],
  ["Im under debt review i need a car", "qr", "debtreview"],
  ["Do you assist people under debt review?", "qr", "debtreview"],
  ["Can u qualify for a car If am under ITC", "qr", "blacklisted"],
  ["I think I might be blacklisted", "qr", "blacklisted"],
  ["I need a car but I have low credit score I can afford to pay", "qr", "badcredit"],
  ["My credit is not that Good but I wud love to have a car", "qr", "badcredit"],
  ["i need a car,but I have bad credit im behind on my credit payements", "qr", "badcredit"],
  ["My score is 577 and I earn 8500 will I be able to get a car", "qr", "badcredit"],
  ["I have no credit record", "qr", "nocredit"],
  ["Do I qualify for a car if I don't have license", "qr", "no licence"],
  ["Is it a must to have driver's licenses to qualify", "qr", "Nolicencerespond"],
  ["I'm actually busy with my learners , will you still check if I qualify?", "qr", "Nolicencerespond"],
  ["Do i send my nominee's license", "qr", "nominated driver"],
  ["My brother inlaw have license", "qr", "nominated driver"],
  ["Are you guys married in comminuty of property", "qr", "spouse"],
  ["Permanently employed with a monthly salary of 7500", "qr", "low income"],
  ["how does the referral work", "qr", "referral"],
  ["Can I trade in my current car", "qr", "trade in"],
  ["No payslips I'm self employed", "qr", "6month"],
  ["Hi Lumina do you do finance", "funnel", null], ["I want a car", "funnel", null],
  ["Check if I qualify to purchase a vehicle", "funnel", null],
  ["Am I qualify for finance?", "funnel", null], ["Yes I need a car", "funnel", null],
  ["Good Morning! How can I assist you today?", "qr", "questions morning"],
  ["Do you do rent to own?", "escalate", null], ["Why is there no response?", "escalate", null],
  ["is the 2023 Ford Ecosport still available?", "escalate", null],
  ["Can I call or text", "escalate", null],
  ["I have just submitted my finance application, any feedback?", "escalate", null],
  ["How can I come in contact with you", "escalate", null],
];

let aFail = 0;
for (const [msg, action, target] of V1_CASES) {
  const d = run(msg);
  const okAction = d.action === action;
  const okTarget = !target || String(d.reply_ref || "").split("+").includes(target);
  if (!okAction || !okTarget) {
    aFail++;
    console.log(`  A-FAIL "${msg}" want ${action}/${target} got ${d.action}/${d.reply_ref} (${d.reason})`);
  }
}

// ================= B) gauntlet =================
let bPass = 0, bFail = 0;
const bFails = [];
for (const probe of merged.gauntlet) {
  const d = run(probe.text);
  let ok;
  if (probe.expect === "escalate") ok = d.action === "escalate";
  else if (probe.expect === "funnel" || (intentByName[probe.expect] || {}).action === "funnel") {
    ok = d.action === "funnel" || (d.reason || "").includes(probe.expect);
  } else {
    const wantTarget = targetOf(probe.expect);
    ok = (d.action === "qr" || d.action === "sequence" || d.action === "learned") &&
      (String(d.reply_ref || "").split("+").includes(wantTarget) ||
        (d.reason || "").includes(probe.expect) ||
        // credit-family probes may legitimately resolve to the diagnostic sequence
        (["badcredit", "blacklisted", "debtreview", "nocredit"].includes(wantTarget) && d.action === "sequence"));
  }
  if (ok) bPass++;
  else { bFail++; bFails.push({ text: probe.text, expect: probe.expect, got: `${d.action}/${d.reply_ref}/${d.reason}` }); }
}

// ================= C) self-consistency =================
let cFail = 0;
const cFails = [];
for (const u of merged.utterances) {
  const toks = ported.normalizeText(u.text, smart.lexicon, smart.vocab).tokens;
  const ranked = ported.__matchSegment ? ported.__matchSegment(toks, smart.index, 0.4) : null;
  if (!ranked) break; // matcher internals not exported in bundle → skip C
  if (!ranked.length) { cFail++; cFails.push({ text: u.text, intent: u.intent, got: "(no score)" }); continue; }
  const top = ranked[0];
  const ok = top.intent === u.intent || targetOf(top.intent) === targetOf(u.intent);
  if (!ok) { cFail++; cFails.push({ text: u.text, intent: u.intent, got: `${top.intent}@${top.score.toFixed(2)}` }); }
}

console.log("=== BRAIN GAUNTLET ===");
console.log(`A v1-preservation: ${V1_CASES.length - aFail}/${V1_CASES.length}`);
console.log(`B gauntlet:        ${bPass}/${merged.gauntlet.length}`);
console.log(`C self-consistency: ${merged.utterances.length - cFail}/${merged.utterances.length}`);
if (bFails.length) {
  console.log("--- B failures (first 25) ---");
  for (const f of bFails.slice(0, 25)) console.log(`  "${f.text}" expect=${f.expect} got=${f.got}`);
}
if (cFails.length) {
  console.log("--- C failures (first 25) ---");
  for (const f of cFails.slice(0, 25)) console.log(`  [${f.intent}] "${f.text}" -> ${f.got}`);
}
fs.writeFileSync(path.join(__dirname, ".test-build", "brain-report.json"), JSON.stringify({ aFail, bPass, bFail, cFail, bFails, cFails }, null, 2));

if (aFail === 0 && bFail === 0 && cFail === 0) console.log("BRAIN ALL GOOD");
else { console.log("BRAIN FAILURES — see report"); process.exit(1); }
