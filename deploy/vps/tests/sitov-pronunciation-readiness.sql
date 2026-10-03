-- Native pronunciation safety smoke. Only synthetic identities/content/audio
-- fixtures are used. The entire transaction rolls back before workers see it.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
SELECT set_config('sitov.readiness.student',gen_random_uuid()::text,true),
 set_config('sitov.readiness.other',gen_random_uuid()::text,true),
 set_config('sitov.readiness.teacher',gen_random_uuid()::text,true),
 set_config('sitov.readiness.unit',gen_random_uuid()::text,true),
 set_config('sitov.readiness.prompt',gen_random_uuid()::text,true),
 set_config('sitov.readiness.recording',gen_random_uuid()::text,true);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at)
 SELECT current_setting('sitov.readiness.'||k)::uuid,current_setting('sitov.readiness.'||k)||'@sitov-readiness.invalid',
 '{}'::jsonb,'{}'::jsonb,'authenticated','authenticated',now(),now() FROM unnest(ARRAY['student','other','teacher']) k;
INSERT INTO public.profiles(id,role,ui_language,notify_pronunciation_feedback,notify_new_content,notify_learning_reminders)
 SELECT current_setting('sitov.readiness.'||k)::uuid,CASE WHEN k='teacher' THEN 'teacher' ELSE 'student' END::public.profile_role,
 'ru',false,false,false FROM unnest(ARRAY['student','other','teacher']) k ON CONFLICT(id) DO UPDATE
 SET role=excluded.role,ui_language='ru',notify_pronunciation_feedback=false,notify_new_content=false,notify_learning_reminders=false;
INSERT INTO public.learning_units(id,level,trainer,label,is_active)
 VALUES(current_setting('sitov.readiness.unit')::uuid,'A1.1','pronunciation','Sitov Ausspracheprüfung',true);
INSERT INTO public.learning_reading_texts(id,unit_id,sentence_de)
 VALUES(current_setting('sitov.readiness.prompt')::uuid,current_setting('sitov.readiness.unit')::uuid,'Ich bin Leon. Ich lerne Deutsch.');
INSERT INTO storage.objects(bucket_id,name,owner_id)
 VALUES('pronunciation_audio',current_setting('sitov.readiness.student')||'/'||current_setting('sitov.readiness.recording')||'.webm',current_setting('sitov.readiness.student'));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.readiness.teacher'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.set_student_level_access(current_setting('sitov.readiness.student')::uuid,ARRAY['A1.1']);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_readiness_fixture_level_failed: %',r; END IF;
 r:=public.set_student_level_access(current_setting('sitov.readiness.other')::uuid,ARRAY['A1.1']);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_readiness_other_level_failed: %',r; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.readiness.student'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.sitov_get_pronunciation_readiness('A1.1');
 IF r->>'mode'<>'logical' OR r->>'tier'<>'0' OR r->'stats'->>'knownWords'<>'0' THEN RAISE EXCEPTION 'sitov_readiness_new_learner_unlocked: %',r; END IF;
 IF EXISTS(SELECT 1 FROM public.learning_reading_texts WHERE id=current_setting('sitov.readiness.prompt')::uuid) THEN RAISE EXCEPTION 'sitov_readiness_locked_body_exposed'; END IF;
 r:=public.sitov_set_pronunciation_access(auth.uid(),'A1.1','hard');
 IF r->>'error'<>'not_authorized' THEN RAISE EXCEPTION 'sitov_readiness_student_override_accepted'; END IF;
 BEGIN INSERT INTO public.sitov_pronunciation_access(auth_user_id,level,mode) VALUES(auth.uid(),'A1.1','hard'); RAISE EXCEPTION 'sitov_readiness_direct_override_accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',auth.uid()::text||'/'||gen_random_uuid()::text||'.webm'); RAISE EXCEPTION 'sitov_readiness_unready_upload_accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 r:=public.create_pronunciation_submission(current_setting('sitov.readiness.prompt')::uuid,'storage://pronunciation_audio/'||current_setting('sitov.readiness.student')||'/'||current_setting('sitov.readiness.recording')||'.webm');
 IF NOT r ? 'error' THEN RAISE EXCEPTION 'sitov_readiness_unready_submission_accepted'; END IF;
 BEGIN PERFORM public.sitov_get_pronunciation_readiness('A1.1',current_setting('sitov.readiness.other')::uuid); RAISE EXCEPTION 'sitov_readiness_foreign_evidence_exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.readiness.teacher'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.sitov_set_pronunciation_access(current_setting('sitov.readiness.student')::uuid,'A1.1','hard');
 IF r->>'success'<>'true' THEN RAISE EXCEPTION 'sitov_readiness_staff_override_failed: %',r; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.readiness.student'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.sitov_get_pronunciation_readiness('A1.1');
 IF r->>'mode'<>'hard' OR NOT EXISTS(SELECT 1 FROM public.learning_reading_texts WHERE id=current_setting('sitov.readiness.prompt')::uuid) THEN RAISE EXCEPTION 'sitov_readiness_staff_override_not_visible'; END IF;
 r:=public.create_pronunciation_submission(current_setting('sitov.readiness.prompt')::uuid,'storage://pronunciation_audio/'||current_setting('sitov.readiness.student')||'/'||current_setting('sitov.readiness.recording')||'.webm');
 IF jsonb_typeof(r)<>'string' THEN RAISE EXCEPTION 'sitov_readiness_ready_submission_failed: %',r; END IF;
 PERFORM set_config('sitov.readiness.submission',r#>>'{}',true);
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.readiness.other'),true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.submissions WHERE id=current_setting('sitov.readiness.submission')::uuid) THEN RAISE EXCEPTION 'sitov_readiness_foreign_recording_exposed'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE name=current_setting('sitov.readiness.student')||'/'||current_setting('sitov.readiness.recording')||'.webm') THEN RAISE EXCEPTION 'sitov_readiness_foreign_audio_exposed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.readiness.teacher'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.set_student_trainer_access(current_setting('sitov.readiness.student')::uuid,'A1.1','pronunciation',false,NULL,false);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_readiness_revoke_failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.readiness.student'),true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_reading_texts WHERE id=current_setting('sitov.readiness.prompt')::uuid) THEN RAISE EXCEPTION 'sitov_readiness_hard_bypassed_teacher_revoke'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.readiness.teacher'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.set_student_trainer_access(current_setting('sitov.readiness.student')::uuid,'A1.1','pronunciation',true,NULL,false);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_readiness_restore_failed'; END IF;
 r:=public.sitov_set_pronunciation_access(current_setting('sitov.readiness.student')::uuid,'A1.1','logical');
 IF r->>'success'<>'true' THEN RAISE EXCEPTION 'sitov_readiness_logical_restore_failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.readiness.student'),true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_reading_texts WHERE id=current_setting('sitov.readiness.prompt')::uuid) THEN RAISE EXCEPTION 'sitov_readiness_logical_restore_unlocked'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.submissions WHERE id=current_setting('sitov.readiness.submission')::uuid) THEN RAISE EXCEPTION 'sitov_readiness_existing_conversation_lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE name=current_setting('sitov.readiness.student')||'/'||current_setting('sitov.readiness.recording')||'.webm') THEN RAISE EXCEPTION 'sitov_readiness_existing_audio_lost'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Sitov pronunciation readiness native smoke passed; all fixtures rolled back' AS result;
