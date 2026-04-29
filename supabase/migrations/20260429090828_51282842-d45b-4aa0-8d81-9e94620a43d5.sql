-- Re-enable RLS
ALTER TABLE public.finance_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- finance_applications policies
-- ============================================

-- Public/anon and authenticated users can submit new applications
DROP POLICY IF EXISTS "Anyone can submit applications" ON public.finance_applications;
CREATE POLICY "Anyone can submit applications"
ON public.finance_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admins: full read access
DROP POLICY IF EXISTS "Admins can view all applications" ON public.finance_applications;
CREATE POLICY "Admins can view all applications"
ON public.finance_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins: full update access
DROP POLICY IF EXISTS "Admins can update applications" ON public.finance_applications;
CREATE POLICY "Admins can update applications"
ON public.finance_applications
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins: full delete access
DROP POLICY IF EXISTS "Admins can delete applications" ON public.finance_applications;
CREATE POLICY "Admins can delete applications"
ON public.finance_applications
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view their own applications
DROP POLICY IF EXISTS "Users can view their own applications" ON public.finance_applications;
CREATE POLICY "Users can view their own applications"
ON public.finance_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Authenticated users can update their own application only when in revision
DROP POLICY IF EXISTS "Users can update own revision applications" ON public.finance_applications;
CREATE POLICY "Users can update own revision applications"
ON public.finance_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'needs_revision')
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- leads policies
-- ============================================

-- Public/anon and authenticated users can create leads
DROP POLICY IF EXISTS "Anyone can create leads" ON public.leads;
CREATE POLICY "Anyone can create leads"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admins: full read access
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins: full update access
DROP POLICY IF EXISTS "Admins can update leads" ON public.leads;
CREATE POLICY "Admins can update leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins: full delete access
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
CREATE POLICY "Admins can delete leads"
ON public.leads
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));