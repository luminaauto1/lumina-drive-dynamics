-- Make delivery-photos bucket private to prevent listing/enumeration
UPDATE storage.buckets SET public = false WHERE id = 'delivery-photos';

-- Remove broad public SELECT policy if present
DROP POLICY IF EXISTS "Public can view delivery photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view delivery photos" ON storage.objects;
DROP POLICY IF EXISTS "Delivery photos are publicly accessible" ON storage.objects;

-- Allow admins to view delivery photos directly
CREATE POLICY "Admins can view delivery photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'delivery-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));