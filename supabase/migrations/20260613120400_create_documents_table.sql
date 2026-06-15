-- Central metadata table powering the admin Documents Hub. One row per stored
-- file, linked to whichever entity it belongs to (client / vehicle / deal) plus
-- a free "business" category for company paperwork. Admin-only RLS.
CREATE TABLE IF NOT EXISTS public.documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  file_path      text NOT NULL,
  bucket         text NOT NULL DEFAULT 'documents',
  category       text NOT NULL DEFAULT 'business'
                   CHECK (category IN ('client', 'vehicle', 'deal', 'business')),
  doc_type       text,
  mime_type      text,
  file_size      bigint NOT NULL DEFAULT 0,
  client_id      uuid,
  application_id uuid REFERENCES public.finance_applications(id) ON DELETE SET NULL,
  vehicle_id     uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  deal_id        uuid REFERENCES public.deal_records(id) ON DELETE SET NULL,
  uploaded_by    uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_client_id_idx      ON public.documents (client_id);
CREATE INDEX IF NOT EXISTS documents_application_id_idx ON public.documents (application_id);
CREATE INDEX IF NOT EXISTS documents_vehicle_id_idx     ON public.documents (vehicle_id);
CREATE INDEX IF NOT EXISTS documents_deal_id_idx        ON public.documents (deal_id);
CREATE INDEX IF NOT EXISTS documents_category_idx       ON public.documents (category);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view documents"
  ON public.documents FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert documents"
  ON public.documents FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update documents"
  ON public.documents FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete documents"
  ON public.documents FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
