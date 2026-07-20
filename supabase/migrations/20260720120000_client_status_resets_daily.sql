-- ============================================================================
-- Client statuses: per-status "clear overnight" flag (owner, 2026-07-20)
-- ============================================================================
-- The `client-status-daily-reset` cron job (jobid 8, 22:00 UTC = midnight SAST)
-- nulled EVERY finance_applications.client_status each night. That is right for
-- day-to-day working statuses ("No Answer", "Actioned") but wrong for milestones
-- ("Validations Submitted", "Contract Signed") — those vanished overnight too.
--
-- This makes the reset opt-in PER STATUS, editable in Settings → Statuses:
--   status_overrides.resets_daily = true  -> cleared at midnight
--   status_overrides.resets_daily = false -> stays until someone changes it
--
-- Additive + idempotent. Default false, then the two working statuses the owner
-- named are switched on, so tonight's run clears exactly those and nothing else.
-- The status_overrides RLS (staff read / admin write) covers the new column.

ALTER TABLE public.status_overrides
  ADD COLUMN IF NOT EXISTS resets_daily boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.status_overrides.resets_daily IS
  'CLIENT track only: when true, the client-status-daily-reset cron job clears this status off applications at midnight SAST. Day-to-day working statuses (No Answer, Actioned) are true; milestones (Validations Submitted, Contract Signed) stay false so they persist. Toggled per status in Settings -> Statuses.';

-- Seed the owner-specified working statuses (idempotent; only these two).
UPDATE public.status_overrides
   SET resets_daily = true
 WHERE status_type = 'client'
   AND slug IN ('client_no_answer', 'client_actioned');

-- Rewrite the cron job to honour the flag. Looked up by NAME (not the hardcoded
-- jobid) so this stays correct if the job is ever recreated. A client_status
-- with no matching status_overrides row (e.g. a deleted status) is deliberately
-- LEFT ALONE rather than silently wiped.
DO $mig$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'client-status-daily-reset';

  IF v_jobid IS NULL THEN
    RAISE NOTICE 'client-status-daily-reset job not found — nothing to alter.';
    RETURN;
  END IF;

  PERFORM cron.alter_job(
    v_jobid,
    command => $cmd$
      UPDATE public.finance_applications fa
         SET client_status = NULL
       WHERE fa.client_status IS NOT NULL
         AND EXISTS (
           SELECT 1
             FROM public.status_overrides so
            WHERE so.slug = fa.client_status
              AND so.status_type = 'client'
              AND so.resets_daily
         );
    $cmd$
  );

  RAISE NOTICE 'client-status-daily-reset now clears only statuses flagged resets_daily.';
END
$mig$;
