-- fix_indexes.sql — Lumina (gkghazemorbxmzzcbaty), generated 2026-07-06
-- Part 1: covering indexes for all 21 unindexed foreign keys (advisor lint).
-- Tables are tiny (<= ~3.2k rows) so these build instantly; they protect FK
-- cascade/lookup performance and the app's join patterns as data grows.
-- Part 2: drops for unused indexes that are (a) reported unused by pg_stat,
-- (b) not unique/PK/constraint-backing, and (c) whose column pattern does not
-- appear in any app query, edge function, DB function, or RLS policy.

-- ============================================================
-- PART 1 — CREATE covering indexes for unindexed FKs
-- ============================================================

-- FK aftersales_records_finance_application_id_fkey
CREATE INDEX IF NOT EXISTS idx_aftersales_records_finance_application_id ON public.aftersales_records (finance_application_id);
-- FK aftersales_records_vehicle_id_fkey
CREATE INDEX IF NOT EXISTS idx_aftersales_records_vehicle_id ON public.aftersales_records (vehicle_id);
-- FK application_matches_vehicle_id_fkey
CREATE INDEX IF NOT EXISTS idx_application_matches_vehicle_id ON public.application_matches (vehicle_id);
-- FK deal_events_actor_id_fkey
CREATE INDEX IF NOT EXISTS idx_deal_events_actor_id ON public.deal_events (actor_id);
-- FK deal_expense_items_payee_id_fkey
CREATE INDEX IF NOT EXISTS idx_deal_expense_items_payee_id ON public.deal_expense_items (payee_id);
-- FK deal_records_vehicle_id_fkey
CREATE INDEX IF NOT EXISTS idx_deal_records_vehicle_id ON public.deal_records (vehicle_id);
-- FK delivery_tasks_application_id_fkey
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_application_id ON public.delivery_tasks (application_id);
-- FK finance_applications_lead_id_fkey
CREATE INDEX IF NOT EXISTS idx_finance_applications_lead_id ON public.finance_applications (lead_id);
-- FK finance_applications_selected_vehicle_id_fkey (joined explicitly in useCrmData.ts embed)
CREATE INDEX IF NOT EXISTS idx_finance_applications_selected_vehicle_id ON public.finance_applications (selected_vehicle_id);
-- FK finance_applications_vehicle_id_fkey
CREATE INDEX IF NOT EXISTS idx_finance_applications_vehicle_id ON public.finance_applications (vehicle_id);
-- FK finance_offers_application_id_fkey
CREATE INDEX IF NOT EXISTS idx_finance_offers_application_id ON public.finance_offers (application_id);
-- FK lead_notes_profile_id_fkey
CREATE INDEX IF NOT EXISTS idx_lead_notes_profile_id ON public.lead_notes (profile_id);
-- FK leads_vehicle_id_fkey
CREATE INDEX IF NOT EXISTS idx_leads_vehicle_id ON public.leads (vehicle_id);
-- FK otps_created_by_fkey
CREATE INDEX IF NOT EXISTS idx_otps_created_by ON public.otps (created_by);
-- FK rental_logs_rental_id_fkey
CREATE INDEX IF NOT EXISTS idx_rental_logs_rental_id ON public.rental_logs (rental_id);
-- FK taskos_entities_source_inbox_id_fkey
CREATE INDEX IF NOT EXISTS idx_taskos_entities_source_inbox_id ON public.taskos_entities (source_inbox_id);
-- FK taskos_goal_suggestions_task_id_fkey
CREATE INDEX IF NOT EXISTS idx_taskos_goal_suggestions_task_id ON public.taskos_goal_suggestions (task_id);
-- FK taskos_preapproval_pings_application_id_fkey
CREATE INDEX IF NOT EXISTS idx_taskos_preapproval_pings_application_id ON public.taskos_preapproval_pings (application_id);
-- FK taskos_tasks_source_inbox_id_fkey
CREATE INDEX IF NOT EXISTS idx_taskos_tasks_source_inbox_id ON public.taskos_tasks (source_inbox_id);
-- FK vehicle_expenses_vehicle_id_fkey (rolls into deal profit model reads)
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_vehicle_id ON public.vehicle_expenses (vehicle_id);
-- FK wishlists_vehicle_id_fkey
CREATE INDEX IF NOT EXISTS idx_wishlists_vehicle_id ON public.wishlists (vehicle_id);


-- Verifier addition: the analytics dashboard date-range query (useAnalyticsData
-- filters .gte(created_at) + orders by created_at) needs a plain created_at
-- index once the composite (event_type, created_at) is gone.
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events (created_at DESC);

-- ============================================================
-- PART 2 — DROP unused indexes (verified: not FK-covering, not
-- constraint-backing, column never filtered server-side)
-- ============================================================

-- leads.last_step_reached is only ever written (FinanceApplication.tsx inserts/updates, capture-dropoff-lead allowlist); never in a filter/order/RLS.
DROP INDEX IF EXISTS public.idx_leads_last_step;
-- finance_applications.utm_source is write-only attribution data (submit-finance-app allowlist, export column); never a server-side filter.
DROP INDEX IF EXISTS public.idx_finance_apps_utm_source;
-- client_audit_logs.author_id is only inserted; author names are resolved client-side by querying profiles by id, never by filtering client_audit_logs on author_id; not an FK.
DROP INDEX IF EXISTS public.idx_client_audit_logs_author_id;
-- finance_applications.assigned_f_and_i_at is only written (assignment timestamps); no filter, order, RLS, or DB-function use anywhere.
DROP INDEX IF EXISTS public.idx_finance_applications_assigned_f_and_i_at;
-- analytics_events: app fetches by created_at range only (useAnalyticsData) and filters event_type client-side; composite leads with event_type so it cannot serve that query (confirmed never scanned).
DROP INDEX IF EXISTS public.idx_analytics_events_type_created;
-- analytics_events.page_path is only filtered client-side (startsWith('/vehicle/')); never a server-side predicate.
DROP INDEX IF EXISTS public.idx_analytics_events_page_path;
-- referrals.referee_phone: the matching trigger (link_referral_on_app_insert) compares normalize_phone_last9(referee_phone) — an expression this plain btree can never serve; no raw .eq in app; RLS only length-checks on INSERT.
DROP INDEX IF EXISTS public.idx_referrals_referee_phone;
-- referrals.referee_email: trigger compares lower(trim(referee_email)) — plain btree unusable for that expression; no raw .eq anywhere.
DROP INDEX IF EXISTS public.idx_referrals_referee_email;

-- ============================================================
-- KEPT despite "unused" lint (do NOT drop):
--   idx_deal_expenses_deal_id            — covers FK deal_expenses_deal_id_fkey (partial WHERE deal_id IS NOT NULL still serves FK lookups).
--   idx_deal_records_finance_house       — covers FK deal_records_finance_house_vendor_id_fkey; feeds lum_vendor_finance_stats.
--   idx_vehicles_source_vendor           — covers FK vehicles_source_vendor_id_fkey.
--   idx_finance_apps_is_archived         — AdminExport filters server-side: .or('is_archived.is.null,is_archived.eq.false').
--   idx_finance_applications_assigned_f_and_i — RLS on finance_applications: (assigned_f_and_i = auth.uid()) branch for plain F&I users.
--   idx_finance_apps_followup_pending    — exactly matches process-delayed-followups cron query (status IN declined/blacklisted AND followup_sent=false, updated_at range).
--   idx_juristic_token                   — JuristicCapture.tsx public page does .eq('access_token', token).
--   inventory_tasks_status_idx           — useAllPendingTasks does .eq('status','pending').
--   documents_client_id_idx              — useDocuments builds or('client_id.eq.<id>', ...) server-side.
--   taskos_tasks_embedding_idx           — HNSW backing taskos_semantic_search RPCs (live feature; planner seq-scans at current size, hence "unused").
--   taskos_entities_embedding_idx        — same as above.
--   taskos_insights_user_status_idx      — edge fns .eq('user_id',...), UI .eq('status','active') + order created_at; matches (user_id, status, created_at DESC).
-- ============================================================
