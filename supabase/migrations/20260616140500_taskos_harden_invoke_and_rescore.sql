-- Security hardening (advisor follow-up):
-- 1. taskos_invoke is SECURITY DEFINER and must NOT be reachable from the public
--    API. REVOKE ... FROM anon, authenticated left the implicit PUBLIC grant in
--    place, so it was still callable via /rest/v1/rpc. Revoke from PUBLIC.
REVOKE ALL ON FUNCTION public.taskos_invoke(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.taskos_invoke(text, jsonb) FROM anon, authenticated;
-- (postgres owns it; pg_cron runs as the owner, so scheduled calls still work.)

-- 2. Pin the rescore function's search_path (defense-in-depth).
ALTER FUNCTION public.taskos_rescore_priorities() SET search_path = public;
