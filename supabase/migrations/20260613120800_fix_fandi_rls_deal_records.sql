-- F&I staff finalize deals from the Deal Room (FinalizeDealModal inserts a
-- deal_records row client-side), but deal_records INSERT/SELECT/UPDATE were
-- admin-only, so finalizing failed for F&I with "Failed to save deal".
-- Grant finance staff view/create/edit on deal_records (DELETE stays admin-only).
CREATE POLICY "F&I view deal records" ON public.deal_records
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'f_and_i'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));
CREATE POLICY "F&I insert deal records" ON public.deal_records
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'f_and_i'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));
CREATE POLICY "F&I update deal records" ON public.deal_records
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'f_and_i'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));
