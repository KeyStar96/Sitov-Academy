-- Sitov Academy native fixtures: synthetic Storage metadata only, always ROLLBACK.
-- The driver injects frozen113/114/115 and independently calculated golden values.
CREATE TEMP TABLE sitov67_checks(name text PRIMARY KEY,passed boolean NOT NULL CHECK(passed));
CREATE FUNCTION pg_temp.sitov67_check(label text,ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'sitov67_check_failed:%',label;END IF;INSERT INTO sitov67_checks VALUES(label,true);END $$;
CREATE TEMP TABLE sitov67_before AS SELECT oid,proowner,proacl,prosecdef,provolatile,proconfig,pg_get_functiondef(oid) definition FROM pg_proc WHERE oid='vocabulary_private.sitov_prepared_german_audio_url(text)'::regprocedure;
CREATE TEMP TABLE sitov67_metadata_before AS SELECT pg_get_functiondef('sitov_storage_private.sitov_audio_metadata(text,text)'::regprocedure) definition;
-- SITOV67_APPLY115
SELECT pg_temp.sitov67_check('prepared_oid_owner_acl_flags_exact',NOT EXISTS(SELECT oid,proowner,proacl,prosecdef,provolatile,proconfig FROM sitov67_before EXCEPT SELECT oid,proowner,proacl,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid='vocabulary_private.sitov_prepared_german_audio_url(text)'::regprocedure));
SELECT pg_temp.sitov67_check('proof_body_only_identity_changed',pg_get_functiondef('vocabulary_private.sitov_prepared_german_audio_url(text)'::regprocedure)=replace((SELECT definition FROM sitov67_before),:SITOV67_OLD,:SITOV67_NEW));
SELECT pg_temp.sitov67_check('readonly_and_write_lock_helper_exact',(SELECT definition FROM sitov67_metadata_before)=pg_get_functiondef('sitov_storage_private.sitov_audio_metadata(text,text)'::regprocedure));
SELECT pg_temp.sitov67_check('private_helper_no_frontend_execute',NOT has_function_privilege('anon','vocabulary_private.sitov_canonical_german_audio_path(text)','EXECUTE') AND NOT has_function_privilege('authenticated','vocabulary_private.sitov_canonical_german_audio_path(text)','EXECUTE') AND NOT has_function_privilege('service_role','vocabulary_private.sitov_canonical_german_audio_path(text)','EXECUTE'));
SELECT pg_temp.sitov67_check('prepared_owner_helper_execute',has_function_privilege((SELECT proowner FROM sitov67_before),'vocabulary_private.sitov_canonical_german_audio_path(text)'::regprocedure,'EXECUTE'));
CREATE TEMP TABLE sitov67_after_first AS SELECT pg_get_functiondef('vocabulary_private.sitov_prepared_german_audio_url(text)'::regprocedure) definition;
-- SITOV67_REPLAY115
SELECT pg_temp.sitov67_check('replay_exact',(SELECT definition FROM sitov67_after_first)=pg_get_functiondef('vocabulary_private.sitov_prepared_german_audio_url(text)'::regprocedure));
CREATE FUNCTION pg_temp.sitov67_error(label text,query text,wanted_state text,wanted_message text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE observed text;message text;
BEGIN
 BEGIN EXECUTE query;RAISE EXCEPTION 'expected_error_not_raised';
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS observed=RETURNED_SQLSTATE,message=MESSAGE_TEXT;
 IF observed<>wanted_state OR position(wanted_message IN message)=0 THEN RAISE EXCEPTION 'wrong_error:%:%:%',label,observed,message;END IF;END;
 INSERT INTO sitov67_checks VALUES(label,true);
END $$;
-- SITOV67_GOLDENS
SELECT pg_temp.sitov67_check('golden:'||label,vocabulary_private.sitov_canonical_german_audio_path(input)=expected) FROM sitov67_goldens;
CREATE TEMP TABLE sitov67_storage_before AS SELECT o.* FROM storage.objects o WHERE o.bucket_id='audio_cache' AND o.name IN(SELECT expected FROM sitov67_goldens UNION SELECT legacy FROM sitov67_goldens);
-- Keep original paths/rows untouched; vendor delete/path guards remain enabled.
SELECT pg_temp.sitov67_check('six_new_variant_assets_initially_missing',NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='audio_cache' AND name IN(SELECT expected FROM sitov67_goldens WHERE label=input AND expected<>legacy)));
-- Crafted old addresses carry valid-looking metadata but cannot satisfy variant lookups.
INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata)
SELECT 'audio_cache',legacy,'{"mimetype":"audio/mpeg","size":4096}'::jsonb,jsonb_build_object('engine','qwen3-tts','voice','sitov-qwen-male-de-v1','revision','sitov-qwen-base-bf16-v1','profileFingerprint','96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5','textSha256',encode(sha256(convert_to(spoken,'UTF8')),'hex'),'audioSha256',repeat('a',64),'wordTimings','[{"start":0.35,"end":0.75}]'::jsonb) FROM sitov67_goldens WHERE label=input AND expected<>legacy ON CONFLICT(bucket_id,name) DO NOTHING;
SELECT pg_temp.sitov67_error('legacy_only_rejected:'||label,format('SELECT vocabulary_private.sitov_prepared_german_audio_url(%L)',input),'22023','prepared_audio_required') FROM sitov67_goldens WHERE label=input AND expected<>legacy;
INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata)
SELECT 'audio_cache',expected,'{"mimetype":"audio/mpeg","size":4096}'::jsonb,jsonb_build_object('engine','qwen3-tts','voice','sitov-qwen-male-de-v1','revision','sitov-qwen-base-bf16-v1','profileFingerprint','96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5','textSha256',encode(sha256(convert_to(spoken,'UTF8')),'hex'),'audioSha256',repeat('a',64),'wordTimings',(SELECT jsonb_agg(jsonb_build_object('start',n-1+0.35,'end',n-1+0.75) ORDER BY n) FROM unnest(string_to_array(spoken,' ')) WITH ORDINALITY t(word,n))) FROM (SELECT DISTINCT spoken,expected FROM sitov67_goldens) x ON CONFLICT(bucket_id,name) DO NOTHING;
SELECT pg_temp.sitov67_check('prepared:'||label,vocabulary_private.sitov_prepared_german_audio_url(input)='storage://audio_cache/'||expected) FROM sitov67_goldens;
SELECT pg_temp.sitov67_check('write_storage_rowshare_lock',EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND relation='storage.objects'::regclass AND mode='RowShareLock' AND granted));
-- Independent malformed metadata and missing assets must reject the new key.
-- SITOV67_NEGATIVE_METADATA
SELECT pg_temp.sitov67_check('original_storage_rows_untouched_inside_transaction',NOT EXISTS(SELECT to_jsonb(o) FROM sitov67_storage_before o EXCEPT SELECT to_jsonb(o) FROM storage.objects o WHERE bucket_id='audio_cache'));
-- SITOV67_UNKNOWN_BASELINE
SELECT jsonb_build_object('checks',(SELECT count(*) FROM sitov67_checks),'allPassed',(SELECT bool_and(passed) FROM sitov67_checks),'serverVersion',current_setting('server_version'),'role',current_user,'fixtureMetadataOnly',true);
ROLLBACK;
SELECT jsonb_build_object('archiveAbsent',to_regclass('path_private.sitov_content_revisions') IS NULL,'variantHelperAbsent',to_regprocedure('vocabulary_private.sitov_canonical_german_audio_path(text)') IS NULL);
