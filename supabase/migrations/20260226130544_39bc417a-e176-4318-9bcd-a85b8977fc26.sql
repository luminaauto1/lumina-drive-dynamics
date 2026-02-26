
-- Fix 1: Remove the open anonymous INSERT policy on sell_car_requests
DROP POLICY IF EXISTS "Anyone can submit sell requests" ON public.sell_car_requests;

-- Fix 2: Remove overly permissive access_token policies on finance_applications
DROP POLICY IF EXISTS "Public can view applications" ON public.finance_applications;
