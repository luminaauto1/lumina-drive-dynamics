-- TASK 5: webhook_events admin read policy
DROP POLICY IF EXISTS "Admins can view webhook events" ON public.webhook_events;
CREATE POLICY "Admins can view webhook events"
ON public.webhook_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- TASK 2: Tighten anonymous client-docs uploads to require a per-session UUID subfolder
DROP POLICY IF EXISTS "Anonymous inbound uploads to client-docs" ON storage.objects;
CREATE POLICY "Anonymous inbound uploads to client-docs"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'client-docs'
  AND (storage.foldername(name))[1] = 'inbound-temp'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND lower(storage.extension(name)) = ANY (ARRAY['jpg','jpeg','png','webp'])
  AND COALESCE((metadata ->> 'size')::bigint, 0) <= 5242880
);
