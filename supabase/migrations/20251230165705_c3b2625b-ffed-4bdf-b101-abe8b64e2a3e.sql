-- Add declined_reason column to finance_applications table
ALTER TABLE public.finance_applications ADD COLUMN IF NOT EXISTS declined_reason TEXT;