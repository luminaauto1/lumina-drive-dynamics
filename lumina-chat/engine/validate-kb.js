// validate-kb.js — referential-integrity checks on the knowledge base.
// Ensures every rule points at something real, so the engine can never
// reference a missing reply. Run: node engine/validate-kb.js
const fs = require("fs");
const path = require("path");
const kb = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "knowledge_base.json"), "utf8"));

const problems = [];
const qrKeys = new Set(kb.quick_replies.map((q) => q.keyword));
const funnelCodes = new Set(kb.funnel.map((n) => n.code));
const tplIds = new Set(kb.templates.map((t) => t.id));

// 1) every intent target resolves
for (const it of kb.intents) {
  if (it.action === "qr" && !qrKeys.has(it.target)) problems.push(`intent ${it.name}: missing quick_reply '${it.target}'`);
  if (it.action === "funnel" && !funnelCodes.has(it.target)) problems.push(`intent ${it.name}: missing funnel '${it.target}'`);
  if (!Array.isArray(it.patterns) || it.patterns.length === 0) problems.push(`intent ${it.name}: no patterns`);
  for (const p of it.patterns) { try { new RegExp(p, "i"); } catch (e) { problems.push(`intent ${it.name}: bad regex ${p}`); } }
}
// 2) every escalation rule has valid regex
for (const e of kb.escalation) {
  for (const p of e.patterns) { try { new RegExp(p, "i"); } catch (_) { problems.push(`escalation ${e.name}: bad regex ${p}`); } }
}
// 3) funnel option targets resolve (qr: / funnel code / control words)
for (const n of kb.funnel) {
  for (const o of n.options || []) {
    const nx = o.next;
    if (!nx) continue;
    if (nx.startsWith("qr:")) { if (!qrKeys.has(nx.slice(3))) problems.push(`funnel ${n.code}: option '${o.title}' -> missing qr '${nx.slice(3)}'`); }
    else if (["ESCALATE", "ESCALATE_OR_INTENT"].includes(nx)) { /* control */ }
    else if (!funnelCodes.has(nx)) problems.push(`funnel ${n.code}: option '${o.title}' -> missing node '${nx}'`);
  }
}
// 4) reengage templates exist
for (const id of (kb.window_policy.reengage_templates || [])) {
  if (!tplIds.has(id)) problems.push(`window_policy: reengage template ${id} not in templates`);
}

console.log("=== KB VALIDATION ===");
console.log(`quick_replies=${kb.quick_replies.length} templates=${kb.templates.length} funnel=${kb.funnel.length} intents=${kb.intents.length} escalation=${kb.escalation.length}`);
if (problems.length) { console.log("PROBLEMS:"); problems.forEach((p) => console.log("  - " + p)); process.exit(1); }
console.log("All references resolve. ✔");
