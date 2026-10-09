-- Sitov Academy additive99: strict proof SELECTs also work in readonly GETs.
-- Readonly transactions take an MVCC view; write/publication/ticket/submission
-- transactions retain the existing FOR SHARE object locks until commit.
CREATE OR REPLACE FUNCTION sitov_storage_private.sitov_audio_metadata(p_bucket text,p_name text)
RETURNS TABLE(user_metadata jsonb,metadata jsonb) LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
BEGIN
 IF current_setting('transaction_read_only')='on' THEN
  RETURN QUERY SELECT o.user_metadata,o.metadata FROM storage.objects o
   WHERE o.bucket_id=p_bucket AND o.name=p_name AND sitov_storage_private.sitov_object_is_current(to_jsonb(o));
 ELSE
  RETURN QUERY SELECT o.user_metadata,o.metadata FROM storage.objects o
   WHERE o.bucket_id=p_bucket AND o.name=p_name AND sitov_storage_private.sitov_object_is_current(to_jsonb(o)) FOR SHARE;
 END IF;
END $$;
REVOKE ALL ON FUNCTION sitov_storage_private.sitov_audio_metadata(text,text) FROM PUBLIC,anon,authenticated,service_role;

DO $sitov$
DECLARE target text;definition text;old_query text;new_query text;
BEGIN
 FOREACH target IN ARRAY ARRAY[
  'vocabulary_private.sitov_prepared_german_audio_url(text)',
  'sitov_pronunciation_private.reference_valid(text,text,sitov_pronunciation_private.pretest_approvals)',
  'sitov_pronunciation_private.public_audio_ready(uuid,text,jsonb)'
 ] LOOP
  definition:=pg_get_functiondef(target::regprocedure);
  IF position('sitov_storage_private.sitov_audio_metadata(' IN definition)>0 THEN CONTINUE;END IF;
  IF target LIKE 'vocabulary_private.%' THEN
   old_query:=$old$SELECT o.user_metadata, o.metadata INTO authored, object_metadata
 FROM storage.objects o WHERE o.bucket_id='audio_cache' AND o.name=cache_path
   AND sitov_storage_private.sitov_object_is_current(to_jsonb(o))
 FOR SHARE;$old$;
   new_query:=$new$SELECT m.user_metadata,m.metadata INTO authored,object_metadata FROM sitov_storage_private.sitov_audio_metadata('audio_cache',cache_path) m;$new$;
  ELSIF target LIKE '%.reference_valid%' THEN
   old_query:=$old$SELECT user_metadata INTO metadata FROM storage.objects o WHERE bucket_id=a.reference_bucket AND name=a.reference_path AND sitov_storage_private.sitov_object_is_current(to_jsonb(o)) FOR SHARE;$old$;
   new_query:=$new$SELECT m.user_metadata INTO metadata FROM sitov_storage_private.sitov_audio_metadata(a.reference_bucket,a.reference_path) m;$new$;
  ELSE
   old_query:=$old$SELECT user_metadata INTO authored FROM storage.objects o WHERE bucket_id='audio_cache' AND name=path AND sitov_storage_private.sitov_object_is_current(to_jsonb(o)) FOR SHARE;$old$;
   new_query:=$new$SELECT m.user_metadata INTO authored FROM sitov_storage_private.sitov_audio_metadata('audio_cache',path) m;$new$;
  END IF;
  IF position(old_query IN definition)=0 THEN RAISE EXCEPTION 'sitov_readonly_audio_proof_contract_changed: %',target;END IF;
  EXECUTE replace(definition,old_query,new_query);
 END LOOP;
END $sitov$;
NOTIFY pgrst,'reload schema';
