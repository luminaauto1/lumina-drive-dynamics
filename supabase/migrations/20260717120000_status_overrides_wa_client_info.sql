-- ============================================================================
-- WhatsApp To Client Info — per-status message box (additive, idempotent, RLS-safe).
-- Empty/defaulted columns => current behaviour preserved.
--
-- Adds an OPT-IN per-status behaviour: when wa_client_info_enabled, the
-- status-change UIs show a dedicated "WhatsApp To Client Info" textarea (distinct
-- from the comment gate). The typed text is (a) logged as an internal pipeline
-- note, and (b) available as the 'wa_client_info' WhatsApp BodySource so a
-- config-driven curated template can inject it at send time (wa-status-send).
--
-- • wa_client_info_enabled  — shows the box when a status is applied.
-- • wa_client_info_required — blocks Apply until the box is filled (UI-enforced).
-- • wa_client_info_prompt   — optional label shown above the box (the box carries
--                             its own label, so this is never hard-required).
-- These are UI/dispatch-input columns only; no notify-* / easysocial contract
-- keys off them. status_overrides RLS (so_select staff-read / so_write admin-write)
-- is table-wide; the new columns inherit it. No policy change.
-- ============================================================================

ALTER TABLE public.status_overrides
  ADD COLUMN IF NOT EXISTS wa_client_info_enabled  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_client_info_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_client_info_prompt   text;

COMMENT ON COLUMN public.status_overrides.wa_client_info_enabled IS
  'When true, the status-change UI shows a dedicated "WhatsApp To Client Info" box on apply. The text is logged as a pipeline note and passed to wa-status-send as the wa_client_info BodySource.';
COMMENT ON COLUMN public.status_overrides.wa_client_info_required IS
  'When true, the status-change UI blocks Apply until the WhatsApp To Client Info box is filled. Enforced in UI modals only.';
COMMENT ON COLUMN public.status_overrides.wa_client_info_prompt IS
  'Optional label shown above the WhatsApp To Client Info box. Blank => a generic placeholder. Never hard-required even when wa_client_info_required (the box carries its own label).';
