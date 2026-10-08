-- Transactional native PostgreSQL smoke: no synthetic learner/content survives.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
SELECT set_config('sitov.parity.student',gen_random_uuid()::text,true),
 set_config('sitov.parity.other',gen_random_uuid()::text,true),
 set_config('sitov.parity.challenge',gen_random_uuid()::text,true);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at)
 SELECT current_setting('sitov.parity.'||k)::uuid,current_setting('sitov.parity.'||k)||'@sitov-parity.invalid',
 '{}'::jsonb,'{}'::jsonb,'authenticated','authenticated',now(),now() FROM unnest(ARRAY['student','other']) k;
INSERT INTO public.profiles(id,role,ui_language,notify_pronunciation_feedback,notify_new_content,notify_learning_reminders)
 SELECT current_setting('sitov.parity.'||k)::uuid,'student'::public.profile_role,'ru',false,false,false FROM unnest(ARRAY['student','other']) k
 ON CONFLICT(id) DO UPDATE SET role='student',ui_language='ru',notify_pronunciation_feedback=false,notify_new_content=false,notify_learning_reminders=false;
INSERT INTO public.student_level_access(auth_user_id,level)
 SELECT current_setting('sitov.parity.student')::uuid,l FROM unnest(ARRAY['A1.1','A1.2']) l ON CONFLICT DO NOTHING;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.parity.student'),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.sitov_set_verb_box('A1.2',ARRAY['sitov-verb-fahren','sitov-verb-arbeiten'],true);
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_parity_box_failed: %',r; END IF;
END $$;
RESET ROLE;
DO $$
DECLARE learner uuid:=current_setting('sitov.parity.student')::uuid; cid uuid; r jsonb; box integer; tomorrow timestamptz;
 before_progress jsonb; before_receipts jsonb; before_activity jsonb; row_progress jsonb; wrong uuid;
BEGIN
 tomorrow:=sitov_verb_private.review_day(clock_timestamp(),1);
 FOR box IN 1..6 LOOP
  DELETE FROM public.sitov_verb_progress WHERE auth_user_id=learner;
  INSERT INTO public.sitov_verb_progress(auth_user_id,verb_id,tense,box,attempts,correct,lapses,next_review_at)
   VALUES(learner,'sitov-verb-fahren','present',box,10,8,2,'2020-01-01');
  cid:=gen_random_uuid();
  INSERT INTO public.sitov_verb_challenges(id,auth_user_id,verb_id,context_level,tense,expected,solution)
   VALUES(cid,learner,'sitov-verb-fahren','A1.2','present','[["fährt"]]','fährt');
  r:=public.sitov_submit_verb_answer(cid,'["wrong"]');
  IF r->>'correct'<>'false' OR r->'progress'->>'box'<>'1' OR r->'progress'->>'attempts'<>'11'
   OR r->'progress'->>'lapses'<>'3' OR (r->'progress'->>'nextReviewAt')::timestamptz<>tomorrow THEN
   RAISE EXCEPTION 'sitov_parity_wrong_phase_failed: %',r; END IF;
  IF public.sitov_submit_verb_answer(cid,'["wrong"]')<>r THEN RAISE EXCEPTION 'sitov_parity_receipt_replay_failed'; END IF;
  wrong:=cid;
 END LOOP;
 SELECT to_jsonb(p) INTO before_progress FROM public.sitov_verb_progress p WHERE auth_user_id=learner;
 SELECT jsonb_agg(to_jsonb(c) ORDER BY id) INTO before_receipts FROM public.sitov_verb_challenges c WHERE auth_user_id=learner;
 SELECT jsonb_agg(to_jsonb(d) ORDER BY day) INTO before_activity FROM public.learning_activity_days d WHERE auth_user_id=learner;
 r:=public.sitov_check_verb_retry(wrong,'["fährt"]');
 IF r->>'correct'<>'true' OR r->>'retry'<>'true' THEN RAISE EXCEPTION 'sitov_parity_retry_failed: %',r; END IF;
 IF before_progress IS DISTINCT FROM (SELECT to_jsonb(p) FROM public.sitov_verb_progress p WHERE auth_user_id=learner)
  OR before_receipts IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.sitov_verb_challenges c WHERE auth_user_id=learner)
  OR before_activity IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(d) ORDER BY day) FROM public.learning_activity_days d WHERE auth_user_id=learner)
 THEN RAISE EXCEPTION 'sitov_parity_retry_wrote_learning_records'; END IF;
 FOR box IN 1..6 LOOP
  DELETE FROM public.sitov_verb_progress WHERE auth_user_id=learner;
  INSERT INTO public.sitov_verb_progress(auth_user_id,verb_id,tense,box,next_review_at)
   VALUES(learner,'sitov-verb-fahren','present',box,'2020-01-01');
  cid:=gen_random_uuid();
  INSERT INTO public.sitov_verb_challenges(id,auth_user_id,verb_id,context_level,tense,expected,solution)
   VALUES(cid,learner,'sitov-verb-fahren','A1.2','present','[["fährt"]]','fährt');
  r:=public.sitov_submit_verb_answer(cid,'["fährt"]');
  IF r->>'correct'<>'true' OR (r->'progress'->>'box')::integer<>box+1 THEN RAISE EXCEPTION 'sitov_parity_right_phase_failed: %',r; END IF;
  IF box=6 THEN
   IF r->'progress'->'nextReviewAt'<>'null'::jsonb THEN RAISE EXCEPTION 'sitov_parity_archive_date_failed: %',r; END IF;
  ELSE
   IF (r->'progress'->>'nextReviewAt')::timestamptz<>sitov_verb_private.review_day(clock_timestamp(),(ARRAY[1,3,9,29,90])[box]) THEN
    RAISE EXCEPTION 'sitov_parity_interval_failed: %',r; END IF;
  END IF;
 END LOOP;
 cid:=gen_random_uuid();
 INSERT INTO public.sitov_verb_challenges(id,auth_user_id,verb_id,context_level,tense,expected,solution)
  VALUES(cid,learner,'sitov-verb-fahren','A1.2','present','[["fährt"]]','fährt');
 r:=public.sitov_submit_verb_answer(cid,'["fährt"]');
 IF r->>'error'<>'review_not_due' THEN RAISE EXCEPTION 'sitov_parity_archive_review_accepted: %',r; END IF;
 -- Check the actual latest vocabulary implementations, preserving all other code.
 IF position('ELSE 1 END;' IN pg_get_functiondef('vocabulary_private.submit_answer(uuid,boolean,text,text)'::regprocedure))=0
  OR position('ELSE 1 END;' IN pg_get_functiondef('vocabulary_private.submit_self_rating(uuid,boolean,text)'::regprocedure))=0 THEN
  RAISE EXCEPTION 'sitov_parity_vocabulary_wrong_phase_missing'; END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('sitov.parity.other'),true);
 IF public.sitov_check_verb_retry(wrong,'["fährt"]')->>'error'<>'not_found' THEN RAISE EXCEPTION 'sitov_parity_peer_retry_allowed'; END IF;
END $$;
-- Exercise both real vocabulary grading RPCs from a later phase too.
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.parity.student'),true),
 set_config('sitov.parity.card',gen_random_uuid()::text,true);
INSERT INTO public.learning_vocabulary_cards(id,unit_id,word_de,article)
 SELECT current_setting('sitov.parity.card')::uuid,u.id,'Haus','das'::public.grammatical_article
 FROM public.learning_units u WHERE u.level='A1.1' AND u.trainer='vocabulary' AND u.is_active
  AND u.owner_auth_user_id IS NULL ORDER BY u.id LIMIT 1;
INSERT INTO public.vocabulary_translations(card_id,locale,translation)
 VALUES(current_setting('sitov.parity.card')::uuid,'ru','дом'),(current_setting('sitov.parity.card')::uuid,'de','Haus');
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.initialize_vocabulary_cards(jsonb_build_array(jsonb_build_object('cardId',current_setting('sitov.parity.card'),'alreadyKnown',false)));
 IF r ? 'error' THEN RAISE EXCEPTION 'sitov_parity_vocabulary_init_failed: %',r; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE learner uuid:=current_setting('sitov.parity.student')::uuid; progress uuid; request uuid; r jsonb; mode text;
BEGIN
 SELECT id INTO STRICT progress FROM public.vocabulary_direction_progress WHERE auth_user_id=learner
  AND card_id=current_setting('sitov.parity.card')::uuid AND direction='native_to_de';
 FOREACH mode IN ARRAY ARRAY['typed','flashcard'] LOOP
  UPDATE public.vocabulary_direction_progress SET box_number=6,next_review_date='2020-01-01',last_answered_at=NULL WHERE id=progress;
  DELETE FROM public.vocabulary_learning_state WHERE auth_user_id=learner;
  request:=gen_random_uuid();
  IF mode='typed' THEN
   r:=public.submit_vocabulary_answer_once(request,progress,NULL,'das Auto','ru');
   IF public.submit_vocabulary_answer_once(request,progress,NULL,'das Auto','ru')<>r THEN RAISE EXCEPTION 'sitov_parity_vocab_receipt_failed'; END IF;
  ELSE
   r:=public.submit_vocabulary_self_rating_once(request,progress,false,'ru');
   IF public.submit_vocabulary_self_rating_once(request,progress,false,'ru')<>r THEN RAISE EXCEPTION 'sitov_parity_vocab_self_receipt_failed'; END IF;
  END IF;
  IF r->>'isCorrect'<>'false' OR r->>'newPhase'<>'1' OR r->>'intervalInDays'<>'1' OR NOT EXISTS(
   SELECT 1 FROM public.vocabulary_direction_progress p WHERE p.id=progress AND p.box_number=1
    AND p.next_review_date=sitov_verb_private.review_day(clock_timestamp(),1)) THEN
   RAISE EXCEPTION 'sitov_parity_vocabulary_wrong_phase_failed in %: %',mode,r; END IF;
 END LOOP;
END $$;
DO $$ BEGIN
 IF has_function_privilege('anon','public.sitov_check_verb_retry(uuid,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','public.sitov_verb_challenges','SELECT') THEN
  RAISE EXCEPTION 'sitov_parity_answer_key_exposed'; END IF;
END $$;
ROLLBACK;
SELECT 'Sitov vocabulary/verb parity smoke passed; every fixture rolled back' AS result;
