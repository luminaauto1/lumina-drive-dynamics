ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS docs_contacted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS docs_contacted_at timestamp with time zone;