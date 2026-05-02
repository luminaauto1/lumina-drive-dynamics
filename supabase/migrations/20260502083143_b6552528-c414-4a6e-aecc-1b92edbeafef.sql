DROP POLICY IF EXISTS "Staff can upload vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

CREATE POLICY "Staff can upload vehicle images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-images'
  AND public.is_staff(auth.uid())
);

CREATE POLICY "Staff can update vehicle images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vehicle-images'
  AND public.is_staff(auth.uid())
)
WITH CHECK (
  bucket_id = 'vehicle-images'
  AND public.is_staff(auth.uid())
);

CREATE POLICY "Staff can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));