-- status_overrides.sla_hours — catch-up migration for a column that only ever
-- existed in production.
--
-- The column is live on the hosted DB and both read and written by the app
-- (useZtcSettings.ts selects it in the status_overrides column list;
-- StatusEditModal writes it for finance statuses), but it was applied directly
-- and never committed as a migration. Nothing is wrong in production — the risk
-- is a fresh environment rebuilt from supabase/migrations/, where the column
-- would be absent and PostgREST would reject the whole select with a 400,
-- blanking the entire Settings → Statuses tab rather than just the SLA field.
--
-- Idempotent and a no-op against the current production schema.

ALTER TABLE public.status_overrides
  ADD COLUMN IF NOT EXISTS sla_hours integer;

COMMENT ON COLUMN public.status_overrides.sla_hours IS
  'Per-status SLA in hours (finance track only). NULL = use the built-in default from src/lib/finance/sla.ts.';
