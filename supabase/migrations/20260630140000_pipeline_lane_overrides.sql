-- ============================================================================
-- Editable Pipeline v2 LANE presentation overrides (label + colour).
-- Additive, idempotent, RLS-safe. Empty table => EXACT current behaviour.
--
-- • pipeline_lane_overrides: one row per Pipeline v2 lane id (PIPELINE_TABS.key,
--   e.g. 'intake', 'submitted', …). Lets a super-admin RENAME a lane tab and
--   RECOLOUR its active underline/count chip. Only PRESENTATION is overridable:
--     - label text  — the tab caption shown in the Pipeline v2 tab bar.
--     - color text  — a HEX string (e.g. '#3b82f6') applied via inline style to
--                     the active underline + count chip. Stored as hex (not a
--                     Tailwind class) so the JIT can never purge a dynamic class.
--   The per-lane status routing (statuses[]) is HARDCODED in app code and is NOT
--   represented here — users can never break which applications land in a lane.
-- • When a lane has no row (or NULL label/color), the app falls back to the
--   hardcoded PIPELINE_TABS default (label + `accent` Tailwind class). So an
--   empty/missing override is byte-for-byte indistinguishable from today and the
--   feature is fully reversible.
--
-- RLS mirrors status_overrides EXACTLY:
--   • SELECT — all staff (is_staff): every admin's Pipeline view applies overrides.
--   • WRITE  — admin role only (has_role(...,'admin')): the settings editor gate.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pipeline_lane_overrides (
  lane_key   text PRIMARY KEY,
  label      text,
  color      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pipeline_lane_overrides IS
  'Per-lane PRESENTATION overrides for Pipeline v2 tabs (PIPELINE_TABS.key). label = tab caption; color = hex applied to the active underline/count. NULL/missing => fall back to the hardcoded PIPELINE_TABS default. Routing (statuses[]) is hardcoded in app code and never stored here.';
COMMENT ON COLUMN public.pipeline_lane_overrides.lane_key IS
  'PIPELINE_TABS.key this row overrides (all/intake/submitted/approved/validations/delivered/declined/closed).';
COMMENT ON COLUMN public.pipeline_lane_overrides.label IS
  'Override tab caption. NULL => use the hardcoded PIPELINE_TABS label.';
COMMENT ON COLUMN public.pipeline_lane_overrides.color IS
  'Override accent colour as a HEX string (e.g. #3b82f6), applied via inline style. NULL => use the hardcoded PIPELINE_TABS `accent` Tailwind class.';

ALTER TABLE public.pipeline_lane_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plo_select ON public.pipeline_lane_overrides;
DROP POLICY IF EXISTS plo_write  ON public.pipeline_lane_overrides;
CREATE POLICY plo_select ON public.pipeline_lane_overrides FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY plo_write  ON public.pipeline_lane_overrides FOR ALL    TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
