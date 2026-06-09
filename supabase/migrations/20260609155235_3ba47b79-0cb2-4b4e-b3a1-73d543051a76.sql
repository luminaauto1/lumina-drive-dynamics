ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS credit_check_first_checked_at timestamptz;

-- Backfill: for any app that already has a recorded outcome, anchor it to updated_at so historical reports remain consistent.
UPDATE public.finance_applications
   SET credit_check_first_checked_at = updated_at
 WHERE credit_check_first_checked_at IS NULL
   AND credit_check_status IN ('passed','failed');