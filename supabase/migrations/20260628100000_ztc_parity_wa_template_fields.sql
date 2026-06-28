-- ============================================================================
-- ZTC-parity WhatsApp template fields (additive, idempotent, RLS-safe).
--
-- Upgrades public.whatsapp_templates from on/off-gate notes into ZTC's curated-
-- template model: an EasySocial send URL, body1/2/3 source mappings, a preview
-- string, and a sort order. Pure ADD COLUMN IF NOT EXISTS — nothing existing is
-- altered.
--
-- DOES NOT alter key/title/body/active:
--   • notify-* functions gate on/off by selecting `active` where key=eq.<...>
--     (e.g. notify-app-submitted) — untouched.
--   • the EasySocial hosted-send path (campaign token + numeric template/lang IDs
--     baked into each notify-* function) is untouched.
--   • `body` remains the human-facing reference note.
--
-- SECURITY: send_url is NOT seeded here. The production send URLs contain a
-- campaign token and whatsapp_templates is staff-readable, so existing rows keep
-- send_url = NULL. The owner pastes a URL per template (from the matching
-- notify-* function) only when they want Test-send for that template.
--
-- RLS: whatsapp_templates policies (wt_select staff-read / wt_write admin-write)
-- are table-wide; the new columns inherit them. No policy change needed.
-- ============================================================================

ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS send_url      text,
  ADD COLUMN IF NOT EXISTS body1_source  text,
  ADD COLUMN IF NOT EXISTS body2_source  text,
  ADD COLUMN IF NOT EXISTS body3_source  text,
  ADD COLUMN IF NOT EXISTS preview_text  text,
  ADD COLUMN IF NOT EXISTS sort_order    integer NOT NULL DEFAULT 100;

COMMENT ON COLUMN public.whatsapp_templates.send_url IS
  'EasySocial hosted-send URL (campaign token + numeric template/lang IDs). The URL is the credential — no auth header. NULL = Test-send disabled for this template. NOT seeded by migration (staff-readable table); owner pastes per template.';
COMMENT ON COLUMN public.whatsapp_templates.body1_source IS
  'ZTC-parity body-var mapping: which source field fills {body1} in the template (e.g. applicant_full_name, vehicle, dealership_name, none). Curated note only — notify-* dispatch is unaffected.';
COMMENT ON COLUMN public.whatsapp_templates.body2_source IS
  'ZTC-parity body-var mapping for {body2}. See body1_source.';
COMMENT ON COLUMN public.whatsapp_templates.body3_source IS
  'ZTC-parity body-var mapping for {body3}. See body1_source.';
COMMENT ON COLUMN public.whatsapp_templates.preview_text IS
  'Rendered preview of the message wording for the admin UI (with body vars shown inline). Reference only.';
COMMENT ON COLUMN public.whatsapp_templates.sort_order IS
  'Display order of templates in the Settings editor (ascending). Default 100.';
