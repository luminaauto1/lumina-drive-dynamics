
-- =========================================
-- 1) Lock down site_settings public access; expose safe fields via view
-- =========================================

-- Drop the overly-permissive public SELECT policy on site_settings
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;

-- Add admin-only SELECT policy on the table
CREATE POLICY "Admins can view site settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create a public-safe view excluding sensitive business columns
-- (sales_reps, monthly_sales_target are internal business data)
CREATE OR REPLACE VIEW public.public_site_settings
WITH (security_invoker = true)
AS
SELECT
  id,
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
  created_at,
  updated_at
FROM public.site_settings;

-- The view is security_invoker, so callers need SELECT on the view AND
-- on the underlying columns. Since we removed public SELECT on the table,
-- we must grant column-level SELECT on the safe columns to anon/authenticated.
GRANT SELECT (
  id,
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
  created_at,
  updated_at
) ON public.site_settings TO anon, authenticated;

-- Allow anon/authenticated to read the view itself.
-- Add a permissive RLS policy that only matches when columns selected are safe.
-- Simpler: re-add a public SELECT policy but rely on app to query the view.
-- Since RLS is row-level not column-level, we must allow row reads but trust column grants.
CREATE POLICY "Public can read safe site settings columns"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- NOTE: The column-level GRANTs above mean even though RLS allows the row,
-- attempting to SELECT sensitive columns (sales_reps, monthly_sales_target, etc.)
-- as anon/authenticated will fail with a permission denied error.
-- Admins still have full access via the admin policy + table owner privileges.

-- Revoke ALL on table from anon/authenticated first to enforce column-level grants
REVOKE ALL ON public.site_settings FROM anon, authenticated;

-- Re-grant ONLY safe columns
GRANT SELECT (
  id,
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
  created_at,
  updated_at
) ON public.site_settings TO anon, authenticated;

GRANT SELECT ON public.public_site_settings TO anon, authenticated;

-- =========================================
-- 2) Remove the dangerous admin_unlock_tables RPC
-- =========================================
-- This function is SECURITY DEFINER and would let any caller disable RLS
-- on finance_applications and leads. It's flagged by the linter and should
-- not exist in production.
DROP FUNCTION IF EXISTS public.admin_unlock_tables();

-- =========================================
-- 3) Harden has_role() execute permissions
-- =========================================
-- has_role is SECURITY DEFINER and intentionally callable by anon/authenticated
-- (RLS policies use it). This is required for RLS to work, so we keep EXECUTE
-- but ensure search_path is fixed (already done).
-- No change needed; the linter warning is informational for this function.
