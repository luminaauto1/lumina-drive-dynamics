-- Invoice history for the upgraded /admin/invoices motor-trade invoice tool
-- (approved plan 2026-07-08, applied live via MCP). Stores every generated
-- invoice's full form state so it can be re-downloaded or duplicated, plus
-- header fields for the list.
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  kind text NOT NULL DEFAULT 'vehicle',          -- 'vehicle' | 'general'
  bill_to_name text NOT NULL DEFAULT '',
  grand_total numeric NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,    -- full creator form state (re-download / duplicate)
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices (created_at DESC);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;

-- Staff who work invoices: admin, accountant, F&I, senior F&I. NOT is_staff()
-- (that helper is admin+sales_agent only). Initplan-wrapped per linter rules.
CREATE POLICY "invoices_staff_all" ON public.invoices
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    ( SELECT has_role((select auth.uid()), 'admin'::app_role) )
    OR ( SELECT has_role((select auth.uid()), 'accountant'::app_role) )
    OR ( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) )
    OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) )
  )
  WITH CHECK (
    ( SELECT has_role((select auth.uid()), 'admin'::app_role) )
    OR ( SELECT has_role((select auth.uid()), 'accountant'::app_role) )
    OR ( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) )
    OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) )
  );

REVOKE ALL ON public.invoices FROM anon;
