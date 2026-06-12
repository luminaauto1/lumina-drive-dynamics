# Migration Guide: Lovable → Claude Code + Vercel

Full migration runbook for the Lumina Drive Dynamics dealer-management & CRM
application.

## Architecture: what moves and what stays

```
BEFORE                                    AFTER
──────                                    ─────
Lovable hosting  ── frontend ──┐          Vercel ── frontend (Vite/React SPA)
                               │             │
Supabase ──────────────────────┤          Supabase (UNCHANGED project)
 ├─ Postgres (CRM data)        │           ├─ Postgres (CRM data)
 ├─ Auth / Storage             │           ├─ Auth / Storage
 └─ Edge Functions (Deno)      │           └─ Edge Functions (Deno)
```

**Key decision: the Supabase project does not move.** The database, auth
users, storage buckets, secrets, and all ~30 edge functions stay exactly where
they are. Only the *frontend hosting* moves from Lovable to Vercel. This is
what guarantees **zero data loss**: leads, CRM records, finance applications,
deal records, and expense logs are never copied, exported, or re-imported —
the new frontend talks to the same database the old one did.

Edge functions remain on Supabase (not Vercel) deliberately: they are Deno
programs deployed via the Supabase CLI, they sit next to the data, and every
external webhook (EasySocial, Make, TikTok) already points at
`https://<project-ref>.supabase.co/functions/v1/...` — keeping them in place
means **no webhook URLs change** during the migration.

## Repository layout

```
├── src/                          # Vite + React frontend
│   ├── integrations/supabase/    # Supabase connection module (client.ts)
│   ├── lib/publicApi.ts          # shared key for public edge endpoints
│   └── pages/, components/, …    # leads, CRM sheet, finance, expenses UI
├── supabase/
│   ├── functions/                # ~30 Deno edge functions (stay on Supabase)
│   │   ├── _shared/publicGuard.ts# CORS origin allowlist ← update on cutover
│   │   └── .env.example          # edge-function secrets template
│   ├── migrations/               # full SQL schema history (source of truth)
│   └── config.toml               # per-function verify_jwt settings
├── scripts/test-connection.mjs   # pre/post-deploy connectivity smoke test
├── docs/MIGRATION.md             # this file
├── vercel.json                   # Vercel build + routing + headers
├── .env.example                  # frontend env template
└── .github/workflows/ci.yml     # build check on every push
```

---

## Step 1 — Back up Supabase before touching anything

Even though no data moves, take a full backup before the cutover so the
migration is reversible from any point.

```sh
# Install + authenticate the Supabase CLI
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>

# 1a. Database: roles, schema, and data as three restorable SQL files
supabase db dump -f backup/roles.sql  --role-only
supabase db dump -f backup/schema.sql
supabase db dump -f backup/data.sql   --data-only --use-copy

# 1b. Alternative full dump straight through the pooler (port 5432 = session
#     mode, required for pg_dump; password is in Dashboard -> Database)
pg_dump "postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  --no-owner --no-privileges -F c -f backup/full.dump

# 1c. Storage buckets (client documents, sell-car photos, vehicle images)
#     List buckets in Dashboard -> Storage, then for each:
supabase storage cp -r ss:///<bucket-name> ./backup/storage/<bucket-name> --experimental

# 1d. Auth users export: Dashboard -> Authentication -> Users -> Export CSV
#     (password hashes are preserved inside the db dump's auth schema)

# 1e. Edge-function secrets inventory (values are NOT printable — record
#     names here and fetch values from your own secret store)
supabase secrets list
```

Also note Supabase's built-in protection: Dashboard → Database → Backups
(daily on Pro plan). Confirm a recent backup exists before cutover.

### If the Supabase project is managed by Lovable Cloud

Check whether project `geovwgfbbfhhmommyasj` appears in **your own** Supabase
dashboard (supabase.com → your org). If it only exists inside Lovable, the
database is Lovable-managed and you must move it to a project you own before
cancelling Lovable — this is the one scenario where data actually moves:

```sh
# 1. Create a new project in YOUR Supabase org (dashboard or CLI), then:
supabase link --project-ref <new-project-ref>

# 2. Restore in order: roles -> schema -> data (from Step 1a dumps)
psql "$NEW_DB_URL" -f backup/roles.sql
psql "$NEW_DB_URL" -f backup/schema.sql
psql "$NEW_DB_URL" -f backup/data.sql

# 3. Redeploy all edge functions + secrets to the new project
supabase functions deploy
supabase secrets set --env-file supabase/functions/.env

# 4. Re-upload storage buckets from backup/storage/, recreate bucket policies

# 5. Point the frontend at the new project: update VITE_SUPABASE_URL,
#    VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID in .env and
#    Vercel, update project_id in supabase/config.toml, redeploy.

# 6. Re-verify row counts against the Step 1 baseline, and update external
#    webhook URLs (EasySocial/Make/TikTok) to the new functions domain.
```

### Record baseline row counts (zero-data-loss proof)

Run in the SQL editor **before** migration, save the output, and re-run
**after** the Vercel cutover — counts must match:

```sql
select 'leads' t, count(*) from leads
union all select 'finance_applications', count(*) from finance_applications
union all select 'deal_records',         count(*) from deal_records
union all select 'vehicles',             count(*) from vehicles
union all select 'vehicle_expenses',     count(*) from vehicle_expenses
union all select 'extra_service_incomes',count(*) from extra_service_incomes
union all select 'referrals',            count(*) from referrals
union all select 'profiles',             count(*) from profiles
union all select 'sell_car_requests',    count(*) from sell_car_requests
union all select 'aftersales_records',   count(*) from aftersales_records;
```

---

## Step 2 — Environment setup

### Local development

```sh
git clone git@github.com:luminaauto1/lumina-drive-dynamics.git
cd lumina-drive-dynamics
npm ci

cp .env.example .env                                    # frontend vars
cp supabase/functions/.env.example supabase/functions/.env   # edge fn secrets

npm run test:connection   # verify Supabase is reachable with your .env
npm run dev               # http://localhost:8080
```

Values come from Supabase Dashboard → Project Settings → API. The anon
("publishable") key is safe in the frontend — Row Level Security is the real
access control. The **service-role key must never appear in any `VITE_*`
variable** — it belongs only in edge-function secrets.

> Note on "connection pooling": the browser never opens Postgres connections —
> it talks HTTP to PostgREST, and Supabase's Supavisor pooler manages Postgres
> connections server-side. If you ever add server-side code that connects
> directly to Postgres (scripts, Vercel functions), use the **pooled**
> connection string (`...pooler.supabase.com:6543`, transaction mode) rather
> than the direct database host, or you will exhaust connections.

### Running edge functions locally

```sh
supabase start                                   # local stack (Docker)
supabase functions serve --env-file supabase/functions/.env
```

---

## Step 3 — GitHub push workflow

```sh
git checkout -b feature/<change>     # never commit straight to main
# ...edit...
npm run lint && npm run build && npm run test:connection
git add -A
git commit -m "Describe the change"
git push -u origin feature/<change>  # open a PR; CI builds it automatically
```

`.github/workflows/ci.yml` runs `npm ci && npm run build` on every push/PR so
a broken build can't reach Vercel. Vercel (Step 4) auto-deploys `main` to
production and every PR to a preview URL — merging to `main` **is** the
deploy step.

Database changes follow the same flow: add a SQL file under
`supabase/migrations/`, then `supabase db push`. Edge function changes deploy
with `supabase functions deploy <name>` (or no name for all).

---

## Step 4 — Vercel deployment

1. **Import the repo**: vercel.com → Add New → Project → import
   `luminaauto1/lumina-drive-dynamics`. Vercel reads `vercel.json` and
   detects Vite automatically (`npm ci`, `npm run build`, output `dist/`).
2. **Set environment variables** (Project Settings → Environment Variables,
   apply to Production *and* Preview) — every variable in `.env.example`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
   - `VITE_GOOGLE_MAPS_API_KEY`

   ⚠️ Vite inlines these at **build** time. Changing a value later requires a
   **redeploy**, not just saving the variable.
3. **Deploy** — first deploy gives you `https://<project>.vercel.app`.
4. **SPA routing** is handled by the rewrite in `vercel.json`: every non-asset
   path serves `index.html` so React Router owns deep links like
   `/admin/crm`. Without it, refreshing any admin page would 404.
5. **Custom domain**: Project Settings → Domains → add `luminaauto.co.za` +
   `www`, update DNS as instructed.

### Post-deploy cutover checklist (the part people forget)

- [ ] **CORS allowlist**: add your real Vercel domain to `ALLOWED_ORIGINS` in
      `supabase/functions/_shared/publicGuard.ts`, then
      `supabase functions deploy`. Public lead capture / finance / sell-car
      forms depend on this.
- [ ] **Auth redirect URLs**: Supabase Dashboard → Authentication → URL
      Configuration → set Site URL to the Vercel/custom domain and add it to
      Redirect URLs (login, invite-sales-agent, and password-reset emails
      break otherwise).
- [ ] **Google Maps key referrers**: add the Vercel + custom domains to the
      browser key's HTTP-referrer restrictions in Google Cloud console.
- [ ] **Lovable AI Gateway** ⚠️: `sales-copilot`, `transcribe-call`,
      `parse-whatsapp`, and `analyze-business-state` call
      `ai.gateway.lovable.dev` using `LOVABLE_API_KEY`. This continues to work
      while the Lovable subscription is active, but plan to port these four
      functions to a direct AI provider before cancelling Lovable.
- [ ] **Webhooks unchanged**: EasySocial / Make / TikTok webhooks point at
      Supabase function URLs, which did not move — verify one inbound event
      end-to-end anyway.
- [ ] Run `npm run test:connection` and re-run the **row-count SQL** from
      Step 1; compare with the baseline (must be ≥ baseline — equal plus any
      new live traffic).

---

## Step 5 — Functional verification (dealer-management features)

After cutover, walk each feature against the production Vercel URL:

| Feature | Where | What to check |
|---|---|---|
| Lead capture | Public site forms, `create-lead`, `capture-dropoff-lead` | New lead appears in Admin → Leads |
| CRM data | `/admin` CRM sheet, contacts, client profiles | Existing records load; edits persist |
| Financial tracking | Finance applications, offers, deal records, partner payouts | Existing apps visible; new submission via `submit-finance-app` succeeds |
| Expense logging | Vehicle expenses, extra service incomes | Historical entries intact; new entry saves |
| Auth & roles | Admin login, sales-agent invites | Login works on new domain; invite email links resolve |
| Documents | Secure document upload, juristic PDF | Upload to storage succeeds; PDF generates |
| Notifications | Status notifications, finance alerts (Resend/EmailJS) | Email actually arrives |
| WhatsApp/AI tools | Parser modal, live call copilot | Functions respond (Lovable gateway caveat above) |

## Rollback

The Lovable deployment keeps working throughout — nothing was removed from
Supabase. To roll back: point DNS back at Lovable (or just keep using the
lovable.app URL). Because both frontends share one database, you can even run
them in parallel during a soak period.
