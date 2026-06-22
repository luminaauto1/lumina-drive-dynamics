-- ============================================================================
-- TaskOS "cognitive layer" — ADDITIVE. Durable learned insights + foresight, plus
-- goal-health tracking columns on entities. Nothing existing is altered.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.taskos_insights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  kind         text NOT NULL,                       -- foresight | goal_health | pattern | reflection | anomaly | suggestion
  title        text NOT NULL,
  body         text,
  severity     smallint NOT NULL DEFAULT 2,         -- 1 info · 2 normal · 3 high · 4 critical
  data         jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_ids  uuid[] NOT NULL DEFAULT '{}',
  for_date     date,
  status       text NOT NULL DEFAULT 'active',      -- active | dismissed | expired
  surfaced_at  timestamptz,
  dismissed_at timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.taskos_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_select ON public.taskos_insights;
DROP POLICY IF EXISTS owner_insert ON public.taskos_insights;
DROP POLICY IF EXISTS owner_update ON public.taskos_insights;
DROP POLICY IF EXISTS owner_delete ON public.taskos_insights;
CREATE POLICY owner_select ON public.taskos_insights FOR SELECT TO authenticated USING ((user_id = auth.uid()) AND is_staff(auth.uid()));
CREATE POLICY owner_insert ON public.taskos_insights FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) AND is_staff(auth.uid()));
CREATE POLICY owner_update ON public.taskos_insights FOR UPDATE TO authenticated USING ((user_id = auth.uid()) AND is_staff(auth.uid())) WITH CHECK ((user_id = auth.uid()) AND is_staff(auth.uid()));
CREATE POLICY owner_delete ON public.taskos_insights FOR DELETE TO authenticated USING ((user_id = auth.uid()) AND is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS taskos_insights_user_status_idx ON public.taskos_insights (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS taskos_insights_user_kind_date_idx ON public.taskos_insights (user_id, kind, for_date);

-- Goal/project health tracking (additive, nullable; used only for goal/project entities).
ALTER TABLE public.taskos_entities ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;
ALTER TABLE public.taskos_entities ADD COLUMN IF NOT EXISTS health_score     smallint;
ALTER TABLE public.taskos_entities ADD COLUMN IF NOT EXISTS health_meta      jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Per-task snooze counter (set by the reschedule path; used by priority + reflection).
ALTER TABLE public.taskos_tasks ADD COLUMN IF NOT EXISTS snooze_count smallint NOT NULL DEFAULT 0;
