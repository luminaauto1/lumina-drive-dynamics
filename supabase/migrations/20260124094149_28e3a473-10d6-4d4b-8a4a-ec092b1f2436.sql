-- Fix Critical Security Issues

-- 1. Drop the flawed public access policies for finance_applications
DROP POLICY IF EXISTS "Public can view applications with valid token" ON public.finance_applications;
DROP POLICY IF EXISTS "Public can update with valid token" ON public.finance_applications;

-- 2. Drop the anonymous lead submission policy (CRM spam vulnerability)
DROP POLICY IF EXISTS "Anyone can submit leads" ON public.leads;

-- 3. Add authenticated user lead creation policy
-- Users can create leads when logged in (for their own finance applications)
CREATE POLICY "Authenticated users can create leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);