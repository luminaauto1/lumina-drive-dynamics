ALTER VIEW public.public_site_settings SET (security_invoker = false);
GRANT SELECT ON public.public_site_settings TO anon, authenticated;