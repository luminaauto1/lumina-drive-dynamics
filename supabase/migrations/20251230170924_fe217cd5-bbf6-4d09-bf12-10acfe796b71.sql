-- Create site_settings table for global configuration
CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Finance Configuration
  default_interest_rate DECIMAL(5,2) NOT NULL DEFAULT 13.75,
  min_balloon_percent INTEGER NOT NULL DEFAULT 0,
  max_balloon_percent INTEGER NOT NULL DEFAULT 40,
  -- Contact & Socials
  contact_phone TEXT NOT NULL DEFAULT '+27 68 601 7462',
  contact_email TEXT NOT NULL DEFAULT 'lumina.auto1@gmail.com',
  whatsapp_number TEXT NOT NULL DEFAULT '27686017462',
  facebook_url TEXT NOT NULL DEFAULT 'https://www.facebook.com/profile.php?id=61573796805868',
  instagram_url TEXT NOT NULL DEFAULT 'https://www.instagram.com/lumina.auto/',
  -- Branding
  hero_headline TEXT NOT NULL DEFAULT 'Drive Your Aspirations',
  hero_subheadline TEXT NOT NULL DEFAULT 'The New Era of Vehicle Sourcing',
  -- Site Control
  is_maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for frontend)
CREATE POLICY "Anyone can view site settings"
ON public.site_settings
FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update site settings"
ON public.site_settings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert settings
CREATE POLICY "Admins can insert site settings"
ON public.site_settings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings row
INSERT INTO public.site_settings (id) VALUES (gen_random_uuid());

-- Add trigger for updated_at
CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();