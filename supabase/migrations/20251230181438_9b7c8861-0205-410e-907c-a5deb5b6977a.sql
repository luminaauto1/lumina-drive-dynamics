-- Add buyer_type column to finance_applications to distinguish cash vs finance buyers
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS buyer_type text DEFAULT 'finance';

-- Add source_of_funds column for cash buyers
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS source_of_funds text;