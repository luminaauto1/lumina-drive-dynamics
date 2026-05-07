
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS require_application_signature boolean NOT NULL DEFAULT true;

DROP VIEW IF EXISTS public.public_site_settings;

CREATE VIEW public.public_site_settings
WITH (security_invoker = true) AS
SELECT id,
   default_interest_rate,
   min_balloon_percent,
   max_balloon_percent,
   default_balloon_percent,
   min_interest,
   max_interest,
   min_deposit_percent,
   show_finance_tab,
   show_trade_in,
   is_maintenance_mode,
   hero_headline,
   hero_subheadline,
   primary_phone,
   secondary_phone,
   primary_email,
   finance_email,
   contact_phone,
   contact_email,
   whatsapp_number,
   facebook_url,
   instagram_url,
   tiktok_url,
   google_review_url,
   hellopeter_url,
   trustpilot_url,
   show_physical_location,
   physical_address,
   require_application_signature,
   created_at,
   updated_at
FROM public.site_settings;

GRANT SELECT ON public.public_site_settings TO anon, authenticated;
