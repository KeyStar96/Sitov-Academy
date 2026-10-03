-- Sitov Academy: account-owned resume state. Checkpoints never award grades.
-- Compare-and-set revisions retain tombstones after resets so stale devices
-- cannot resurrect an old session. Existing verified progress stays intact.
CREATE TABLE IF NOT EXISTS public.sitov_learning_checkpoints (
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('vocabulary','vocabulary_focus','exercises','pronunciation','videos')),
 level text NOT NULL REFERENCES public.learning_levels(code),
 state jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(state)='object' AND octet_length(state::text)<=262144),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(auth_user_id,kind,level)
);
ALTER TABLE public.sitov_learning_checkpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sitov_learning_checkpoint_read ON public.sitov_learning_checkpoints;
CREATE POLICY sitov_learning_checkpoint_read ON public.sitov_learning_checkpoints FOR SELECT TO authenticated
 USING(auth_user_id=(SELECT auth.uid()) AND trainer_access_private.allowed(level,CASE WHEN kind='vocabulary_focus' THEN 'vocabulary' ELSE kind END));
REVOKE ALL ON public.sitov_learning_checkpoints FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.sitov_learning_checkpoints TO authenticated;
GRANT ALL ON public.sitov_learning_checkpoints TO service_role;

CREATE OR REPLACE FUNCTION public.sitov_learning_checkpoint(p_action text,p_kind text,p_level text,p_state jsonb DEFAULT NULL,p_expected_revision bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); saved public.sitov_learning_checkpoints%ROWTYPE; payload jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
 IF p_action IS NULL OR p_action NOT IN('get','save','clear') OR p_kind IS NULL OR p_kind NOT IN('vocabulary','vocabulary_focus','exercises','pronunciation','videos')
  OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level AND is_active) THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 IF NOT trainer_access_private.allowed(p_level,CASE WHEN p_kind='vocabulary_focus' THEN 'vocabulary' ELSE p_kind END) THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 IF p_action<>'get' THEN
  IF p_expected_revision IS NULL OR p_expected_revision<0 OR (p_action='save' AND (jsonb_typeof(p_state) IS DISTINCT FROM 'object' OR octet_length(p_state::text)>262144)) THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
  -- Same first lock as grading and reset; no inverse lock order.
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
  PERFORM learning_reset_private.assert_writable(actor);
 END IF;
 SELECT * INTO saved FROM public.sitov_learning_checkpoints WHERE auth_user_id=actor AND kind=p_kind AND level=p_level;
 payload:=CASE WHEN saved.auth_user_id IS NULL THEN NULL ELSE jsonb_build_object('state',saved.state,'revision',saved.revision,'updatedAt',saved.updated_at) END;
 IF p_action='get' THEN RETURN jsonb_build_object('checkpoint',payload); END IF;
 IF coalesce(saved.revision,0)<>p_expected_revision THEN
  -- A transport retry after a committed write returns the same receipt.
  IF saved.revision=p_expected_revision+1 AND saved.state=(CASE WHEN p_action='clear' THEN '{}'::jsonb ELSE p_state END) THEN RETURN jsonb_build_object('checkpoint',payload); END IF;
  RETURN jsonb_build_object('error','conflict','checkpoint',payload);
 END IF;
 INSERT INTO public.sitov_learning_checkpoints AS c(auth_user_id,kind,level,state)
 VALUES(actor,p_kind,p_level,CASE WHEN p_action='clear' THEN '{}'::jsonb ELSE p_state END)
 ON CONFLICT(auth_user_id,kind,level) DO UPDATE SET state=excluded.state,revision=c.revision+1,updated_at=clock_timestamp()
 RETURNING * INTO saved;
 RETURN jsonb_build_object('checkpoint',jsonb_build_object('state',saved.state,'revision',saved.revision,'updatedAt',saved.updated_at));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed');
END $$;
REVOKE ALL ON FUNCTION public.sitov_learning_checkpoint(text,text,text,jsonb,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_learning_checkpoint(text,text,text,jsonb,bigint) TO authenticated;

-- Every reset clears resume state in its existing protected transaction.
DO $sitov$
DECLARE signature text; body text; marker text:='DELETE FROM public.user_exercise_progress'; replacement text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['learning_private.reset_student_level(uuid,text)','learning_reset_private.finish_reset(uuid)'] LOOP
  body:=pg_get_functiondef(signature::regprocedure);
  IF strpos(body,'public.sitov_learning_checkpoints')=0 THEN
   IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'sitov_checkpoint_reset_contract_changed'; END IF;
   replacement:=CASE WHEN signature LIKE 'learning_private.%' THEN
    'INSERT INTO public.sitov_learning_checkpoints AS c(auth_user_id,kind,level,state) SELECT p_student_id,k.kind,p_level,''{}''::jsonb FROM unnest(ARRAY[''vocabulary'',''vocabulary_focus'',''exercises'',''pronunciation'',''videos'']) k(kind) ON CONFLICT(auth_user_id,kind,level) DO UPDATE SET state=''{}''::jsonb,revision=c.revision+1,updated_at=clock_timestamp(); DELETE FROM grammar_private.sitov_checkpoint_receipts WHERE auth_user_id=p_student_id AND level=p_level; '
    ELSE 'INSERT INTO public.sitov_learning_checkpoints AS c(auth_user_id,kind,level,state) SELECT actor,k.kind,l.code,''{}''::jsonb FROM public.learning_levels l CROSS JOIN unnest(ARRAY[''vocabulary'',''vocabulary_focus'',''exercises'',''pronunciation'',''videos'']) k(kind) ON CONFLICT(auth_user_id,kind,level) DO UPDATE SET state=''{}''::jsonb,revision=c.revision+1,updated_at=clock_timestamp(); DELETE FROM grammar_private.sitov_checkpoint_receipts WHERE auth_user_id=actor; ' END;
   EXECUTE replace(body,marker,replacement||marker);
  END IF;
 END LOOP;
 -- Home/learn navigation uses the same account checkpoint on another device.
 body:=pg_get_functiondef('public.get_last_active_level()'::regprocedure);
 IF strpos(body,'FROM public.sitov_learning_checkpoints')=0 THEN
  marker:='), latest AS (';
  IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'sitov_checkpoint_activity_contract_changed'; END IF;
  EXECUTE replace(body,marker,$fragment$
  UNION ALL SELECT c.level,CASE WHEN c.kind='vocabulary_focus' THEN 'vocabulary' ELSE c.kind END,c.updated_at,NULL::text,NULL::text
   FROM public.sitov_learning_checkpoints c WHERE c.auth_user_id=actor AND c.state<>'{}'::jsonb AND trainer_access_private.allowed(c.level,CASE WHEN c.kind='vocabulary_focus' THEN 'vocabulary' ELSE c.kind END)
 ), latest AS ($fragment$);
 END IF;
END $sitov$;

-- A lost response followed by retry must not duplicate a stored recording.
DO $sitov$
DECLARE body text; marker text:='INSERT INTO public.submissions';
BEGIN
 body:=pg_get_functiondef('pronunciation_private.create_submission(uuid,text)'::regprocedure);
 IF strpos(body,'sitov recording retry')=0 THEN
  IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'sitov_recording_contract_changed'; END IF;
  EXECUTE replace(body,marker,$fragment$
  -- sitov recording retry: same immutable owned audio means same submission.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_audio_path,0));
  SELECT s.id INTO result FROM public.submissions s WHERE s.auth_user_id=actor AND s.prompt_id=p_prompt_id AND s.content_url=p_audio_path ORDER BY s.created_at,s.id LIMIT 1;
  IF result IS NOT NULL THEN RETURN result; END IF;
  INSERT INTO public.submissions$fragment$);
 END IF;
END $sitov$;

-- Sitov Academy: stale tabs may replay a saved test answer, never replace it.
CREATE OR REPLACE FUNCTION public.submit_path_test_answer(p_attempt_id uuid,p_exercise_id uuid,p_answer jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; a public.path_test_attempts; saved jsonb;
BEGIN
 actor:=path_private.check_actor();
 IF p_answer IS NULL OR p_answer='null'::jsonb OR octet_length(p_answer::text)>4194304 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM public.path_test_attempts WHERE id=p_attempt_id AND auth_user_id=actor AND status='active' AND is_active FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='42501'; END IF;
 IF NOT path_private.node_available(a.node_id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM path_private.test_items WHERE attempt_id=a.id AND exercise_id=p_exercise_id) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT answer INTO saved FROM public.path_test_answers WHERE attempt_id=a.id AND exercise_id=p_exercise_id;
 IF FOUND THEN
  IF saved IS DISTINCT FROM p_answer THEN RAISE EXCEPTION 'request_conflict' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('saved',true);
 END IF;
 -- Saving intentionally does not grade or expose solutions.
 INSERT INTO public.path_test_answers(attempt_id,exercise_id,answer) VALUES(a.id,p_exercise_id,p_answer);
 RETURN jsonb_build_object('saved',true);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

REVOKE ALL ON FUNCTION public.submit_path_test_answer(uuid,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.submit_path_test_answer(uuid,uuid,jsonb) TO authenticated;

-- Reuse the reviewed map query and add the newest live checkpoint. No catalog,
-- grading, completion or intervention behavior changes.
DO $sitov_resume$
DECLARE definition text; marker text;
BEGIN
 definition:=pg_get_functiondef('public.get_learning_path(text,text)'::regprocedure);
 marker:=$marker$RETURN jsonb_build_object('level',p_level,'paths',paths,'completed',done,'next_level',next_level,'next_level_available',next_allowed);$marker$;
 IF position('''resume_node_id''' IN definition)=0 THEN
  IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'sitov_path_resume_patch_unavailable'; END IF;
  definition:=replace(definition,marker,$replacement$
 RETURN jsonb_build_object('level',p_level,'paths',paths,'completed',done,'next_level',next_level,'next_level_available',next_allowed,
  'resume_node_id',(SELECT checkpoint.node_id FROM (
    SELECT r.node_id,r.updated_at AS at FROM public.path_practice_runs r
    JOIN public.path_nodes n ON n.id=r.node_id JOIN public.learning_units u ON u.id=n.unit_id
    WHERE r.auth_user_id=actor AND r.is_active AND r.status='active' AND u.level=p_level AND path_private.node_available(n.id)
    UNION ALL
    SELECT a.node_id,greatest(a.created_at,coalesce((SELECT max(answered_at) FROM public.path_test_answers ans WHERE ans.attempt_id=a.id),a.created_at))
    FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id
    WHERE a.auth_user_id=actor AND a.is_active AND a.status='active' AND u.level=p_level AND path_private.node_available(n.id)
  ) checkpoint ORDER BY checkpoint.at DESC,checkpoint.node_id LIMIT 1));
 $replacement$);
  EXECUTE definition;
 END IF;
END $sitov_resume$;

-- Sitov Academy: grading, resume position and retry receipt commit together.
-- Retry grades are private: learner-writable checkpoint JSON is never grading evidence.
CREATE TABLE IF NOT EXISTS grammar_private.sitov_checkpoint_receipts (
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 level text NOT NULL REFERENCES public.learning_levels(code),request_id uuid NOT NULL,
 exercise_id uuid NOT NULL,answer text NOT NULL,hint_shown boolean NOT NULL,
 expected_revision bigint NOT NULL,checkpoint_revision bigint NOT NULL,response jsonb NOT NULL,
 PRIMARY KEY(auth_user_id,level)
);
ALTER TABLE grammar_private.sitov_checkpoint_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON grammar_private.sitov_checkpoint_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON grammar_private.sitov_checkpoint_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.sitov_record_grammar_checkpoint_attempt(
 p_exercise_id uuid,p_answer text,p_hint_shown boolean,p_level text,p_expected_revision bigint,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); saved public.sitov_learning_checkpoints%ROWTYPE;
 payload jsonb; receipt grammar_private.sitov_checkpoint_receipts%ROWTYPE; grade jsonb; response jsonb; position integer; count integer;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
 IF p_request_id IS NULL OR p_exercise_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1
  OR p_answer IS NULL OR length(btrim(p_answer))=0 OR length(p_answer)>1000 OR p_hint_shown IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level AND is_active) THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 IF NOT trainer_access_private.allowed(p_level,'exercises') THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 PERFORM learning_reset_private.assert_writable(actor);
 SELECT * INTO saved FROM public.sitov_learning_checkpoints WHERE auth_user_id=actor AND kind='exercises' AND level=p_level FOR UPDATE;
 payload:=CASE WHEN saved.auth_user_id IS NULL THEN NULL ELSE jsonb_build_object('state',saved.state,'revision',saved.revision,'updatedAt',saved.updated_at) END;
 SELECT * INTO receipt FROM grammar_private.sitov_checkpoint_receipts WHERE auth_user_id=actor AND level=p_level;
 IF receipt.request_id=p_request_id THEN
  IF receipt.exercise_id IS DISTINCT FROM p_exercise_id OR receipt.answer IS DISTINCT FROM p_answer
   OR receipt.hint_shown IS DISTINCT FROM p_hint_shown OR receipt.expected_revision<>p_expected_revision
   OR receipt.checkpoint_revision IS DISTINCT FROM saved.revision THEN RETURN jsonb_build_object('error','conflict','checkpoint',payload); END IF;
  RETURN receipt.response;
 END IF;
 IF coalesce(saved.revision,0)<>p_expected_revision THEN RETURN jsonb_build_object('error','conflict','checkpoint',payload); END IF;
 IF jsonb_typeof(saved.state->'exerciseIds') IS DISTINCT FROM 'array' OR jsonb_typeof(saved.state->'currentIndex') IS DISTINCT FROM 'number'
  OR (saved.state->>'currentIndex') !~ '^[0-9]+$' THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 count:=jsonb_array_length(saved.state->'exerciseIds'); position:=(saved.state->>'currentIndex')::integer;
 IF count NOT BETWEEN 1 AND 10 OR position<0 OR position>=count
  OR saved.state->'exerciseIds'->>position IS DISTINCT FROM p_exercise_id::text THEN RETURN jsonb_build_object('error','conflict','checkpoint',payload); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_exercises e JOIN public.learning_units u ON u.id=e.unit_id
  WHERE e.id=p_exercise_id AND u.level=p_level AND e.node_id IS NULL AND learning_private.unit_allowed(u.id)) THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 grade:=grammar_private.record_attempt(p_exercise_id,p_answer,p_hint_shown);
 PERFORM platform_private.require_rpc_success(grade);
 IF grade->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'sitov_grammar_grade_failed'; END IF;
 saved.state:=jsonb_set(saved.state,'{currentIndex}',to_jsonb(position+CASE WHEN grade->>'isCorrect'='true' THEN 1 ELSE 0 END));
 UPDATE public.sitov_learning_checkpoints SET state=saved.state,revision=revision+1,updated_at=clock_timestamp()
  WHERE auth_user_id=actor AND kind='exercises' AND level=p_level RETURNING * INTO saved;
 response:=jsonb_build_object('grade',grade,'checkpoint',jsonb_build_object('state',saved.state,'revision',saved.revision,'updatedAt',saved.updated_at));
 INSERT INTO grammar_private.sitov_checkpoint_receipts(auth_user_id,level,request_id,exercise_id,answer,hint_shown,expected_revision,checkpoint_revision,response)
 VALUES(actor,p_level,p_request_id,p_exercise_id,p_answer,p_hint_shown,p_expected_revision,saved.revision,response)
 ON CONFLICT(auth_user_id,level) DO UPDATE SET request_id=excluded.request_id,exercise_id=excluded.exercise_id,answer=excluded.answer,
  hint_shown=excluded.hint_shown,expected_revision=excluded.expected_revision,checkpoint_revision=excluded.checkpoint_revision,response=excluded.response;
 RETURN response;
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error',CASE WHEN SQLSTATE='42501' THEN 'not_authorized' WHEN SQLSTATE IN('22023','22P02','23514') THEN 'invalid_input' ELSE 'request_failed' END);
END $$;
REVOKE ALL ON FUNCTION public.sitov_record_grammar_checkpoint_attempt(uuid,text,boolean,text,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_record_grammar_checkpoint_attempt(uuid,text,boolean,text,bigint,uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
