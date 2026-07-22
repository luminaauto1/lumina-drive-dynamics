-- Per-user override of which finance statuses a staff member may SELECT.
-- NULL (or empty) = fall back to the role default in lib/roleStatusFilter.
-- Lives beside the existing per-user visibility/archive rules so Settings →
-- Team & Permissions has one row per user to manage.
ALTER TABLE public.app_visibility_rules
  ADD COLUMN IF NOT EXISTS allowed_statuses text[];

COMMENT ON COLUMN public.app_visibility_rules.allowed_statuses IS
  'Finance status keys this user may set. NULL/empty = role default.';
