-- The Checklist tab is part of the delivery workflow and is shown to
-- delivery-only roles, so its document rows must be readable/writable by them
-- too. Without this the tab renders but silently returns nothing.
CREATE POLICY "deal_checklist_docs delivery select" ON public.deal_checklist_docs
  FOR SELECT TO authenticated USING ((SELECT public.can_deal_delivery()));
CREATE POLICY "deal_checklist_docs delivery insert" ON public.deal_checklist_docs
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.can_deal_delivery()));
CREATE POLICY "deal_checklist_docs delivery update" ON public.deal_checklist_docs
  FOR UPDATE TO authenticated USING ((SELECT public.can_deal_delivery()))
  WITH CHECK ((SELECT public.can_deal_delivery()));
CREATE POLICY "deal_checklist_docs delivery delete" ON public.deal_checklist_docs
  FOR DELETE TO authenticated USING ((SELECT public.can_deal_delivery()));
