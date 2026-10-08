-- Sitov Academy native media analytics smoke after migration 91.
-- Synthetic identities, metadata and view receipts remain in one transaction.
-- No files are uploaded and no fixture or queued notification is committed.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF position('sitov-media-visibility-v1' IN pg_get_functiondef('public.get_learning_progress(uuid,text,integer)'::regprocedure))=0 THEN
  RAISE EXCEPTION 'sitov_media_smoke_migration_missing';
 END IF;
END $$;
SELECT set_config('sitov.media_smoke.'||k,gen_random_uuid()::text,true)
 FROM unnest(ARRAY['student','other','teacher','folder','selected_link','excluded_link','upload','draft','presentation']) k;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at)
 SELECT current_setting('sitov.media_smoke.'||k)::uuid,current_setting('sitov.media_smoke.'||k)||'@sitov-media-smoke.invalid',now(),
  '{}'::jsonb,'{}'::jsonb,'authenticated','authenticated',now(),now() FROM unnest(ARRAY['student','other','teacher']) k;
INSERT INTO public.profiles(id,role,ui_language,notify_pronunciation_feedback,notify_new_content,notify_learning_reminders)
 SELECT current_setting('sitov.media_smoke.'||k)::uuid,CASE WHEN k='teacher' THEN 'teacher' ELSE 'student' END::public.profile_role,
  'ru',false,false,false FROM unnest(ARRAY['student','other','teacher']) k
 ON CONFLICT(id) DO UPDATE SET role=excluded.role,ui_language='ru',notify_pronunciation_feedback=false,notify_new_content=false,notify_learning_reminders=false;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.media_smoke.teacher'),true);
INSERT INTO public.lms_media_folder(folder_id,level,title)
 VALUES(current_setting('sitov.media_smoke.folder')::uuid,'A1.1','Sitov media smoke folder');
INSERT INTO public.learning_units(id,level,trainer,label,is_active)
 SELECT current_setting('sitov.media_smoke.'||k)::uuid,'A1.1','videos','Sitov media '||replace(k,'_',' '),true
 FROM unnest(ARRAY['selected_link','excluded_link','upload','draft']) k;
INSERT INTO public.learning_videos(id,unit_id,folder_id,title,source_url)
 SELECT current_setting('sitov.media_smoke.'||k)::uuid,current_setting('sitov.media_smoke.'||k)::uuid,
  current_setting('sitov.media_smoke.folder')::uuid,
  CASE WHEN k='selected_link' THEN NULL ELSE 'Sitov media '||replace(k,'_',' ') END,'https://example.com/sitov-media/'||k
 FROM unnest(ARRAY['selected_link','excluded_link','draft']) k;
INSERT INTO storage.objects(bucket_id,name,owner_id,metadata)
 VALUES('course-assets','A1.1/'||current_setting('sitov.media_smoke.folder')||'/videos/'||current_setting('sitov.media_smoke.upload')||'.mp4',
  current_setting('sitov.media_smoke.teacher'),'{"size":128,"mimetype":"video/mp4"}'),
 ('course-assets','A1.1/'||current_setting('sitov.media_smoke.folder')||'/presentations/'||current_setting('sitov.media_smoke.presentation')||'.pdf',
  current_setting('sitov.media_smoke.teacher'),'{"size":128,"mimetype":"application/pdf"}');
INSERT INTO public.learning_videos(id,unit_id,folder_id,title,storage_path,file_size)
 VALUES(current_setting('sitov.media_smoke.upload')::uuid,current_setting('sitov.media_smoke.upload')::uuid,
  current_setting('sitov.media_smoke.folder')::uuid,'Sitov media upload',
  'A1.1/'||current_setting('sitov.media_smoke.folder')||'/videos/'||current_setting('sitov.media_smoke.upload')||'.mp4',128);
INSERT INTO public.lms_presentation_asset(asset_id,folder_id,file_name,storage_path,mime_type,file_size)
 VALUES(current_setting('sitov.media_smoke.presentation')::uuid,current_setting('sitov.media_smoke.folder')::uuid,'Sitov media notes.pdf',
  'A1.1/'||current_setting('sitov.media_smoke.folder')||'/presentations/'||current_setting('sitov.media_smoke.presentation')||'.pdf','application/pdf',128);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.set_student_level_access(current_setting('sitov.media_smoke.student')::uuid,ARRAY['A1.1']);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_media_smoke_level_grant_failed: %',r; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.media_smoke.student'),true);
DO $$ DECLARE r jsonb; k text; BEGIN
 FOREACH k IN ARRAY ARRAY['selected_link','excluded_link','upload','draft'] LOOP
  r:=public.record_media_view('video',current_setting('sitov.media_smoke.'||k)::uuid);
  IF r->>'recorded' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'sitov_media_smoke_video_view_failed: % / %',k,r; END IF;
 END LOOP;
 r:=public.record_media_view('presentation',current_setting('sitov.media_smoke.presentation')::uuid);
 IF r->>'recorded' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'sitov_media_smoke_presentation_view_failed: %',r; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.media_smoke.teacher'),true);
UPDATE public.learning_units SET is_active=false WHERE id=current_setting('sitov.media_smoke.draft')::uuid;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.set_student_trainer_access(current_setting('sitov.media_smoke.student')::uuid,'A1.1','videos',true,
  ARRAY[current_setting('sitov.media_smoke.selected_link')::uuid],true);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_media_smoke_selection_failed: %',r; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.media_smoke.student'),true);
DO $$ DECLARE r jsonb; expected bigint; titles text[]; BEGIN
 -- Compare against actual learner RLS, including pre-existing live media.
 SELECT (SELECT count(*) FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id
   WHERE u.level='A1.1' AND u.is_active AND ((v.storage_path IS NOT NULL AND v.file_size>0)
    OR (v.storage_path IS NULL AND nullif(btrim(v.source_url),'') IS NOT NULL)))
  +(SELECT count(*) FROM public.lms_presentation_asset a JOIN public.lms_media_folder f ON f.folder_id=a.folder_id WHERE f.level='A1.1')
 INTO expected;
 r:=public.get_learning_progress(NULL,'A1.1',7);
 IF r->>'success' IS DISTINCT FROM 'true' OR (r#>>'{media,totalMedia}')::bigint IS DISTINCT FROM expected
  OR r#>>'{media,viewedMedia}' IS DISTINCT FROM '3' THEN RAISE EXCEPTION 'sitov_media_smoke_rls_or_selection_mismatch: % / %',expected,r->'media'; END IF;
 SELECT array_agg(item->>'title' ORDER BY item->>'title') INTO titles FROM jsonb_array_elements(r#>'{media,recent}') item;
 IF titles IS DISTINCT FROM ARRAY['Sitov media notes.pdf','Sitov media selected link','Sitov media upload'] THEN
  RAISE EXCEPTION 'sitov_media_smoke_recent_visibility_or_title_fallback_mismatch: %',titles; END IF;
 IF r->'daily'->6->'media'->>'views' IS DISTINCT FROM '5' THEN RAISE EXCEPTION 'sitov_media_smoke_history_missing'; END IF;
 PERFORM set_config('sitov.media_smoke.media', (r->'media')::text,true);
 PERFORM set_config('sitov.media_smoke.daily', (r->'daily')::text,true);
 PERFORM set_config('sitov.media_smoke.history',(SELECT jsonb_agg(to_jsonb(v) ORDER BY day,kind,object_id)::text
  FROM public.learning_media_views v WHERE v.auth_user_id=auth.uid()),true);
 BEGIN INSERT INTO public.learning_media_views(auth_user_id,day,kind,object_id,level)
  VALUES(auth.uid(),current_date,'video',gen_random_uuid(),'A1.1');
  RAISE EXCEPTION 'sitov_media_smoke_direct_history_write_allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.media_smoke.teacher'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.get_learning_progress(current_setting('sitov.media_smoke.student')::uuid,'A1.1',7);
 IF r->'media' IS DISTINCT FROM current_setting('sitov.media_smoke.media')::jsonb THEN RAISE EXCEPTION 'sitov_media_smoke_staff_used_own_rights'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.media_smoke.student'),true);
UPDATE public.profiles SET ui_language='de' WHERE id=auth.uid();
DO $$ DECLARE r jsonb; expected bigint; BEGIN
 SELECT (SELECT count(*) FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id
   WHERE u.level='A1.1' AND u.is_active AND v.storage_path IS NOT NULL AND v.file_size>0)
  +(SELECT count(*) FROM public.lms_presentation_asset a JOIN public.lms_media_folder f ON f.folder_id=a.folder_id WHERE f.level='A1.1') INTO expected;
 r:=public.get_learning_progress(NULL,'A1.1',7);
 IF (r#>>'{media,totalMedia}')::bigint IS DISTINCT FROM expected OR r#>>'{media,viewedMedia}' IS DISTINCT FROM '2'
  OR jsonb_array_length(r#>'{media,recent}')<>2 OR EXISTS(SELECT 1 FROM jsonb_array_elements(r#>'{media,recent}') i WHERE i->>'kind'='link')
  OR r->'daily' IS DISTINCT FROM current_setting('sitov.media_smoke.daily')::jsonb THEN RAISE EXCEPTION 'sitov_media_smoke_german_branch_mismatch: %',r->'media'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.media_smoke.teacher'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.set_student_trainer_access(current_setting('sitov.media_smoke.student')::uuid,'A1.1','videos',false,NULL,false);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_media_smoke_disable_failed: %',r; END IF;
 r:=public.get_learning_progress(current_setting('sitov.media_smoke.student')::uuid,'A1.1',7);
 IF r->'media' IS DISTINCT FROM '{"totalMedia":0,"viewedMedia":0,"recent":[]}'::jsonb
  OR r->'daily' IS DISTINCT FROM current_setting('sitov.media_smoke.daily')::jsonb THEN RAISE EXCEPTION 'sitov_media_smoke_disabled_staff_mismatch: %',r->'media'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.media_smoke.student'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.get_learning_progress(NULL,'A1.1',7);
 IF r->'media' IS DISTINCT FROM '{"totalMedia":0,"viewedMedia":0,"recent":[]}'::jsonb
  OR EXISTS(SELECT 1 FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id WHERE u.level='A1.1')
  OR EXISTS(SELECT 1 FROM public.lms_presentation_asset a JOIN public.lms_media_folder f ON f.folder_id=a.folder_id WHERE f.level='A1.1') THEN
  RAISE EXCEPTION 'sitov_media_smoke_disabled_rls_mismatch'; END IF;
 UPDATE public.profiles SET ui_language='ru' WHERE id=auth.uid();
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.media_smoke.teacher'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.set_student_trainer_access(current_setting('sitov.media_smoke.student')::uuid,'A1.1','videos',true,ARRAY[]::uuid[],true);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_media_smoke_empty_selection_failed: %',r; END IF;
 r:=public.get_learning_progress(current_setting('sitov.media_smoke.student')::uuid,'A1.1',7);
 IF r#>>'{media,viewedMedia}' IS DISTINCT FROM '2' OR jsonb_array_length(r#>'{media,recent}')<>2 THEN
  RAISE EXCEPTION 'sitov_media_smoke_uploads_inherited_link_selection: %',r->'media'; END IF;
 r:=public.set_student_level_access(current_setting('sitov.media_smoke.student')::uuid,ARRAY[]::text[]);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_media_smoke_level_revoke_failed: %',r; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.media_smoke.student'),true);
DO $$ DECLARE r jsonb; history jsonb; BEGIN
 r:=public.get_learning_progress(NULL,'A1.1',7);
 SELECT jsonb_agg(to_jsonb(v) ORDER BY day,kind,object_id) INTO history FROM public.learning_media_views v WHERE v.auth_user_id=auth.uid();
 IF r->'media' IS DISTINCT FROM '{"totalMedia":0,"viewedMedia":0,"recent":[]}'::jsonb
  OR r->'daily' IS DISTINCT FROM current_setting('sitov.media_smoke.daily')::jsonb
  OR history IS DISTINCT FROM current_setting('sitov.media_smoke.history')::jsonb THEN
  RAISE EXCEPTION 'sitov_media_smoke_revoked_scope_or_history_mismatch'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.media_smoke.other'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.get_learning_progress(current_setting('sitov.media_smoke.student')::uuid,'A1.1',7);
 IF r->>'error' IS DISTINCT FROM 'not_authorized' THEN RAISE EXCEPTION 'sitov_media_smoke_peer_read_allowed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.get_learning_progress(uuid,text,integer)','EXECUTE') THEN
  RAISE EXCEPTION 'sitov_media_smoke_anonymous_read_allowed'; END IF;
END $$;
ROLLBACK;
SELECT 'Sitov media analytics native smoke passed; every fixture rolled back' AS result;
