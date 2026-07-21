-- Sales agents work the DELIVERY side of Deal Desk (deals list, Natis,
-- customer follow-ups) but must never see profit, cost sheets or payables.
-- deal_costsheet / deal_expense_items / deal_payees are deliberately NOT
-- widened here — they stay blocked at the database for this role.

CREATE OR REPLACE FUNCTION public.can_deal_delivery()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.can_deal_desk()
      OR has_role(auth.uid(), 'sales_agent'::app_role);
$$;

-- ── deal_records: read, plus a delivery-scoped write ──────────────────────
CREATE POLICY "Sales agents view deal records"
  ON public.deal_records FOR SELECT TO authenticated
  USING ((SELECT has_role((SELECT auth.uid()), 'sales_agent'::app_role)));

CREATE POLICY "Sales agents update deal delivery fields"
  ON public.deal_records FOR UPDATE TO authenticated
  USING ((SELECT has_role((SELECT auth.uid()), 'sales_agent'::app_role)))
  WITH CHECK ((SELECT has_role((SELECT auth.uid()), 'sales_agent'::app_role)));

-- Column guard. RLS is row-level only, so this trigger is what actually stops
-- a delivery-only role from touching money. The list is an ALLOWlist, so any
-- column added to deal_records in future is protected by default.
CREATE OR REPLACE FUNCTION public.deal_records_guard_financials()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  allowed text[] := ARRAY[
    'delivery_address','delivery_date','delivery_photos',
    'natis_sent_at','natis_window_days','natis_stage','natis_location',
    'natis_plates_disc_done','natis_whatsapp_on_done','natis_doc_path',
    'deal_stage','next_service_date','next_service_km','sold_mileage',
    'post_deal_notes'
  ];
BEGIN
  -- Service-role / server-side calls (no JWT) and full deal-desk roles pass through.
  IF auth.uid() IS NULL OR public.can_deal_desk() THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
    RAISE EXCEPTION 'Your role may only change delivery and Natis fields on a deal';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deal_records_guard_financials ON public.deal_records;
CREATE TRIGGER deal_records_guard_financials
  BEFORE UPDATE ON public.deal_records
  FOR EACH ROW EXECUTE FUNCTION public.deal_records_guard_financials();

-- ── Supporting tables the delivery tabs read/write ────────────────────────
CREATE POLICY "deal_checklist delivery select" ON public.deal_checklist
  FOR SELECT TO authenticated USING ((SELECT public.can_deal_delivery()));
CREATE POLICY "deal_checklist delivery insert" ON public.deal_checklist
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.can_deal_delivery()));
CREATE POLICY "deal_checklist delivery update" ON public.deal_checklist
  FOR UPDATE TO authenticated USING ((SELECT public.can_deal_delivery()))
  WITH CHECK ((SELECT public.can_deal_delivery()));

CREATE POLICY "deal_events delivery select" ON public.deal_events
  FOR SELECT TO authenticated USING ((SELECT public.can_deal_delivery()));
CREATE POLICY "deal_events delivery insert" ON public.deal_events
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.can_deal_delivery()));

CREATE POLICY "dd_settings delivery select" ON public.deal_desk_settings
  FOR SELECT TO authenticated USING ((SELECT public.can_deal_delivery()));

-- Customer Follow-ups tab (service/follow-up records — no profit fields).
CREATE POLICY "aftersales delivery select" ON public.aftersales_records
  FOR SELECT TO authenticated USING ((SELECT public.can_deal_delivery()));
CREATE POLICY "aftersales delivery update" ON public.aftersales_records
  FOR UPDATE TO authenticated USING ((SELECT public.can_deal_delivery()))
  WITH CHECK ((SELECT public.can_deal_delivery()));
