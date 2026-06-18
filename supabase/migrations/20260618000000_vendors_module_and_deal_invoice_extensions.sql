-- Vendors module + deal invoice extensions (applied to production 2026-06-18).
-- Additive only: new tables + nullable columns. Does NOT alter any existing
-- deal_records / vehicles data. RLS mirrors the existing has_role(...) convention.

-- 1. VENDORS — counterparties we BUY cars from and/or SELL finance deals to.
CREATE TABLE IF NOT EXISTS public.vendors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  vendor_type         text NOT NULL DEFAULT 'both'
                       CHECK (vendor_type IN ('supplier','finance_house','both')),
  registration_number text,
  vat_number          text,
  contact_person      text,
  email               text,
  phone               text,
  address             text,
  bank_name           text,
  bank_account_number text,
  bank_branch_code    text,
  invoice_notes       text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 2. VENDOR_DOCUMENTS — files uploaded per vendor (private vendor-documents bucket).
CREATE TABLE IF NOT EXISTS public.vendor_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  label       text,
  doc_type    text,
  file_path   text NOT NULL,
  file_name   text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_vendor_id ON public.vendor_documents(vendor_id);

-- 3. DEAL_RECORDS — how the deal was sold + who it is invoiced to.
ALTER TABLE public.deal_records
  ADD COLUMN IF NOT EXISTS deal_type text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS finance_house_vendor_id uuid REFERENCES public.vendors(id),
  ADD COLUMN IF NOT EXISTS invoice_config jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deal_records_deal_type_check') THEN
    ALTER TABLE public.deal_records ADD CONSTRAINT deal_records_deal_type_check CHECK (deal_type IN ('direct','finance'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_deal_records_finance_house ON public.deal_records(finance_house_vendor_id);

-- 4. VEHICLES — where the car was bought (captured at intake).
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS source_vendor_id uuid REFERENCES public.vendors(id);
CREATE INDEX IF NOT EXISTS idx_vehicles_source_vendor ON public.vehicles(source_vendor_id);

-- 5. updated_at trigger for vendors.
CREATE OR REPLACE FUNCTION public.vendors_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.vendors_set_updated_at();

-- 6. RLS — mirror existing admin/accountant/senior_f_and_i/sales_agent pattern.
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view vendors" ON public.vendors FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'accountant'::app_role)
      OR has_role(auth.uid(),'senior_f_and_i'::app_role) OR has_role(auth.uid(),'sales_agent'::app_role));
CREATE POLICY "Managers insert vendors" ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));
CREATE POLICY "Managers update vendors" ON public.vendors FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));
CREATE POLICY "Admins delete vendors" ON public.vendors FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Staff view vendor docs" ON public.vendor_documents FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'accountant'::app_role)
      OR has_role(auth.uid(),'senior_f_and_i'::app_role) OR has_role(auth.uid(),'sales_agent'::app_role));
CREATE POLICY "Managers insert vendor docs" ON public.vendor_documents FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));
CREATE POLICY "Managers delete vendor docs" ON public.vendor_documents FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));

-- 7. Private storage bucket for vendor documents + staff-only object policies.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('vendor-documents','vendor-documents', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff read vendor-documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vendor-documents' AND (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'accountant'::app_role)
    OR has_role(auth.uid(),'senior_f_and_i'::app_role) OR has_role(auth.uid(),'sales_agent'::app_role)));
CREATE POLICY "Managers upload vendor-documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-documents' AND (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role)));
CREATE POLICY "Managers delete vendor-documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-documents' AND (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role)));
