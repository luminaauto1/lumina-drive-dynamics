ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS submission_source TEXT NOT NULL DEFAULT 'website';