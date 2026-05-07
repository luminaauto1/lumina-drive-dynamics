ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS id_type text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS marriage_type text,
  ADD COLUMN IF NOT EXISTS spouse_first_name text,
  ADD COLUMN IF NOT EXISTS spouse_surname text,
  ADD COLUMN IF NOT EXISTS spouse_id text,
  ADD COLUMN IF NOT EXISTS spouse_contact text;