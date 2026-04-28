DROP POLICY IF EXISTS "Allow public to submit applications" ON public.finance_applications;
CREATE POLICY "Allow public to submit applications" ON public.finance_applications FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Public Insert" ON public.finance_applications;
CREATE POLICY "Public Insert" ON public.finance_applications FOR INSERT TO anon WITH CHECK (true);