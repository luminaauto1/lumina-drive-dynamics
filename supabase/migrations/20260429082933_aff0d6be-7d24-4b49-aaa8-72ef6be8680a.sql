-- 1. Re-enable security
ALTER TABLE public.finance_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 2. Clean up redundant/overlapping public INSERT policies on finance_applications
DROP POLICY IF EXISTS "Allow public to submit applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Anonymous can submit applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Public Insert" ON public.finance_applications;
DROP POLICY IF EXISTS "Public Submit Only" ON public.finance_applications;

-- Single canonical anon-submit policy (no SELECT/UPDATE/DELETE for anon)
CREATE POLICY "Public can submit applications"
  ON public.finance_applications
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 3. Clean up redundant public INSERT policies on leads
DROP POLICY IF EXISTS "Allow public to create leads" ON public.leads;
DROP POLICY IF EXISTS "Public Submit Lead Only" ON public.leads;

CREATE POLICY "Public can submit leads"
  ON public.leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 4. Admin full-access policies already exist via has_role(auth.uid(), 'admin') —
-- no changes needed. Authenticated user policies (own application read/insert) also retained.