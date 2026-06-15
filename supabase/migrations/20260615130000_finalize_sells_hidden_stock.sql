-- Bug found in live walkthrough: finalizing a deal on a HIDDEN (client-specific)
-- vehicle left it stuck as 'hidden' instead of moving it to 'sold' stock. Hidden
-- cars are real stock bought for a specific client, so on finalize they must sell.
-- Only 'sourcing' (ghost/template stock) is left untouched.
CREATE OR REPLACE FUNCTION public.finalize_deal_atomic(p_application_id uuid, p_vehicle_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized to finalize deals' USING errcode = '42501';
  END IF;

  UPDATE public.finance_applications
     SET status = 'finalized',
         status_updated_at = now(),
         status_history = COALESCE(status_history, '[]'::jsonb)
                          || jsonb_build_object('status', 'finalized', 'timestamp', now())
   WHERE id = p_application_id;

  IF p_vehicle_id IS NOT NULL THEN
    SELECT status INTO v_current_status FROM public.vehicles WHERE id = p_vehicle_id;
    IF v_current_status IN ('available', 'reserved', 'incoming', 'hidden') THEN
      UPDATE public.vehicles SET status = 'sold' WHERE id = p_vehicle_id;
    END IF;
  END IF;
END;
$function$;
