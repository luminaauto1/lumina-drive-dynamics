ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS assigned_f_and_i uuid;

CREATE INDEX IF NOT EXISTS idx_finance_applications_assigned_f_and_i
  ON public.finance_applications(assigned_f_and_i);