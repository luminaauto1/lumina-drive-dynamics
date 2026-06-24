-- Schedule the morning pre-approval doc-chase digest. Runs every 15 min; the edge
-- function itself fires only when a linked user's LOCAL clock is at 09:00 (override via
-- settings.preapproval_hour) and dedupes per day via taskos_briefings. Idempotent.
SELECT cron.schedule('taskos-preapproval-digest', '*/15 * * * *',
  $$ SELECT public.taskos_invoke('taskos-preapproval-digest', '{}'::jsonb); $$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'taskos-preapproval-digest');
