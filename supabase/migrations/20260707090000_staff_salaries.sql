-- Staff salary register for the admin-only Salary Calculator (Settings).
-- SECURITY: salary data is the most sensitive table in the system — RLS is
-- admin-only for EVERY command (initplan-wrapped), FORCEd, and anon/authenticated
-- get no table grants beyond what RLS allows. No edge function touches it.
CREATE TABLE IF NOT EXISTS public.staff_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name text NOT NULL,
  role_title text,
  -- Monthly amounts in Rand.
  gross_basic numeric NOT NULL DEFAULT 0,
  fixed_allowances numeric NOT NULL DEFAULT 0,   -- travel/phone etc. (taxable)
  pension_percent numeric NOT NULL DEFAULT 0,    -- employee retirement contribution % of basic (tax-deductible, s11F)
  age_band text NOT NULL DEFAULT 'under_65',     -- under_65 | from_65 | from_75 (SARS rebates)
  custom_deductions jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{label, amount}] after-tax deductions (loans/advances)
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_salaries FORCE ROW LEVEL SECURITY;

CREATE POLICY "salary_admin_all" ON public.staff_salaries
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- Belt-and-braces: no anon access path at all.
REVOKE ALL ON public.staff_salaries FROM anon;

CREATE TRIGGER staff_salaries_updated_at
  BEFORE UPDATE ON public.staff_salaries
  FOR EACH ROW EXECUTE FUNCTION public.vendors_set_updated_at();
