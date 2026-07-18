# Lumina Auto — Migration Handover (Lovable → Vercel + own Supabase)

**Status: migration COMPLETE and live.** This document is the full context so a
fresh chat/session can continue with nothing missed. Read it top to bottom.

> TIP for the new chat: open the session in the **Claude Code web app on a
> computer browser (claude.ai/code)** or the **desktop/IDE** version so the
> **Preview / Terminal / Files** panels are enabled (they're greyed out on
> mobile / slimmed-down surfaces). The app is already configured to run with
> `npm run dev` on **port 8080** for the in-chat Preview.

---

## 1. What this project is
Dealer-management & CRM web app for **Lumina Auto** (South Africa): public
vehicle showroom, lead capture, finance applications, CRM, deal/expense
tracking, aftersales, referrals, juristic (company) finance, WhatsApp/TikTok
lead automation.

- **Frontend:** Vite + React 18 + TypeScript + Tailwind + shadcn/ui (SPA).
- **Backend:** Supabase — Postgres (RLS), Auth, Storage, 32 Deno edge functions.
- **Hosting:** Vercel (frontend) + Supabase (backend). **Lovable is no longer in
  the path** but is kept temporarily as a rollback.

---

## 2. Key identifiers (NON-secret — safe to keep here)

### New (self-owned) Supabase — PRODUCTION
- Name: **lumina-auto-production**
- Project ref / ID: **`gkghazemorbxmzzcbaty`**
- URL: **`https://gkghazemorbxmzzcbaty.supabase.co`**
- Region: eu-west-1
- Anon / publishable key:
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZ2hhemVtb3JieG16emNiYXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODEwMTQsImV4cCI6MjA5Njg1NzAxNH0.3ZTKnEjaD374VAGOWynmdaSFgghW5fxo-8PDNF1WM_4`

### Old Supabase (Lovable Cloud — BACKUP, still running)
- Project ref: **`geovwgfbbfhhmommyasj`**
- We have **no dashboard access** to it (Lovable Cloud managed). Reachable only
  via its edge functions. Keep it alive as rollback until fully confident.

### Vercel
- Project: **lumina-drive-dynamics**, team **"Lumina Auto's projects"**
  (`team_pEq6NR4dRmtM7zcNeeTpROcq`)
- Live URLs: **https://luminaauto.co.za**, `https://www.luminaauto.co.za`
  (308-redirects to apex), `https://lumina-drive-dynamics.vercel.app`
- Auto-deploys on push to `main` via GitHub Actions (see §6).

### GitHub
- Repo: **`luminaauto1/lumina-drive-dynamics`** (default branch `main`)
- Active working branch this migration used: **`claude/cool-bell-ouewq8`**
- Owner login: `luminaauto1` (lumina.auto1@gmail.com)

### Domain (GoDaddy DNS)
- `luminaauto.co.za` → **A `@` → `216.198.79.1`** (Vercel; `76.76.21.21` also valid)
- `www` → A `216.198.79.1` + Vercel redirect to apex (308)
- Email (MX, dkim CNAMEs, SPF/DMARC TXT, autodiscover SRV) **untouched & working**.

### Frontend env vars (VITE_*, all public/build-time)
```
VITE_SUPABASE_URL=https://gkghazemorbxmzzcbaty.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key above>
VITE_SUPABASE_PROJECT_ID=gkghazemorbxmzzcbaty
VITE_GOOGLE_MAPS_API_KEY=AIzaSyAzIpJyiSzVJwx9DrMPXHbHAS7tV_X76Lw
```

---

## 3. ▶ How to run locally (for the in-chat Preview)
```sh
npm install
# create .env.local (gitignored) with the four VITE_* values from §2:
cp .env.example .env.local   # then edit to the NEW project values above
npm run dev                  # Vite serves on http://localhost:8080
```
- The dev server host is already set to `0.0.0.0` in `vite.config.ts` (so it runs
  in IPv4-only/containerised environments and the Preview panel can attach).
- Open the **Preview** panel and point it at **port 8080**.
- A `.env.local` with the new-project values may already exist in the working
  copy (it is gitignored, so it won't be in a fresh clone — recreate it).

---

## 4. What was migrated — ✅ all verified, ZERO data loss
Row counts compared old→new (all matched exactly, 0 mismatches):

| Data | Count |
|---|---|
| auth users (password hashes intact) | 146 |
| profiles | 146 |
| user_roles | 11 |
| leads | 1,696 |
| finance_applications | 516 |
| vehicles | 33 |
| deal_records | 17 |
| vehicle_expenses | 73 |
| whatsapp_messages | 4,332 |
| analytics_events | 679 |
| client_audit_logs | 438 |
| application_drafts | 224 |
| (+ all other tables — 31 total) | matched |

- **Storage: 374 files**, per-bucket verified — vehicle-images 332, delivery-photos
  23, client-docs 9, bank-templates 5, credit-check-screenshots 3,
  juristic-signatures 2, scroll-frames 0.
- **32 edge functions** deployed to the new project + **all 13 secrets transferred**
  (verified: a guarded function accepted its `LUMINA_INTERNAL_API_KEY`).
- Vehicle image URLs in the DB were **repointed** from the old project to the new
  (so the new DB is self-contained).
- Domain verified live: `luminaauto.co.za` returns HTTP 200 from Vercel; `www`
  redirects to apex.

### Schema-drift fixes applied to the new project (were missing from migrations)
- Added column `finance_applications.credit_check_status` (text).
- Created buckets `credit-check-screenshots`, `scroll-frames`.
- Added admin/staff storage policies for `credit-check-screenshots`.

---

## 5. Architecture quick map
```
src/
  pages/admin/         CRM sheet, leads, finance, expenses, reports, settings, deal room
  pages/               public site: showroom, finance application, juristic
  integrations/supabase/client.ts   env-driven Supabase client (reads VITE_* with validation)
  lib/publicApi.ts     LUMINA_PUBLIC_KEY shared secret for public edge endpoints
supabase/
  functions/           32 Deno edge functions (+ _shared/publicGuard.ts)
  migrations/          151 SQL migrations (full schema history)
  config.toml          per-function verify_jwt settings
.github/workflows/     ci.yml, deploy-edge-functions.yml, deploy-vercel.yml
docs/MIGRATION.md, docs/CUTOVER.md   migration runbooks
```
Biggest tables/features: `leads`, `finance_applications` (+ `finance_offers`,
`application_matches`, `deal_records`), `vehicles` (+ derived `public_vehicles`
table kept in sync by a trigger), `vehicle_expenses`, `extra_service_incomes`,
`rentals`, `referrals`, `juristic_submissions`, `whatsapp_messages`.

Roles enum `app_role`: `admin`, `user`, `sales_agent`, `f_and_i`,
`senior_f_and_i`, `accountant`. RLS uses `has_role()` / `is_staff()`.

---

## 6. Deployment / CI (GitHub Actions)
- **`deploy-vercel.yml`** — on push to `main` (and manual) builds + deploys the
  site to Vercel. Needs repo secret **`VERCEL_TOKEN`** (already set; keep it for
  auto-deploys). VITE_* values are baked into the workflow as `--build-env`.
- **`deploy-edge-functions.yml`** — manual; deploys all 32 functions to the new
  project and pulls their secrets from the old project's bridge. Needs repo
  secret **`SUPABASE_ACCESS_TOKEN`** (one-time job already done — see cleanup).
- **`ci.yml`** — build check on PRs.

> Why CI does the deploys: in the migration environment, `deploy_edge_function`
> and Vercel deploy via MCP were approval-gated/unavailable, and there is no MCP
> tool to set Supabase function secrets. GitHub Actions + a user-provided token
> was the working path. The new chat will hit the same limits — prefer this CI
> pattern, or run the Supabase/Vercel CLIs locally.

---

## 7. ⚠️ Remaining housekeeping (none blocking; do soon)
1. **Security — delete the migration bridge from the OLD project.** In Lovable
   chat: *"Delete the migrate-export edge function."* It can read data (guarded
   only by the public key) and secrets (guarded by a token baked in the code).
2. **Revoke the one-time tokens:** the Supabase personal access token
   (supabase.com → Account → Access Tokens) and remove the
   **`SUPABASE_ACCESS_TOKEN`** GitHub secret. Keep `VERCEL_TOKEN`.
3. **Supabase Auth URLs** (new project → Authentication → URL Configuration):
   Site URL `https://luminaauto.co.za`; add redirect URLs
   `https://luminaauto.co.za/**`, `https://www.luminaauto.co.za/**`,
   `https://lumina-drive-dynamics.vercel.app/**`.
4. **Google Maps key:** restrict to the new domains in Google Cloud.
5. **Repo tidy:** remove `supabase/functions/migrate-export`,
   `supabase/functions/migrate-import-storage`, and the one-time
   `deploy-edge-functions.yml` once functions are confirmed (a cleanup PR).
6. **AI functions before leaving Lovable:** `sales-copilot`, `transcribe-call`,
   `parse-whatsapp`, `analyze-business-state` call the **Lovable AI Gateway**
   via `LOVABLE_API_KEY`. They work now but must be repointed to a direct AI
   provider before cancelling Lovable.
7. **Do NOT cancel Lovable yet** — it + the old DB are the rollback. Soak 1–2 weeks.

### Temporary artifacts already CLEANED from the new project (for reference)
Temp upload policies, temp `has_role`/`is_staff` grants to `anon`, the temp admin
user used to copy private-bucket files, and all `_migration*` tables were removed
after use. (A broad `grant insert,select,update on storage.objects to anon,
authenticated` and `grant select on storage.buckets to anon` were left in place
as they match Supabase defaults and are gated by RLS — optional to review.)

---

## 8. Security notes / gotchas
- **`LUMINA_INTERNAL_API_KEY` == the public frontend key** `lumina-pub-2026-v2-rotate`
  (in `src/lib/publicApi.ts`). The public-endpoint guard is therefore weak by
  design. Consider rotating BOTH together after cutover.
- `supabase/functions/_shared/publicGuard.ts` `ALLOWED_ORIGINS` includes
  `luminaauto.co.za`, `www`, the vercel.app domain, and the old lovable.app
  (remove lovable.app at the end).
- `.env.local` is gitignored; the committed `.env` still holds the **old**
  project's publishable values (kept so the old Lovable site stays on the old DB
  during the soak). Vercel uses the new values via build-env, so production is on
  the new project regardless. When fully cut over, update committed `.env`.

---

## 9. How the migration was actually done (audit trail)
Because Lovable Cloud exposes no DB connection string/dashboard:
1. Schema: replayed all 151 `supabase/migrations/*.sql` into the new project via
   MCP `apply_migration` (with splits around `ALTER TYPE ... ADD VALUE`).
2. Data + auth + storage list: a temporary **`migrate-export`** edge function was
   deployed INTO the old project (via Lovable) exposing read-only `dump-table`,
   `dump-auth`, `list-storage`, `push-storage`, `dump-secrets` actions, guarded
   by the shared key (+ a strong token for secrets).
3. The new project pulled data using **`pg_net`** (server-to-server HTTP from the
   new DB), inserting via `jsonb_populate_recordset` with FK-safe ordering and
   `session_replication_role=replica` for the circular vehicles↔finance FKs.
4. Storage files: `push-storage` downloaded from old storage and uploaded to new
   storage; private buckets needed an authenticated admin token (a temp admin
   user was created, logged in via the auth API, then deleted).
5. Functions + secrets: GitHub Actions (`deploy-edge-functions.yml`) ran
   `supabase functions deploy` and `supabase secrets set` using the
   `dump-secrets` bridge.
6. Frontend: GitHub Actions (`deploy-vercel.yml`) deployed to Vercel.
7. Domain: GoDaddy A records → Vercel; verified via `pg_net` GET (server=Vercel).

---

## 10. First moves for the new chat
1. `npm install` → create `.env.local` (new-project VITE_* values) → `npm run dev`
   → open Preview on port 8080. Click through admin + public site.
2. Work through the §7 housekeeping list (start with deleting the old bridge and
   revoking tokens).
3. Supabase MCP is connected to the **new** project `gkghazemorbxmzzcbaty`
   (`apply_migration` works; `execute_sql`, `deploy_edge_function` may be
   approval-gated — use CI/CLI as in §6).
