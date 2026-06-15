-- F&I staff work the Deal Room (route allows f_and_i / senior_f_and_i) but RLS
-- only granted finance_banks/finance_offers to admins, so F&I saw an empty bank
-- dropdown (Contract Sent) and an empty / unsavable finance podium.
-- These tables hold bank names and per-application quotes (no profit data), so
-- granting finance staff is safe and matches their role.
CREATE POLICY "F&I view finance banks" ON public.finance_banks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'f_and_i'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));

CREATE POLICY "F&I view finance offers" ON public.finance_offers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'f_and_i'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));
CREATE POLICY "F&I insert finance offers" ON public.finance_offers
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'f_and_i'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));
CREATE POLICY "F&I update finance offers" ON public.finance_offers
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'f_and_i'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));
CREATE POLICY "F&I delete finance offers" ON public.finance_offers
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'f_and_i'::app_role) OR has_role(auth.uid(),'senior_f_and_i'::app_role));
