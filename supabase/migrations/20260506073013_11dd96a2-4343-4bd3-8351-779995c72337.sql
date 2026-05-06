ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.client_audit_logs
  ADD COLUMN IF NOT EXISTS author_id uuid;

CREATE INDEX IF NOT EXISTS idx_finance_apps_created_by ON public.finance_applications(created_by);
CREATE INDEX IF NOT EXISTS idx_client_audit_logs_author_id ON public.client_audit_logs(author_id);