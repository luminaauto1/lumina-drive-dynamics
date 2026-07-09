// test-port.mjs — proves the TypeScript port (supabase/functions/_shared/chat)
// is behaviourally identical to the original engine.js: replays the SAME 50
// real client messages from test-engine.js through BOTH engines and diffs
// every decision field that matters. Run via: node lumina-chat/engine/run-tests.mjs
// (which esbuild-bundles the TS first).
import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const kb = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "knowledge_base.json"), "utf8"));

// original CommonJS engine
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const orig = require("./engine.js");

// ported TS engine (pre-bundled by run-tests.mjs into .test-build/)
const ported = await import(url.pathToFileURL(path.join(__dirname, ".test-build", "chat-bundle.mjs")).href);

const nowIso = new Date().toISOString();
const freshState = { name: "Thabo", last_user_message_at: nowIso };

const CASES = [
  ["Where are u located?", "location"],
  ["Hi. Where are u located?", "location"],
  ["Do you have a branch in Pretoria?", "location"],
  ["Do you do nationwide delivery", "location"],
  ["I am looking for car but i don't have deposit", "deposit_or_upfront"],
  ["I'm afraid of scam. This money you need to qualify", "deposit_or_upfront"],
  ["Is there a balloon payment?", "deposit_or_upfront"],
  ["How much is the monthly installments", "installments_price"],
  ["Evening interested in a polo installment not more than 3000", "installments_price"],
  ["what will my monthly instalment be?", "installments_price"],
  ["What is needed to qualify ?", "documents"],
  ["What do i need to bye a vehicle", "documents"],
  ["Requirements?", "documents"],
  ["Which cars do you have?", "catalog_stock"],
  ["Do you have automatic cars", "catalog_stock"],
  ["Do you sell bakkies new demo and pre owned bakkies", "catalog_stock"],
  ["Do you have Renault triber available", "catalog_stock"],
  ["Show me whats cars do u have", "catalog_stock"],
  ["How much credit score your looking for", "credit_score_info"],
  ["Im under debt review i need a car", "debt_review"],
  ["Do you assist people under debt review?", "debt_review"],
  ["Can u qualify for a car If am under ITC", "blacklisted"],
  ["I think I might be blacklisted", "blacklisted"],
  ["I need a car but I have low credit score I can afford to pay", "bad_credit_arrears"],
  ["My credit is not that Good but I wud love to have a car", "bad_credit_arrears"],
  ["i need a car,but I have bad credit im behind on my credit payements", "bad_credit_arrears"],
  ["My score is 577 and I earn 8500 will I be able to get a car", "bad_credit_arrears"],
  ["I have no credit record", "no_credit"],
  ["Do I qualify for a car if I don't have license", "no_licence"],
  ["Is it a must to have driver's licenses to qualify", "licence_question"],
  ["I'm actually busy with my learners , will you still check if I qualify?", "learners_only"],
  ["Do i send my nominee's license", "nominated_driver"],
  ["My brother inlaw have license", "nominated_driver"],
  ["Are you guys married in comminuty of property", "spouse_info"],
  ["Permanently employed with a monthly salary of 7500", "low_income"],
  ["how does the referral work", "referral"],
  ["Can I trade in my current car", "trade_in"],
  ["No payslips I'm self employed", "self_employed"],
  ["Hi Lumina do you do finance", "funnel"],
  ["I want a car", "funnel"],
  ["Check if I qualify to purchase a vehicle", "funnel"],
  ["Am I qualify for finance?", "funnel"],
  ["Yes I need a car", "funnel"],
  ["Good Morning! How can I assist you today?", "greeting"],
  ["Do you do rent to own?", "escalate"],
  ["Why is there no response?", "escalate"],
  ["is the 2023 Ford Ecosport still available?", "escalate"],
  ["Can I call or text", "escalate"],
  ["I have just submitted my finance application, any feedback?", "escalate"],
  ["How can I come in contact with you", "escalate"],
];

let pass = 0, fail = 0, diverge = 0;
const NOW = new Date();
for (const [msg, expected] of CASES) {
  const a = orig.decide({ text: msg, state: { ...freshState }, kb, now: NOW });
  const b = ported.decide({ text: msg, state: { ...freshState }, kb, now: NOW });
  const gotB = b.action === "escalate" ? "escalate" : (b.action === "funnel" ? "funnel" : b.reason);
  const ok = expected === "escalate" ? b.action === "escalate"
           : expected === "funnel" ? b.action === "funnel"
           : gotB === expected;
  if (ok) pass++; else { fail++; console.log(`  EXPECT FAIL: "${msg}" expected=${expected} got=${gotB}`); }
  // port-vs-original identity on the fields that matter
  for (const f of ["action", "reason", "reply_ref", "outbound_text", "confidence"]) {
    if (JSON.stringify(a[f] ?? null) !== JSON.stringify(b[f] ?? null)) {
      diverge++;
      console.log(`  DIVERGE [${f}] "${msg}"\n    orig=${JSON.stringify(a[f])}\n    port=${JSON.stringify(b[f])}`);
    }
  }
}

// 24h window behaviour
const stale = { name: "Old", last_user_message_at: new Date(Date.now() - 40 * 3.6e6).toISOString() };
const w = ported.decide({ text: "How much is the monthly installments", state: stale, kb, now: NOW });
const windowOk = w.action === "template" && w.needs_template === true;

console.log("=== PORT REPLAY ===");
console.log(`cases: ${CASES.length}  pass: ${pass}  fail: ${fail}  port-divergences: ${diverge}  window: ${windowOk ? "OK" : "FAIL"}`);
if (fail === 0 && diverge === 0 && windowOk) console.log("PORT ALL GOOD");
else { console.log("PORT MISMATCH"); process.exit(1); }
