-- Two-track status: add a stored `deal_stage` to deal_records (NOT applied yet).
--
-- Lumina runs two parallel status tracks on a deal:
--   1. the FINANCE status (finance_applications.status — the 9-step finance flow)
--   2. the DEAL stage (this column — the back-office lifecycle of the sold car)
--
-- Until now the Deal Desk lifecycle was *derived* on read (see
-- src/lib/dealdesk/fromDealRecord.ts → deriveDealStatus), never stored. This adds
-- an explicit, editable stage so the deal track can advance independently of the
-- derived heuristic and be shown as its own badge alongside the finance badge.
--
-- Design rules:
--   * NULLABLE, DEFAULT NULL — existing rows keep deriving their stage on read;
--     nothing is back-filled, so this is a purely additive, zero-behaviour-change
--     column until the app starts writing it.
--   * Values mirror the deal-stage track used by the shared <StatusBadge
--     track="deal">: 'none','deal_started','contract_signed','in_delivery',
--     'delivered','cleared'. A CHECK keeps the column honest while still allowing
--     NULL (= "use the derived stage").
--
-- NOTE: written but NOT applied. The orchestrator applies migrations.

ALTER TABLE public.deal_records
  ADD COLUMN IF NOT EXISTS deal_stage text DEFAULT NULL;

ALTER TABLE public.deal_records
  DROP CONSTRAINT IF EXISTS deal_records_deal_stage_check;

ALTER TABLE public.deal_records
  ADD CONSTRAINT deal_records_deal_stage_check
  CHECK (
    deal_stage IS NULL OR deal_stage IN (
      'none',
      'deal_started',
      'contract_signed',
      'in_delivery',
      'delivered',
      'cleared'
    )
  );

COMMENT ON COLUMN public.deal_records.deal_stage IS
  'Back-office deal lifecycle stage (deal track), independent of the finance status track. NULL = derive on read (fromDealRecord.deriveDealStatus). One of: none, deal_started, contract_signed, in_delivery, delivered, cleared.';
