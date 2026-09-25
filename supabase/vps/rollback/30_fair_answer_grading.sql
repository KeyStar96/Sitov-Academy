-- R9: take a fresh R8 backup, stop writers, run atomically, activate matching app.
-- Restore the exact pre-30 bodies (06 + 07 readiness; 22 submit/retry). Keep the
-- installed 23 answer_key and all learner progress/receipts/content untouched.
CREATE OR REPLACE FUNCTION learning_private.normalize_answer(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path TO '' AS $function$
 SELECT btrim(regexp_replace(p_value,'\s+',' ','g'))
$function$;

CREATE OR REPLACE FUNCTION learning_private.grade_answer(p_input text,p_accepted text[]) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE input_value text; candidate text; original text; reason learning_private.soft_error_reason;
 status learning_private.answer_status:='INCORRECT'; input_words text[]; accepted_words text[];
 distance integer; word_index integer;
BEGIN
 IF p_input IS NULL OR length(p_input)>4000 OR learning_private.normalize_answer(p_input)='' THEN
  RETURN jsonb_build_object('error','invalid_answer','message','Enter an answer of at most 4000 characters.','sqlstate','22023');
 END IF;
 IF p_accepted IS NULL OR coalesce(array_ndims(p_accepted),0)<>1 OR cardinality(p_accepted) NOT BETWEEN 1 AND 128
  OR EXISTS(SELECT 1 FROM unnest(p_accepted) a WHERE a IS NULL OR length(a)>4000 OR learning_private.normalize_answer(a)='') THEN
  RETURN jsonb_build_object('error','invalid_accepted_answers','message','The accepted answers are missing or invalid.','sqlstate','22023');
 END IF;
 input_value:=learning_private.normalize_answer(p_input);
 -- Exact answers across the whole list always outrank a soft match to another answer.
 FOREACH original IN ARRAY p_accepted LOOP
  IF input_value=learning_private.normalize_answer(original) THEN
   status:='EXACT'; RETURN jsonb_build_object('status',status,'matched',original,'reason',NULL);
  END IF;
 END LOOP;
 -- Priority applies across all accepted answers, without combining normalizations.
 FOREACH reason IN ARRAY enum_range(NULL::learning_private.soft_error_reason) LOOP
  FOREACH original IN ARRAY p_accepted LOOP
   candidate:=learning_private.normalize_answer(original);
   IF reason='punctuation' THEN
    IF learning_private.normalize_answer(regexp_replace(input_value,'[[:punct:]„“”‘’«»…—–]','','g')) =
      learning_private.normalize_answer(regexp_replace(candidate,'[[:punct:]„“”‘’«»…—–]','','g')) THEN
     status:='SOFT_ERROR'; RETURN jsonb_build_object('status',status,'matched',original,'reason',reason);
    END IF;
   ELSIF reason='capitalization' THEN
    IF lower(input_value)=lower(candidate) THEN
     status:='SOFT_ERROR'; RETURN jsonb_build_object('status',status,'matched',original,'reason',reason);
    END IF;
   ELSIF reason='umlaut' THEN
    IF learning_private.expand_german_letters(input_value)=learning_private.expand_german_letters(candidate) THEN
     status:='SOFT_ERROR'; RETURN jsonb_build_object('status',status,'matched',original,'reason',reason);
    END IF;
   ELSE
    -- Preserve every separator (including punctuation) and word order/count.
    -- A typo may not quietly combine punctuation/capitalization/umlaut changes.
    IF regexp_split_to_array(input_value,'[[:alnum:]ÄÖÜäöüßẞ]+') IS DISTINCT FROM
       regexp_split_to_array(candidate,'[[:alnum:]ÄÖÜäöüßẞ]+') THEN CONTINUE; END IF;
    input_words:=regexp_split_to_array(input_value,'[^[:alnum:]ÄÖÜäöüßẞ]+');
    accepted_words:=regexp_split_to_array(candidate,'[^[:alnum:]ÄÖÜäöüßẞ]+');
    IF cardinality(input_words)<>cardinality(accepted_words) THEN CONTINUE; END IF;
    distance:=0;
    FOR word_index IN 1..cardinality(input_words) LOOP
     IF input_words[word_index]=accepted_words[word_index] THEN CONTINUE; END IF;
     IF least(char_length(input_words[word_index]),char_length(accepted_words[word_index]))<4 THEN distance:=2; EXIT; END IF;
     distance:=distance+learning_private.levenshtein_at_most_one(input_words[word_index],accepted_words[word_index]);
     IF distance>1 THEN EXIT; END IF;
    END LOOP;
    IF distance=1 THEN
     status:='SOFT_ERROR'; RETURN jsonb_build_object('status',status,'matched',original,'reason',reason);
    END IF;
   END IF;
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('status',status,'matched',NULL,'reason',NULL);
END $function$;

CREATE OR REPLACE FUNCTION grammar_private.record_attempt(p_exercise_id uuid,p_answer text,p_hint_shown boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE actor uuid:=auth.uid(); target public.learning_exercises; correct boolean; grade jsonb;
 accepted jsonb; attempt_count integer; final_score integer; soft boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_answer IS NULL OR length(btrim(p_answer))=0 OR length(p_answer)>1000 THEN
  RAISE EXCEPTION 'invalid_answer' USING ERRCODE='22023'; END IF;
 SELECT * INTO target FROM public.learning_exercises WHERE id=p_exercise_id;
 IF NOT FOUND OR target.type NOT IN('fill_in_blank','multiple_choice') THEN
  RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF;
 IF NOT learning_private.unit_allowed(target.unit_id) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 -- phase3-content-ready-guard-v1
 IF target.content_status<>'ready' THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF;
 IF nullif(btrim(target.content->>'correct_answer'),'') IS NULL THEN
  RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF;
 IF target.type='multiple_choice' THEN
  -- Options are discrete choices: a wrong option must never become a typo match.
  correct:=p_answer=target.content->>'correct_answer';
  grade:=jsonb_build_object('status',CASE WHEN correct THEN 'EXACT' ELSE 'INCORRECT' END,
   'matched',CASE WHEN correct THEN target.content->>'correct_answer' ELSE NULL END,'reason',NULL);
 ELSE
  -- Compatibility fallback for legacy reads; remove only in a follow-up release.
  accepted:=coalesce(target.content->'accepted_answers',target.content->'alternative_answers','[]'::jsonb);
  IF jsonb_typeof(accepted) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF;
  grade:=learning_private.grade_answer(p_answer,ARRAY[target.content->>'correct_answer']||ARRAY(SELECT jsonb_array_elements_text(accepted)));
  PERFORM platform_private.require_rpc_success(grade);
  correct:=grade->>'status' IN('EXACT','SOFT_ERROR');
 END IF;
 soft:=grade->>'status'='SOFT_ERROR';
 INSERT INTO public.user_exercise_progress AS progress
  (auth_user_id,exercise_id,attempts,completed,score,hint_shown,updated_at)
 VALUES(actor,p_exercise_id,1,correct,CASE WHEN soft THEN 90 WHEN correct THEN 100 ELSE 0 END,coalesce(p_hint_shown,false),now())
 ON CONFLICT(auth_user_id,exercise_id) DO UPDATE SET
  attempts=progress.attempts+1,completed=coalesce(progress.completed,false) OR correct,
  -- Preserve attempt scoring; each soft submission caps the stored score too,
  -- even following an earlier 100. Incorrect submissions retain the best score.
  score=least(CASE WHEN soft THEN 90 ELSE 100 END,greatest(coalesce(progress.score,0),CASE WHEN correct THEN
   CASE WHEN progress.attempts+1<=1 THEN 100 WHEN progress.attempts+1=2 THEN 80 WHEN progress.attempts+1=3 THEN 60 ELSE 40 END ELSE 0 END)),
  hint_shown=progress.hint_shown OR coalesce(p_hint_shown,false),updated_at=now()
 RETURNING attempts,score INTO attempt_count,final_score;
 RETURN jsonb_build_object('success',true,'attempts',attempt_count,'isCorrect',correct,'score',final_score)||grade;
END $function$;

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid,p_is_correct boolean,p_typed_answer text,p_ui_language text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 profile public.profiles; solution record; previous_card uuid; grade jsonb;
 correct boolean; soft boolean; old_phase integer; new_phase integer;
 new_box integer; days integer; previous_days integer; difficult boolean; is_alternative boolean:=false;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF length(p_typed_answer)>4000 THEN RAISE EXCEPTION 'answer_too_long' USING ERRCODE='22023'; END IF;
 IF p_typed_answer IS NULL OR learning_private.normalize_answer(p_typed_answer)='' THEN
  RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 SELECT * INTO progress FROM public.vocabulary_direction_progress WHERE id=p_progress_id AND auth_user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'progress_not_found' USING ERRCODE='42501'; END IF;
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=progress.card_id;
 SELECT * INTO profile FROM public.profiles WHERE id=actor;
 IF NOT learning_private.unit_allowed(card.unit_id) OR p_ui_language='de' THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF progress.box_number=7 OR progress.next_review_date>now() THEN
  RAISE EXCEPTION 'review_not_due' USING ERRCODE='PT409'; END IF;
 SELECT last_card_id INTO previous_card FROM public.vocabulary_learning_state WHERE auth_user_id=actor;
 IF previous_card=progress.card_id THEN RAISE EXCEPTION 'vocabulary_spacing_required' USING ERRCODE='PT409'; END IF;
 SELECT * INTO solution FROM vocabulary_private.answer_key(card.id,progress.direction::text,p_ui_language);
 -- Every answer, in either direction, is graded from stored content. The legacy
 -- p_is_correct argument remains payload-bound for receipt compatibility only.
 grade:=learning_private.grade_answer(p_typed_answer,solution.accepted);
 PERFORM platform_private.require_rpc_success(grade);
 correct:=grade->>'status' IN('EXACT','SOFT_ERROR'); soft:=grade->>'status'='SOFT_ERROR';
 is_alternative:=correct AND grade->>'matched' IS DISTINCT FROM solution.canonical;
 old_phase:=least(6,greatest(1,coalesce(progress.box_number,1)));
 new_phase:=CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;
 new_box:=CASE WHEN correct AND old_phase=6 THEN 7 ELSE new_phase END;
 IF correct THEN
  days:=CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
  previous_days:=CASE old_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
  IF soft THEN days:=least(days,previous_days); END IF;
  SELECT coalesce(t.is_difficult,false) INTO difficult FROM public.vocabulary_translations t WHERE t.card_id=card.id AND t.locale=profile.native_language;
  IF difficult THEN days:=greatest(1,days/2); END IF;
 ELSE
  -- Phase 6: Ein falscher erster Versuch kommt am nächsten Tag wieder.
  days:=1;
 END IF;
 UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=vocabulary_private.review_day(days),
  lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now() WHERE id=progress.id;
 INSERT INTO public.vocabulary_learning_state(auth_user_id,last_card_id,last_reviewed_at) VALUES(actor,progress.card_id,now())
 ON CONFLICT(auth_user_id) DO UPDATE SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
  'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days,
  'correctAnswer',solution.canonical,'isAlternative',is_alternative,'softError',grade->'reason');
END $function$;

CREATE OR REPLACE FUNCTION vocabulary_private.check_retry_answer(p_progress_id uuid, p_typed_answer text, p_ui_language text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 solution record; grade jsonb; correct boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF length(p_typed_answer)>4000 THEN RAISE EXCEPTION 'answer_too_long' USING ERRCODE='22023'; END IF;
 IF p_typed_answer IS NULL OR learning_private.normalize_answer(p_typed_answer)='' THEN
  RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
 SELECT * INTO progress FROM public.vocabulary_direction_progress WHERE id=p_progress_id AND auth_user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'progress_not_found' USING ERRCODE='42501'; END IF;
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=progress.card_id;
 IF NOT learning_private.unit_allowed(card.unit_id) OR p_ui_language='de' THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF progress.last_answered_at IS NULL OR progress.last_answered_at<vocabulary_private.review_day(0)
  OR progress.next_review_date<=now() THEN
  RAISE EXCEPTION 'retry_not_available' USING ERRCODE='PT409'; END IF;
 SELECT * INTO solution FROM vocabulary_private.answer_key(card.id,progress.direction::text,p_ui_language);
 grade:=learning_private.grade_answer(p_typed_answer,solution.accepted);
 PERFORM platform_private.require_rpc_success(grade);
 correct:=grade->>'status' IN('EXACT','SOFT_ERROR');
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'correctAnswer',solution.canonical,
  'isAlternative',correct AND grade->>'matched' IS DISTINCT FROM solution.canonical,'softError',grade->'reason');
END $$;
DROP FUNCTION IF EXISTS vocabulary_private.answer_article_feedback(text,text,text,text) RESTRICT;
DROP FUNCTION IF EXISTS learning_private.answer_without_punctuation(text) RESTRICT;
DROP TYPE IF EXISTS vocabulary_private.article_feedback RESTRICT;
DROP TYPE IF EXISTS learning_private.answer_hint RESTRICT;
