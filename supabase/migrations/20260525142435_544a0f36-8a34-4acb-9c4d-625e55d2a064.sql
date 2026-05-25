ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS followup_sent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_finance_apps_followup_pending
  ON public.finance_applications (status, followup_sent, updated_at)
  WHERE followup_sent = false AND status IN ('declined', 'blacklisted');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;