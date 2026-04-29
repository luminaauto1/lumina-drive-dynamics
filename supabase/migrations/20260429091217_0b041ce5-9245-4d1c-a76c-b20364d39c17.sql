ALTER TABLE public.finance_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Finance applications: reset public/admin policies into a known-good state
DROP POLICY IF EXISTS "Enable insert for anonymous users" ON public.finance_applications;
DROP POLICY IF EXISTS "Anyone can submit applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Admins can delete applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Users can view their own applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Users can update own revision applications" ON public.finance_applications;

CREATE POLICY "Anyone can submit applications"
ON public.finance_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view all applications"
ON public.finance_applications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update applications"
ON public.finance_applications
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete applications"
ON public.finance_applications
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view their own applications"
ON public.finance_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own revision applications"
ON public.finance_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'needs_revision')
WITH CHECK (auth.uid() = user_id);

-- Leads: reset public/admin policies into a known-good state
DROP POLICY IF EXISTS "Enable insert for anonymous leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can create leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can update leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;

CREATE POLICY "Anyone can create leads"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete leads"
ON public.leads
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));