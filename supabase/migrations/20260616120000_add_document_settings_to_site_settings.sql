-- Customizable company / invoice / OTP document settings live in one JSON blob
-- on the single-row site_settings table. Additive and safe; the public site
-- view (public_site_settings) intentionally does NOT expose this (it holds
-- banking + VAT details that must stay admin-only).
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS document_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
