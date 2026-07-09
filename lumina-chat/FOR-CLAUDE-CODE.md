# Implementation brief — for Claude Code

You are integrating a **standalone, deterministic WhatsApp auto-responder + control panel** into the user's existing website (Vercel + Supabase). Everything you need is in this folder. Follow this brief top to bottom.

## Hard rules (do not violate)
- **No third-party automation and no paid tools. No n8n. No AI/LLM at runtime.** Replies are chosen by deterministic rules (regex/keyword + funnel state) already written in `engine/engine.js`. Do not swap in an AI call.
- The only external system is **EasySocial** (the user's existing platform) via its API, and the user's own **Supabase**.
- **Sends stay OFF (`ES_DRY_RUN=true`) until the user explicitly enables them.** Do not flip it.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `ES_TOKEN`, or `BATCH_SECRET` to the browser. All EasySocial/Supabase calls happen in server routes only.

## What this system does
1. **Realtime:** EasySocial's built-in **API node** calls `GET /api/respond` for each incoming WhatsApp message; the engine returns the correct reply (the user's real quick replies) and EasySocial sends it. Answers every new chat as if a human typed it.
2. **Batch button:** `POST /api/run-batch` sweeps all waiting chats and answers/escalates them (for clearing the backlog + a safety net).
3. **Control panel** (you build the UI, see `docs/DASHBOARD-SPEC.md`): stats dashboard (counts by tag/credit/licence/income), the "answer all chats" button, and a **"needs you" queue** where the user types an answer for anything the bot was unsure about — which is **sent and remembered** (exact-message memory) so it auto-answers next time.
4. **Hands-off:** leads tagged **Approved - Need Docs / Validations Pending / Vals Done** are never auto-answered (the user handles pre-approved/validated themselves).

## Step 1 — Database (Supabase)
Run, in order, in the Supabase SQL editor (or as migrations):
1. `db/schema.sql` — creates KB tables, operational tables, `learned_reply`, `stats_snapshot`. Enables RLS (server-only access).
2. `db/seed.sql` — loads the knowledge base (32 quick replies, 17 templates, 9 funnel nodes, 22 intents, 6 escalation rules, business rules, tags).
Verify: `select count(*) from quick_reply;` → 32.
`seed.sql` is safe to re-run (it truncates only KB tables, never `learned_reply`/logs).

## Step 2 — Code
Copy this folder into the repo (suggested `/lumina-chat/`). It's CommonJS, Node ≥18, one dependency (`@supabase/supabase-js`). The `api/*.js` files are plain serverless handlers `(req,res)`; adapt to the project's routing:
- **Next.js App Router:** wrap each in a `route.ts` (`export async function GET/POST(req)`), or drop them in `/pages/api/*` if using Pages Router (they already match that signature).
- Keep `engine/*` and `data/*` as server-side imports (never bundle into client code — they read the KB/JSON and env).

Endpoints:
| Route | Method | Auth header | Purpose |
|---|---|---|---|
| `/api/respond` | GET | none (EasySocial calls it) | Realtime reply for the EasySocial API node |
| `/api/run-batch` | POST | `x-batch-secret` | Sweep + answer waiting chats |
| `/api/stats` | GET | `x-admin-secret` | Dashboard numbers (fast, from snapshot) |
| `/api/refresh-stats` | POST | `x-admin-secret` | Recompute numbers from EasySocial |
| `/api/escalations` | GET | `x-admin-secret` | The "needs you" queue |
| `/api/answer` | POST | `x-admin-secret` | Send a human answer + remember it |

`x-admin-secret` and `x-batch-secret` both check `process.env.BATCH_SECRET`.

## Step 3 — Environment variables (Vercel → Settings → Env)
Copy from `.env.example`:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ES_API_BASE`, `ES_BUSINESS_ID` (4026), `ES_TOKEN`, `ES_DEVICE_ID`, `ES_USER_ID` (8403), `ES_DRY_RUN=true`, `BATCH_SECRET` (long random string).
> `ES_TOKEN`/`ES_DEVICE_ID` come from the EasySocial web app's Local Storage (`token`, `device-id`). The web token is short-lived — tell the user to generate a proper EasySocial API key for production and swap it in (`engine/easysocial.js` `headers()`).

## Step 4 — Wire the realtime path in EasySocial
In EasySocial → chatbot builder: capture the user's message into a lead field, then add an **API node** pointing to
`https://<site>/api/respond?leadId=[leadId]&message=[user_input]&name=[name]&phone=[phone]&licence=[licence_status]&credit=[credit_profile_status]&income=[income_status]&tags=[tags]`.
Pass the profile fields (licence/credit/income) so the engine answers with the exact-right reply; they're optional but recommended. `/api/respond` also fetches the **full transcript** from EasySocial itself, so buried questions are answered even if EasySocial only sends the latest message. It returns `{ data: { body_text } }` or an interactive-button block. (See `docs/RUNBOOK.md` §4.)

### How replies are built (deterministic, no AI)
For every message the engine: (1) reads the **entire conversation** (via `engine/context.js` + `es.getAllMessages`) and gathers **every** still-unanswered client question, (2) uses the client's **profile** to pick the exact-right reply (e.g. credit = debt review → the debt-review reply, not a generic one), (3) **combines** multiple questions into one message, (4) **fills in numbers** (name, deposit math, income thresholds), (5) **won't repeat** a reply already sent, and (6) reproduces your **multi-step human flows** as sequences (see below). It's all rule-based assembly from the database — no model, no cost. Do not replace this with an AI call.

### Message sequences (mined from your real takeovers)
Some situations are answered by your team with a **sequence of messages**, not one. This was mined across ~140 pages / 860 human-takeover messages. The `reply_sequence` table holds them; today the seeded one is **`credit_diagnostic` = ["whyscore","arrears"]**: when a client raises bad/low credit *without specifics and we don't already know their profile*, the bot sends **"Why is your credit score low?"** then **"Do you have accounts in arrears or are you under debt review?"** — exactly your human flow — and the client's next answer (arrears/missed → `badcredit`; debt review/blacklisted → `debtreview`; no credit → `nocredit`) drives the right advice on the following turn. The engine returns `action:"sequence"` with a `messages[]` array; the batch worker sends each message in order, and `/api/respond` returns them joined. Add more sequences by inserting into `reply_sequence` (steps = quick_reply keywords) via `data/build_kb.py`.

## Step 5 — Build the control panel UI
Follow `docs/DASHBOARD-SPEC.md` exactly, styled to the site's design system. It only calls the six endpoints above. No secrets in the client.

## Step 6 — Confirm the SEND endpoint (before going live)
`engine/easysocial.js` `sendMessage()` / `sendTemplate()` are marked **VERIFY** and default to dry-run. Confirm the exact EasySocial send path/shape (the reads are confirmed working) before the user sets `ES_DRY_RUN=false`. Until then the whole system runs in simulation and logs to `reply_log`.

## Step 7 — Test
- `npm install` then `npm test` → engine replay must print **ALL GOOD** (50/50).
- `node engine/validate-kb.js` → "All references resolve".
- `node engine/coverage.js` → ~81% auto-answered, rest escalated (expected).

## Known items to surface to the user (not blockers)
- **Self-employed minimum income** conflicts in their own templates (R14k/R15k/R20k/R25k). KB uses R20k — confirm and update `data/build_kb.py → BUSINESS_RULES`, then `python3 data/build_kb.py` and re-run `db/seed.sql`.
- **Referral amount** varies (R5k vs ranges).
- EasySocial `ES_TOKEN` rotation → move to an API key.

## Editing the brain later
`data/build_kb.py` is the single source of truth. Edit quick replies / intents / escalation there, run `python3 data/build_kb.py` (regenerates `knowledge_base.json` + `db/seed.sql`), re-run `seed.sql`, then `npm test`. Never hand-edit `seed.sql` or `knowledge_base.json`.

---
**How the user hands this to you:** they drop this folder into the repo you're already connected to and point you at this file. Everything is self-contained and verified.
