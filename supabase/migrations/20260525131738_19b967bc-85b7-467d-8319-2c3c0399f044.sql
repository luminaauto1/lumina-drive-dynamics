
ALTER FUNCTION public.normalize_phone_last9(text) SET search_path = public;

REVOKE ALL ON FUNCTION public.normalize_phone_last9(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_referral_on_app_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_referral_on_app_status() FROM PUBLIC, anon, authenticated;
