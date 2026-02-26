-- Remove the overly permissive anonymous upload policy on client-docs
DROP POLICY IF EXISTS "Public clients can upload documents" ON storage.objects;