-- LuminaTaskOS P2/P3: cron infrastructure (self-contained auth) + priority engine.
-- Requires extensions: pg_cron, pg_net (both pre-enabled on this Supabase project).

-- 1. Service-role-only config (cron secret, base url, anon key). No client access.
CREATE TABLE IF NOT EXISTS public.taskos_internal_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public.taskos_internal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskos_internal_config FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.taskos_internal_config FROM anon, authenticated;
GRANT SELECT ON public.taskos_internal_config TO service_role;

-- Seed config. The cron secret is random and lives ONLY in the DB: the pg_cron
-- caller reads it to send, the edge function reads it (service role) to verify.
-- The anon key below is the PUBLIC publishable key (safe to store). No user step.
INSERT INTO public.taskos_internal_config (key, value) VALUES
  ('functions_base_url', 'https://gkghazemorbxmzzcbaty.supabase.co/functions/v1'),
  ('anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZ2hhemVtb3JieG16emNiYXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODEwMTQsImV4cCI6MjA5Njg1NzAxNH0.3ZTKnEjaD374VAGOWynmdaSFgghW5fxo-8PDNF1WM_4'),
  ('cron_secret', replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''))
ON CONFLICT (key) DO NOTHING;

-- 2. SECURITY DEFINER helper: pg_cron -> pg_net POST to an edge function with the
-- cron secret. Owned by postgres; not callable by anon/authenticated.
CREATE OR REPLACE FUNCTION public.taskos_invoke(fn text, body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_base   text;
  v_secret text;
  v_anon   text;
  v_req    bigint;
BEGIN
  SELECT value INTO v_base   FROM public.taskos_internal_config WHERE key='functions_base_url';
  SELECT value INTO v_secret FROM public.taskos_internal_config WHERE key='cron_secret';
  SELECT value INTO v_anon   FROM public.taskos_internal_config WHERE key='anon_key';
  SELECT net.http_post(
    url := v_base || '/' || fn,
    body := coalesce(body, '{}'::jsonb),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-taskos-cron', v_secret,
      'apikey', v_anon,
      'Authorization', 'Bearer ' || v_anon
    ),
    timeout_milliseconds := 10000
  ) INTO v_req;
  RETURN v_req;
END $$;
REVOKE ALL ON FUNCTION public.taskos_invoke(text, jsonb) FROM anon, authenticated;

-- 3. PRIORITY ENGINE (pure SQL; no secret, no edge call). Rescores active,
-- unlocked tasks. Eisenhower-ish: importance + urgency + due proximity + staleness
-- + status nudge. Only writes rows whose score actually changes (avoids churn).
CREATE OR REPLACE FUNCTION public.taskos_rescore_priorities()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE n integer;
BEGIN
  WITH scored AS (
    SELECT id,
      least(100, greatest(0,
        importance * 12 + urgency * 8
        + CASE
            WHEN due_at IS NULL THEN 0
            WHEN due_at < now() THEN 50
            WHEN due_at < now() + interval '24 hours' THEN 35
            WHEN due_at < now() + interval '72 hours' THEN 20
            WHEN due_at < now() + interval '7 days'  THEN 8
            ELSE 0 END
        + least(15, greatest(0, extract(epoch FROM (now() - last_progress_at)) / 86400.0 * 2))
        + CASE status
            WHEN 'in_progress' THEN 6
            WHEN 'blocked'     THEN -8
            WHEN 'waiting'     THEN -6
            ELSE 0 END
      ))::double precision AS ns
    FROM public.taskos_tasks
    WHERE status NOT IN ('done','cancelled') AND priority_locked = false
  )
  UPDATE public.taskos_tasks t
     SET priority_score = s.ns,
         priority_meta  = coalesce(t.priority_meta,'{}'::jsonb) || jsonb_build_object('rescored_at', now())
    FROM scored s
   WHERE t.id = s.id AND t.priority_score IS DISTINCT FROM s.ns;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- 4. Schedule the priority rescore every 15 minutes (pure SQL job).
SELECT cron.schedule('taskos-rescore-priorities', '*/15 * * * *',
  $$ SELECT public.taskos_rescore_priorities(); $$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'taskos-rescore-priorities');
