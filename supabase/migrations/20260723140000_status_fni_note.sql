-- Per-status "F&I notes" box.
--
-- A third, separately-toggled comment box alongside the existing comment gate and
-- the "WhatsApp To Client Info" box (owner 2026-07-23): when a status has this
-- enabled, the status-change UIs prompt the F&I for an extra internal note (e.g.
-- "deposit needed") which is saved like any other note. Mirrors the wa_client_info
-- columns; all additive and default-off, so behaviour is unchanged until a status
-- opts in.

ALTER TABLE public.status_overrides
  ADD COLUMN IF NOT EXISTS fni_note_enabled  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fni_note_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fni_note_prompt   text;

COMMENT ON COLUMN public.status_overrides.fni_note_enabled IS
  'When true, the status-change UIs show a dedicated "F&I notes" box for this status (both tracks). The text is saved as an fni_note pipeline note.';
COMMENT ON COLUMN public.status_overrides.fni_note_required IS
  'When true (and fni_note_enabled), the status cannot be saved until the F&I note box is filled.';
COMMENT ON COLUMN public.status_overrides.fni_note_prompt IS
  'Optional label shown above the F&I notes box (NULL => a generic default).';
