-- LuminaTaskOS P2-P4: spend log, reminders, briefings log, knowledge graph

-- P2: AI spend log (per user) for cost caps + observability
CREATE TABLE IF NOT EXISTS public.taskos_ai_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          text NOT NULL,                 -- classify | query | briefing | weekly_review
  model         text NOT NULL,
  input_tokens  integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd      double precision NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS taskos_ai_runs_user_day_idx ON public.taskos_ai_runs (user_id, created_at DESC);

-- P3: reminder/escalation fields on tasks + entities
ALTER TABLE public.taskos_tasks
  ADD COLUMN IF NOT EXISTS remind_at        timestamptz,
  ADD COLUMN IF NOT EXISTS notified_at      timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_level smallint NOT NULL DEFAULT 0;
ALTER TABLE public.taskos_entities
  ADD COLUMN IF NOT EXISTS remind_at        timestamptz,
  ADD COLUMN IF NOT EXISTS notified_at      timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_level smallint NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS taskos_tasks_remind_idx ON public.taskos_tasks (remind_at)
  WHERE remind_at IS NOT NULL AND status NOT IN ('done','cancelled');
CREATE INDEX IF NOT EXISTS taskos_entities_remind_idx ON public.taskos_entities (remind_at)
  WHERE remind_at IS NOT NULL;

-- P3: daily briefing log (dedupe per user/day)
CREATE TABLE IF NOT EXISTS public.taskos_briefings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          text NOT NULL DEFAULT 'daily',  -- daily | weekly
  for_date      date NOT NULL,
  body          text,
  sent_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS taskos_briefings_uq ON public.taskos_briefings (user_id, kind, for_date);

-- P4: knowledge-graph edges (entity <-> entity, same user)
CREATE TABLE IF NOT EXISTS public.taskos_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_kind   text NOT NULL,    -- 'task' | 'entity'
  from_id     uuid NOT NULL,
  to_kind     text NOT NULL,
  to_id       uuid NOT NULL,
  relation    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS taskos_links_uq ON public.taskos_links (user_id, from_id, to_id, relation);
CREATE INDEX IF NOT EXISTS taskos_links_from_idx ON public.taskos_links (user_id, from_id);
CREATE INDEX IF NOT EXISTS taskos_links_to_idx ON public.taskos_links (user_id, to_id);

-- RLS + grants for the new client-facing tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['taskos_ai_runs','taskos_briefings','taskos_links'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner_select" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "owner_select" ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.is_staff(auth.uid()));', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated;', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
  END LOOP;
END $$;
-- taskos_links also needs owner write (created from the panel later); ai_runs/briefings are service-write only.
DROP POLICY IF EXISTS "owner_insert" ON public.taskos_links;
CREATE POLICY "owner_insert" ON public.taskos_links FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "owner_delete" ON public.taskos_links;
CREATE POLICY "owner_delete" ON public.taskos_links FOR DELETE TO authenticated USING (user_id = auth.uid() AND public.is_staff(auth.uid()));
GRANT INSERT, DELETE ON public.taskos_links TO authenticated;

NOTIFY pgrst, 'reload schema';
