-- Create application_matches table for vehicle matchmaking
CREATE TABLE public.application_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.finance_applications(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  -- Prevent duplicate matches
  UNIQUE(application_id, vehicle_id)
);

-- Enable RLS
ALTER TABLE public.application_matches ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with matches
CREATE POLICY "Admins can view all matches"
ON public.application_matches
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert matches"
ON public.application_matches
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update matches"
ON public.application_matches
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete matches"
ON public.application_matches
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view matches for their own applications
CREATE POLICY "Users can view their own matches"
ON public.application_matches
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.finance_applications 
    WHERE id = application_matches.application_id 
    AND user_id = auth.uid()
  )
);