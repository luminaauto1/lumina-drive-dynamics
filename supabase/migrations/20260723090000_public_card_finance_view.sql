-- Expose the four public-card finance columns through the anon-facing view.
--
-- 20260723080000 added card_interest_rate / card_deposit_percent /
-- card_balloon_percent / card_term_months to the base site_settings table, but
-- the storefront (and the admin FinanceBody form) read via the public_site_settings
-- VIEW — useSiteSettings.ts `.from('public_site_settings')` — whose column list is
-- explicit and frozen at creation. Without adding the columns here, the four
-- levers are invisible to every reader: the /pm estimate silently uses the code
-- fallbacks and the owner's saved values read back as undefined (the admin field
-- appears to revert on reopen). Masked today only because the current values
-- equal those fallbacks.
--
-- CREATE OR REPLACE preserves the existing SELECT grants (anon, authenticated)
-- and the security_invoker setting; appending columns at the end is permitted.
-- The column list is the live view definition verbatim, plus the four card_* at
-- the end.

CREATE OR REPLACE VIEW public.public_site_settings AS
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
    updated_at,
    card_interest_rate,
    card_deposit_percent,
    card_balloon_percent,
    card_term_months
  FROM public.site_settings;
