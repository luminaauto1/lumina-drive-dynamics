# Verification Report

Automated checks on the knowledge base and engine. Re-run any time with:
`node engine/validate-kb.js`, `node engine/test-engine.js`, `node engine/coverage.js`.

## 1. Knowledge-base integrity (`validate-kb.js`)
- 32 quick replies · 17 templates · 9 funnel nodes · 22 intents · 6 escalation rules.
- **All references resolve** — every intent/funnel target points at a real quick reply or node; every regex compiles; every re-engagement template exists. ✔

## 2. Engine replay — labelled (`test-engine.js`)
- **50 / 50 real client messages routed correctly (100%).**
- 24-hour window: a stale chat correctly switches to a **template** (no free text). ✔
- Safety: an abusive + legal message correctly **escalates** (hard rule). ✔
- Hands-off tag: a `Vals Done` (pre-approved) lead correctly **escalates/skips**. ✔
- Learned reply: a human-taught exact answer correctly **overrides soft escalation** and auto-answers. ✔

## 2b. Full-base analysis (all 6,702 leads)
- Every lead swept for tags/labels/profile; ~3,000 transcripts mined for wording.
- Confirmed the KB covers the dominant situations; disputes are rare and route to a human.
- See `docs/ANALYTICS.md` + `data/analytics.json`.

## 2d. Full-chat context + dynamic composition (`test-engine.js`)
- **Buried question** (asked → auto-reply → "ok"): the earlier question is still answered. ✔
- **Two questions in one message** → a single combined reply. ✔
- **Profile-aware credit**: vague "my credit is bad" + profile = debt review → the debt-review reply (not a generic one). ✔
- **Deposit math**: "R38,000 deposit" → reply gains "≈ R600pm less". ✔
- **No repeats**: a reply already sent isn't sent again → routes to a human instead. ✔
- Reads the whole transcript via `engine/context.js` + `es.getAllMessages`. All rule-based, no AI.

## 2e. Message sequences (`test-engine.js`)
- **Credit diagnostic**: vague bad credit + unknown profile → sends "Why is your credit score low?" **then** "/arrears" (2-message sequence). ✔
- **Known profile** (