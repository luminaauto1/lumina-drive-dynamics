-- Add show_finance_tab to site_settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS show_finance_tab boolean NOT NULL DEFAULT true;

-- Create aftersales_records table
CREATE TABLE public.aftersales_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  sale_date timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  finance_application_id uuid REFERENCES public.finance_applications(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.aftersales_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for aftersales_records
CREATE POLICY "Admins can view all aftersales records"
ON public.aftersales_records
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert aftersales records"
ON public.aftersales_records
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update aftersales records"
ON public.aftersales_records
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete aftersales records"
ON public.aftersales_records
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_aftersales_records_updated_at
BEFORE UPDATE ON public.aftersales_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();