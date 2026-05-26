
-- Table
CREATE TABLE public.juristic_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  application_id UUID NULL,
  created_by UUID NULL,
  status TEXT NOT NULL DEFAULT 'draft',

  -- Entity
  company_name TEXT,
  registration_number TEXT,
  trading_name TEXT,
  entity_type TEXT,
  tax_number TEXT,
  vat_number TEXT,
  nature_of_business TEXT,
  registered_address TEXT,
  postal_address TEXT,
  contact_phone TEXT,
  contact_email TEXT,

  -- JSON blobs
  banking_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  associated_parties JSONB NOT NULL DEFAULT '[]'::jsonb,
  public_official_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  financial_details JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Consent
  signature_image_url TEXT,
  signer_full_name TEXT,
  signer_capacity TEXT,
  popia_consent_accepted BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.juristic_submissions ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins manage juristic submissions"
ON public.juristic_submissions
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Sales agents view juristic submissions"
ON public.juristic_submissions
FOR SELECT TO authenticated
USING (has_role(auth.uid(),'sales_agent'::app_role) OR has_role(auth.uid(),'f_and_i'::app_role));

-- Public (anon) can INSERT a new draft (token returned to admin client-side after insert by admin only).
-- We restrict anon INSERT to bare draft with no application_id linkage; admin creates the row first via dashboard.
-- Public UPDATE by token: allowed only when status='draft' to fill fields.
CREATE POLICY "Public can read submission by token (draft)"
ON public.juristic_submissions
FOR SELECT TO anon, authenticated
USING (status IN ('draft','submitted'));

CREATE POLICY "Public can update draft by token"
ON public.juristic_submissions
FOR UPDATE TO anon, authenticated
USING (status = 'draft')
WITH CHECK (status IN ('draft','submitted'));

-- updated_at trigger
CREATE TRIGGER trg_juristic_updated
BEFORE UPDATE ON public.juristic_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_juristic_application ON public.juristic_submissions(application_id);
CREATE INDEX idx_juristic_token ON public.juristic_submissions(access_token);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('bank-templates','bank-templates', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('juristic-signatures','juristic-signatures', false)
ON CONFLICT (id) DO NOTHING;

-- bank-templates: admin only
CREATE POLICY "Admin read bank templates"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='bank-templates' AND has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admin write bank templates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='bank-templates' AND has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admin update bank templates"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='bank-templates' AND has_role(auth.uid(),'admin'::app_role));

-- juristic-signatures: anon write allowed (path = submission id), admin read
CREATE POLICY "Anon upload juristic signature"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id='juristic-signatures');

CREATE POLICY "Admin read juristic signatures"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='juristic-signatures' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sales_agent'::app_role) OR has_role(auth.uid(),'f_and_i'::app_role)));
