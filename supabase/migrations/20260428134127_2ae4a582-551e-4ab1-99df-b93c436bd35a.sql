-- 1. Lock down vehicles table SELECT to admins only; public uses public_vehicles view
DROP POLICY IF EXISTS "Anyone can view vehicles" ON public.vehicles;

CREATE POLICY "Admins can view vehicles"
ON public.vehicles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Ensure the public_vehicles view runs with caller privileges (so anon can read it
-- via its own grants) and grant read access to anon + authenticated
ALTER VIEW public.public_vehicles SET (security_invoker = on);
GRANT SELECT ON public.public_vehicles TO anon, authenticated;

-- 2. Restrict client-docs storage uploads to admins only.
-- (Anonymous applicant uploads go through the upload-client-doc edge function with service role.)
DROP POLICY IF EXISTS "Allow authenticated upload to client-docs" ON storage.objects;

-- 3. Revoke EXECUTE on SECURITY DEFINER functions from public API roles.
-- handle_new_user is a trigger function; should never be invokable via PostgREST.
-- has_role is used inside RLS policies — RLS evaluates with the policy owner's
-- privileges, so revoking EXECUTE from anon/authenticated does NOT break RLS.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;