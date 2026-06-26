-- Phase C: let the universal activity trail link entries directly to an application
-- or a deal (not only by client email/phone). Additive columns + indexes only.
-- RLS already permits admin + f_and_i + sales_agent to read/write; senior_f_and_i and
-- accountant inherit the f_and_i role row, so all staff are covered (no policy change).
-- (Applied to the live DB via Supabase MCP; committed here for migration history.)

ALTER TABLE public.client_audit_logs
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.finance_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deal_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_audit_logs_application_id
  ON public.client_audit_logs(application_id) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_audit_logs_deal_id
  ON public.client_audit_logs(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_audit_logs_created_at
  ON public.client_audit_logs(created_at DESC);
