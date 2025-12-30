-- Add new columns to finance_applications table for complete finance workflow

-- Personal Details
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS marital_status text,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS qualification text;

-- Address
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS street_address text,
ADD COLUMN IF NOT EXISTS area_code text;

-- Employment
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS employment_period text;

-- Next of Kin
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS kin_name text,
ADD COLUMN IF NOT EXISTS kin_contact text;

-- Banking
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS account_type text,
ADD COLUMN IF NOT EXISTS account_number text;

-- Financials
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS gross_salary numeric,
ADD COLUMN IF NOT EXISTS net_salary numeric,
ADD COLUMN IF NOT EXISTS expenses_summary text;

-- Consent
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS popia_consent boolean DEFAULT false;