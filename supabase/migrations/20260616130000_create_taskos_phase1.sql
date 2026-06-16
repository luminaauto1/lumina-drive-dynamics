-- ============================================================================
-- LuminaTaskOS — Phase 1 foundation. Internal staff-only second brain.
-- STRICT per-user isolation: every table carries user_id (FK auth.users) and
-- RLS limits ALL authenticated access to user_id = auth.uid() AND is_staff().
-- Service-role edge functions BYPASS RLS and MUST set/filter user_id in code.
-- NO pgvector in Phase 1 — FTS only (tsvector). Embeddings = a later phase.
-- ============================================================================

-- ---------- 1. Enums ----------
DO $$ BEGIN
  CREATE TYPE public.taskos_inbox_source AS ENUM
    ('telegram','panel','web','voice','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.taskos_inbox_status AS ENUM
    ('pending','processing','processed','needs_review','failed','ignored');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.taskos_entity_kind AS ENUM
    ('note','memory','idea','opportunity','decision','risk',
     'reference','journal','contact','reminder','goal','project',
     'person','event','meeting','deadline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.taskos_task_status AS ENUM
    ('todo','in_progress','blocked','waiting','done','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 2. PER-USER SETTINGS ----------
CREATE TABLE IF NOT EXISTS public.taskos_user_settings (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone          text NOT NULL DEFAULT 'Africa/Johannesburg',
  briefing_hour     smallint NOT NULL DEFAULT 7 CHECK (briefing_hour BETWEEN 0 AND 23),
  auto_classify     boolean NOT NULL DEFAULT true,
  settings          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------- 3. INBOX (the single front door; nothing bypasses it) ----------
CREATE TABLE IF NOT EXISTS public.taskos_inbox_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source        public.taskos_inbox_source NOT NULL DEFAULT 'telegram',
  raw_text      text,
  media_kind    text NOT NULL DEFAULT 'text',
  media_ref     text,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        public.taskos_inbox_status NOT NULL DEFAULT 'pending',
  ai_result     jsonb,
  error_text    text,
  error_count   smallint NOT NULL DEFAULT 0,
  external_id   text,
  claimed_at    timestamptz,
  processed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS taskos_inbox_user_status_idx
  ON public.taskos_inbox_items (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS taskos_inbox_pending_idx
  ON public.taskos_inbox_items (created_at) WHERE status IN ('pending','failed');
CREATE UNIQUE INDEX IF NOT EXISTS taskos_inbox_external_uq
  ON public.taskos_inbox_items (user_id, external_id) WHERE external_id IS NOT NULL;

-- ---------- 4. TASKS (the only promoted entity in Phase 1) ----------
CREATE TABLE IF NOT EXISTS public.taskos_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  status          public.taskos_task_status NOT NULL DEFAULT 'todo',
  due_at          timestamptz,
  start_at        timestamptz,
  urgency         smallint NOT NULL DEFAULT 3 CHECK (urgency    BETWEEN 1 AND 5),
  importance      smallint NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  priority_score  double precision NOT NULL DEFAULT 0,
  priority_meta   jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority_locked boolean NOT NULL DEFAULT false,
  last_progress_at timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  tags            text[] NOT NULL DEFAULT '{}',
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_inbox_id uuid REFERENCES public.taskos_inbox_items(id) ON DELETE SET NULL,
  fts             tsvector GENERATED ALWAYS AS
                    (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS taskos_tasks_user_priority_idx
  ON public.taskos_tasks (user_id, priority_score DESC)
  WHERE status NOT IN ('done','cancelled');
CREATE INDEX IF NOT EXISTS taskos_tasks_user_due_idx
  ON public.taskos_tasks (user_id, due_at)
  WHERE status NOT IN ('done','cancelled');
CREATE INDEX IF NOT EXISTS taskos_tasks_fts_idx
  ON public.taskos_tasks USING gin (fts);

-- ---------- 5. ENTITIES (flexible store for every non-task kind) ----------
CREATE TABLE IF NOT EXISTS public.taskos_entities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind            public.taskos_entity_kind NOT NULL,
  title           text,
  body            text NOT NULL DEFAULT '',
  attributes      jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     timestamptz,
  due_at          timestamptz,
  importance      smallint NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  tags            text[] NOT NULL DEFAULT '{}',
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_inbox_id uuid REFERENCES public.taskos_inbox_items(id) ON DELETE SET NULL,
  fts             tsvector GENERATED ALWAYS AS
                    (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))) STORED,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS taskos_entities_user_kind_idx
  ON public.taskos_entities (user_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS taskos_entities_fts_idx
  ON public.taskos_entities USING gin (fts);

-- ---------- 6. TELEGRAM LINK (isolation linchpin) ----------
CREATE TABLE IF NOT EXISTS public.taskos_telegram_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id  bigint NOT NULL,
  telegram_user_id  bigint,
  telegram_username text,
  is_active         boolean NOT NULL DEFAULT true,
  linked_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS taskos_tg_chat_uq
  ON public.taskos_telegram_links (telegram_chat_id);
CREATE UNIQUE INDEX IF NOT EXISTS taskos_tg_user_active_uq
  ON public.taskos_telegram_links (user_id) WHERE is_active;

-- ---------- 7. LINK CODES (service-role only; no client policy) ----------
CREATE TABLE IF NOT EXISTS public.taskos_link_codes (
  code        text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS taskos_link_codes_user_idx
  ON public.taskos_link_codes (user_id) WHERE consumed_at IS NULL;

-- ============================================================================
-- 8. updated_at triggers (reuse existing public.update_updated_at_column)
-- ============================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'taskos_user_settings','taskos_inbox_items','taskos_tasks',
    'taskos_entities','taskos_telegram_links'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', t);
  END LOOP;
END $$;

-- ============================================================================
-- 9. RLS — enable + FORCE on every table
-- ============================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'taskos_user_settings','taskos_inbox_items','taskos_tasks',
    'taskos_entities','taskos_telegram_links','taskos_link_codes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;',  t);
  END LOOP;
END $$;

-- Owner-only policies for the FIVE client-facing tables (NOT link_codes).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'taskos_user_settings','taskos_inbox_items','taskos_tasks',
    'taskos_entities','taskos_telegram_links'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "owner_select" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY "owner_select" ON public.%I FOR SELECT TO authenticated
         USING (user_id = auth.uid() AND public.is_staff(auth.uid()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner_insert" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY "owner_insert" ON public.%I FOR INSERT TO authenticated
         WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner_update" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY "owner_update" ON public.%I FOR UPDATE TO authenticated
         USING (user_id = auth.uid() AND public.is_staff(auth.uid()))
         WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner_delete" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY "owner_delete" ON public.%I FOR DELETE TO authenticated
         USING (user_id = auth.uid() AND public.is_staff(auth.uid()));', t);
  END LOOP;
END $$;
-- taskos_link_codes: deliberately NO policy => authenticated has zero access.

-- ---------- 10. Grants (anon gets nothing; link_codes never granted) ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'taskos_user_settings','taskos_inbox_items','taskos_tasks',
    'taskos_entities','taskos_telegram_links'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
  END LOOP;
END $$;
REVOKE ALL ON public.taskos_link_codes FROM authenticated, anon;

NOTIFY pgrst, 'reload schema';
