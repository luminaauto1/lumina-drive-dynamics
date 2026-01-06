-- Add new columns for anti-time-wasting and TikTok to site_settings
ALTER TABLE public.finance_applications
ADD COLUMN IF NOT EXISTS has_drivers_license boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS credit_score_status text DEFAULT NULL;

-- Add tiktok_url to site_settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS tiktok_url text DEFAULT '' NOT NULL;