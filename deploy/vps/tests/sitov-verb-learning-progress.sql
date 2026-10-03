-- Sitov Academy native analytics smoke. Uses synthetic users and rolls back
-- every grant, answer, session and queued notification before workers see it.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
SELECT set_config('sitov.analytics.student',gen_random_uuid()::text,true),
 set_config('sitov.analytics.other',gen_random_uuid()::text,true),
 set_config('sitov.analytics.teacher',gen_random_uuid()::text,true),
 set_config('sitov.analytics.challenge',gen_random_uuid()::text,true);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at)
 SELECT current_setting('sitov.analytics.'||k)::uuid,current_setting('sitov.analytics.'||k)||'@sitov-analytics.invalid',
  '{}'::jsonb,'{}'::jsonb,'authenticated','authenticated',now(),now() FROM unnest(ARRAY['student','other','teacher']) k;
INSERT INTO public.profiles(id,role,ui_language,notify_pronunciation_feedback,notify_new_content,notify_learning_reminders)
 SELECT current_setting('sitov.analytics.'||k)::uuid,CASE WHEN k='teacher' THEN 'teacher' ELSE 'student' END::public.profile_role,
  'ru',false,false,false FROM unnest(ARRAY['student','other','teacher']) k
 ON CONFLICT(id) DO UPDATE SET role=excluded.role,ui_language='ru',notify_pronunciation_feedback=false,notify_new_content=false,notify_learning_reminders=false;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.analytics.teacher'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.set_student_level_access(current_setting('sitov.analytics.student')::uuid,ARRAY['A1.1','A1.2']);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_analytics_fixture_level_failed: %',r; END IF;
 r:=public.set_student_trainer_access(current_setting('sitov.analytics.student')::uuid,'B2','verbs',true,NULL,false);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_analytics_fixture_advanced_failed: %',r; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.analytics.student'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.sitov_set_verb_box('B2',ARRAY['sitov-verb-fahren','sitov-verb-sein'],true);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_analytics_fixture_box_failed: %',r; END IF;
END $$;
RESET ROLE;
INSERT INTO public.sitov_verb_challenges(id,auth_user_id,verb_id,context_level,tense,expected,solution,created_at)
 VALUES(current_setting('sitov.analytics.challenge')::uuid,current_setting('sitov.analytics.student')::uuid,
  'sitov-verb-fahren','B2','perfect','[["ist"],["gefahren"]]','ist gefahren',now()-interval '1 day');
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; replay jsonb; BEGIN
 r:=public.sitov_submit_verb_answer(current_setting('sitov.analytics.challenge')::uuid,'["ist","gefahren"]');
 IF r->>'correct'<>'true' THEN RAISE EXCEPTION 'sitov_analytics_fixture_answer_failed: %',r; END IF;
 replay:=public.sitov_submit_verb_answer(current_setting('sitov.analytics.challenge')::uuid,'["ist","gefahren"]');
 IF replay<>r THEN RAISE EXCEPTION 'sitov_analytics_duplicate_receipt'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.learning_sessions(auth_user_id,mode,level,started_at,ended_at,answer_count,study_seconds)
 VALUES(current_setting('sitov.analytics.student')::uuid,'verbs','B2',now()-interval '2 minutes',now(),2,120);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; v jsonb; d jsonb; n integer; BEGIN
 r:=public.get_learning_progress(NULL,'B2',7);
 IF r->>'success'<>'true' THEN RAISE EXCEPTION 'sitov_analytics_read_failed: %',r; END IF;
 d:=r->'daily'->6; v:=r->'verbs';
 IF d->'verbs'->>'answers'<>'1' OR d->'verbs'->>'correct'<>'1'
  OR d->'verbs'->>'seconds'<>'120' OR d->'verbs'->'perfect'->>'answers'<>'1'
  OR r->'daily'->5->'verbs'->>'answers'<>'0' THEN RAISE EXCEPTION 'sitov_analytics_day_or_replay_mismatch: %',d; END IF;
 IF v->>'inBox'<>'2' OR v->>'totalForms'<>'6' OR v->>'practicedForms'<>'1'
  OR v->>'confidentForms'<>'0' OR v->>'dueForms'<>'5' OR v->'buckets'->0->>'count'<>'5'
  OR jsonb_array_length(v->'tenses')<>3 THEN RAISE EXCEPTION 'sitov_analytics_cumulative_snapshot_mismatch: %',v; END IF;
 SELECT sum((b->>'count')::integer) INTO n FROM jsonb_array_elements(v->'buckets') b;
 IF n<>6 THEN RAISE EXCEPTION 'sitov_analytics_distribution_mismatch'; END IF;
 r:=public.get_learning_progress(NULL,'A1.1',7);
 IF r->'daily'->6->'verbs'->>'answers'<>'0' OR r->'verbs'->>'totalForms'<>'2' THEN
  RAISE EXCEPTION 'sitov_analytics_context_filter_mismatch: %',r; END IF;
 PERFORM public.sitov_set_verb_box('B2',ARRAY['sitov-verb-fahren'],false);
 r:=public.get_learning_progress(NULL,'B2',7);
 IF r->'verbs'->>'inBox'<>'1' OR r->'daily'->6->'verbs'->>'answers'<>'1' THEN
  RAISE EXCEPTION 'sitov_analytics_removal_erased_history: %',r; END IF;
 PERFORM public.sitov_set_verb_box('B2',ARRAY['sitov-verb-fahren'],true);
 IF (SELECT attempts FROM public.sitov_verb_progress WHERE auth_user_id=auth.uid() AND verb_id='sitov-verb-fahren' AND tense='perfect')<>1 THEN
  RAISE EXCEPTION 'sitov_analytics_selection_reset_progress'; END IF;
 BEGIN PERFORM 1 FROM public.sitov_verb_challenges; RAISE EXCEPTION 'sitov_analytics_answer_keys_exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.analytics.other'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.get_learning_progress(current_setting('sitov.analytics.student')::uuid,'B2',7);
 IF r->>'error'<>'not_authorized' THEN RAISE EXCEPTION 'sitov_analytics_peer_read_allowed: %',r; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.analytics.teacher'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.get_learning_progress(current_setting('sitov.analytics.student')::uuid,'B2',90);
 IF r->>'success'<>'true' OR jsonb_array_length(r->'daily')<>90 OR r->'verbs'->>'practicedForms'<>'1' THEN
  RAISE EXCEPTION 'sitov_analytics_teacher_read_failed: %',r; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.get_learning_progress(uuid,text,integer)','EXECUTE') THEN
  RAISE EXCEPTION 'sitov_analytics_anonymous_read_allowed'; END IF;
END $$;
ROLLBACK;
SELECT 'Sitov verb analytics smoke passed; every fixture rolled back' AS result;
