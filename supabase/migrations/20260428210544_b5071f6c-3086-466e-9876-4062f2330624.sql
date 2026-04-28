DROP POLICY IF EXISTS "Allow public to submit applications" ON public.finance_applications;
CREATE POLICY "Allow public to submit applications" ON public.finance_applications FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public to create leads" ON public.leads;
CREATE POLICY "Allow public to create leads" ON public.leads FOR INSERT TO anon WITH CHECK (true);