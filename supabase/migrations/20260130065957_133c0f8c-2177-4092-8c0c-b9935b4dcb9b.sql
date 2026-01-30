-- 1. Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-docs', 'client-docs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public clients can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage client-docs" ON storage.objects;

-- 3. Allow Public (Anon) to UPLOAD files (Write Only)
-- They can insert, but NOT select/list (privacy)
CREATE POLICY "Public clients can upload documents"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'client-docs' );

-- 4. Allow Admins to View/Download everything
CREATE POLICY "Admins can manage client-docs"
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'client-docs' AND has_role(auth.uid(), 'admin'::app_role) )
WITH CHECK ( bucket_id = 'client-docs' AND has_role(auth.uid(), 'admin'::app_role) );