# Lumina Auto — Standalone WhatsApp Auto-Responder

Answers your EasySocial WhatsApp chats **automatically, as if a human typed it**, using your own real quick replies. **No AI. No n8n. No third-party or paid tools.** Runs entirely on your existing stack: **EasySocial → your Vercel API → your Supabase database.**

Built from a read-only study of your chats: **all 6,702 leads** analysed for tags/labels/profiles, and **~3,000 transcripts** mined deeply for reply wording (nothing was sent, no unread chat was opened).

### Start here
1. `FOR-CLAUDE-CODE.md` — hand this whole folder to Claude Code; it's the implementation brief.
2. `docs/PLAYBOOK.md` — exactly what you say in every scenario (the brain, in plain English).
3. `docs/ANALYTICS.md` — what all 6,702 leads look like (typical client, tag counts).
4. `docs/DASHBOARD-SPEC.md` — the control-panel page to build.
5. `docs/RUNBOOK.md` — how to set it up and go live safely.

### Control panel (runs EasySocial for you)
A page on your site with: a **stats dashboard** (how many blacklisted / bad credit / declined / no-licence, etc.), an **"answer all chats"** button, and a **"needs you" queue** — anything the bot is unsure about, you type an answer once and it's **sent and remembered** (auto-answers that message next time). Pre-approved/validated leads are left for you. Endpoints in `api/`, UI spec in `docs/DASHBOARD-SPEC.md`.

### Quick facts
- **33** quick replies + **17** templates + **9** funnel steps + **22** intent rules + **6** safety/escalation rules + **message sequences** — all mined from your chats.
- Deterministic engine: reads the whole chat, uses the client's profile, combines answers