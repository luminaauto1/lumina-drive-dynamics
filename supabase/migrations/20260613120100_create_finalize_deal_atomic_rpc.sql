-- Atomically finalize a deal: mark the finance application 'finalized' AND move
-- the vehicle to 'sold' in a single transaction. Either both succeed or both
-- roll back, so we can never end up with a sold car on an un-finalized app
-- (or vice-versa). Staff-only, SECURITY DEFINER.
--
-- Called from AdminDealRoom.handleFinalizeDealSuccess. The deal_records ("ledger")
-- row is created separately by useDealRecords before this runs; this RPC owns the
-- application-status + inventory flip that previously failed mid-sequence.
CREATE OR REPLACE FUNCTION public.finalize_deal_atomic(
  p_application_id uuid,
  p_vehicle_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
BEGIN
  -- Authorization: only staff may finalize deals.
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized to finalize deals' USING errcode = '42501';
  END IF;

  -- 1. Mark the finance application finalized, stamping status_updated_at and
  --    appending to status_history (mirrors the frontend hook behaviour).
  UPDATE public.finance_applications
     SET status = 'finalized',
         status_updated_at = now(),
         status_history = COALESCE(status_history, '[]'::jsonb)
                          || jsonb_build_object('status', 'finalized', 'timestamp', now())
   WHERE id = p_application_id;

  -- 2. Move the vehicle to sold inventory — but ONLY real stock. Sourcing /
  --    hidden (client) stock keeps its status, matching useDealRecords.
  IF p_vehicle_id IS NOT NULL THEN
    SELECT status INTO v_current_status FROM public.vehicles WHERE id = p_vehicle_id;
    IF v_current_status IN ('available', 'reserved', 'incoming') THEN
      UPDATE public.vehicles SET status = 'sold' WHERE id = p_vehicle_id;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_deal_atomic(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finalize_deal_atomic(uuid, uuid) TO authenticated;
