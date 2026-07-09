# Lumina Auto — Standalone Chat Responder: Runbook

A fully **standalone** WhatsApp auto-responder. It runs on **your own stack only**:

```
WhatsApp client ──▶ EasySocial (your platform) ──▶ YOUR Vercel API ──▶ YOUR Supabase (the brain)
                         ▲                                                  │
                         └───────────── reply (as if a human) ◀────────────┘
```

**No n8n. No third-party automation. No paid add-ons. No AI.** The only moving parts are EasySocial (where your chats already live), your Vercel serverless functions, and your Supabase database. Replies are chosen by deterministic rules built from your real quick replies.

---

## Two ways it answers (use both)

**A. Realtime (recommended, answers every new chat instantly)**
EasySocial's built-in **API node** (part of your chatbot builder — no extra tool) calls your endpoint for each incoming message and sends back your reply. This handles read, unread and brand-new chats automatically, 24/7.

**B. Morning batch button (catch-up for the backlog)**
A button on your site POSTs to `/api/run-batch`. It sweeps chats that are waiting on you, applies the same engine, and answers or escalates each. Great for clearing the current backlog and as a safety net.

Both share the exact same brain (`engine/engine.js` + your Supabase KB), so answers are identical.

---

## What's in this package

```
db/schema.sql          Supabase tables (KB + operational)
db/seed.sql            Loads your 32 quick replies, 17 templates, funnel, intents, rules
data/build_kb.py       Single source of truth -> regenerates knowledge_base.json + seed.sql
data/knowledge_base.json  Machine-readable brain (also the offline fallback)
engine/engine.js       Deterministic decision engine (NO AI, zero deps)
engine/kb.js           Loads KB from Supabase (or JSON fallback)
engine/easysocial.js   Client for EasySocial's API (read chats, send, templates)
engine/batch-worker.js The morning sweep logic
engine/test-engine.js  Replays 50 real client messages (100% pass)
api/respond.js         Realtime endpoint EasySocial's API node calls
api/run-batch.js       Endpoint your website button/cron calls
docs/PLAYBOOK.md       Exactly what you say in every scenario
```

---

## Setup (once)

### 1. Database
1. Open Supabase → SQL Editor.
2. Run `db/schema.sql` (creates the tables).
3. Run `db/seed.sql` (loads the knowledge base).
   Sanity check: `select count(*) from quick_reply;` → 32.

### 2. Deploy the API
1. Put this folder in your existing Vercel project (or a new one).
2. `npm install` (only dependency: `@supabase/supabase-js`).
3. Add the environment variables from `.env.example` in Vercel → Settings → Environment Variables.
4. Deploy. You now have `POST /api/run-batch` and `GET /api/respond`.

### 3. Get your EasySocial credentials
The reads use the same headers the EasySocial web app uses:
- `ES_TOKEN` – in the web app, DevTools → Application → Local Storage → `token`.
- `ES_DEVICE_ID` – Local Storage → `device-id`.
- `ES_BUSINESS_ID` = `4026`, `ES_USER_ID` = `8403`.

> ⚠️ The web-app token expires. For production, generate a proper **EasySocial API key** (EasySocial → Settings → WhatsApp/API) and use that. This keeps everything on your own account with a stable credential.

### 4. Wire the realtime path (EasySocial API node)
In EasySocial → Settings → Chatbot Platforms → WhatsApp → chatflow builder:
1. Add a **Basic Message** node that captures the user's text into a lead field (e.g. `user_input`).
2. Add an **API node** right after it. Point it at:
   `https://<your-site>/api/respond?leadId=[leadId]&message=[user_input]&name=[name]&phone=[phone]&licence=[licence_status]&credit=[credit_profile_status]&income=[income_status]&tags=[tags]`
   (the profile params let it answer with the exact-right reply; it also pulls the **whole conversation** from EasySocial so earlier/buried questions still get answered.)
3. Your endpoint returns `{ "data": { "body_text": "..." } }` (or an interactive button block) which EasySocial delivers to WhatsApp.
4. Add an exit **Basic Message** node marked "end node".

That's the same integration slot EasySocial documents for AI — except here it calls **your deterministic engine**, not an AI.

### 5. Wire the morning button
Add a button on your site that does:
```
fetch("https://<your-site>/api/run-batch", {
  method: "POST",
  headers: { "content-type": "application/json", "x-batch-secret": BATCH_SECRET },
  body: JSON.stringify({ dryRun: true, maxLeads: 200 })
})
```
Optionally schedule it every morning with **Vercel Cron** (first-party, free) hitting the same endpoint.

---

## Go-live sequence (safe)

1. Keep `ES_DRY_RUN=true`. Press the button (or let realtime run). **Nothing is sent.**
2. Inspect `reply_log` in Supabase — every row shows the inbound message, the chosen reply, and the confidence. Read a few dozen and confirm they match how you'd answer.
3. Check `escalation_queue` — these are the ones it (correctly) refused to guess on.
4. **Confirm the send endpoint** in `engine/easysocial.js` (`sendMessage` / `sendTemplate`) against your EasySocial account. They're marked `VERIFY` and default to dry-run.
5. Flip `ES_DRY_RUN=false`. It now sends for real. Watch `run_log` and `reply_log`.

---

## The 24-hour window (handled for you)

`engine/engine.js` checks `last_user_message_at`. Inside 24h it sends a normal reply; outside 24h it returns a **template** instead (WhatsApp rule), defaulting to the *no-reply reminder*. You don't have to do anything — but make sure your re-engagement templates stay approved in EasySocial.

---

## Keeping the brain in sync

- Your quick replies live in two places that must match: EasySocial (for the composer) and Supabase (for the engine). If you change a quick reply in EasySocial, re-pull them: `GET /api/v1/quick-reply` (helper: `engine/easysocial.js → getQuickReplies`) and update `data/build_kb.py`, then `python3 data/build_kb.py` and re-run `db/seed.sql`.
- To add/adjust rules: edit `INTENTS` / `ESCALATION` / `BUSINESS_RULES` in `data/build_kb.py`, run it, re-seed, and run `npm test` to confirm nothing regressed.

---

## Guardrails baked in

- **Never guesses.** No confident rule match → escalates to a human (`escalation_queue`).
- **Safety first.** Legal/abuse/scam-accusation/status/"call me" always escalate, even if another rule matches.
- **Dry-run by default.** No message goes out until you explicitly enable it.
- **Fu