-- Handover photos and deal checklist documents are delivery-side work, so the
-- roles that run deliveries must be able to upload and view them.
-- NOTE: delivery-photos was admin-ONLY, so senior F&I could not upload either.

CREATE POLICY "Delivery roles read delivery photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-photos' AND (SELECT public.can_deal_delivery()));
CREATE POLICY "Delivery roles upload delivery photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-photos' AND (SELECT public.can_deal_delivery()));
CREATE POLICY "Delivery roles update delivery photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'delivery-photos' AND (SELECT public.can_deal_delivery()))
  WITH CHECK (bucket_id = 'delivery-photos' AND (SELECT public.can_deal_delivery()));
CREATE POLICY "Delivery roles delete delivery photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'delivery-photos' AND (SELECT public.can_deal_delivery()));

-- Deal checklist documents live under documents/deal/% — same audience.
CREATE POLICY "Delivery roles read deal documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND name LIKE 'deal/%' AND (SELECT public.can_deal_delivery()));
CREATE POLICY "Delivery roles upload deal documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND name LIKE 'deal/%' AND (SELECT public.can_deal_delivery()));
CREATE POLICY "Delivery roles update deal documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND name LIKE 'deal/%' AND (SELECT public.can_deal_delivery()))
  WITH CHECK (bucket_id = 'documents' AND name LIKE 'deal/%' AND (SELECT public.can_deal_delivery()));
CREATE POLICY "Delivery roles delete deal documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND name LIKE 'deal/%' AND (SELECT public.can_deal_delivery()));
