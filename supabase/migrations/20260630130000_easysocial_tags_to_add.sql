-- ============================================================================
-- EasySocial multi tag-to-ADD (additive, idempotent, RLS-safe).
-- Lets a status configure MULTIPLE EasySocial tags to ADD on apply (a multi-select),
-- superseding the single easysocial_tag_to_add NAME when non-empty. Stores tag
-- NAMES (consistent with the existing single add being a NAME, resolved to ids
-- server-side via the tag dictionary). Default '{}' => an unconfigured status
-- behaves EXACTLY as today: the edge fn falls back to the single override / the
-- hardcoded plan. status_overrides RLS (so_select staff-read / so_write admin-write)
-- is table-wide; the new column inherits it. No policy change.
--
-- Read server-side by easysocial-tag-sync (via resolveStatusApplyConfig). The names
-- still flow through resolveIds + the intersection + SAFE_TAG_NAMES filters — the
-- multi-add can only ever augment the add set, never bypass the safety filters.
-- ============================================================================

ALTER TABLE public.status_overrides
  ADD COLUMN IF NOT EXISTS easysocial_tags_to_add text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.status_overrides.easysocial_tags_to_add IS
  'EasySocial multi tag-to-ADD: list of tag NAMES added on apply (resolved to ids via the EasySocial tag dictionary). When non-empty this SUPERSEDES the single easysocial_tag_to_add override; when empty (default) the edge fn falls back to the single override / hardcoded plan (current behaviour). Names flow through the same resolveIds + intersection + SAFE_TAG_NAMES filters, so multi-add can only augment the add set, never bypass safety.';
