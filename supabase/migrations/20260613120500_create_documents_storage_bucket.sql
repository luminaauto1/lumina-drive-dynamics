-- Private storage bucket for all Documents Hub files. Admin-only access.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can read documents bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can upload to documents bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update documents bucket"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete from documents bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'::app_role));
