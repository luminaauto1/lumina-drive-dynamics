# Cutover Runbook — Lumina Auto (live status)

This reflects what has **actually** been done and what remains. It supersedes
the generic plan in `MIGRATION.md` for the live cutover.

## New project (you own this)
- **Name:** `lumina-auto-production`
- **Ref / Project ID:** `gkghazemorbxmzzcbaty`
- **URL:** `https://gkghazemorbxmzzcbaty.supabase.co`
- **Region:** eu-west-1
- **Anon (publishable) key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZ2hhemVtb3JieG16emNiYXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODEwMTQsImV4cCI6MjA5Njg1NzAxNH0.3ZTKnEjaD374VAGOWynmdaSFgghW5fxo-8PDNF1WM_4`

## ✅ Done & verified (zero data loss)
- Full schema replayed (all 151 migrations) + drift fixes (`credit_check_status`
  column; `credit-check-screenshots` / `scroll-frames` buckets; credit-check
  storage policies).
- All table data copied and row-count verified against source: 146 auth users
  (password hashes intact), 1,696 leads, 516 finance applications, 33 vehicles,
  and every other table — **0 mismatches**.
- All **374 storage files** copied and per-bucket verified.
- Vehicle image URLs repointed from the old project to the new one.
- All temporary migration scaffolding removed from the new project.

## ⏳ Remaining steps (in order)

### 1. Edge functions + secrets → new project  *(needs your computer)*
Prereqs: install the [Supabase CLI](https://supabase.com/docs/guides/cli),
run `supabase login`, and **redeploy `migrate-export` in Lovable once more** so
it includes the new `dump-secrets` action.

Then from the repo root:
```sh
bash scripts/migrate-edge-functions.sh
```
This deploys all 32 application functions to the new project and copies their
secrets across (secrets flow old → your machine → new; never shown).

### 2. Point the frontend at the new project
Update these (locally in `.env`, and in Vercel → Project Settings → Environment
Variables), then redeploy:
```
VITE_SUPABASE_URL=https://gkghazemorbxmzzcbaty.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<the anon key above>
VITE_SUPABASE_PROJECT_ID=gkghazemorbxmzzcbaty
```
Also set `VITE_GOOGLE_MAPS_API_KEY`. Do this **after** step 1, or public forms
(which call the edge functions on the new project) will error.

### 3. Deploy to Vercel + custom domain
- Import the repo at vercel.com, set the env vars from step 2, deploy.
- Test thoroughly on the `*.vercel.app` URL (login, lead capture, finance
  submission, admin CRM, images, emails).
- Add `luminaauto.co.za` (+ `www`) under Vercel → Domains and update the DNS
  records at your domain provider as Vercel instructs. SEO/rankings are
  preserved because the domain and page paths are unchanged.

### 4. New-project configuration
- Supabase → Authentication → URL Configuration: set Site URL + Redirect URLs
  to the Vercel/custom domain.
- `supabase/functions/_shared/publicGuard.ts`: confirm the Vercel domain is in
  `ALLOWED_ORIGINS` (already pre-added), redeploy functions if changed.
- Restrict the Google Maps browser key to the new domains.
- ⚠️ The 4 AI functions (`sales-copilot`, `transcribe-call`, `parse-whatsapp`,
  `analyze-business-state`) call the Lovable AI Gateway via `LOVABLE_API_KEY`;
  port them to a direct AI provider before cancelling Lovable.

### 5. Cleanup
- Ask Lovable to delete `supabase/functions/migrate-export` from the old project.
- Remove `migrate-export` + `migrate-import-storage` from the repo (a cleanup PR).
- Optionally rotate `LUMINA_INTERNAL_API_KEY` (+ `LUMINA_PUBLIC_KEY` in
  `src/lib/publicApi.ts` to match) since the old value was used during migration.

## Rollback
The old Lovable site + database remain fully intact and running throughout.
If anything looks wrong on the new setup, simply don't switch DNS (or point it
back). No data was removed from the source at any point.
