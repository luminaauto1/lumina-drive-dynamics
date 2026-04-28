-- Tighten delivery-photos storage bucket: restrict writes/deletes to admins only.
-- Keep public SELECT because customer-facing handover page uses public URLs (URLs are UUID-based and shared via secure handover links).

DROP POLICY IF EXISTS "Authenticated users can upload delivery photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete delivery photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload delivery photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update delivery photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete delivery photos" ON storage.objects;

CREATE POLICY "Admins can upload delivery photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'delivery-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update delivery photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'delivery-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete delivery photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'delivery-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Explicitly block all writes/deletes to user_roles by non-admins (defense in depth).
-- RLS already blocks by default, but make intent explicit.

DROP POLICY IF EXISTS "Only admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete user roles" ON public.user_roles;

CREATE POLICY "Only admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Only admins can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Only admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));