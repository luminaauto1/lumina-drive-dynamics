
-- Add review link columns to existing site_settings table
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS google_review_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS hellopeter_url TEXT DEFAULT '';
