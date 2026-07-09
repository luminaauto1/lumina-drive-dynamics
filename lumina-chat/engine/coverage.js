// coverage.js — runs ~110 REAL client messages (mined read-only from your
// chats) through the engine and reports how many get auto-answered vs handed
// to a human. This is a realistic coverage estimate, not a pass/fail test.
// Run: node engine/coverage.js
const fs = require("fs");
const path = require("path");
const { decide } = require("./engine.js");
const kb = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "knowledge_base.json"), "utf8"));
const fresh = { name: "Client", last_user_message_at: new Date().toISOString() };

const MSGS = [
  "Where are u located?", "Hi. Where are u located?", "Do you have a branch in Pretoria?",
  "Do you do nationwide delivery", "We dont get PaySlips", "No payslips I'm self employed",
  "I am looking for car but i don't have deposit", "I'm afraid of scam. This money you need to qualify",
  "How much is the monthly installments", "How much credit score your looking for",
  "What is needed to qualify ?", "What do i need to bye a vehicle", "Requirements?",
  "Which cars do you have?", "Do you have automatic cars", "Do you sell bakkies new demo and pre owned bakkies",
  "Do you have Renault triber available", "Show me whats cars do u have", "Give list off cars",
  "Can u show me the varieties of the cars", "Do you have panel Vans", "I'm looking for7seater even used car",
  "Im under debt review i need a car", "Do you assist debt review clients", "Do you assist people under debt review?",
  "So if I'm under debt review is it possible to help me?", "Can u qualify for a car If am under ITC",
  "I think I might be blacklisted", "Am earning r32k dats bfr deductions, m blacklisted",
  "I need a car but I have low credit score I can afford to pay", "My credit is not that Good but I wud love to have a car",
  "i need a car,but I have bad credit im behind on my credit payements", "My score is 577 and I earn 8500 will I be able to get a car",
  "My credit score is 581 , would I qualify if I earn 18000 per month?", "Salary 20k credi score 590",
  "My salary around R14 000 score around 594", "Do help when on a low credit score ?",
  "Do you also help clients with bad credit record?", "Blacklisted, affordability as well",
  "I have no credit record", "Do I qualify for a car if I don't have license",
  "Is it a must to have driver's licenses to qualify", "I dont have a drivers licence...and im under debt review",
  "I'm actually busy with my learners , will you still check if I qualify?", "What car would I qualify for? I have a learners driver not yes licence",
  "Do i send my nominee's license", "My brother inlaw have license", "What if I don't have parents anymore.",
  "Are you guys married in comminuty of property", "Permanently employed with a monthly salary of 7500",
  "I don't qualify due to my earnings per month", "how does the referral work",
  "Can I trade in my current car", "Hi I have a rav4 Toyota I'm in debt i finish in 2028 Can you help me to give me a other car",
  "Hi Lumina do you do finance", "Hi Lumina do you do finance", "I want a car", "I want car", "I just need a Car",
  "I need a car", "Yes I need a car", "I wanna busy a car", "I'm looking for a car",
  "Check if I qualify to purchase a vehicle", "Am I qualify for finance?", "Am I qualify for finance?",
  "Hi, I would like to inquire about vehicle finance.", "What is needed to qualify",
  "Hey what do you need to qualify for car", "Hi my credit score is 582 can I get a no deposit car deal",
  "Which car would i get if i have a deposit amount of R38 000.00 a salary that varies from R7500 to R14000",
  "Permanently employed with a monthly salary of 7500", "Good Morning! How can I assist you today?",
  "Good morning", "Hello! Can I get more info on this?", "I'm interested in this Car", "I like that car",
  "What are You offering", "Hey", "Yes I need a car", "Requirements?",
  "How much is the monthly installments", "Used car", "No documents", "Password for Payslip: 8511050427085",
  "I will send the payslips tomorrow", "I am waiting for the latest payslip.", "Payslip",
  // --- expected to ESCALATE (no safe canned answer) ---
  "Do you do rent to own?", "Good morning, do you do rent to own?", "Do you do rent to own",
  "Why is there no response?", "Why u didn't help me", "Why was t declined",
  "is the 2023 Ford Ecosport still available?", "Morning do you Cherry Tigo 4 Automatic?",
  "Can I call or text", "How can I come in contact with you", "When can I come to you'll guys office",
  "I have just submitted my finance application, any feedback?", "Am I qualify? any feedback from the bank",
  "https://maps.app.goo.gl/AvaADswechnAATuWA", "I can explain what happened if you give me that opportunity",
];

const dist = {};
const escalated = [];
const answered = [];
for (const m of MSGS) {
  const d = decide({ text: m, state: { ...fresh }, kb });
  dist[d.action] = (dist[d.action] || 0) + 1;
  if (d.action === "escalate") escalated.push(`${m}  ->  [${d.reason}]`);
  else answered.push(`${m}  ->  ${d.action}:${d.reply_ref || ""}`);
}
const total = MSGS.length;
const auto = (dist.qr || 0) + (dist.funnel || 0) + (dist.template || 0);
console.log("=== COVERAGE over", total, "real client messages ===");
console.log("distribution:", dist);
console.log(`auto-answered: ${auto}/${total} (${((auto/total)*100).toFixed(0)}%)`);
console.log(`escalated to human: ${dist.escalate || 0}/${total} (${(((dist.escalate||0)/total)*100).toFixed(0)}%)`);
console.log("\n--- escalated (correctly handed to a human) ---");
escalated.forEach((e) => console.log("  " + e));
