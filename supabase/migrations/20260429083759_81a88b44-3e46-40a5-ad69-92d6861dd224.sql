-- Finance applications: replace any existing anon insert policies with the canonical one
DROP POLICY IF EXISTS "Public can submit applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Enable insert for anonymous users" ON public.finance_applications;
CREATE POLICY "Enable insert for anonymous users"
ON public.finance_applications FOR INSERT TO anon WITH CHECK (true);

-- Leads: replace any existing anon insert policies with the canonical one
DROP POLICY IF EXISTS "Public can submit leads" ON public.leads;
DROP POLICY IF EXISTS "Enable insert for anonymous leads" ON public.leads;
CREATE POLICY "Enable insert for anonymous leads"
ON public.leads FOR INSERT TO anon WITH CHECK (true);