-- ============================================================================
-- Deal Desk (P5d) — ADDITIVE layer ported from ZTC. NOTHING here edits or reads
-- the frozen finalize surface. gross_profit / AccountingVAT are never touched.
-- New tables FK -> deal_records; cost sheet is analytical-only (its own table).
-- ============================================================================

-- Write gate: admin + senior_f_and_i (mirrors the deal_records SELECT floor).
CREATE OR REPLACE FUNCTION public.can_deal_desk()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'senior_f_and_i'::app_role);
$$;

-- ---- enums (idempotent) ----------------------------------------------------
DO $$ BEGIN CREATE TYPE public.dd_checklist_step AS ENUM ('not_started','requested','in_progress','done','not_applicable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dd_handover AS ENUM ('pickup','delivery'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dd_payee_type AS ENUM ('spotter','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dd_expense_reason AS ENUM ('spotter','disc_and_plates','delivery','advertising','fitments','fuel','spare_key','service','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dd_event_type AS ENUM ('created','status_changed','fields_changed','costing_saved','checklist_saved','delivery_changed','linked','unlinked','note'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- 1:1 analytical cost sheet (NEVER feeds deal_records) -------------------
CREATE TABLE IF NOT EXISTS public.deal_costsheet (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid NOT NULL UNIQUE REFERENCES public.deal_records(id) ON DELETE CASCADE,
  retail          numeric(12,2) NOT NULL DEFAULT 0,
  spotter         numeric(12,2) NOT NULL DEFAULT 0,
  delivery        numeric(12,2) NOT NULL DEFAULT 0,
  over_allowance  numeric(12,2) NOT NULL DEFAULT 0,
  vehicle_cost    numeric(12,2) NOT NULL DEFAULT 0,
  recon           numeric(12,2) NOT NULL DEFAULT 0,
  fleet_1pct      numeric(12,2) NOT NULL DEFAULT 0,
  c4c             numeric(12,2) NOT NULL DEFAULT 0,
  accessories     jsonb NOT NULL DEFAULT '[]'::jsonb,
  fni             jsonb NOT NULL DEFAULT '[]'::jsonb,
  vehicle_gp        numeric(12,2) NOT NULL DEFAULT 0,
  accessories_total numeric(12,2) NOT NULL DEFAULT 0,
  fni_total         numeric(12,2) NOT NULL DEFAULT 0,
  total             numeric(12,2) NOT NULL DEFAULT 0,
  correct_total     numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_costsheet ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deal_costsheet select" ON public.deal_costsheet;
DROP POLICY IF EXISTS "deal_costsheet write"  ON public.deal_costsheet;
CREATE POLICY "deal_costsheet select" ON public.deal_costsheet FOR SELECT TO authenticated USING (public.can_deal_desk());
CREATE POLICY "deal_costsheet write"  ON public.deal_costsheet FOR ALL    TO authenticated USING (public.can_deal_desk()) WITH CHECK (public.can_deal_desk());

-- ---- 1:1 delivery checklist ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deal_checklist (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id            uuid NOT NULL UNIQUE REFERENCES public.deal_records(id) ON DELETE CASCADE,
  pickup_or_delivery public.dd_handover NOT NULL DEFAULT 'delivery',
  fica            public.dd_checklist_step NOT NULL DEFAULT 'not_started',
  recon           public.dd_checklist_step NOT NULL DEFAULT 'not_started',
  dekra           public.dd_checklist_step NOT NULL DEFAULT 'not_started',
  point_80        public.dd_checklist_step NOT NULL DEFAULT 'not_started',
  fitments        public.dd_checklist_step NOT NULL DEFAULT 'not_started',
  valet           public.dd_checklist_step NOT NULL DEFAULT 'not_started',
  insurance       public.dd_checklist_step NOT NULL DEFAULT 'not_started',
  fuel_keys_permit public.dd_checklist_step NOT NULL DEFAULT 'not_started',
  delivery_ready  boolean NOT NULL DEFAULT false,
  comments        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deal_checklist select" ON public.deal_checklist;
DROP POLICY IF EXISTS "deal_checklist write"  ON public.deal_checklist;
CREATE POLICY "deal_checklist select" ON public.deal_checklist FOR SELECT TO authenticated USING (public.can_deal_desk());
CREATE POLICY "deal_checklist write"  ON public.deal_checklist FOR ALL    TO authenticated USING (public.can_deal_desk()) WITH CHECK (public.can_deal_desk());

-- ---- payables (standalone tracker; NOT read by AccountingVAT/dealMetrics) ---
CREATE TABLE IF NOT EXISTS public.deal_payees (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  type       public.dd_payee_type NOT NULL DEFAULT 'other',
  phone      text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.deal_expense_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      uuid REFERENCES public.deal_records(id) ON DELETE CASCADE,
  payee_id     uuid REFERENCES public.deal_payees(id) ON DELETE SET NULL,
  expense_date date,
  amount       numeric(12,2) NOT NULL DEFAULT 0,
  reason       public.dd_expense_reason NOT NULL DEFAULT 'other',
  vin          text,
  paid         boolean NOT NULL DEFAULT false,
  comments     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deal_expense_items_deal_id_idx ON public.deal_expense_items(deal_id);
ALTER TABLE public.deal_payees        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_expense_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deal_payees select" ON public.deal_payees;
DROP POLICY IF EXISTS "deal_payees write"  ON public.deal_payees;
DROP POLICY IF EXISTS "deal_expense_items select" ON public.deal_expense_items;
DROP POLICY IF EXISTS "deal_expense_items write"  ON public.deal_expense_items;
CREATE POLICY "deal_payees select" ON public.deal_payees FOR SELECT TO authenticated USING (public.can_deal_desk());
CREATE POLICY "deal_payees write"  ON public.deal_payees FOR ALL    TO authenticated USING (public.can_deal_desk()) WITH CHECK (public.can_deal_desk());
CREATE POLICY "deal_expense_items select" ON public.deal_expense_items FOR SELECT TO authenticated USING (public.can_deal_desk());
CREATE POLICY "deal_expense_items write"  ON public.deal_expense_items FOR ALL    TO authenticated USING (public.can_deal_desk()) WITH CHECK (public.can_deal_desk());

-- ---- append-only activity --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deal_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    uuid NOT NULL REFERENCES public.deal_records(id) ON DELETE CASCADE,
  actor_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type public.dd_event_type NOT NULL,
  summary    text NOT NULL,
  changes    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deal_events_deal_id_idx ON public.deal_events(deal_id, created_at DESC);
ALTER TABLE public.deal_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deal_events select" ON public.deal_events;
DROP POLICY IF EXISTS "deal_events insert" ON public.deal_events;
CREATE POLICY "deal_events select" ON public.deal_events FOR SELECT TO authenticated USING (public.can_deal_desk());
CREATE POLICY "deal_events insert" ON public.deal_events FOR INSERT TO authenticated WITH CHECK (public.can_deal_desk());

-- ---- Natis state on deal_records (ADD COLUMN only; net-new, defaulted) ------
-- Per verdict #1: natis_received dropped as vestigial; sent_at is the single signal.
ALTER TABLE public.deal_records ADD COLUMN IF NOT EXISTS natis_sent_at     timestamptz;
ALTER TABLE public.deal_records ADD COLUMN IF NOT EXISTS natis_window_days integer;

-- ---- settings singleton ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deal_desk_settings (
  id               text PRIMARY KEY DEFAULT 'default',
  natis_window_days integer NOT NULL DEFAULT 21,
  natis_warn_days   integer NOT NULL DEFAULT 5,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.deal_desk_settings(id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.deal_desk_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dd_settings select" ON public.deal_desk_settings;
DROP POLICY IF EXISTS "dd_settings write"  ON public.deal_desk_settings;
CREATE POLICY "dd_settings select" ON public.deal_desk_settings FOR SELECT TO authenticated USING (public.can_deal_desk());
CREATE POLICY "dd_settings write"  ON public.deal_desk_settings FOR ALL    TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
