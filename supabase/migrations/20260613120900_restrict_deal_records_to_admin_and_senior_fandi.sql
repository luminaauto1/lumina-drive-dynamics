-- Correct the access rule from the previous migration: ONLY admins + senior F&I
-- may finalize/see deals (deal_records holds profit/cost figures). Standard F&I
-- and sales get nothing on deal_records.
DROP POLICY IF EXISTS "F&I view deal records"   ON public.deal_records;
DROP POLICY IF EXISTS "F&I insert deal records" ON public.deal_records;
DROP POLICY IF EXISTS "F&I update deal records" ON public.deal_records;

CREATE POLICY "Senior F&I view deal records" ON public.deal_records
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'senior_f_and_i'::app_role));
CREATE POLICY "Senior F&I insert deal records" ON public.deal_records
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'senior_f_and_i'::app_role));
CREATE POLICY "Senior F&I update deal records" ON public.deal_records
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'senior_f_and_i'::app_role));
