-- Native production smoke. All synthetic users, activity and transactional
-- mail enqueue records remain uncommitted and end in ROLLBACK. Workers cannot
-- observe them. No real learner or teacher row is changed. The native Auth
-- trigger requires a valid email; random reserved .invalid addresses satisfy
-- identity checks, remain unconfirmed, and are discarded by this rollback.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
SELECT set_config('sitov.smoke.student',gen_random_uuid()::text,true),set_config('sitov.smoke.other',gen_random_uuid()::text,true),set_config('sitov.smoke.teacher',gen_random_uuid()::text,true),set_config('sitov.smoke.challenge',gen_random_uuid()::text,true);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at)
 SELECT current_setting('sitov.smoke.'||k)::uuid,current_setting('sitov.smoke.'||k)||'@sitov-smoke.invalid','{}'::jsonb,'{}'::jsonb,'authenticated','authenticated',now(),now() FROM unnest(ARRAY['student','other','teacher']) k;
INSERT INTO public.profiles(id,role,ui_language,notify_pronunciation_feedback,notify_new_content,notify_learning_reminders)
 SELECT current_setting('sitov.smoke.'||k)::uuid,CASE WHEN k='teacher' THEN 'teacher' ELSE 'student' END::public.profile_role,'ru',false,false,false FROM unnest(ARRAY['student','other','teacher']) k
 ON CONFLICT(id) DO UPDATE SET role=excluded.role,ui_language='ru',notify_pronunciation_feedback=false,notify_new_content=false,notify_learning_reminders=false;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.sitov_verb_catalog)<>960 THEN RAISE EXCEPTION 'sitov_catalog_count_mismatch'; END IF;
 IF (SELECT count(*) FROM public.sitov_verb_catalog c JOIN public.learning_units u ON u.id=c.unit_id AND u.level=c.level AND u.trainer='verbs' AND u.is_active)<>960 THEN RAISE EXCEPTION 'sitov_catalog_unit_mismatch'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.smoke.teacher'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.set_student_level_access(current_setting('sitov.smoke.student')::uuid,ARRAY['A1.1','A1.2']); IF r ? 'error' THEN RAISE EXCEPTION 'sitov_fixture_level_grant_failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.smoke.student'),true);
RESET ROLE;
DO $$ BEGIN
 IF NOT trainer_access_private.allowed('A1.1','verbs') OR trainer_access_private.allowed('B2','verbs') THEN RAISE EXCEPTION 'sitov_entitlement_mismatch'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.sitov_set_verb_box('A1.2',ARRAY['sitov-verb-fahren'],true); IF r ? 'error' THEN RAISE EXCEPTION 'sitov_box_add_failed'; END IF;
 BEGIN INSERT INTO public.sitov_verb_progress(auth_user_id,verb_id,tense,box) VALUES(auth.uid(),'sitov-verb-fahren','present',7); RAISE EXCEPTION 'sitov_forged_grade_accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM 1 FROM public.sitov_verb_challenges; RAISE EXCEPTION 'sitov_answer_key_exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO public.sitov_verb_challenges(id,auth_user_id,verb_id,context_level,tense,expected,solution)
 VALUES(current_setting('sitov.smoke.challenge')::uuid,current_setting('sitov.smoke.student')::uuid,'sitov-verb-fahren','A1.2','perfect','[["ist"],["gefahren"]]','ist gefahren');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.smoke.student'),true);
DO $$ DECLARE r jsonb; retry jsonb; BEGIN
 r:=public.sitov_submit_verb_answer(current_setting('sitov.smoke.challenge')::uuid,'["  IST  ","gefahren"]');
 IF r->>'correct'<>'true' OR r->'progress'->>'box'<>'2' THEN RAISE EXCEPTION 'sitov_atomic_grade_failed: %',r; END IF;
 retry:=public.sitov_submit_verb_answer(current_setting('sitov.smoke.challenge')::uuid,'["  IST  ","gefahren"]'); IF r<>retry OR retry->'progress'->>'attempts'<>'1' THEN RAISE EXCEPTION 'sitov_idempotence_failed'; END IF;
 PERFORM public.sitov_set_verb_box('A1.2',ARRAY['sitov-verb-fahren'],false);
 r:=public.sitov_submit_verb_answer(current_setting('sitov.smoke.challenge')::uuid,'["  IST  ","gefahren"]'); IF r->>'error'<>'not_authorized' THEN RAISE EXCEPTION 'sitov_removed_verb_replayed'; END IF;
 PERFORM public.sitov_set_verb_box('A1.2',ARRAY['sitov-verb-fahren'],true);
 IF (SELECT attempts FROM public.sitov_verb_progress WHERE auth_user_id=auth.uid() AND verb_id='sitov-verb-fahren' AND tense='perfect')<>1 THEN RAISE EXCEPTION 'sitov_remove_reset_progress'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.smoke.other'),true);
DO $$ DECLARE r jsonb; BEGIN
 IF EXISTS(SELECT 1 FROM public.sitov_verb_progress) THEN RAISE EXCEPTION 'sitov_foreign_progress_visible'; END IF;
 r:=public.sitov_submit_verb_answer(current_setting('sitov.smoke.challenge')::uuid,'["ist","gefahren"]'); IF r->>'error'<>'not_found' THEN RAISE EXCEPTION 'sitov_foreign_challenge_accepted'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.smoke.teacher'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.set_student_trainer_access(current_setting('sitov.smoke.student')::uuid,'B2','verbs',true,NULL,false); IF r ? 'error' THEN RAISE EXCEPTION 'sitov_advanced_grant_failed'; END IF;
 r:=public.set_student_trainer_access(current_setting('sitov.smoke.student')::uuid,'A1.1','verbs',false,NULL,false); IF r ? 'error' THEN RAISE EXCEPTION 'sitov_revoke_failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.smoke.student'),true);
RESET ROLE;
DO $$ BEGIN
 IF NOT trainer_access_private.allowed('B2','verbs') OR trainer_access_private.allowed('B2','vocabulary') OR trainer_access_private.allowed('B2','exercises') OR trainer_access_private.allowed('B2','videos') THEN RAISE EXCEPTION 'sitov_advanced_other_trainer_unlocked'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 IF EXISTS(SELECT 1 FROM public.sitov_verb_catalog WHERE id='sitov-verb-fahren') THEN RAISE EXCEPTION 'sitov_revoked_content_visible'; END IF;
 r:=public.sitov_submit_verb_answer(current_setting('sitov.smoke.challenge')::uuid,'["  IST  ","gefahren"]'); IF r->>'error'<>'not_authorized' THEN RAISE EXCEPTION 'sitov_revoked_receipt_replayed'; END IF;
 IF (SELECT attempts FROM public.sitov_verb_progress WHERE auth_user_id=auth.uid() AND verb_id='sitov-verb-fahren' AND tense='perfect')<>1 THEN RAISE EXCEPTION 'sitov_revoke_reset_progress'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Sitov verb trainer native smoke passed; all fixtures rolled back' AS result;
