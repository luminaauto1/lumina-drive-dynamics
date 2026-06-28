-- ============================================================================
-- Editable destination-tab (lane) routing for FINANCE statuses.
-- Additive, idempotent, RLS-safe. NULL lane => EXACT current behaviour.
--
-- • status_overrides gains a `lane` text column: the chosen Pipeline v2 tab id a
--   FINANCE status slug should route/count an application into. When NULL (or not
--   a real PIPELINE_TABS id), the app code falls back to the hardcoded slug→lane
--   map in src/lib/pipelinev2/tabs.ts (statusToTab) — so an empty override is
--   indistinguishable from today's behaviour and the change is fully reversible.
-- • This ONLY affects which tab an application is shown/counted in. It does NOT
--   change the finance status value itself, slugs, notify-*/easysocial dispatch,
--   role filters, or the client-status track. Client rows ignore `lane`.
-- RLS: status_overrides policies are table-wide; the new column inherits them.
--   No policy changes needed.
-- ============================================================================

ALTER TABLE public.status_overrides
  ADD COLUMN IF NOT EXISTS lane text;

COMMENT ON COLUMN public.status_overrides.lane IS
  'Optional Pipeline v2 destination tab id for a FINANCE status slug (resolveStatusTab override). NULL or unknown id => fall back to the hardcoded slug→lane map (statusToTab). Affects bucketing/counting only; never changes the status value, dispatch, slugs, or the client track.';
