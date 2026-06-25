-- Credit Check overhaul (Phase A).
-- 1) The modal writes status_screenshot_url + (new) credit_score to finance_applications,
--    but status_screenshot_url never existed and there was no numeric score column — add both.
-- 2) RLS FIX: the credit-check-screenshots bucket only allowed ADMINS to upload (staff could
--    only read), so an F&I attaching a bureau screenshot hit a row-level-security error.
--    Allow any STAFF member to upload/update objects in that bucket.

ALTER TABLE public.finance_applications
  ADD COLUMN IF NOT EXISTS status_screenshot_url text,
  ADD COLUMN IF NOT EXISTS credit_score integer;

COMMENT ON COLUMN public.finance_applications.credit_score IS 'Numeric bureau credit score captured at credit-check time (optional).';

-- Storage policies are permissive/OR-ed, so adding a staff INSERT/UPDATE policy alongside the
-- existing admin "manage" policy lets F&I upload bureau screenshots.
DROP POLICY IF EXISTS "Staff upload credit-check-screenshots" ON storage.objects;
CREATE POLICY "Staff upload credit-check-screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'credit-check-screenshots' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update credit-check-screenshots" ON storage.objects;
CREATE POLICY "Staff update credit-check-screenshots"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'credit-check-screenshots' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'credit-check-screenshots' AND public.is_staff(auth.uid()));
