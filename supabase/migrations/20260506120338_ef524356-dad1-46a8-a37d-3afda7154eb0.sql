ALTER TABLE public.finance_applications ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
-- Backfill: any existing rows with status='archived' get archived flag set
UPDATE public.finance_applications SET is_archived = true WHERE status = 'archived';
CREATE INDEX IF NOT EXISTS idx_finance_apps_is_archived ON public.finance_applications(is_archived);