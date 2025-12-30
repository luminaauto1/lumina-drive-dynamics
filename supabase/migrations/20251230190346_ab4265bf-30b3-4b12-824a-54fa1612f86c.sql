-- Remove the open INSERT policy that allows anyone to submit leads without authentication
-- This policy is not currently used by the frontend and poses a spam/DoS risk
DROP POLICY IF EXISTS "Anyone can submit leads" ON public.leads;