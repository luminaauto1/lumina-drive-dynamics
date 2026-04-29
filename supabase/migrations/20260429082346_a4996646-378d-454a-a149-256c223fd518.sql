CREATE OR REPLACE FUNCTION public.admin_unlock_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE public.finance_applications DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unlock_tables() FROM PUBLIC, anon, authenticated;