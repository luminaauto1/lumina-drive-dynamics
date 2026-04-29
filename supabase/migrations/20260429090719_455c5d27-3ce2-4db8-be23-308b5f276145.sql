-- Drop all restrictive policies that might linger
DROP POLICY IF EXISTS "Public Submit Only" ON public.finance_applications;
DROP POLICY IF EXISTS "Admins Full Access" ON public.finance_applications;
DROP POLICY IF EXISTS "Enable insert for anonymous users" ON public.finance_applications;
DROP POLICY IF EXISTS "Admins can delete applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Admins can insert any application" ON public.finance_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Users can submit their own applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Users can update own revision applications" ON public.finance_applications;
DROP POLICY IF EXISTS "Users can view their own applications" ON public.finance_applications;

DROP POLICY IF EXISTS "Enable insert for anonymous leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can update leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can create leads" ON public.leads;

-- Permanently disable RLS on these tables
ALTER TABLE public.finance_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;