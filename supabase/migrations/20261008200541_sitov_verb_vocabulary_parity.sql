-- Sitov Academy verb trainer uses the established vocabulary Phase 6 rules.
-- Apply with migrate-local.py after 91; backup is required. Existing selections,
-- boxes, answer history and counters are retained. Only legacy active due dates
-- are reconciled to Berlin calendar days. Rollback keeps those calendar dates.
-- Rollback: supabase/vps/rollback/92_sitov_verb_vocabulary_parity.sql.


-- The user's shared rule is now explicit: a wrong vocabulary/form returns to
-- phase 1. Patch only that branch of the latest vocabulary functions, retaining
-- their fair grader, weights, caps, access guards, spacing and receipt contract.
DO $sitov$
DECLARE signature text; definition text;
 previous constant text:='new_phase:=CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;';
 current_branch constant text:='new_phase:=CASE WHEN correct THEN least(6,old_phase+1) ELSE 1 END;';
BEGIN
 FOREACH signature IN ARRAY ARRAY['vocabulary_private.submit_answer(uuid,boolean,text,text)','vocabulary_private.submit_self_rating(uuid,boolean,text)'] LOOP
  definition:=pg_get_functiondef(signature::regprocedure);
  IF position(current_branch IN definition)>0 THEN CONTINUE; END IF;
  IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'sitov_vocabulary_wrong_phase_contract_changed'; END IF;
  EXECUTE replace(definition,previous,current_branch);
 END LOOP;
END $sitov$;

CREATE OR REPLACE FUNCTION sitov_verb_private.review_day(p_at timestamptz,p_days integer)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT (date_trunc('day',p_at AT TIME ZONE 'Europe/Berlin')+make_interval(days=>p_days)) AT TIME ZONE 'Europe/Berlin'
$$;

-- The same stored-answer grader as vocabulary. A revealed/empty field is an
-- incorrect answer; capitalization, punctuation, umlaut and typo handling match.
CREATE OR REPLACE FUNCTION sitov_verb_private.grade(p_expected jsonb,p_answer jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE position integer; assessment jsonb; accepted text[]; good boolean:=true; reason text;
BEGIN
 IF p_answer IS NULL OR jsonb_typeof(p_answer)<>'array' OR octet_length(p_answer::text)>2048
  OR jsonb_array_length(p_answer)<>jsonb_array_length(p_expected)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_answer) a WHERE jsonb_typeof(a)<>'string' OR length(a#>>'{}')>240)
 THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 FOR position IN 0..jsonb_array_length(p_expected)-1 LOOP
  IF coalesce(learning_private.normalize_answer(p_answer->>position),'')='' THEN good:=false; CONTINUE; END IF;
  SELECT array_agg(value) INTO accepted FROM jsonb_array_elements_text(p_expected->position);
  assessment:=learning_private.grade_answer(p_answer->>position,accepted);
  IF assessment ? 'error' THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
  IF assessment->>'status' NOT IN('EXACT','SOFT_ERROR') THEN good:=false; END IF;
  IF assessment->>'status'='SOFT_ERROR' THEN reason:=coalesce(reason,assessment->>'reason'); END IF;
 END LOOP;
 RETURN jsonb_build_object('correct',good,'softError',CASE WHEN good THEN reason ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION sitov_verb_private.review_day(timestamptz,integer),sitov_verb_private.grade(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
-- CREATE OR REPLACE preserves legacy function owners (postgres on the VPS).
GRANT EXECUTE ON FUNCTION sitov_verb_private.review_day(timestamptz,integer),sitov_verb_private.grade(jsonb,jsonb) TO postgres;

CREATE OR REPLACE FUNCTION public.sitov_submit_verb_answer(p_challenge_id uuid,p_answer jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); c public.sitov_verb_challenges; p public.sitov_verb_progress;
 assessment jsonb; good boolean; receipt jsonb; answered_at timestamptz:=clock_timestamp();
 old_box integer; new_box integer; days integer; previous_days integer;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
 IF p_answer IS NULL OR jsonb_typeof(p_answer)<>'array' OR octet_length(p_answer::text)>2048 THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 PERFORM learning_reset_private.assert_writable(actor);
 PERFORM pg_advisory_xact_lock(hashtextextended('sitov-verbs:'||actor::text,0));
 answered_at:=clock_timestamp();
 SELECT * INTO c FROM public.sitov_verb_challenges WHERE id=p_challenge_id AND auth_user_id=actor FOR UPDATE;
 IF c.id IS NULL THEN RETURN jsonb_build_object('error','not_found'); END IF;
 IF NOT sitov_verb_private.level_allowed(actor,c.context_level) OR NOT sitov_verb_private.verb_allowed(actor,c.verb_id)
 OR NOT sitov_verb_private.tense_allowed(c.context_level,c.verb_id,c.tense)
 OR NOT EXISTS(SELECT 1 FROM public.sitov_verb_box WHERE auth_user_id=actor AND verb_id=c.verb_id AND selected)
 OR NOT EXISTS(SELECT 1 FROM public.sitov_verb_catalog v JOIN public.learning_levels source ON source.code=v.level JOIN public.learning_levels target ON target.code=c.context_level WHERE v.id=c.verb_id AND source.sort_order<=target.sort_order)
 THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 -- Replay immutable receipts before due/spacing/expiry checks.
 IF c.result IS NOT NULL THEN
  IF c.answer=p_answer THEN RETURN c.result; ELSE RETURN jsonb_build_object('error','conflict'); END IF;
 END IF;
 IF c.expires_at<answered_at THEN RETURN jsonb_build_object('error','expired'); END IF;
 SELECT * INTO p FROM public.sitov_verb_progress WHERE auth_user_id=actor AND verb_id=c.verb_id AND tense=c.tense FOR UPDATE;
 IF p.verb_id IS NOT NULL AND (p.box=7 OR p.next_review_at>answered_at
  OR p.last_answered_at>=sitov_verb_private.review_day(answered_at,0))
 THEN RETURN jsonb_build_object('error','review_not_due'); END IF;
 -- Sibling tenses are separated just like the vocabulary directions. Ties are
 -- excluded conservatively; retries use their separate, read-only endpoint.
 IF EXISTS(SELECT 1 FROM public.sitov_verb_progress previous WHERE previous.auth_user_id=actor
  AND previous.verb_id=c.verb_id AND previous.last_answered_at IS NOT NULL
  AND previous.last_answered_at=(SELECT max(last_answered_at) FROM public.sitov_verb_progress WHERE auth_user_id=actor))
 THEN RETURN jsonb_build_object('error','spacing_required'); END IF;
 assessment:=sitov_verb_private.grade(c.expected,p_answer);
 IF assessment ? 'error' THEN RETURN assessment; END IF;
 good:=(assessment->>'correct')::boolean;
 old_box:=coalesce(p.box,1);
 new_box:=CASE WHEN good THEN least(7,old_box+1) ELSE 1 END;
 days:=CASE WHEN NOT good THEN 1 ELSE (ARRAY[1,1,3,9,29,90])[least(6,new_box)] END;
 previous_days:=(ARRAY[1,1,3,9,29,90])[least(6,old_box)];
 IF good AND assessment->>'softError' IS NOT NULL THEN days:=least(days,previous_days); END IF;
 INSERT INTO public.sitov_verb_progress(auth_user_id,verb_id,tense,box,attempts,correct,lapses,next_review_at,last_answered_at)
 VALUES(actor,c.verb_id,c.tense,new_box,1,CASE WHEN good THEN 1 ELSE 0 END,CASE WHEN good THEN 0 ELSE 1 END,sitov_verb_private.review_day(answered_at,days),answered_at)
 ON CONFLICT(auth_user_id,verb_id,tense) DO UPDATE SET box=new_box,
 attempts=sitov_verb_progress.attempts+1,correct=sitov_verb_progress.correct+CASE WHEN good THEN 1 ELSE 0 END,
 lapses=sitov_verb_progress.lapses+CASE WHEN good THEN 0 ELSE 1 END,
 next_review_at=sitov_verb_private.review_day(answered_at,days),last_answered_at=answered_at RETURNING * INTO p;
 receipt:=jsonb_build_object('correct',good,'solution',c.solution,'retry',false,'softError',assessment->'softError',
  'progress',jsonb_build_object('verbId',p.verb_id,'tense',p.tense,'box',p.box,'attempts',p.attempts,'correct',p.correct,'lapses',p.lapses,
   'nextReviewAt',CASE WHEN p.box=7 THEN NULL ELSE p.next_review_at END,'lastAnsweredAt',p.last_answered_at));
 UPDATE public.sitov_verb_challenges SET answer=p_answer,result=receipt WHERE id=c.id;
 PERFORM learning_private.record_learning_event(actor,'verbs',c.context_level,answered_at);
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.sitov_submit_verb_answer(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_submit_verb_answer(uuid,jsonb) TO authenticated;

-- Read-only repeats grade the ORIGINAL completed challenge, never a new task.
-- Its issue expiry is irrelevant after today's scored answer; no row/receipt,
-- learning event, box, date or counter is written by this function.
CREATE OR REPLACE FUNCTION sitov_verb_private.check_retry(p_challenge_id uuid,p_answer jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); c public.sitov_verb_challenges; p public.sitov_verb_progress; assessment jsonb; checked_at timestamptz:=clock_timestamp();
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 PERFORM learning_reset_private.assert_writable(actor);
 PERFORM pg_advisory_xact_lock(hashtextextended('sitov-verbs:'||actor::text,0));
 checked_at:=clock_timestamp();
 SELECT * INTO c FROM public.sitov_verb_challenges WHERE id=p_challenge_id AND auth_user_id=actor;
 IF c.id IS NULL THEN RETURN jsonb_build_object('error','not_found'); END IF;
 IF NOT sitov_verb_private.level_allowed(actor,c.context_level) OR NOT sitov_verb_private.verb_allowed(actor,c.verb_id)
 OR NOT sitov_verb_private.tense_allowed(c.context_level,c.verb_id,c.tense)
 OR NOT EXISTS(SELECT 1 FROM public.sitov_verb_box WHERE auth_user_id=actor AND verb_id=c.verb_id AND selected)
 OR NOT EXISTS(SELECT 1 FROM public.sitov_verb_catalog v JOIN public.learning_levels source ON source.code=v.level JOIN public.learning_levels target ON target.code=c.context_level WHERE v.id=c.verb_id AND source.sort_order<=target.sort_order)
 THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 SELECT * INTO p FROM public.sitov_verb_progress WHERE auth_user_id=actor AND verb_id=c.verb_id AND tense=c.tense;
 IF p.verb_id IS NULL OR c.result IS NULL OR c.result->>'correct' IS DISTINCT FROM 'false'
  OR p.box=7 OR p.last_answered_at IS NULL OR p.last_answered_at<sitov_verb_private.review_day(checked_at,0)
  OR p.next_review_at<=checked_at OR p.last_answered_at IS DISTINCT FROM (c.result->'progress'->>'lastAnsweredAt')::timestamptz
 THEN RETURN jsonb_build_object('error','retry_not_available'); END IF;
 assessment:=sitov_verb_private.grade(c.expected,p_answer);
 IF assessment ? 'error' THEN RETURN assessment; END IF;
 RETURN jsonb_build_object('correct',assessment->'correct','solution',c.solution,'retry',true,'softError',assessment->'softError',
  'progress',jsonb_build_object('verbId',p.verb_id,'tense',p.tense,'box',p.box,'attempts',p.attempts,'correct',p.correct,'lapses',p.lapses,
   'nextReviewAt',p.next_review_at,'lastAnsweredAt',p.last_answered_at));
END $$;
REVOKE ALL ON FUNCTION sitov_verb_private.check_retry(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION sitov_verb_private.check_retry(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.sitov_check_verb_retry(p_challenge_id uuid,p_answer jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT sitov_verb_private.check_retry(p_challenge_id,p_answer)
$$;
REVOKE ALL ON FUNCTION public.sitov_check_verb_retry(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_check_verb_retry(uuid,jsonb) TO authenticated;

-- Reconcile only legacy active dates, preserving boxes/counters and immutable
-- receipts. Historical wrong answers come tomorrow; right answers use the
-- existing vocabulary interval of their stored phase. No backfill of grades.
WITH legacy AS (
 SELECT p.auth_user_id,p.verb_id,p.tense,p.last_answered_at,
 CASE WHEN latest.result->>'correct'='false' THEN 1
  ELSE (ARRAY[1,1,3,9,29,90])[least(6,p.box)] END AS days
 FROM public.sitov_verb_progress p
 LEFT JOIN LATERAL (SELECT c.result FROM public.sitov_verb_challenges c
  WHERE c.auth_user_id=p.auth_user_id AND c.verb_id=p.verb_id AND c.tense=p.tense AND c.result IS NOT NULL
  AND (c.result->'progress'->>'lastAnsweredAt')::timestamptz=p.last_answered_at
  ORDER BY c.created_at DESC,c.id DESC LIMIT 1) latest ON true
 WHERE p.box<7 AND p.attempts>0 AND p.last_answered_at IS NOT NULL AND NOT coalesce(latest.result ? 'retry',false)
)
UPDATE public.sitov_verb_progress p SET next_review_at=sitov_verb_private.review_day(legacy.last_answered_at,legacy.days)
FROM legacy WHERE p.auth_user_id=legacy.auth_user_id AND p.verb_id=legacy.verb_id AND p.tense=legacy.tense
 AND p.next_review_at IS DISTINCT FROM sitov_verb_private.review_day(legacy.last_answered_at,legacy.days);

-- Preserve the latest analytics/media/level changes while excluding archives
-- and forms answered today from due counts.
DO $sitov$
DECLARE definition text; previous_tense text:='count(f.id) FILTER(WHERE coalesce(f.attempts,0)=0 OR f.next_review_at<=now()) due';
 previous_forms text:='''dueForms'',(SELECT count(*) FROM forms WHERE coalesce(attempts,0)=0 OR next_review_at<=now())';
BEGIN
 IF to_regprocedure('public.get_learning_progress(uuid,text,integer)') IS NULL THEN RETURN; END IF;
 definition:=pg_get_functiondef('public.get_learning_progress(uuid,text,integer)'::regprocedure);
 IF position('sitov-verb-vocabulary-parity-v1' IN definition)>0 THEN RETURN; END IF;
 IF position(previous_tense IN definition)=0 OR position(previous_forms IN definition)=0 THEN RAISE EXCEPTION 'sitov_verb_analytics_contract_changed'; END IF;
 definition:=replace(definition,'SELECT pool.id,t.tense,p.box,p.attempts,p.next_review_at','SELECT pool.id,t.tense,p.box,p.attempts,p.next_review_at,p.last_answered_at');
 definition:=replace(definition,previous_tense,'count(f.id) FILTER(WHERE coalesce(f.box,1)<7 AND (f.last_answered_at IS NULL OR f.last_answered_at<sitov_verb_private.review_day(now(),0)) AND (coalesce(f.attempts,0)=0 OR f.next_review_at<=now())) due');
 definition:=replace(definition,previous_forms,'''dueForms'',(SELECT count(*) FROM forms WHERE coalesce(box,1)<7 AND (last_answered_at IS NULL OR last_answered_at<sitov_verb_private.review_day(now(),0)) AND (coalesce(attempts,0)=0 OR next_review_at<=now()))');
 definition:=replace(definition,' -- The current verb box is cumulative',' -- sitov-verb-vocabulary-parity-v1
 -- The current verb box is cumulative');
 EXECUTE definition;
END $sitov$;

DO $sitov$
BEGIN
 IF has_function_privilege('anon','public.sitov_check_verb_retry(uuid,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','public.sitov_verb_challenges','SELECT')
  OR NOT has_function_privilege('postgres','sitov_verb_private.grade(jsonb,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'sitov_verb_parity_permission_invalid' USING ERRCODE='42501'; END IF;
END $sitov$;
NOTIFY pgrst,'reload schema';
