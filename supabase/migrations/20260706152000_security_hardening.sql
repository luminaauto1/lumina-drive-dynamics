-- ============================================================================
-- fix_security.sql — Lumina (project gkghazemorbxmzzcbaty)
-- Security-lint remediation: ONLY changes proven safe by reading the live
-- objects (pg_proc / pg_policy / view def / role_section_access) and grepping
-- the app repo (src/ + supabase/functions/). Apply as ONE migration.
-- Generated 2026-07-06. PLANNING ARTIFACT — review before applying.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — Pin search_path on the 8 flagged functions (lint: mutable
-- search_path). None of the 8 is SECURITY DEFINER, so this is pure hardening;
-- all objects they reference live in public, so behavior is unchanged.
-- Exact signatures read from pg_proc on the live DB.
-- Perf note: a SET clause disables SQL-function inlining for the three
-- lum_is_* helpers; irrelevant at this DB size (largest table ~3.2k rows).
-- ============================================================================

ALTER FUNCTION public._migrate_ingest_rows(bigint, regclass)  SET search_path = public;
ALTER FUNCTION public._migrate_ingest_array(jsonb, regclass)  SET search_path = public;
ALTER FUNCTION public.vendors_set_updated_at()                SET search_path = public;
ALTER FUNCTION public.lum_is_submitted(text)                  SET search_path = public;
ALTER FUNCTION public.lum_is_approved(text)                   SET search_path = public;
ALTER FUNCTION public.lum_is_declined(text)                   SET search_path = public;
ALTER FUNCTION public.lum_working_minutes(timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.lum_first_family_ts(jsonb, text, timestamp with time zone, text)        SET search_path = public;


-- ============================================================================
-- SECTION 2 — Revoke anon EXECUTE on SECURITY DEFINER functions the app only
-- ever calls while logged in.
--
-- Evidence:
--  * lum_analytics_kpis/leaderboard/daily/snapshot: called ONLY from
--    src/hooks/useAnalyticsDashboard.ts, used ONLY by /admin/analytics which
--    is wrapped in <ProtectedRoute section="analytics"> (src/App.tsx:150).
--  * lum_vendor_finance_stats: called ONLY from src/hooks/useVendors.ts:140,
--    used by /admin/vendors (ProtectedRoute section="vendors", App.tsx:145).
--  * can_deal_desk(): NEVER called via supabase.rpc anywhere in src/ or
--    supabase/functions/ (only a comment mention in useDealDesk.ts). It is
--    referenced ONLY inside RLS policies on deal_* tables, and every one of
--    those policies is TO authenticated — anon never triggers evaluation.
--  * is_taskos_user(uuid): referenced only inside taskos_* RLS policies; all
--    are TO authenticated except taskos_goal_suggestions_owner_select which
--    was TO public — fixed below in Section 3 so anon can never evaluate it.
--  * Precedent: has_role() and is_staff() ALREADY have no PUBLIC/anon grant
--    (proacl: postgres/authenticated/service_role only) and the public site
--    works — proving anon-facing tables never evaluate these helpers.
--
-- ACLs read from pg_proc: each of these has EXPLICIT grants to authenticated
-- and service_role, so revoking PUBLIC + anon leaves logged-in app calls and
-- edge functions untouched.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.can_deal_desk()                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_taskos_user(uuid)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lum_analytics_daily(integer)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lum_analytics_kpis(timestamp with time zone, timestamp with time zone)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lum_analytics_leaderboard(timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lum_analytics_snapshot()           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lum_vendor_finance_stats(timestamp with time zone, timestamp with time zone)  FROM PUBLIC, anon;

-- Bonus (same evidence standard): the _migrate_* ingest helpers appear NOWHERE
-- in src/ or supabase/functions/ (grep: zero hits). They are one-off migration
-- plumbing; anon has no business executing them. Not SECURITY DEFINER, so this
-- is defense-in-depth only. authenticated grant left as-is (RLS still gates
-- whatever they touch); consider DROPping them once migration work is done.
REVOKE EXECUTE ON FUNCTION public._migrate_ingest_rows(bigint, regclass) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._migrate_ingest_array(jsonb, regclass) FROM PUBLIC, anon;


-- ============================================================================
-- SECTION 3 — taskos_goal_suggestions_owner_select: restrict TO authenticated.
--
-- Current: roles={public}, qual = (user_id = auth.uid()) AND is_taskos_user(auth.uid()).
-- For anon, auth.uid() IS NULL so the qual can never pass — anon already gets
-- zero rows. Restricting the policy to authenticated is therefore
-- behavior-preserving (RLS default-deny still yields zero rows for anon), and
-- it guarantees the Section-2 revoke of is_taskos_user can never surface a
-- "permission denied for function" error to anon. No client code reads this
-- table at all (grep src/: zero hits; only service-role edge functions touch
-- it, and they bypass RLS).
-- ============================================================================

ALTER POLICY "taskos_goal_suggestions_owner_select"
  ON public.taskos_goal_suggestions
  TO authenticated;


-- ============================================================================
-- SECTION 4 — Replace the two always-true UPDATE policies (lint 4).
--
-- Evidence for scope:
--  * auth.users has 199 accounts with NO row in user_roles (likely client
--    signups). Role counts: f_and_i=8, admin=3, senior_f_and_i=3,
--    sales_agent=1, accountant=0. USING(true) meant those 199 role-less
--    authenticated users could rewrite any OTP or stock-doc row. Real bug.
--  * otps updates: ONLY src/hooks/useOtps.ts (useUpdateOtp), used ONLY by
--    /admin/otp behind <ProtectedRoute section="finance"> (App.tsx:139).
--    role_section_access (live rows) grants "finance" to sales_agent,
--    f_and_i, senior_f_and_i AND accountant; admins bypass the matrix.
--    => all five staff roles must keep UPDATE.
--  * vehicle_stock_docs updates: ONLY src/hooks/useVehicleStockDocs.ts
--    (upsert), reached from AdminInventoryPage (section "inventory" →
--    sales_agent + admin), StockInModal (inventory page), and the Deal Desk
--    StageStepPanel (sections deal_desk/deal_ledger → senior_f_and_i +
--    admin). The section matrix is admin-editable, so any staff role could
--    be granted these sections tomorrow — the same five-role staff set is
--    used for both tables.
--  * is_staff() alone (admin|sales_agent) would BREAK the 8 f_and_i users and
--    3 senior_f_and_i users; hence the explicit has_role OR-chain.
--  * NOTE: upsert() also exercises the INSERT policy; existing INSERT policies
--    (auth.uid() IS NOT NULL) are untouched, so no write path gets narrower
--    than its INSERT gate.
--  * has_role is STABLE SECURITY DEFINER SET search_path=public and already
--    granted to authenticated; (select auth.uid()) keeps it initplan-cached
--    (matches the perf-lint remediation pattern).
-- ============================================================================

DROP POLICY "Staff can update OTPs" ON public.otps;
CREATE POLICY "Staff can update OTPs"
  ON public.otps
  FOR UPDATE
  TO authenticated
  USING (
       has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'sales_agent'::app_role)
    OR has_role((select auth.uid()), 'f_and_i'::app_role)
    OR has_role((select auth.uid()), 'senior_f_and_i'::app_role)
    OR has_role((select auth.uid()), 'accountant'::app_role)
  )
  WITH CHECK (
       has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'sales_agent'::app_role)
    OR has_role((select auth.uid()), 'f_and_i'::app_role)
    OR has_role((select auth.uid()), 'senior_f_and_i'::app_role)
    OR has_role((select auth.uid()), 'accountant'::app_role)
  );

DROP POLICY "Staff can update vehicle stock docs" ON public.vehicle_stock_docs;
CREATE POLICY "Staff can update vehicle stock docs"
  ON public.vehicle_stock_docs
  FOR UPDATE
  TO authenticated
  USING (
       has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'sales_agent'::app_role)
    OR has_role((select auth.uid()), 'f_and_i'::app_role)
    OR has_role((select auth.uid()), 'senior_f_and_i'::app_role)
    OR has_role((select auth.uid()), 'accountant'::app_role)
  )
  WITH CHECK (
       has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'sales_agent'::app_role)
    OR has_role((select auth.uid()), 'f_and_i'::app_role)
    OR has_role((select auth.uid()), 'senior_f_and_i'::app_role)
    OR has_role((select auth.uid()), 'accountant'::app_role)
  );


-- ============================================================================
-- SECTION 5 — public_site_settings view: KEPT as SECURITY DEFINER (documented,
-- NOT changed). Memorialize the decision so the next audit doesn't flip it.
--
-- Why security_invoker = true would BREAK PRODUCTION:
--  * site_settings has NO anon SELECT policy (only "Admins can view..." and
--    "Sales agents can view...", both TO authenticated). With an invoker
--    view, anon would get zero rows.
--  * The logged-out public site reads this view on nearly every page:
--    src/hooks/useSiteSettings.ts:72 → Index, Inventory, Contact, Calculator,
--    FinanceApplication, Navbar, Footer, FloatingWhatsApp, Testimonials …
--    and the anon /handover/:dealId page (src/pages/ClientHandover.tsx:40).
--  * The definer view is the intentional "public projection" pattern: it
--    exposes a curated column list and EXCLUDES the sensitive columns
--    sales_reps, monthly_sales_target, document_settings. Base-table RLS
--    stays locked down; the view is the only anon window.
-- ============================================================================

COMMENT ON VIEW public.public_site_settings IS
  'INTENTIONALLY SECURITY DEFINER (security_invoker=false). Anon-facing projection of site_settings for the logged-out public site (useSiteSettings.ts, ClientHandover.tsx). site_settings itself has no anon policy and holds staff-only columns (sales_reps, monthly_sales_target, document_settings) that this view deliberately omits. Do NOT set security_invoker=true — it would blank the public site. Linter finding 0010_security_definer_view: accepted risk, reviewed 2026-07-06.';


-- ============================================================================
-- DO-NOT-TOUCH LIST (deliberately NOT changed by this script)
-- ============================================================================
-- 1. public.public_site_settings view — keep SECURITY DEFINER (see Section 5).
--
-- 2. taskos_internal_config, taskos_link_codes, taskos_preapproval_pings —
--    RLS enabled with ZERO policies is CORRECT (deny-all). Only edge functions
--    touch them via the service-role client (supabase/functions/_shared/
--    taskos/cron.ts, taskos-telegram-link, taskos-telegram-webhook,
--    taskos-preapproval-digest), which bypasses RLS. The migrations even
--    REVOKE table privileges from anon/authenticated and FORCE RLS. The
--    "rls_enabled_no_policy" INFO lint is a false positive here. No action.
--
-- 3. storage.objects SELECT policy on the public vehicle-images bucket —
--    RECOMMEND-ONLY, do not change blind. The app never calls
--    storage.from('vehicle-images').list() (grep: the only .list() in src/ is
--    on 'client-docs'), and public reads go through getPublicUrl (CDN path,
--    no RLS). So the broad SELECT policy *appears* removable, BUT the bucket
--    is public=true anyway (objects readable by URL regardless), and admin
--    upload flows may rely on API-side reads after upsert. Net risk of
--    keeping it on an already-public bucket is ~zero; net risk of removing it
--    is breaking an unproven admin path. Recommendation: leave; if the
--    listing surface bothers you, scope the policy TO authenticated after a
--    staging test.
--
-- 4. Extensions pg_net + pg_trgm in schema public — RECOMMEND-ONLY.
--    pg_net is used by TaskOS pg_cron jobs (taskos_internal_config stores the
--    cron secret; migrations call net.* from cron SQL) — relocating it can
--    break cron/webhook invocations and is not cleanly supported on all
--    versions. pg_trgm relocation rewrites operator/opclass resolution for
--    any trigram indexes. Do during a maintenance window, not in this pass:
--      CREATE SCHEMA IF NOT EXISTS extensions;
--      ALTER EXTENSION pg_trgm SET SCHEMA extensions;  -- verify indexes after
--      -- pg_net: prefer drop/recreate in schema "extensions" per Supabase
--      -- docs, then re-test every pg_cron job and webhook trigger.
--
-- 5. otps/vehicle_stock_docs SELECT (qual: true) and INSERT
--    (auth.uid() IS NOT NULL) policies — out of this lint's scope, but note:
--    the 199 role-less authenticated users can still READ otps rows (client
--    names, balances) and INSERT rows. Recommend tightening to the same
--    five-role staff set in a follow-up after confirming no client-facing
--    flow reads them (none found in src/, but this pass only proved UPDATE).
--
-- 6. MANUAL DASHBOARD STEP (cannot be done in SQL): enable leaked-password
--    protection — Dashboard → Authentication → Providers → Email →
--    "Prevent use of leaked passwords" (HaveIBeenPwned). Zero app impact;
--    only rejects newly-set compromised passwords.
-- ============================================================================
