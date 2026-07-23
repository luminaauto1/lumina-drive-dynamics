-- Pipeline "time in status" timer.
--
-- Two additions, both additive and behaviour-preserving:
--
-- 1. status_overrides.show_timer — per-status opt-in (both tracks). When true, the
--    Pipeline shows a coloured timer counting how long the lead has sat in that
--    status. Default false = no timer (today's behaviour). Admin toggles it per
--    status in Settings → Statuses.
--
-- 2. finance_applications.client_status_updated_at — the client-status equivalent
--    of the existing status_updated_at (which the stamp_status_change trigger keeps
--    for the FINANCE status). Needed because a client status can also drive the
--    timer (owner rule 2026-07-23: client status wins, else finance). Stamped by a
--    new trigger whenever client_status actually changes, and backfilled from the
--    most recent 'client_status_set' pipeline note (else updated_at) so existing
--    leads show a sensible age immediately.

ALTER TABLE public.status_overrides
  ADD COLUMN IF NOT EXISTS show_timer boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.status_overrides.show_timer IS
  'When true, the Pipeline shows a time-in-status timer for leads currently in this status (finance or client track). Default false.';

ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS client_status_updated_at timestamptz;

COMMENT ON COLUMN public.finance_applications.client_status_updated_at IS
  'When client_status last changed (stamped by stamp_client_status_change). Client-track equivalent of status_updated_at; drives the Pipeline timer.';

-- Stamp client_status_updated_at on every real client_status change (NULL→value,
-- value→value, value→NULL). Mirrors stamp_status_change for the finance status.
-- SECURITY DEFINER-free: it only writes a NEW column value in a BEFORE trigger.
CREATE OR REPLACE FUNCTION public.stamp_client_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.client_status_updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_client_status_change ON public.finance_applications;
CREATE TRIGGER stamp_client_status_change
  BEFORE UPDATE ON public.finance_applications
  FOR EACH ROW
  WHEN (NEW.client_status IS DISTINCT FROM OLD.client_status)
  EXECUTE FUNCTION public.stamp_client_status_change();

-- Backfill: for leads that currently have a client_status, seed the timestamp from
-- the most recent 'client_status_set' auto-note (the exact moment it was set); fall
-- back to updated_at where no such note exists (pre-2026-07-17 sets).
UPDATE public.finance_applications fa
SET client_status_updated_at = COALESCE(
  (SELECT max((n->>'created_at')::timestamptz)
     FROM jsonb_array_elements(
       CASE WHEN jsonb_typeof(fa.pipeline_notes) = 'array' THEN fa.pipeline_notes ELSE '[]'::jsonb END
     ) n
     WHERE n->>'category' = 'client_status_set'),
  fa.updated_at
)
WHERE fa.client_status IS NOT NULL
  AND fa.client_status_updated_at IS NULL;
