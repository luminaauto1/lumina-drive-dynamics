-- Per-finance-status "clear the client status" option.
--
-- Owner 2026-07-23: when a lead is moved into certain finance statuses, the
-- day-to-day client status (No Answer / Actioned / …) should reset to nothing so
-- the new stage starts clean. Toggled per finance status in Settings → Statuses.
--
-- Enforced by a BEFORE-UPDATE trigger rather than in each status-change UI, so it
-- holds for EVERY path that changes the finance status (Pipeline modal, Finance
-- page, bulk, Deal Room, edge functions) — one data-layer invariant, impossible
-- to miss. Additive + default-off: no lead is affected until a status opts in.

ALTER TABLE public.status_overrides
  ADD COLUMN IF NOT EXISTS clear_client_status boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.status_overrides.clear_client_status IS
  'FINANCE track: when a lead is moved into this finance status, its client_status is reset to NULL (Settings → Statuses toggle). Default false.';

-- SECURITY DEFINER so the status_overrides config lookup is never blocked by the
-- invoker's RLS (the flag is config, not user data). search_path pinned.
CREATE OR REPLACE FUNCTION public.clear_client_status_on_finance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only when the NEW finance status is flagged, and there is a client status to
  -- clear. Fires under a WHEN (status changed) guard, so this is a cheap PK lookup
  -- on the rows that actually move.
  IF NEW.client_status IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.status_overrides o
       WHERE o.slug = NEW.status AND o.clear_client_status
     ) THEN
    NEW.client_status := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clear_client_status_on_finance_change ON public.finance_applications;
-- Name sorts before stamp_client_status_change, so the client-status stamp trigger
-- then sees the NULL and stamps client_status_updated_at — harmless (no timer on a
-- null client status). Both orderings are safe.
CREATE TRIGGER clear_client_status_on_finance_change
  BEFORE UPDATE ON public.finance_applications
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.clear_client_status_on_finance_change();
