# Dashboard / Control Panel — Build Spec (for Claude Code)

A single page on your site that runs EasySocial for you, so you rarely open EasySocial itself. Build it to match your existing site's design system. All data comes from the API endpoints in this package — the page holds **no secrets** (the server does).

## Page: `/control` (or wherever you like)

Auth: the page itself sits behind your existing site login. It calls the API routes, which each require the header `x-admin-secret: <BATCH_SECRET>`. Set that server-side (e.g. the routes read `process.env.BATCH_SECRET`); the browser never sees EasySocial or Supabase keys.

### Layout — three sections, top to bottom

**1) Header bar**
- Title "EasySocial Control Panel".
- Primary button **"Answer all waiting chats"** → `POST /api/run-batch` with `{ dryRun }`.
  - Include a **Dry-run toggle** next to it (default ON). When ON, body `{dryRun:true}`; the run only logs what it *would* send.
  - While running, disable the button and show a spinner; on return, show a toast: `replied N · escalated M · skipped K (dry run?)` from the response `summary`.
- A **"Refresh stats"** button → `POST /api/refresh-stats` then re-fetch `/api/stats`. Show "updated Xm ago" from `stats.snapshotAt`.

**2) Stats grid (the dashboard)**
Fetch once on load: `GET /api/stats` → `{ stats }`. Render cards/number tiles:
- **Totals:** Total leads, Read, Unread, Open escalations (`stats.openEscalations`, make this one clickable → scrolls to section 3).
- **By tag** (`stats.tags`, sort desc): New Lead, Blacklisted, Bad Credit, Application Declined, No Licence, Low Income, App Submitted, Application Received, etc. A horizontal bar list reads best.
- **Credit profile** (`stats.credit`): Blacklisted/Debt Review, Im Not Sure, Missed Many Payments, Its Looking Better, Good Credit Record, No Credit Record.
- **Licence** (`stats.licence`) and **Income** (`stats.income`) as small donut/bar.
- **Journey** (`stats.journey`): active vs resolved/dead vs none.
> Numbers may include `partial:true` if the refresh hit its time budget — show a small "partial" note if so.

**3) "Needs you" queue (the unsure chats)**
Fetch `GET /api/escalations?status=open` → `{ items }`. Each item is a chat the bot wasn't sure about. Render a list; each row shows:
- Client `name` + `phone`, the `inbound_text` (what they asked), the `reason` (e.g. `rent_to_own`, `application_status`, `low_confidence`, `no_match`, `talk_to_human`), and `created_at`.
- An **"Open in EasySocial" link** using `item.chat_url` (opens the exact conversation in a new tab) so you can read the full thread before answering.
- A **text box** + **Send** button. On Send → `POST /api/answer` with:
  ```json
  { "leadId": <item.lead_id>, "phone": <item.phone>, "inbound_text": <item.inbound_text>,
    "message": <typed text>, "escalationId": <item.id>, "learn": true }
  ```
- A **"Remember this answer" checkbox** (default checked) → maps to `learn`. When checked, the next client who sends essentially the same message gets this answer **automatically** (exact-message memory).
- After a successful send, remove the row and show a toast: `Sent ✓ (remembered)` or `Sent ✓ (dry run)` based on the response `{ sent, learned, dryRun }`.

Optional: a small **"Learned answers"** panel listing recent `learned_reply` rows (add a tiny `GET /api/learned` if you want to show/edit them — not required for v1).

### Endpoint reference (all require `x-admin-secret`)
| Method | Route | Purpose |
|---|---|---|
| GET  | `/api/stats` | Numbers for the stats grid (fast; from snapshot). |
| POST | `/api/refresh-stats` | Recompute numbers from EasySocial (slow; also cron-able). |
| GET  | `/api/escalations?status=open` | The "needs you" queue. |
| POST | `/api/answer` | Send a human answer + remember it + close the escalation. |
| POST | `/api/run-batch` | Answer all waiting chats now (the button). |

### States & niceties
- Loading skeletons for the stats grid and queue.
- Empty state for the queue: "Nothing waiting — the bot's got it. 🎉"
- Errors: show the endpoint's `{error}` in a dismissible banner; never surface secrets.
- Poll `/api/escalations` every ~30s (or a manual refresh) so new unsure chats appear.
- Everything is safe while `ES_DRY_RUN=true` — the page works fully; sends are simulated. Show a small "DRY RUN" badge in the header when the last run/answer returned `dryRun:true`.

### What the bot will NOT put in the queue (by design)
Pre-approved / validated leads (tags: **Approved - Need Docs, Validations Pending, Vals Done**) are skipped entirely — you handle those in EasySocial yourself, as requested. They won't appear in the queue.
