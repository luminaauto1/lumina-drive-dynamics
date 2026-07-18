# Lumina Drive Dynamics

Dealer management & CRM platform for Lumina Auto — public vehicle showroom,
lead capture, finance applications, CRM sheet, deal/expense tracking, and
aftersales, built on:

- **Frontend**: Vite + React 18 + TypeScript + Tailwind + shadcn/ui, hosted on **Vercel**
- **Backend**: **Supabase** — Postgres (with RLS), Auth, Storage, and ~30 Deno edge functions
- **Migrated from Lovable** — see [`docs/MIGRATION.md`](docs/MIGRATION.md) for the full runbook

## Quick start

```sh
npm ci
cp .env.example .env          # fill in Supabase URL + anon key (Dashboard -> Settings -> API)
npm run test:connection       # smoke-test Supabase REST/Auth/Storage/edge functions
npm run dev                   # http://localhost:8080
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (what Vercel runs) |
| `npm run lint` | ESLint |
| `npm run test:connection` | Verify frontend ↔ Supabase ↔ edge functions connectivity |

## Deployment

Pushing to `main` deploys to production via Vercel; PRs get preview URLs.
Edge functions deploy separately with `supabase functions deploy`; database
changes go through `supabase/migrations/` + `supabase db push`.

Environment variables are documented in [`.env.example`](.env.example)
(frontend / Vercel) and
[`supabase/functions/.env.example`](supabase/functions/.env.example)
(edge-function secrets). Never put server secrets in `VITE_*` variables —
they are inlined into the public JS bundle.

## Repository map

```
src/pages/admin/        CRM sheet, leads, finance, expenses, reports, settings
src/pages/              public site: showroom, finance application
src/integrations/supabase/  typed Supabase client (connection module)
supabase/functions/     Deno edge functions (notifications, webhooks, AI tools)
supabase/migrations/    SQL schema history
docs/MIGRATION.md       Lovable -> Vercel migration runbook
```
