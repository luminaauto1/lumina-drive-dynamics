-- Deal-level expenses (mirror of vehicle_expenses, but attached to the DEAL via its
-- application_id — the deal's through-line pre/post finalize). Plus refund/recovery
-- columns on deal_records. Additive only.
-- (Applied to the live DB via Supabase MCP; committed here for migration history.)

CREATE TABLE IF NOT EXISTS public.deal_expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.finance_applications(id) ON DELETE CASCADE,
  deal_id        uuid REFERENCES public.deal_records(id) ON DELETE CASCADE,
  description    text NOT NULL,
  amount         numeric NOT NULL DEFAULT 0,
  category       text NOT NULL DEFAULT 'general',
  receipt_url    text,
  date_incurred  date NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_expenses_parent_chk CHECK (application_id IS NOT NULL OR deal_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_deal_expenses_application_id ON public.deal_expenses(application_id) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_expenses_deal_id ON public.deal_expenses(deal_id) WHERE deal_id IS NOT NULL;

ALTER TABLE public.deal_expenses ENABLE ROW LEVEL SECURITY;
-- Mirror vehicle_expenses (admin-only CRUD).
CREATE POLICY "Admins can view all deal expenses"   ON public.deal_expenses FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert deal expenses"     ON public.deal_expenses FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update deal expenses"     ON public.deal_expenses FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete deal expenses"     ON public.deal_expenses FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Refund & recovery (licence/reg + admin) on the finalized deal. Net (refund − cost)
-- is folded into gross_profit at finalize (see FinalizeDealModal).
ALTER TABLE public.deal_records
  ADD COLUMN IF NOT EXISTS license_reg_cost       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS license_reg_refund     numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_recovery_cost    numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_recovery_refund  numeric DEFAULT 0;

-- Backfill: existing deal_records.aftersales_expenses items → deal_expenses rows,
-- so historical deals show their line items in the new UI. gross_profit is unchanged
-- (aftersales_expenses snapshot column stays as the reader source of truth).
INSERT INTO public.deal_expenses (application_id, deal_id, description, amount, category, date_incurred)
SELECT d.application_id, d.id,
       COALESCE(NULLIF(e->>'description',''), NULLIF(e->>'type',''), 'Expense'),
       COALESCE(NULLIF(e->>'amount','')::numeric, 0),
       COALESCE(NULLIF(e->>'type',''), 'general'),
       COALESCE(d.sale_date, d.created_at::date)
FROM public.deal_records d
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(d.aftersales_expenses) = 'array' THEN d.aftersales_expenses ELSE '[]'::jsonb END
) AS e
WHERE COALESCE(NULLIF(e->>'amount','')::numeric, 0) <> 0;
