-- Master 4, Phase 1.2/1.3. Apply only with migrate-local.py after its R8 backup.
-- Full bodies preserve 07 readiness, 22 calendar/retry rules and the answer_key
-- installed by 23 (including private-word translation fallback). No data rewrite.
-- Rollback: rollback/30_fair_answer_grading.sql, then the matching app release.
DO $types$ BEGIN
 IF to_regtype('learning_private.answer_hint') IS NULL THEN
  CREATE TYPE learning_private.answer_hint AS ENUM ('capitalization','punctuation','capitalization_punctuation');
 END IF;
 IF to_regtype('vocabulary_private.article_feedback') IS NULL THEN
  CREATE TYPE vocabulary_private.article_feedback AS ENUM ('article_missing','article_wrong');
 END IF;
END $types$;

CREATE OR REPLACE FUNCTION learning_private.normalize_answer(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path TO '' AS $function$
 SELECT btrim(regexp_replace(translate(translate(translate(normalize(p_value,NFC),
  '’‘ʼ＇',repeat(chr(39),4)), '„“”«»＂','""""""'), '‐‑‒–—−﹘－','--------'), '[[:space:]  ]+',' ','g'))
$function$;

CREATE OR REPLACE FUNCTION learning_private.answer_without_punctuation(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path TO '' AS $function$
 SELECT learning_private.normalize_answer(regexp_replace(learning_private.normalize_answer(p_value),
  $punct$(?<![[:digit:]])[.,]|[.,](?![[:digit:]])|[!?;:'"()\[\]{}…]|(?<![[:digit:]])-(?![[:digit:]])$punct$,'','g'))
$function$;

CREATE OR REPLACE FUNCTION learning_private.grade_answer(p_input text,p_accepted text[]) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE input_value text; input_plain text; candidate text; candidate_plain text; original text;
 hint learning_private.answer_hint; reason learning_private.soft_error_reason;
 input_words text[]; accepted_words text[]; distance integer; word_index integer;
BEGIN
 IF p_input IS NULL OR length(p_input)>4000 OR learning_private.normalize_answer(p_input)='' THEN
  RETURN jsonb_build_object('error','invalid_answer','message','Enter an answer of at most 4000 characters.','sqlstate','22023');
 END IF;
 IF p_accepted IS NULL OR coalesce(array_ndims(p_accepted),0)<>1 OR cardinality(p_accepted) NOT BETWEEN 1 AND 128
  OR EXISTS(SELECT 1 FROM unnest(p_accepted) a WHERE a IS NULL OR length(a)>4000 OR learning_private.normalize_answer(a)='') THEN
  RETURN jsonb_build_object('error','invalid_accepted_answers','message','The accepted answers are missing or invalid.','sqlstate','22023');
 END IF;
 input_value:=learning_private.normalize_answer(p_input);
 input_plain:=learning_private.answer_without_punctuation(input_value);
 -- Literal/typographic equality across all answers outranks every other match.
 FOREACH original IN ARRAY p_accepted LOOP
  IF input_value=learning_private.normalize_answer(original) THEN
   RETURN jsonb_build_object('status','EXACT','matched',original,'reason',NULL,'hint',NULL);
  END IF;
 END LOOP;
 -- Case and punctuation carry a neutral writing hint, never a penalty.
 FOREACH original IN ARRAY p_accepted LOOP
  candidate:=learning_private.normalize_answer(original);
  candidate_plain:=learning_private.answer_without_punctuation(candidate);
  IF lower(input_plain)=lower(candidate_plain) THEN
   hint:=CASE WHEN lower(input_value)=lower(candidate) THEN 'capitalization'
    WHEN input_plain=candidate_plain THEN 'punctuation' ELSE 'capitalization_punctuation' END;
   RETURN jsonb_build_object('status','EXACT','matched',original,'reason',NULL,'hint',hint);
  END IF;
 END LOOP;
 -- Ignore case/punctuation before checking remaining errors. Umlaut outranks
 -- typo across the entire answer list; we never equate word order or content.
 FOREACH reason IN ARRAY ARRAY['umlaut','typo']::learning_private.soft_error_reason[] LOOP
  FOREACH original IN ARRAY p_accepted LOOP
   candidate_plain:=lower(learning_private.answer_without_punctuation(original));
   IF reason='umlaut' THEN
    IF learning_private.expand_german_letters(lower(input_plain))=learning_private.expand_german_letters(candidate_plain) THEN
     RETURN jsonb_build_object('status','SOFT_ERROR','matched',original,'reason',reason,'hint',NULL);
    END IF;
   ELSE
    -- Content symbols (currency, %, +) and numeral separators must agree too.
    IF regexp_split_to_array(lower(input_plain),'[[:alnum:]ÄÖÜäöüßẞ]+') IS DISTINCT FROM
       regexp_split_to_array(candidate_plain,'[[:alnum:]ÄÖÜäöüßẞ]+') THEN CONTINUE; END IF;
    input_words:=regexp_split_to_array(lower(input_plain),'[^[:alnum:]ÄÖÜäöüßẞ]+');
    accepted_words:=regexp_split_to_array(candidate_plain,'[^[:alnum:]ÄÖÜäöüßẞ]+');
    IF cardinality(input_words)<>cardinality(accepted_words) THEN CONTINUE; END IF;
    distance:=0;
    FOR word_index IN 1..cardinality(input_words) LOOP
     IF input_words[word_index]=accepted_words[word_index] THEN CONTINUE; END IF;
     -- Numbers/codes may be the learning objective: changed numeric-bearing
     -- tokens require an authored accepted answer, never global typo tolerance.
     IF input_words[word_index] !~ '^[[:alpha:]ÄÖÜäöüßẞ]+$'
      OR accepted_words[word_index] !~ '^[[:alpha:]ÄÖÜäöüßẞ]+$' THEN distance:=2; EXIT; END IF;
     -- Articles/pronouns/prepositions remain exact: der/den, ihm/ihn, am/an.
     IF least(char_length(input_words[word_index]),char_length(accepted_words[word_index]))<4 THEN distance:=2; EXIT; END IF;
     distance:=distance+learning_private.levenshtein_at_most_one(input_words[word_index],accepted_words[word_index]);
     IF distance>1 THEN EXIT; END IF;
    END LOOP;
    IF distance=1 THEN
     RETURN jsonb_build_object('status','SOFT_ERROR','matched',original,'reason',reason,'hint',NULL);
    END IF;
   END IF;
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
END $function$;

-- A noun's article remains a learning objective, including plural-only nouns.
-- Pure function shared by the scored attempt and the non-mutating retry.
CREATE OR REPLACE FUNCTION vocabulary_private.answer_article_feedback(p_input text,p_word text,p_article text,p_plural text)
RETURNS vocabulary_private.article_feedback LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE input_value text:=lower(learning_private.answer_without_punctuation(p_input));
 word text:=lower(learning_private.answer_without_punctuation(p_word));
 plural text:=CASE WHEN btrim(coalesce(p_plural,'')) NOT IN ('','-','–','—')
  THEN lower(learning_private.answer_without_punctuation(p_plural)) END;
 parts text[];
BEGIN
 IF p_article IS NULL OR p_article='none' THEN RETURN NULL; END IF;
 IF input_value=word OR input_value=plural THEN RETURN 'article_missing'; END IF;
 parts:=regexp_match(input_value,'^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines) (.+)$');
 IF parts IS NOT NULL AND (parts[2]=word OR parts[2]=plural)
  AND NOT (coalesce(parts[2]=word AND parts[1]=p_article,false)
    OR coalesce(parts[2]=plural AND parts[1]='die',false)) THEN RETURN 'article_wrong'; END IF;
 RETURN NULL;
END $function$;
REVOKE ALL ON FUNCTION learning_private.answer_without_punctuation(text),
 vocabulary_private.answer_article_feedback(text,text,text,text) FROM PUBLIC,anon,authenticated;
-- Legacy SECURITY DEFINER owners need just these helpers, not client access.
GRANT EXECUTE ON FUNCTION learning_private.answer_without_punctuation(text),
 vocabulary_private.answer_article_feedback(text,text,text,text) TO postgres;

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
   'matched',CASE WHEN correct THEN target.content->>'correct_answer' ELSE NULL END,'reason',NULL,'hint',NULL);
 ELSE
  -- Compatibility fallback for legacy reads; remove only in a follow-up release.
  accepted:=coalesce(target.content->'accepted_answers',target.content->'alternative_answers','[]'::jsonb);
  IF jsonb_typeof(accepted) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF;
  -- A supplied wrong option is deliberate grammar content, never a typo.
  IF jsonb_typeof(target.content->'options')='array' AND EXISTS(
   SELECT 1 FROM jsonb_array_elements_text(target.content->'options') option
   WHERE option=p_answer AND option<>target.content->>'correct_answer'
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(accepted) answer WHERE answer=option)) THEN
   grade:=jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
  ELSE
   grade:=learning_private.grade_answer(p_answer,ARRAY[target.content->>'correct_answer']||ARRAY(SELECT jsonb_array_elements_text(accepted)));
  END IF;
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
 feedback vocabulary_private.article_feedback; correct boolean; soft boolean; old_phase integer; new_phase integer;
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
 IF progress.direction='native_to_de' AND NOT card.sentence_practice THEN
  feedback:=vocabulary_private.answer_article_feedback(p_typed_answer,card.word_de,card.article::text,card.plural);
  IF feedback IS NOT NULL THEN
   grade:=jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
  END IF;
 END IF;
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
  'correctAnswer',solution.canonical,'isAlternative',is_alternative,'softError',grade->'reason','hint',grade->'hint','feedback',feedback);
END $function$;

CREATE OR REPLACE FUNCTION vocabulary_private.check_retry_answer(p_progress_id uuid, p_typed_answer text, p_ui_language text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 solution record; grade jsonb; correct boolean; feedback vocabulary_private.article_feedback;
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
 IF progress.direction='native_to_de' AND NOT card.sentence_practice THEN
  feedback:=vocabulary_private.answer_article_feedback(p_typed_answer,card.word_de,card.article::text,card.plural);
  IF feedback IS NOT NULL THEN
   grade:=jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
  END IF;
 END IF;
 correct:=grade->>'status' IN('EXACT','SOFT_ERROR');
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'correctAnswer',solution.canonical,
  'isAlternative',correct AND grade->>'matched' IS DISTINCT FROM solution.canonical,'softError',grade->'reason','hint',grade->'hint','feedback',feedback);
END $$;
