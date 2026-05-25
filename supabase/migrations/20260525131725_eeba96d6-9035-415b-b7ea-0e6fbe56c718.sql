
-- Phone normalization helper (last 9 digits, mirrors frontend normalizePhone)
CREATE OR REPLACE FUNCTION public.normalize_phone_last9(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    WHEN length(regexp_replace(p, '\D', '', 'g')) < 7 THEN NULL
    ELSE right(regexp_replace(p, '\D', '', 'g'), 9)
  END;
$$;

-- Early-link: on new finance application, attach any Pending referral whose
-- referee contact matches and flip it to 'In Progress'.
CREATE OR REPLACE FUNCTION public.link_referral_on_app_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_phone text;
BEGIN
  v_email := NULLIF(lower(trim(NEW.email)), '');
  v_phone := public.normalize_phone_last9(NEW.phone);

  IF v_email IS NULL AND v_phone IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.referrals r
     SET status = 'In Progress',
         matched_application_id = NEW.id,
         matched_client_id = COALESCE(r.matched_client_id, NEW.user_id),
         updated_at = now()
   WHERE r.status = 'Pending'
     AND r.matched_application_id IS NULL
     AND (
          (v_email IS NOT NULL AND lower(trim(r.referee_email)) = v_email)
       OR (v_phone IS NOT NULL AND public.normalize_phone_last9(r.referee_phone) = v_phone)
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_referral_on_app_insert ON public.finance_applications;
CREATE TRIGGER trg_link_referral_on_app_insert
AFTER INSERT ON public.finance_applications
FOR EACH ROW EXECUTE FUNCTION public.link_referral_on_app_insert();

-- Status sync: when a linked application's status changes, mirror outcome
-- onto its referral row.
CREATE OR REPLACE FUNCTION public.sync_referral_on_app_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_new_status := NULL;
  IF NEW.status IN ('declined', 'blacklisted') THEN
    v_new_status := 'Declined';
  ELSIF NEW.status IN ('vehicle_delivered', 'finalized', 'delivered') THEN
    v_new_status := 'Fee Outstanding';
  END IF;

  IF v_new_status IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.referrals
     SET status = v_new_status,
         matched_client_id = COALESCE(matched_client_id, NEW.user_id),
         updated_at = now()
   WHERE matched_application_id = NEW.id
     AND status <> 'Paid'
     AND status <> v_new_status;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_referral_on_app_status ON public.finance_applications;
CREATE TRIGGER trg_sync_referral_on_app_status
AFTER UPDATE OF status ON public.finance_applications
FOR EACH ROW EXECUTE FUNCTION public.sync_referral_on_app_status();
