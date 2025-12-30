-- Create leads table for CRM
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'website',
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage leads
CREATE POLICY "Admins can view all leads" 
ON public.leads 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update leads" 
ON public.leads 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete leads" 
ON public.leads 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow anonymous lead submission (for contact forms, etc.)
CREATE POLICY "Anyone can submit leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for vehicle images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vehicle-images', 'vehicle-images', true);

-- Storage policies for vehicle images
CREATE POLICY "Anyone can view vehicle images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'vehicle-images');

CREATE POLICY "Admins can upload vehicle images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'vehicle-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update vehicle images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'vehicle-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete vehicle images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'vehicle-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for leads table
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;