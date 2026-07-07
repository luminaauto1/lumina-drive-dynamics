-- EasySocial tag sync — server-side trigger (RELIABILITY FIX, applied live 2026-07-07).
--
-- Root cause of "adds tags but doesn't remove old ones": the website fired the
-- easysocial-tag-sync CORS preflight (OPTIONS 200 in the edge logs) but the
-- actual POST was dropped when the page navigated away after submit — the call
-- was browser fire-and-forget. So tag REMOVES never reached EasySocial. The ADDs
-- the user still saw came from EasySocial's own campaign auto-tagging when the
-- notify-* WhatsApp templates sent (those POSTs completed). The tag-sync API and
-- edge function themselves are correct — verified end-to-end against the live
-- panel (add + remove + master-wipe all succeed) and via pg_net (200 responses).
--
-- This trigger fires the SAME edge function server-side on every status change,
-- immune to browser navigation and independent of which client made the change
-- (admin CRM, public form, sheet-apps-receiver, make/tiktok receivers). pg_net
-- queues the POST asynchronously so the finance_applications write is never
-- blocked, and any failure is swallowed (never breaks the DB write). The
-- existing browser invokes are left in place as harmless belt-and-braces.
CREATE OR REPLACE FUNCTION public.finance_app_easysocial_tag_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := btrim(coalesce(NEW.phone, ''));
BEGIN
  -- Need a phone number to identify the EasySocial lead.
  IF v_phone = '' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only act when the status actually changed.
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://gkghazemorbxmzzcbaty.supabase.co/functions/v1/easysocial-tag-sync',
      body := jsonb_build_object(
        'phone_number', v_phone,
        'new_status', NEW.status,
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_hQgHFIME0haDAsoxCqMbSw_YUehChx-'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[easysocial-tag-sync trigger] net.http_post failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_app_easysocial_tag_sync ON public.finance_applications;
CREATE TRIGGER finance_app_easysocial_tag_sync
  AFTER INSERT OR UPDATE OF status
  ON public.finance_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.finance_app_easysocial_tag_sync();
