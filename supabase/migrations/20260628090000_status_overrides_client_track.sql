-- ============================================================================
-- Client-status track + comment-required + richer status rules.
-- Additive, idempotent, RLS-safe. Empty/defaulted columns => current behaviour.
--
-- • status_overrides gains a status_type discriminator ('finance' | 'client').
--   Existing rows default to 'finance' so all current presentation overrides are
--   untouched. Client-track statuses are NEW rows (status_type='client') with
--   admin-defined slugs (namespaced 'client_*' by the editor) — they can never
--   collide with the fixed finance slugs and are never read by notify-* /
--   easysocial-tag-sync / the auto-mailer (those key off finance status only).
-- • comment_required / comment_prompt drive the UI comment gate (enforced in the
--   modals, NOT in any dispatch hook).
-- • is_internal is stored only (not yet wired to skip notifications).
-- • easysocial_tag_to_add stores the per-status tag; the editor mirrors it into
--   integration_settings.config.tag_add_overrides (the live integration path).
-- • finance_applications.client_status holds an app's current client status.
--   Nullable, no default, no FK => existing rows = NULL => badge renders '—'.
-- RLS: status_overrides + finance_applications policies are table-wide; new
--   columns inherit them. No policy changes needed.
-- ============================================================================

ALTER TABLE public.status_overrides
  ADD COLUMN IF NOT EXISTS status_type           text    NOT NULL DEFAULT 'finance',
  ADD COLUMN IF NOT EXISTS comment_required      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comment_prompt        text,
  ADD COLUMN IF NOT EXISTS is_internal           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS easysocial_tag_to_add text;

-- Guard the discriminator to the two known tracks (idempotent re-add).
ALTER TABLE public.status_overrides
  DROP CONSTRAINT IF EXISTS status_overrides_status_type_chk;
ALTER TABLE public.status_overrides
  ADD CONSTRAINT status_overrides_status_type_chk
  CHECK (status_type IN ('finance','client'));

COMMENT ON COLUMN public.status_overrides.status_type IS
  'Track discriminator: ''finance'' (fixed built-in slugs, presentation+rules editable) or ''client'' (admin CRUD, free-form slug, never moves pipeline lanes).';
COMMENT ON COLUMN public.status_overrides.comment_required IS
  'When true, the status-change UI blocks Apply until a comment is entered. Enforced in UI modals only.';
COMMENT ON COLUMN public.status_overrides.comment_prompt IS
  'Label shown above the comment box when comment_required. Blank => generic label.';
COMMENT ON COLUMN public.status_overrides.is_internal IS
  'Store-only flag (not yet active). Intended to mark internal statuses that would skip WhatsApp/EasySocial.';
COMMENT ON COLUMN public.status_overrides.easysocial_tag_to_add IS
  'Per-status EasySocial tag-to-add. Editor mirrors this into integration_settings.config.tag_add_overrides.';

ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS client_status text;

COMMENT ON COLUMN public.finance_applications.client_status IS
  'Customizable client-facing status track (status_overrides rows, status_type=''client''). Independent of finance status; never triggers notify-*/easysocial/auto-mailer; does not move pipeline lanes.';
