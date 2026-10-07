-- Sitov Academy: measured Storage objects are distinct from the server disk.
-- Preserve total_bytes and levels for existing clients (course-assets only).
-- This read-only RPC never changes files, learning content or quota counters.
CREATE OR REPLACE FUNCTION public.media_storage_usage() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT business_private.is_staff() THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.');
 END IF;
 RETURN (
  WITH sitov_objects AS MATERIALIZED (
   SELECT o.bucket_id,o.name,
    CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,18}$' THEN (o.metadata->>'size')::bigint END bytes
   FROM storage.objects o
  ), sitov_buckets AS (
   SELECT bucket_id,coalesce(sum(bytes),0) bytes,count(*) object_count,
    count(*) FILTER (WHERE bytes IS NULL) unknown_size_objects
   FROM sitov_objects GROUP BY bucket_id
  ), sitov_levels AS (
   SELECT split_part(name,'/',1) level,coalesce(sum(bytes),0) bytes
   FROM sitov_objects WHERE bucket_id='course-assets' GROUP BY 1
  )
  SELECT jsonb_build_object(
   'total_bytes',(SELECT coalesce(sum(bytes),0) FROM sitov_objects WHERE bucket_id='course-assets'),
   'storage_total_bytes',(SELECT coalesce(sum(bytes),0) FROM sitov_objects),
   'unknown_size_objects',(SELECT count(*) FROM sitov_objects WHERE bytes IS NULL),
   'levels',coalesce((
    SELECT jsonb_agg(jsonb_build_object('level',l.code,'bytes',coalesce(u.bytes,0),'limit_bytes',21474836480) ORDER BY l.sort_order,l.code)
    FROM public.learning_levels l LEFT JOIN sitov_levels u ON u.level=l.code
   ),'[]'::jsonb),
   'buckets',coalesce((
    SELECT jsonb_agg(jsonb_build_object(
     'bucket_id',b.id,'bytes',coalesce(u.bytes,0),'object_count',coalesce(u.object_count,0),
     'unknown_size_objects',coalesce(u.unknown_size_objects,0),'limit_bytes',q.bucket_bytes
    ) ORDER BY b.id)
    FROM storage.buckets b LEFT JOIN sitov_buckets u ON u.bucket_id=b.id
    LEFT JOIN sitov_storage_private.limits q ON q.bucket_id=b.id
   ),'[]'::jsonb)
  )
 );
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','storage_usage_failed','message','Storage usage could not be read.');
END $$;
-- Only authenticated staff pass the existing authorization check. The definer
-- reads private quota configuration and aggregates protected object metadata;
-- it never returns paths, owners, audio contents or user-level information.
REVOKE ALL ON FUNCTION public.media_storage_usage() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_storage_usage() TO authenticated;
NOTIFY pgrst,'reload schema';
