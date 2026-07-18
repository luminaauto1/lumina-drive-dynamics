-- ============================================================================
-- OPTIONAL / owner-applied — Contract Signed (CLIENT track) → Deal Desk backfill
-- ============================================================================
-- Context (2026-07-18): the auto-create-draft feature (Phase 3, flag
-- `document_settings.autoCreateDealOnContractSigned`) lives in the app layer in
-- useUpdateFinanceApplication and only watches the FINANCE status slug
-- 'contract_signed'. The owner works the CLIENT track ("Contract Signed 🎉",
-- slug 'client_contract_signed', finance_applications.client_status) via
-- useUpdateClientStatus — which has no draft logic, so those deals never reach
-- Deal Desk. The primary fix is app-layer (mirror the draft block into
-- useUpdateClientStatus; routed to the branch that owns useFinanceApplications).
--
-- This migration is the DB-side companion. It contains NO trigger (a DB trigger
-- variant was deliberately rejected in June 2026 — see
-- 20260627090000_contract_signed_deal_draft_trigger.sql, never applied). It:
--
--   1. Codifies `sale_date DROP DEFAULT`. 20260130120831 gave deal_records.
--      sale_date DEFAULT CURRENT_DATE; prod had the default dropped ad-hoc so
--      drafts carry NULL sale_date, but NO migration in the repo records that.
--      Without this, any draft insert that omits sale_date is stamped with
--      today's date and reads as an INVOICED/finalized deal (deriveDealStatus)
--      and pollutes Accounting/Reports (isFinalizedDeal). Idempotent: DROP
--      DEFAULT on a column with no default is a no-op.
--
--   2. Codifies the partial unique index on application_id (also only ever
--      written inside the never-applied 20260627090000 file; believed to exist
--      in prod already — IF NOT EXISTS makes this a no-op there).
--      NOTE: if prod does NOT have the index AND legacy duplicate
--      application_id rows exist, this statement will fail — that failure is a
--      signal to dedupe first, not a bug in this file.
--
--   3. One-time, idempotent BACKFILL: applications sitting at
--      client_status = 'client_contract_signed' RIGHT NOW (the nightly 22:00
--      UTC pg_cron reset nulls client_status, so this only ever catches rows
--      set today) with no deal_records row get the same DRAFT shape the
--      app-layer hook creates. Gated on the same feature flag. Never touches
--      existing deal rows; INSERT-only; WHERE NOT EXISTS by application_id.
--
-- Draft shape = exactly what isAwaitingFinalize() classifies as an
-- awaiting-finalize draft and what Accounting excludes:
--   • sale_date NULL, delivery_date NULL, natis_sent_at NULL
--       → deriveDealStatus() = 'contract_signed'
--   • gross_profit 0 (and every money figure 0)
--       → isAwaitingFinalize() = true; dealNetProfit() = 0
--   • sale_date NULL + is_closed false → isFinalizedDeal() = false
--   • deal_stage NULL → derives to 'contract_signed' on read (matches the
--     app-layer draft, which also leaves it unset)
--   • vehicle_id nullable: seeded via LEFT JOIN when the application has one
--     (sold_price defaults from that vehicle's listed price), NULL otherwise —
--     a vehicle-less draft renders fine (fromDealRecord is null-tolerant) and
--     the vehicle is picked in the Finalize modal.
-- Client name/phone/email/ID are NOT columns on deal_records — the Deal Desk
-- reads them through the application_id join (DEAL_DESK_SELECT), so linking
-- application_id IS the client seeding.
-- ============================================================================

-- 1. Drafts must never inherit a CURRENT_DATE sale_date (idempotent no-op if
--    the default was already dropped in prod).
ALTER TABLE public.deal_records ALTER COLUMN sale_date DROP DEFAULT;

-- 2. Belt-and-braces: at most one deal_records row per application.
CREATE UNIQUE INDEX IF NOT EXISTS deal_records_application_id_unique
  ON public.deal_records (application_id)
  WHERE application_id IS NOT NULL;

-- 3. One-time idempotent backfill (flag-gated, INSERT-only, draft shape).
DO $$
DECLARE
  v_enabled boolean := false;
  v_count   integer := 0;
BEGIN
  -- Same flag the app-layer automation respects. Flag OFF => backfill no-ops.
  SELECT COALESCE((s.document_settings->>'autoCreateDealOnContractSigned')::boolean, false)
    INTO v_enabled
    FROM public.site_settings s
    LIMIT 1;

  IF NOT COALESCE(v_enabled, false) THEN
    RAISE NOTICE 'contract_signed_client_status_deal_backfill: flag autoCreateDealOnContractSigned is OFF — nothing done.';
    RETURN;
  END IF;

  INSERT INTO public.deal_records (
    application_id, vehicle_id, sold_price, sale_date,
    cost_price, gross_profit, recon_cost, discount_amount,
    dealer_deposit_contribution, external_admin_fee, bank_initiation_fee,
    total_financed_amount, client_deposit, dic_amount, sales_rep_commission,
    referral_commission_amount, referral_income_amount, partner_capital_contribution,
    is_shared_capital, is_closed, addons_data, aftersales_expenses
  )
  SELECT
    fa.id,
    fa.vehicle_id,                 -- nullable; vehicle-less drafts are allowed
    COALESCE(v.price, 0),          -- default sold_price from the linked vehicle
    NULL,                          -- explicit NULL sale_date => awaiting-finalize
    0, 0, 0, 0,
    0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0,
    false, false, '[]'::jsonb, '[]'::jsonb
  FROM public.finance_applications fa
  LEFT JOIN public.vehicles v ON v.id = fa.vehicle_id
  WHERE fa.client_status = 'client_contract_signed'
    AND NOT EXISTS (
      SELECT 1 FROM public.deal_records dr WHERE dr.application_id = fa.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'contract_signed_client_status_deal_backfill: % draft deal(s) created.', v_count;
END $$;
