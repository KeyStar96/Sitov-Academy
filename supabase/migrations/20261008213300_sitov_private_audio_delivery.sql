-- Sitov Academy: deploy only together with the authenticated audio adapter,
-- exact-current pronunciation RLS and audited prepared assets. No file copies,
-- learner state, historical recordings or authored IDs are rewritten here.
DO $sitov$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='audio_cache') THEN
  RAISE EXCEPTION 'sitov_audio_cache_missing';
 END IF;
 UPDATE storage.buckets SET public=false WHERE id='audio_cache' AND public IS DISTINCT FROM false;
END $sitov$;

-- Public object URLs bypass SQL SELECT policy for public buckets. Both the
-- bucket flag and this restrictive policy are required; service delivery only.
DROP POLICY IF EXISTS sitov_audio_cache_private_read ON storage.objects;
CREATE POLICY sitov_audio_cache_private_read ON storage.objects AS RESTRICTIVE
 FOR SELECT TO anon,authenticated USING(bucket_id<>'audio_cache');

-- Keep publication proof and its original OID/ACL, changing only the stored
-- reference. Audio controls authorize the canonical card, never this path.
DO $sitov$
DECLARE definition text;
 previous constant text:=$old$RETURN '/supabase/storage/v1/object/public/audio_cache/' || cache_path;$old$;
 current_reference constant text:=$new$RETURN 'storage://audio_cache/' || cache_path;$new$;
BEGIN
 definition:=pg_get_functiondef('vocabulary_private.sitov_prepared_german_audio_url(text)'::regprocedure);
 IF position(current_reference IN definition)>0 THEN RETURN; END IF;
 IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'sitov_prepared_audio_reference_contract_changed'; END IF;
 EXECUTE replace(definition,previous,current_reference);
END $sitov$;
NOTIFY pgrst,'reload schema';
