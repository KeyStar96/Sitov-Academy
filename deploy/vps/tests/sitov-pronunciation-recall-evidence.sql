-- Native smoke for VPS migration 90. Fixtures stay in an inactive vocabulary
-- unit and inside this rolled-back transaction; no task or audio is published.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
SELECT set_config('sitov.recall.student',gen_random_uuid()::text,true),
 set_config('sitov.recall.other',gen_random_uuid()::text,true),
 set_config('sitov.recall.unit',gen_random_uuid()::text,true),
 set_config('sitov.recall.card',gen_random_uuid()::text,true),
 set_config('sitov.recall.request',gen_random_uuid()::text,true);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at)
 SELECT current_setting('sitov.recall.'||k)::uuid,current_setting('sitov.recall.'||k)||'@sitov-recall.invalid',
 '{}'::jsonb,'{}'::jsonb,'authenticated','authenticated',now(),now() FROM unnest(ARRAY['student','other']) k;
INSERT INTO public.profiles(id,role,native_language,ui_language,notify_pronunciation_feedback,notify_new_content,notify_learning_reminders)
 SELECT current_setting('sitov.recall.'||k)::uuid,'student','ru','ru',false,false,false
 FROM unnest(ARRAY['student','other']) k ON CONFLICT(id) DO UPDATE
 SET role='student',native_language='ru',ui_language='ru',notify_pronunciation_feedback=false,notify_new_content=false,notify_learning_reminders=false;
INSERT INTO public.student_level_access(auth_user_id,level)
 VALUES(current_setting('sitov.recall.student')::uuid,'A1.1');
INSERT INTO public.learning_units(id,level,trainer,label,is_active)
 VALUES(current_setting('sitov.recall.unit')::uuid,'A1.1','vocabulary','Sitov Recall-Prüfung',false);
INSERT INTO public.learning_vocabulary_cards(id,unit_id,word_de)
 VALUES(current_setting('sitov.recall.card')::uuid,current_setting('sitov.recall.unit')::uuid,'Mann');
INSERT INTO public.vocabulary_direction_progress(auth_user_id,card_id,direction,box_number)
 SELECT current_setting('sitov.recall.student')::uuid,current_setting('sitov.recall.card')::uuid,direction::public.vocabulary_direction,3
 FROM unnest(ARRAY['native_to_de','de_to_native']) direction;
INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,typed_answer,ui_language,response)
 SELECT p.auth_user_id,current_setting('sitov.recall.request')::uuid,p.id,'Mann','ru',
 '{"success":true,"isCorrect":true,"correctAnswer":"Mann"}'::jsonb
 FROM public.vocabulary_direction_progress p WHERE p.card_id=current_setting('sitov.recall.card')::uuid AND p.direction='native_to_de';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.recall.student'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.sitov_get_pronunciation_readiness('A1.1');
 IF r->'stats'->>'knownWords'<>'1' THEN RAISE EXCEPTION 'sitov_recall_typed_and_flashcard_not_counted: %',r; END IF;
 IF r->>'tier'<>'0' THEN RAISE EXCEPTION 'sitov_recall_missing_other_milestones_ignored'; END IF;
 BEGIN PERFORM sitov_pronunciation_private.evidence(auth.uid()); RAISE EXCEPTION 'sitov_recall_private_evidence_exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.recall.other'),true);
DO $$ BEGIN
 BEGIN PERFORM public.sitov_get_pronunciation_readiness('A1.1',current_setting('sitov.recall.student')::uuid); RAISE EXCEPTION 'sitov_recall_foreign_evidence_exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.vocabulary_direction_progress SET box_number=2
 WHERE card_id=current_setting('sitov.recall.card')::uuid AND direction='de_to_native';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.recall.student'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.sitov_get_pronunciation_readiness('A1.1');
 IF r->'stats'->>'knownWords'<>'0' THEN RAISE EXCEPTION 'sitov_recall_weak_reverse_direction_ignored'; END IF;
END $$;
RESET ROLE;
UPDATE public.vocabulary_direction_progress SET box_number=3
 WHERE card_id=current_setting('sitov.recall.card')::uuid AND direction='de_to_native';
UPDATE vocabulary_private.answer_receipts SET typed_answer=NULL
 WHERE request_id=current_setting('sitov.recall.request')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.recall.student'),true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.sitov_get_pronunciation_readiness('A1.1');
 IF r->'stats'->>'knownWords'<>'0' THEN RAISE EXCEPTION 'sitov_recall_self_rating_only_counted'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Sitov pronunciation recall evidence native smoke passed; all fixtures rolled back' AS result;
