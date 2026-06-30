-- ============================================================================
-- ZTC-parity status-apply config (additive, idempotent, RLS-safe).
-- Every column is nullable / 'none'-defaulted / '{}'-defaulted => an unconfigured
-- status behaves EXACTLY as today. status_overrides RLS (so_select staff-read /
-- so_write admin-write) is table-wide; new columns inherit it. No policy change.
--
-- These columns drive two opt-in, config-only behaviours layered ON TOP of the
-- existing (unchanged) easysocial-tag-sync state machine and notify-* dispatch:
--   (a) EasySocial CRM — config-driven tag REMOVE + lead client_status write.
--   (b) WhatsApp auto-send — link a curated whatsapp_templates row + body sources.
-- Empty config => no new wire payload, no new send. See the matching edge
-- functions (easysocial-tag-sync extended; new wa-status-send) for the read path.
-- ============================================================================

ALTER TABLE public.status_overrides
  -- (a) EasySocial CRM ---------------------------------------------------------
  -- tag-to-ADD already exists (easysocial_tag_to_add). Add REMOVE + client_status.
  ADD COLUMN IF NOT EXISTS easysocial_client_status text,
  ADD COLUMN IF NOT EXISTS tag_remove_mode          text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS easysocial_tags_to_remove text[] NOT NULL DEFAULT '{}',
  -- (b) WhatsApp auto-send ------------------------------------------------------
  -- Link to a curated whatsapp_templates row (its send_url is the credential).
  ADD COLUMN IF NOT EXISTS whatsapp_template_key text,
  ADD COLUMN IF NOT EXISTS wa_body1_source       text,
  ADD COLUMN IF NOT EXISTS wa_body2_source       text,
  ADD COLUMN IF NOT EXISTS wa_body3_source       text;

-- Guard the remove-mode enum (idempotent re-add).
ALTER TABLE public.status_overrides
  DROP CONSTRAINT IF EXISTS status_overrides_tag_remove_mode_chk;
ALTER TABLE public.status_overrides
  ADD CONSTRAINT status_overrides_tag_remove_mode_chk
  CHECK (tag_remove_mode IN ('none','specific','all_except'));

COMMENT ON COLUMN public.status_overrides.easysocial_client_status IS
  'ZTC-parity: text written to the EasySocial lead''s client_status (lead_data.client_status) on apply. NULL => not written. Gated server-side by the client_status kill-switch (integration_settings.config.easysocial_client_status_enabled, default OFF) until canary-verified.';
COMMENT ON COLUMN public.status_overrides.tag_remove_mode IS
  'ZTC-parity remove MODE: none (default, remove nothing config-driven) | specific (remove the listed tags) | all_except (remove everything EXCEPT the listed keep-set + tag-to-add). The existing intersection + SAFE_TAG_NAMES filters always run last, so config can never remove a protected tag.';
COMMENT ON COLUMN public.status_overrides.easysocial_tags_to_remove IS
  'ZTC-parity tag-id list, interpreted per tag_remove_mode (specific=remove these; all_except=KEEP these). EasySocial integer tag ids stored as text[].';
COMMENT ON COLUMN public.status_overrides.whatsapp_template_key IS
  'ZTC-parity: FK-by-convention to whatsapp_templates.key. When set AND that row has send_url, the template auto-sends on apply via wa-status-send. NULL/blank => no auto-send (current behaviour). The 5 notify-* owned slugs are excluded from auto-send to prevent double messaging.';
COMMENT ON COLUMN public.status_overrides.wa_body1_source IS
  'ZTC BodySource for {body1}: full_name|first_name|comment|vehicle|email|phone|bank|static:<literal>|none. NULL/none => param omitted.';
COMMENT ON COLUMN public.status_overrides.wa_body2_source IS 'See wa_body1_source.';
COMMENT ON COLUMN public.status_overrides.wa_body3_source IS 'See wa_body1_source.';
