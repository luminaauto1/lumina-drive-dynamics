-- Add is_featured column to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Create client-docs storage bucket for aftersales documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('client-docs', 'client-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for client-docs bucket
CREATE POLICY "Admins can view client docs" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'client-docs' AND EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can upload client docs" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'client-docs' AND EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can update client docs" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'client-docs' AND EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can delete client docs" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'client-docs' AND EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));