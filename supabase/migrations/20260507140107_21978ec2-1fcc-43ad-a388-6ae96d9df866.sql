ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS has_6_months_statements boolean,
  ADD COLUMN IF NOT EXISTS workplace_cell_no text,
  ADD COLUMN IF NOT EXISTS business_address_auto text;