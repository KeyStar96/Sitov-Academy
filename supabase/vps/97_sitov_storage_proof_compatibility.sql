-- Sitov Academy additive97: Storage1.44.2 has no soft-delete columns.
-- Read optional flags from the concrete row, never invent vendor columns.
-- Missing/null markers mean current; any archive value or non-false delete
-- marker fails closed. Existing metadata, identity, profile, timing and locks
-- remain in the original guards. OIDs, ownership and guard ACLs are preserved.
CREATE OR REPLACE FUNCTION sitov_storage_private.sitov_object_is_current(p_object jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_typeof(p_object)='object'
  AND coalesce(p_object->'archived_at','null'::jsonb)='null'::jsonb
  AND coalesce(p_object->'is_delete_marker','null'::jsonb) IN('false'::jsonb,'null'::jsonb),false)
$$;
REVOKE ALL ON FUNCTION sitov_storage_private.sitov_object_is_current(jsonb) FROM PUBLIC,anon,authenticated,service_role;

DO $sitov$
DECLARE target text;definition text;old_clause text;new_clause constant text:='sitov_storage_private.sitov_object_is_current(to_jsonb(o))';
BEGIN
 FOREACH target IN ARRAY ARRAY[
  'vocabulary_private.sitov_prepared_german_audio_url(text)',
  'sitov_pronunciation_private.reference_valid(text,text,sitov_pronunciation_private.pretest_approvals)',
  'sitov_pronunciation_private.public_audio_ready(uuid,text,jsonb)',
  'sitov_special_private.definition_ready(sitov_special_private.definitions)'
 ] LOOP
  definition:=pg_get_functiondef(target::regprocedure);
  IF position(new_clause IN definition)>0 THEN CONTINUE;END IF;
  old_clause:=CASE
   WHEN target LIKE 'vocabulary_private.%' THEN 'o.archived_at IS NULL AND coalesce(o.is_delete_marker,false)=false'
   WHEN target LIKE 'sitov_pronunciation_private.%' THEN 'archived_at IS NULL AND NOT coalesce(is_delete_marker,false)'
   ELSE 'archived_at IS NULL AND coalesce(is_delete_marker,false)=false' END;
  IF position(old_clause IN definition)=0 THEN RAISE EXCEPTION 'sitov_storage_proof_guard_contract_changed: %',target;END IF;
  IF target NOT LIKE 'vocabulary_private.%' THEN
   IF position('FROM storage.objects WHERE' IN definition)=0 THEN RAISE EXCEPTION 'sitov_storage_proof_object_contract_changed: %',target;END IF;
   definition:=replace(definition,'FROM storage.objects WHERE','FROM storage.objects o WHERE');
  END IF;
  EXECUTE replace(definition,old_clause,new_clause);
 END LOOP;
END $sitov$;
NOTIFY pgrst,'reload schema';
