
-- 1. Fix SECURITY DEFINER view warning: enable security_invoker on public_vehicles
ALTER VIEW public.public_vehicles SET (security_invoker = true);

-- 2. Restrict site_settings SELECT — remove the public ALL-COLUMNS policy.
--    Public reads must go through the slim public_site_settings view.
DROP POLICY IF EXISTS "Public can read safe site settings columns" ON public.site_settings;

-- Ensure staff can still read for admin pages (admin policy already exists; add sales_agent)
DROP POLICY IF EXISTS "Sales agents can view site settings" ON public.site_settings;
CREATE POLICY "Sales agents can view site settings"
ON public.site_settings
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'sales_agent'::app_role));

-- Make sure the public_site_settings view is readable by anon/auth (it pulls only safe fields)
GRANT SELECT ON public.public_site_settings TO anon, authenticated;

-- 3. Tighten storage policies for client-docs bucket: anonymous uploads ONLY into inbound-temp/,
--    image types only, 5MB max. Admin/service role unaffected.
DROP POLICY IF EXISTS "Anonymous inbound uploads to client-docs" ON storage.objects;
CREATE POLICY "Anonymous inbound uploads to client-docs"
ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'client-docs'
  AND (storage.foldername(name))[1] = 'inbound-temp'
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
  AND COALESCE((metadata->>'size')::bigint, 0) <= 5242880
);
