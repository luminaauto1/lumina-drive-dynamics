// test-engine.js — replays REAL client messages (mined read-only from 1,430
// chats) through the deterministic engine and reports coverage + a sample map.
// Run:  node engine/test-engine.js
const fs = require("fs");
const path = require("path");
const { decide } = require("./engine.js");

const kb = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "knowledge_base.json"), "utf8"));

// A within-window lead (client just messaged) so free-text replies are allowed.
const nowIso = new Date().toISOString();
const freshState = { name: "Thabo", last_user_message_at: nowIso };

// Real client messages -> what we EXPECT (intent name or 'escalate').
// Expectations reflect Lumina's actual playbook.
const CASES = [
  // location / delivery
  ["Where are u located?", "location"],
  ["Hi. Where are u located?", "location"],
  ["Do you have a branch in Pretoria?", "location"],
  ["Do you do nationwide delivery", "location"],
  // deposit / upfront / scam
  ["I am looking for car but i don't have deposit", "deposit_or_upfront"],
  ["I'm afraid of scam. This money you need to qualify", "deposit_or_upfront"],
  ["Is there a balloon payment?", "deposit_or_upfront"],
  // installments / price
  ["How much is the monthly installments", "installments_price"],
  ["Evening interested in a polo installment not more than 3000", "installments_price"],
  ["what will my monthly instalment be?", "installments_price"],
  // documents
  ["What is needed to qualify ?", "documents"],
  ["What do i need to bye a vehicle", "documents"],
  ["Requirements?", "documents"],
  // catalog / stock
  ["Which cars do you have?", "catalog_stock"],
  ["Do you have automatic cars", "catalog_stock"],
  ["Do you sell bakkies new demo and pre owned bakkies", "catalog_stock"],
  ["Do you have Renault triber available", "catalog_stock"],
  ["Show me whats cars do u have", "catalog_stock"],
  // credit score info
  ["How much credit score your looking for", "credit_score_info"],
  // debt review / blacklisted
  ["Im under debt review i need a car", "debt_review"],
  ["Do you assist people under debt review?", "debt_review"],
  ["Can u qualify for a car If am under ITC", "blacklisted"],
  ["I think I might be blacklisted", "blacklisted"],
  // bad credit / arrears
  ["I need a car but I have low credit score I can afford to pay", "bad_credit_arrears"],
  ["My credit is not that Good but I wud love to have a car", "bad_credit_arrears"],
  ["i need a car,but I have bad credit im behind on my credit payements", "bad_credit_arrears"],
  ["My score is 577 and I earn 8500 will I be able to get a car", "bad_credit_arrears"],
  // no credit
  ["I have no credit record", "no_credit"],
  // licence
  ["Do I qualify for a car if I don't have license", "no_licence"],
  ["Is it a must to have driver's licenses to qualify", "licence_question"],
  ["I'm actually busy with my learners , will you still check if I qualify?", "learners_only"],
  // nominated driver / spouse
  ["Do i send my nominee's license", "nominated_driver"],
  ["My brother inlaw have license", "nominated_driver"],
  ["Are you guys married in comminuty of property", "spouse_info"],
  // low income
  ["Permanently employed with a monthly salary of 7500", "low_income"],
  // referral
  ["how does the referral work", "referral"],
  // trade in
  ["Can I trade in my current car", "trade_in"],
  // self employed
  ["No payslips I'm self employed", "self_employed"],
  // interested / qualify -> funnel
  ["Hi Lumina do you do finance", "funnel"],
  ["I want a car", "funnel"],
  ["Check if I qualify to purchase a vehicle", "funnel"],
  ["Am I qualify for finance?", "funnel"],
  ["Yes I need a car", "funnel"],
  // greeting
  ["Good Morning! How can I assist you today?", "greeting"],
  // --- SHOULD ESCALATE (no safe canned answer) ---
  ["Do you do rent to own?", "escalate"],
  ["Why is there no response?", "escalate"],           // complaint-ish / status
  ["is the 2023 Ford Ecosport still available?", "escalate"], // live stock
  ["Can I call or text", "escalate"],                  // wants a human/call
  ["I have just submitted my finance application, any feedback?", "escalate"], // live status
  ["How can I come in contact with you", "escalate"],
];

let pass = 0, fail = 0;
const dist = {};
const fails = [];
for (const [msg, expected] of CASES) {
  const d = decide({ text: msg, state: { ...freshState }, kb });
  const got = d.action === "escalate" ? "escalate" : (d.action === "funnel" ? "funnel" : d.reason);
  dist[d.action] = (dist[d.action] || 0) + 1;
  const ok = expected === "escalate" ? d.action === "escalate"
           : expected === "funnel" ? d.action === "funnel"
           : got === expected;
  if (ok) pass++; else { fail++; fails.push({ msg, expected, got, action: d.action, conf: d.confidence }); }
}

console.log("=== ENGINE REPLAY (real client messages) ===");
console.log(`cases: ${CASES.length}  pass: ${pass}  fail: ${fail}  (${((pass/CASES.length)*100).toFixed(0)}%)`);
console.log("action distribution:", dist);
if (fails.length) {
  console.log("\n--- mismatches (review) ---");
  for (const f of fails) console.log(`  "${f.msg}"\n     expected=${f.expected} got=${f.got} action=${f.action} conf=${f.conf}`);
}

// 24h window behaviour check
const stale = { name: "Old", last_user_message_at: new Date(Date.now() - 40 * 3.6e6).toISOString() };
const d2 = decide({ text: "How much is the monthly installments", state: stale, kb });
console.log("\n=== 24h WINDOW ===");
console.log(`stale chat -> action=${d2.action} needs_template=${!!d2.needs_template} template=${d2.template_name} (expected template)`);

// safety check
const d3 = decide({ text: "You guys are scammers, I will call my lawyer", state: freshState, kb });
console.log("\n=== SAFETY ===");
console.log(`abuse+legal -> action=${d3.action} reason=${d3.reason} (expected escalate)`);


// hands-off tag check
const d4 = decide({ text: "How much is the monthly installments", state: { ...freshState, tags: ["Vals Done"] }, kb });
console.log("\n=== HANDS-OFF TAG ===");
console.log(`pre-approved lead -> action=${d4.action} reason=${d4.reason} (expected escalate hands_off)`);

// learned reply (exact-message memory)
const { normKey } = require("./engine.js");
const kb2 = { ...kb, learned_replies: [{ match_key: normKey("do you do rent to own"), message: "Yes! We do rent-to-own on selected stock. Send me your budget and I'll line up options.", active: true }] };
const d5 = decide({ text: "Do you do rent to own?", state: { ...freshState }, kb: kb2 });
console.log("\n=== LEARNED REPLY ===");
console.log(`taught answer -> action=${d5.action} reason=${d5.reason} (expected learned)`);


// ===== CONTEXT-AWARE COMPOSITION =====
const { buildContext } = require("./context.js");
const R = (msg) => JSON.stringify(msg);

// 1) buried question: asked -> auto reply -> "ok". The real question must still be answered.
const transcript = [
  { sent_by: "user", sender_id: null, type: "text", message: "Where are you based?", created_at: "2026-07-08T10:00:00Z" },
  { sent_by: "self", sender_id: null, type: "interactive", message: { body: { text: "How can I assist you today?" } }, created_at: "2026-07-08T10:00:01Z" },
  { sent_by: "user", sender_id: null, type: "text", message: "ok", created_at: "2026-07-08T10:00:02Z" },
];
const cx1 = buildContext(transcript, { id: 1, name: "Sipho", lead_data: {} }, kb);
const dc1 = decide({ text: "ok", state: { name: "Sipho", last_user_message_at: nowIso, tags: [] }, kb, context: cx1 });
const t1 = dc1.action === "qr" && /Pretoria/.test(dc1.outbound_text || "");

// 2) two questions in one -> one combined reply
const cx2 = { effectiveInbound: "where are you based and do you require a deposit", profile: {}, tags: [], alreadySent: [] };
const dc2 = decide({ text: "x", state: { last_user_message_at: nowIso }, kb, context: cx2 });
const t2 = dc2.action === "qr" && dc2.combined === true && /Pretoria/.test(dc2.outbound_text) && /deposit/i.test(dc2.outbound_text);

// 3) profile-aware credit: vague "bad credit" + profile debt_review -> debtreview reply
const cx3 = { effectiveInbound: "my credit is bad can i still get a car", profile: { credit: "debt_review" }, tags: [], alreadySent: [] };
const dc3 = decide({ text: "x", state: { last_user_message_at: nowIso }, kb, context: cx3 });
const t3 = (dc3.reply_ref || "").includes("debtreview");

// 4) dynamic deposit math: R38000 -> ~R600pm off
const cx4 = { effectiveInbound: "I have a R38000 deposit, where are you based?", profile: {}, tags: [], alreadySent: [] };
const dc4 = decide({ text: "x", state: { last_user_message_at: nowIso }, kb, context: cx4 });
const t4 = /600pm/.test(dc4.outbound_text || "") && /Pretoria/.test(dc4.outbound_text || "");

// 5) don't repeat: only-matched reply already sent -> escalate 'already_answered'
const cx5 = { effectiveInbound: "where are you based", profile: {}, tags: [], alreadySent: ["Based"] };
const dc5 = decide({ text: "x", state: { last_user_message_at: nowIso }, kb, context: cx5 });
const t5 = dc5.action === "escalate" && dc5.reason === "already_answered";

const ctxOK = t1 && t2 && t3 && t4 && t5;
console.log("\n=== CONTEXT COMPOSITION ===");
console.log(`buried-question=${t1} combine=${t2} profile-credit=${t3} deposit-math=${t4} no-repeat=${t5}`);


// ===== MESSAGE SEQUENCES (human multi-step flow) =====
// vague bad credit, unknown profile -> diagnostic sequence: why-score THEN /arrears
const cxS1 = { effectiveInbound: "my credit is bad, can I get a car", profile: {}, tags: [], alreadySent: [] };
const dcS1 = decide({ text: "x", state: { last_user_message_at: nowIso }, kb, context: cxS1 });
const s1 = dcS1.action === "sequence" && dcS1.messages && dcS1.messages.length === 2 && /credit score low/i.test(dcS1.outbound_text) && /arrears/i.test(dcS1.outbound_text);

// same, but we already KNOW they're under debt review -> straight to advice
const cxS2 = { effectiveInbound: "my credit is bad", profile: { credit: "debt_review" }, tags: [], alreadySent: [] };
const dcS2 = decide({ text: "x", state: { last_user_message_at: nowIso }, kb, context: cxS2 });
const s2 = dcS2.action === "qr" && (dcS2.reply_ref || "").includes("debtreview");

// specifics already in the message -> advice, not the diagnostic
const cxS3 = { effectiveInbound: "I have accounts in arrears", profile: {}, tags: [], alreadySent: [] };
const dcS3 = decide({ text: "x", state: { last_user_message_at: nowIso }, kb, context: cxS3 });
const s3 = dcS3.action === "qr" && (dcS3.reply_ref || "").includes("badcredit");

// funnel "I've Got Questions" now sends the greeting (mined 11x), not escalate
const dcS4 = decide({ text: "I've Got Questions", state: { last_user_message_at: nowIso }, kb });
const s4 = dcS4.action === "qr" && dcS4.reply_ref === "questions morning";

const seqOK = s1 && s2 && s3 && s4;
console.log("\n=== SEQUENCES ===");
console.log(`diagnostic=${s1} known-profile-advice=${s2} specifics-advice=${s3} igotquestions-greeting=${s4}`);

const exitCode = fail === 0 && d2.action === "template" && d3.action === "escalate" && d4.action === "escalate" && d5.action === "learned" && ctxOK && seqOK ? 0 : 1;
console.log(`\nRESULT: ${exitCode === 0 ? "ALL GOOD" : "NEEDS ATTENTION"}`);
process.exit(exitCode);
