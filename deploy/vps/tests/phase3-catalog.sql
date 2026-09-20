-- Read-only acceptance against real PostgreSQL, usable before and after rollout.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
DO $verify$
DECLARE item record; result jsonb; signature regprocedure;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('Guten Tag.','Guten Tag.','EXACT',NULL),
    ('  Guten  Tag.  ','Guten Tag.','EXACT',NULL),
    ('Guten Tag','Guten Tag.','SOFT_ERROR','punctuation'),
    ('guten tag.','Guten Tag.','SOFT_ERROR','capitalization'),
    ('Ich heisse Anna.','Ich heiße Anna.','SOFT_ERROR','umlaut'),
    ('Die Katze schlaeft.','Die Katze schläft.','SOFT_ERROR','umlaut'),
    ('Das Hauss.','Das Haus.','SOFT_ERROR','typo'),
    ('der','den','INCORRECT',NULL),
    ('ihm','ihn','INCORRECT',NULL),
    ('am','an','INCORRECT',NULL),
    ('guten Tag','Guten Tag.','INCORRECT',NULL)
  ) cases(input,accepted,status,reason) LOOP
    result := learning_private.grade_answer(item.input,ARRAY[item.accepted]);
    IF result->>'status' IS DISTINCT FROM item.status OR result->>'reason' IS DISTINCT FROM item.reason
       OR result->>'matched' IS DISTINCT FROM (CASE WHEN item.status='INCORRECT' THEN NULL ELSE item.accepted END) THEN
      RAISE EXCEPTION 'Unexpected grade for %: %',item.input,result;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.learning_exercises
    WHERE content ? 'alternative_answers' OR NOT grammar_private.valid_accepted_answers(content,type)) THEN
    RAISE EXCEPTION 'Noncanonical exercise content';
  END IF;
  FOREACH signature IN ARRAY ARRAY[
    'grammar_private.record_attempt(uuid,text,boolean)'::regprocedure,
    'vocabulary_private.submit_answer(uuid,boolean,text,text)'::regprocedure,
    'vocabulary_private.submit_answer_once(uuid,uuid,boolean,text,text)'::regprocedure,
    'learning_private.grade_answer(text,text[])'::regprocedure
  ] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=signature AND prosecdef AND proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'Unsafe function configuration: %',signature;
    END IF;
  END LOOP;
  IF has_function_privilege('authenticated','learning_private.grade_answer(text,text[])','EXECUTE')
    OR has_function_privilege('anon','learning_private.grade_answer(text,text[])','EXECUTE') THEN
    RAISE EXCEPTION 'Grader directly exposed to learners';
  END IF;
  IF enum_range(NULL::learning_private.answer_status)::text[] <> ARRAY['EXACT','SOFT_ERROR','INCORRECT']
    OR enum_range(NULL::learning_private.soft_error_reason)::text[] <> ARRAY['punctuation','capitalization','umlaut','typo'] THEN
    RAISE EXCEPTION 'Invalid grading enum contract';
  END IF;
  result := public.record_grammar_attempt(gen_random_uuid(),'Haus',false);
  IF result->>'error' IS DISTINCT FROM 'authentication_required' OR nullif(result->>'message','') IS NULL THEN
    RAISE EXCEPTION 'Public RPC error is not explicit JSONB';
  END IF;
END $verify$;
SELECT 'Phase 3 catalog, grading, permissions and JSONB errors verified' AS result;
ROLLBACK;
