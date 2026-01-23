-- Fix the overly permissive storage policy by requiring proper path format
DROP POLICY IF EXISTS "Allow public upload with token path" ON storage.objects;

-- More restrictive policy: only allow uploads to client-docs bucket
-- where the folder path matches an access_token format (UUID)
CREATE POLICY "Allow authenticated upload to client-docs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'client-docs' AND 
  auth.role() = 'authenticated'
);

-- Allow public uploads only if the path starts with a valid UUID format
CREATE POLICY "Allow token-based public upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'client-docs' AND
  (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);