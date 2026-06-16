-- Schedule the edge-function crons. Each calls public.taskos_invoke(fn, body),
-- which posts to the function with the DB-held cron secret. Idempotent.

SELECT cron.schedule('taskos-run-reminders', '*/5 * * * *',
  $$ SELECT public.taskos_invoke('taskos-run-reminders', '{}'::jsonb); $$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'taskos-run-reminders');

SELECT cron.schedule('taskos-run-briefings', '*/15 * * * *',
  $$ SELECT public.taskos_invoke('taskos-run-briefings', '{}'::jsonb); $$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'taskos-run-briefings');

SELECT cron.schedule('taskos-inbox-sweep', '*/10 * * * *',
  $$ SELECT public.taskos_invoke('taskos-process-inbox', '{"mode":"sweep"}'::jsonb); $$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'taskos-inbox-sweep');
