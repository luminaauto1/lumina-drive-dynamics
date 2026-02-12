
-- 1. Add delivery photos column to deal_records
ALTER TABLE deal_records 
ADD COLUMN IF NOT EXISTS delivery_photos TEXT[] DEFAULT '{}';

-- 2. Create delivery-photos storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-photos', 'delivery-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Allow public read access
CREATE POLICY "Anyone can view delivery photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-photos');

-- 4. Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload delivery photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'delivery-photos' AND auth.role() = 'authenticated');

-- 5. Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete delivery photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'delivery-photos' AND auth.role() = 'authenticated');
