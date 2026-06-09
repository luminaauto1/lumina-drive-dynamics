ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS docs_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS docs_whatsapp boolean NOT NULL DEFAULT false;