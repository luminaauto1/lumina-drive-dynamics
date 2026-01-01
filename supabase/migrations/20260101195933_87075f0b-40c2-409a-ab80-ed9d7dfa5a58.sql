-- Add new contact/location fields to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS primary_phone text NOT NULL DEFAULT '+27 68 601 7462',
ADD COLUMN IF NOT EXISTS secondary_phone text,
ADD COLUMN IF NOT EXISTS primary_email text NOT NULL DEFAULT 'lumina.auto1@gmail.com',
ADD COLUMN IF NOT EXISTS finance_email text NOT NULL DEFAULT 'finance@luminaauto.co.za',
ADD COLUMN IF NOT EXISTS show_physical_location boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS physical_address text DEFAULT '123 Automotive Drive, Sandton, Johannesburg, South Africa';

-- Create analytics_events table for tracking
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  page_path text,
  session_id text,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on analytics_events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert analytics events (anonymous tracking)
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
WITH CHECK (true);

-- Only admins can view analytics
CREATE POLICY "Admins can view all analytics"
ON public.analytics_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON public.analytics_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_page_path ON public.analytics_events(page_path);

-- Add delete capability for finance_applications by admins
CREATE POLICY "Admins can delete applications"
ON public.finance_applications
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));