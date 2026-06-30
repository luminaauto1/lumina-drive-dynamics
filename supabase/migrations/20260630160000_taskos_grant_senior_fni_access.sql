-- Give senior F&I users (role 'senior_f_and_i' — which accountants also carry)
-- access to their OWN TaskOS. Previously every taskos_* RLS policy required
-- is_staff() = admin/sales_agent only, so a senior F&I saw the launcher (frontend
-- isStaff includes them) but an empty/blocked panel (DB is_staff() rejected them).
--
-- is_staff() is reused by many NON-TaskOS policies (export_presets, finance_banks,
-- integration_settings, credit-check storage, role_section_access, etc.), so we do
-- NOT broaden it globally. Instead a dedicated TaskOS-only helper.
-- (Applied to the live DB via Supabase MCP; committed here for migration history.)
CREATE OR REPLACE FUNCTION public.is_taskos_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'sales_agent'::app_role, 'senior_f_and_i'::app_role)
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_taskos_user(uuid) TO authenticated, anon;

-- Repoint every taskos_* policy from is_staff() → is_taskos_user(). The per-user
-- (user_id = auth.uid()) scoping is preserved, so each user only ever sees/edits
-- THEIR OWN TaskOS data — no cross-user leakage.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname = 'public' AND tablename LIKE 'taskos%'
  LOOP
    IF r.cmd = 'INSERT' THEN
      EXECUTE format(
        'ALTER POLICY %I ON public.%I WITH CHECK ((user_id = auth.uid()) AND public.is_taskos_user(auth.uid()))',
        r.policyname, r.tablename);
    ELSIF r.cmd = 'UPDATE' THEN
      EXECUTE format(
        'ALTER POLICY %I ON public.%I USING ((user_id = auth.uid()) AND public.is_taskos_user(auth.uid())) WITH CHECK ((user_id = auth.uid()) AND public.is_taskos_user(auth.uid()))',
        r.policyname, r.tablename);
    ELSE  -- SELECT, DELETE
      EXECUTE format(
        'ALTER POLICY %I ON public.%I USING ((user_id = auth.uid()) AND public.is_taskos_user(auth.uid()))',
        r.policyname, r.tablename);
    END IF;
  END LOOP;
END $$;
