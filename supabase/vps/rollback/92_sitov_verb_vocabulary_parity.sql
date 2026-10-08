-- Roll back the client first so it no longer calls sitov_check_verb_retry.
-- Restore only the former scoring contract. Existing boxes/counters/receipts
-- and reconciled Berlin calendar dates remain intact; restore the migrate-local
-- backup if the former due timestamps themselves are required.
CREATE OR REPLACE FUNCTION public.sitov_submit_verb_answer(p_challenge_id uuid,p_answer jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); c public.sitov_verb_challenges; p public.sitov_verb_progress; good boolean:=true; position integer; receipt jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
 IF p_answer IS NULL OR jsonb_typeof(p_answer)<>'array' OR octet_length(p_answer::text)>2048 THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 PERFORM learning_reset_private.assert_writable(actor);
 PERFORM pg_advisory_xact_lock(hashtextextended('sitov-verbs:'||actor::text,0));
 SELECT * INTO c FROM public.sitov_verb_challenges WHERE id=p_challenge_id AND auth_user_id=actor FOR UPDATE;
 IF c.id IS NULL THEN RETURN jsonb_build_object('error','not_found'); END IF;
 IF NOT sitov_verb_private.level_allowed(actor,c.context_level) OR NOT sitov_verb_private.verb_allowed(actor,c.verb_id)
 OR NOT sitov_verb_private.tense_allowed(c.context_level,c.verb_id,c.tense)
 OR NOT EXISTS(SELECT 1 FROM public.sitov_verb_box WHERE auth_user_id=actor AND verb_id=c.verb_id AND selected)
 OR NOT EXISTS(SELECT 1 FROM public.sitov_verb_catalog v JOIN public.learning_levels source ON source.code=v.level JOIN public.learning_levels target ON target.code=c.context_level WHERE v.id=c.verb_id AND source.sort_order<=target.sort_order)
 THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 IF c.result IS NOT NULL THEN
  IF c.answer=p_answer THEN RETURN c.result; ELSE RETURN jsonb_build_object('error','conflict'); END IF;
 END IF;
 IF c.expires_at<clock_timestamp() THEN RETURN jsonb_build_object('error','expired'); END IF;
 IF jsonb_array_length(p_answer)<>jsonb_array_length(c.expected) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_answer) a WHERE jsonb_typeof(a)<>'string' OR length(a#>>'{}')>240) THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 FOR position IN 0..jsonb_array_length(c.expected)-1 LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(c.expected->position) accepted WHERE sitov_verb_private.normalize(accepted)=sitov_verb_private.normalize(p_answer->>position)) THEN good:=false; END IF;
 END LOOP;
 INSERT INTO public.sitov_verb_progress(auth_user_id,verb_id,tense,box,attempts,correct,lapses,next_review_at,last_answered_at)
 VALUES(actor,c.verb_id,c.tense,CASE WHEN good THEN 2 ELSE 1 END,1,CASE WHEN good THEN 1 ELSE 0 END,CASE WHEN good THEN 0 ELSE 1 END,clock_timestamp()+CASE WHEN good THEN interval '1 day' ELSE interval '5 minutes' END,clock_timestamp())
 ON CONFLICT(auth_user_id,verb_id,tense) DO UPDATE SET
 box=CASE WHEN NOT good THEN 1 WHEN sitov_verb_progress.next_review_at<=clock_timestamp() THEN least(7,sitov_verb_progress.box+1) ELSE sitov_verb_progress.box END,
 attempts=sitov_verb_progress.attempts+1,correct=sitov_verb_progress.correct+CASE WHEN good THEN 1 ELSE 0 END,
 lapses=sitov_verb_progress.lapses+CASE WHEN good THEN 0 ELSE 1 END,
 next_review_at=CASE WHEN NOT good THEN clock_timestamp()+interval '5 minutes' WHEN sitov_verb_progress.next_review_at<=clock_timestamp() THEN clock_timestamp()+(ARRAY[1,1,3,7,14,30,60])[least(7,sitov_verb_progress.box+1)]*interval '1 day' ELSE sitov_verb_progress.next_review_at END,
 last_answered_at=clock_timestamp() RETURNING * INTO p;
 receipt:=jsonb_build_object('correct',good,'solution',c.solution,'progress',jsonb_build_object('verbId',p.verb_id,'tense',p.tense,'box',p.box,'attempts',p.attempts,'correct',p.correct,'lapses',p.lapses,'nextReviewAt',p.next_review_at,'lastAnsweredAt',p.last_answered_at));
 UPDATE public.sitov_verb_challenges SET answer=p_answer,result=receipt WHERE id=c.id;
 PERFORM learning_private.record_learning_event(actor,'verbs',c.context_level,clock_timestamp());
 RETURN receipt;
END $$;

DROP FUNCTION IF EXISTS public.sitov_check_verb_retry(uuid,jsonb);
DROP FUNCTION IF EXISTS sitov_verb_private.check_retry(uuid,jsonb);
-- Analytics keeps archive-safe due counts; review_day remains its dependency.
DROP FUNCTION IF EXISTS sitov_verb_private.grade(jsonb,jsonb);
NOTIFY pgrst,'reload schema';

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
  IF position(previous IN definition)>0 THEN CONTINUE; END IF;
  IF position(current_branch IN definition)=0 THEN RAISE EXCEPTION 'sitov_vocabulary_wrong_phase_contract_changed'; END IF;
  EXECUTE replace(definition,current_branch,previous);
 END LOOP;
END $sitov$;
