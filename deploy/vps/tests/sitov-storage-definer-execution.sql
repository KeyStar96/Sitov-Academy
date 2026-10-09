-- Sitov Academy: native post-110 ACL and actual Storage RLS smoke.
-- Existing accounts/objects only. Claims are native SQL context, not signed JWTs.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='30s';
DO $sitov$
DECLARE actor record; targets jsonb;
BEGIN
 IF NOT has_function_privilege('postgres','sitov_simulation_private.preserve_media(uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'sitov_storage_definer_missing';
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) r
  WHERE has_function_privilege(r,'sitov_simulation_private.preserve_media(uuid,text)','EXECUTE'))
 OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid='sitov_simulation_private.preserve_media(uuid,text)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN
  RAISE EXCEPTION 'sitov_storage_definer_api_grant';
 END IF;
 SELECT u.id,u.role,u.raw_app_meta_data INTO actor FROM auth.users u
 JOIN public.profiles p ON p.id=u.id WHERE p.role='student' ORDER BY u.id LIMIT 1;
 IF actor.id IS NULL THEN RAISE EXCEPTION 'sitov_storage_definer_no_actual_student'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor.id::text,true);
 PERFORM set_config('request.jwt.claim.role',actor.role,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role',actor.role,'app_metadata',actor.raw_app_meta_data)::text,true);
 SELECT jsonb_agg(to_jsonb(x)) INTO targets FROM (
  SELECT DISTINCT ON(bucket_id) id,bucket_id FROM storage.objects ORDER BY bucket_id,id
 ) x;
 IF targets IS NULL THEN RAISE EXCEPTION 'sitov_storage_definer_no_actual_objects'; END IF;
 PERFORM set_config('sitov.storage_definer_targets',targets::text,true);
END
$sitov$;
SET LOCAL ROLE authenticated;
DO $sitov$
DECLARE target jsonb; visible boolean;
BEGIN
 FOR target IN SELECT value FROM jsonb_array_elements(current_setting('sitov.storage_definer_targets')::jsonb) LOOP
  -- The real SELECT policy reaches can_remove_audio -> preserve_media as postgres.
  SELECT EXISTS(SELECT 1 FROM storage.objects WHERE id=(target->>'id')::uuid) INTO visible;
  PERFORM learning_reset_private.can_remove_audio((target->>'id')::uuid);
  IF target->>'bucket_id'='audio_cache' AND visible THEN
   RAISE EXCEPTION 'sitov_storage_definer_private_audio_exposed';
  END IF;
 END LOOP;
 BEGIN
  PERFORM sitov_simulation_private.preserve_media(auth.uid(),NULL);
  RAISE EXCEPTION 'sitov_storage_definer_direct_authenticated_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$sitov$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $sitov$ BEGIN
 BEGIN
  PERFORM sitov_simulation_private.preserve_media(NULL,NULL);
  RAISE EXCEPTION 'sitov_storage_definer_direct_anon_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $sitov$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $sitov$ BEGIN
 BEGIN
  PERFORM sitov_simulation_private.preserve_media(NULL,NULL);
  RAISE EXCEPTION 'sitov_storage_definer_direct_service_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $sitov$;
RESET ROLE;
SELECT 'sitov_storage_definer_execution_ok' AS result;
ROLLBACK;
