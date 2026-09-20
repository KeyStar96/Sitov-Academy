-- Phase 2.0 / ADR 001. Run after a verified R8 backup, inside the runner's transaction.
-- Rename only: no table recreation, no data changes, no identity merge.
DO $identity_columns$
DECLARE target record; relation oid; old_exists boolean; new_exists boolean;
BEGIN
 FOR target IN SELECT * FROM (VALUES
  ('public','student_level_access'),
  ('public','learning_trainer_grants'),
  ('public','learning_unit_grants'),
  ('public','user_exercise_progress'),
  ('public','vocabulary_direction_progress'),
  ('public','vocabulary_learning_state'),
  ('public','vocabulary_onboarding'),
  ('public','submissions'),
  ('vocabulary_private','answer_receipts'),
  ('learning_reset_private','audio_objects'),
  ('learning_reset_private','jobs')
 ) AS affected(schema_name,table_name) LOOP
  relation:=to_regclass(format('%I.%I',target.schema_name,target.table_name));
  IF relation IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='identity_alignment_missing_table',
    DETAIL=jsonb_build_object('error','identity_alignment_missing_table','message',format('Required table %I.%I is absent',target.schema_name,target.table_name))::text;
  END IF;
  SELECT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=relation AND attname='user_id' AND NOT attisdropped),
         EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=relation AND attname='auth_user_id' AND NOT attisdropped)
   INTO old_exists,new_exists;
  IF old_exists AND NOT new_exists THEN
   EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN user_id TO auth_user_id',target.schema_name,target.table_name);
  ELSIF NOT old_exists AND new_exists THEN
   CONTINUE;
  ELSE
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='identity_alignment_ambiguous_columns',
    DETAIL=jsonb_build_object('error','identity_alignment_ambiguous_columns','message',format('Expected exactly one identity column on %I.%I',target.schema_name,target.table_name))::text;
  END IF;
 END LOOP;
END $identity_columns$;

-- RLS/FK dependency trees follow the attribute rename automatically. Stored
-- function source does not. Use installed definitions so repeat runs preserve
-- subsequent fixes, function signatures, security options and existing ACLs.
-- PostgreSQL word boundaries include underscores: p_user_id is never replaced.
DO $identity_functions$
DECLARE target record; routine record; found_count integer;
BEGIN
 FOR target IN SELECT * FROM (VALUES
  ('grammar_private','record_attempt'),
  ('learning_private','reset_student_level'),
  ('learning_reset_private','assert_writable'),
  ('learning_reset_private','audio_batch'),
  ('learning_reset_private','begin_reset'),
  ('learning_reset_private','can_remove_audio'),
  ('learning_reset_private','finish_reset'),
  ('learning_reset_private','guard_write'),
  ('learning_reset_private','storage_writable'),
  ('pronunciation_private','can_access_submission'),
  ('pronunciation_private','create_submission'),
  ('public','set_student_level_access'),
  ('public','set_student_trainer_access'),
  ('trainer_access_private','allowed'),
  ('trainer_access_private','unit_allowed'),
  ('vocabulary_private','initialize_cards'),
  ('vocabulary_private','reset_lesson'),
  ('vocabulary_private','skip_assessment'),
  ('vocabulary_private','submit_answer'),
  ('vocabulary_private','submit_answer_once')
 ) AS affected(schema_name,function_name) LOOP
  found_count:=0;
  FOR routine IN SELECT p.oid,p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname=target.schema_name AND p.proname=target.function_name AND p.prokind='f'
  LOOP
   found_count:=found_count+1;
   IF routine.prosrc ~ '\muser_id\M' THEN
    EXECUTE regexp_replace(pg_get_functiondef(routine.oid),'\muser_id\M','auth_user_id','g');
   END IF;
  END LOOP;
  IF found_count=0 THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='identity_alignment_missing_function',
    DETAIL=jsonb_build_object('error','identity_alignment_missing_function','message',format('Required function %I.%I is absent',target.schema_name,target.function_name))::text;
  END IF;
 END LOOP;
END $identity_functions$;

-- Fail the surrounding transaction on schema drift rather than deploying an
-- application whose next request would evaluate an old identifier.
DO $identity_verify$
DECLARE stale text;
BEGIN
 SELECT string_agg(format('%I.%I.%I',table_schema,table_name,column_name),', ')
 INTO stale FROM information_schema.columns
 WHERE table_schema IN('public','vocabulary_private','learning_reset_private') AND column_name='user_id';
 IF stale IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='identity_alignment_stale_column',DETAIL=stale;
 END IF;
 SELECT string_agg(format('%I.%I',schemaname,policyname),', ') INTO stale FROM pg_policies
 WHERE schemaname IN('public','vocabulary_private','learning_reset_private')
  AND (coalesce(qual,'') ~ '\muser_id\M' OR coalesce(with_check,'') ~ '\muser_id\M');
 IF stale IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='identity_alignment_stale_policy',DETAIL=stale;
 END IF;
 SELECT string_agg(format('%I.%I',schemaname,viewname),', ') INTO stale FROM pg_views
 WHERE schemaname IN('public','vocabulary_private','learning_reset_private') AND definition ~ '\muser_id\M';
 IF stale IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='identity_alignment_stale_view',DETAIL=stale;
 END IF;
 SELECT string_agg(p.oid::regprocedure::text,', ') INTO stale FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('public','business_private','grammar_private','identity_private','learning_private',
  'learning_reset_private','platform_private','private','pronunciation_private','trainer_access_private','vocabulary_private')
  AND p.prokind='f' AND p.prosrc ~ '\muser_id\M';
 IF stale IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='identity_alignment_stale_function',DETAIL=stale;
 END IF;
END $identity_verify$;

-- ROLLBACK (after reversing any later dependent migrations; use one transaction):
-- ALTER TABLE public.student_level_access RENAME COLUMN auth_user_id TO user_id;
-- ALTER TABLE public.learning_trainer_grants RENAME COLUMN auth_user_id TO user_id;
-- ALTER TABLE public.learning_unit_grants RENAME COLUMN auth_user_id TO user_id;
-- ALTER TABLE public.user_exercise_progress RENAME COLUMN auth_user_id TO user_id;
-- ALTER TABLE public.vocabulary_direction_progress RENAME COLUMN auth_user_id TO user_id;
-- ALTER TABLE public.vocabulary_learning_state RENAME COLUMN auth_user_id TO user_id;
-- ALTER TABLE public.vocabulary_onboarding RENAME COLUMN auth_user_id TO user_id;
-- ALTER TABLE public.submissions RENAME COLUMN auth_user_id TO user_id;
-- ALTER TABLE vocabulary_private.answer_receipts RENAME COLUMN auth_user_id TO user_id;
-- ALTER TABLE learning_reset_private.audio_objects RENAME COLUMN auth_user_id TO user_id;
-- ALTER TABLE learning_reset_private.jobs RENAME COLUMN auth_user_id TO user_id;
-- Function restoration: run the identity_functions block above with ONLY its
-- regex condition changed to '\mauth_user_id\M' and its replacement expression
-- changed to regexp_replace(pg_get_functiondef(routine.oid),'\mauth_user_id\M','user_id','g').
-- Keep exactly the same twenty-function manifest; never transform people or
-- business identity functions. If their definitions changed since this deploy,
-- restore those twenty pre-migration definitions from the R8 pg_dump backup
-- instead, then redeploy the preceding application and refresh schema/types.
