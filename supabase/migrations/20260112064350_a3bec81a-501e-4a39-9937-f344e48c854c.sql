-- Create finance_offers table for bank offers/podium
CREATE TABLE IF NOT EXISTS public.finance_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES public.finance_applications(id) ON DELETE CASCADE NOT NULL,
  bank_name TEXT NOT NULL,
  cash_price NUMERIC,
  license_fee NUMERIC,
  delivery_fee NUMERIC,
  admin_fee NUMERIC,
  initiation_fee NUMERIC,
  total_fees NUMERIC,
  principal_debt NUMERIC,
  balloon_amount NUMERIC,
  interest_rate_linked NUMERIC,
  instalment_linked NUMERIC,
  interest_rate_fixed NUMERIC,
  instalment_fixed NUMERIC,
  vap_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.finance_offers ENABLE ROW LEVEL SECURITY;

-- Admins can manage all offers
CREATE POLICY "Admins can view all offers" 
ON public.finance_offers 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert offers" 
ON public.finance_offers 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update offers" 
ON public.finance_offers 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete offers" 
ON public.finance_offers 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own offers
CREATE POLICY "Users can view their own offers" 
ON public.finance_offers 
FOR SELECT 
USING (
  application_id IN (
    SELECT id FROM public.finance_applications WHERE user_id = auth.uid()
  )
);

-- Add signature_url column to finance_applications if not exists
ALTER TABLE public.finance_applications 
ADD COLUMN IF NOT EXISTS signature_url TEXT;