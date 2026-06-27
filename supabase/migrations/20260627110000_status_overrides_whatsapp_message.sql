-- ============================================================================
-- Phase 5: editable WhatsApp message body per status.
-- Additive + fallback-safe: NULL/blank whatsapp_message => the built-in
-- getWhatsAppMessage() text is used, so empty column = current behaviour.
-- SLUGS STAY FIXED — this only adds an overridable message body alongside the
-- already-overridable label / colour / order / visibility.
-- ============================================================================

ALTER TABLE public.status_overrides
  ADD COLUMN IF NOT EXISTS whatsapp_message text;

COMMENT ON COLUMN public.status_overrides.whatsapp_message IS
  'Optional editable WhatsApp deep-link message body for this status. Supports {name} / {{clientName}} placeholders. Blank => built-in default in getWhatsAppMessage().';
