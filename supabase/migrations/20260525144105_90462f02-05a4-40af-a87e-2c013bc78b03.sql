
CREATE POLICY "Public can submit referrals"
ON public.referrals
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'Pending'
  AND matched_application_id IS NULL
  AND matched_client_id IS NULL
  AND length(trim(referrer_name)) BETWEEN 2 AND 120
  AND length(trim(referee_name))  BETWEEN 2 AND 120
  AND length(regexp_replace(coalesce(referrer_phone,''), '\D', '', 'g')) BETWEEN 6 AND 20
  AND length(regexp_replace(coalesce(referee_phone,''),  '\D', '', 'g')) BETWEEN 6 AND 20
  AND length(coalesce(notes,'')) <= 500
);
