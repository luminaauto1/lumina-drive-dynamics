-- TaskOS Goal/Deadline engine (Phase 1) — AI-suggested sub-tasks awaiting the
-- user's Telegram confirmation. When a deadline-goal is captured, the decompose
-- engine generates the typical steps and DMs one ✅ Add / ⏭ Skip question per step.
-- Each pending suggestion lives here until the user taps a button.
CREATE TABLE IF NOT EXISTS public.taskos_goal_suggestions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id             uuid NOT NULL REFERENCES public.taskos_entities(id) ON DELETE CASCADE,
  title               text NOT NULL,
  body                text,
  suggested_due_at    timestamptz,
  status              text NOT NULL DEFAULT 'pending',     -- pending | added | skipped
  task_id             uuid REFERENCES public.taskos_tasks(id) ON DELETE SET NULL,
  telegram_message_id bigint,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_taskos_goal_suggestions_user   ON public.taskos_goal_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_taskos_goal_suggestions_goal   ON public.taskos_goal_suggestions(goal_id);

ALTER TABLE public.taskos_goal_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskos_goal_suggestions FORCE ROW LEVEL SECURITY;

-- Table privileges are checked BEFORE RLS, so the owner-read policy needs an explicit
-- GRANT to authenticated (matches every other taskos table). anon gets nothing.
REVOKE ALL ON public.taskos_goal_suggestions FROM anon;
GRANT SELECT ON public.taskos_goal_suggestions TO authenticated;

-- Writes are service-role only (edge functions bypass RLS). Owner (staff only) may
-- READ their own suggestions — for a future in-app Goals surface. Staff guard matches
-- the rest of TaskOS (internal staff-only second brain).
DROP POLICY IF EXISTS taskos_goal_suggestions_owner_select ON public.taskos_goal_suggestions;
CREATE POLICY taskos_goal_suggestions_owner_select
  ON public.taskos_goal_suggestions FOR SELECT
  USING (user_id = auth.uid() AND public.is_staff(auth.uid()));
