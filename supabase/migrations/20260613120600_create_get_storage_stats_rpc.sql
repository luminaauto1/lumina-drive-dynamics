-- Returns live Supabase Storage usage for the Documents Hub dashboard
-- (total bytes/files + per-bucket breakdown). Admin-only.
CREATE OR REPLACE FUNCTION public.get_storage_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_bytes bigint;
  v_total_files bigint;
  v_by_bucket   jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized' USING errcode = '42501';
  END IF;

  SELECT coalesce(sum((metadata->>'size')::bigint), 0), count(*)
    INTO v_total_bytes, v_total_files
    FROM storage.objects;

  SELECT coalesce(jsonb_object_agg(bucket_id,
           jsonb_build_object('bytes', bytes, 'files', files)), '{}'::jsonb)
    INTO v_by_bucket
    FROM (
      SELECT bucket_id,
             coalesce(sum((metadata->>'size')::bigint), 0) AS bytes,
             count(*) AS files
        FROM storage.objects
       GROUP BY bucket_id
    ) t;

  RETURN jsonb_build_object(
    'total_bytes', v_total_bytes,
    'total_files', v_total_files,
    'by_bucket',   v_by_bucket
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storage_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_storage_stats() TO authenticated;
