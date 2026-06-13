-- Fix: finance_applications was missing status_updated_at (only `leads` had it,
-- added in 20260212071013). The admin app stamps this column on every pipeline
-- status change (useFinanceApplications.ts), so the "Finalize Deal" status
-- update threw a PostgREST schema-cache error:
--   "Could not find the 'status_updated_at' column of 'finance_applications'".
ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz DEFAULT now();

-- Backfill existing rows so dashboard "today" counters / analytics stay sane.
UPDATE public.finance_applications
   SET status_updated_at = COALESCE(updated_at, created_at, now())
 WHERE status_updated_at IS NULL;

-- Force PostgREST to refresh its schema cache immediately.
NOTIFY pgrst, 'reload schema';
