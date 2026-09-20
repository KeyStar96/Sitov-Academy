-- Phase 3.1–3.3. Applied by migrate-local.py in its transaction after 05 and R8 backup.
-- Public JSONB error boundaries, argument signatures and existing ACLs stay intact.
DO $types$ BEGIN
 IF to_regtype('learning_private.answer_status') IS NULL THEN
  CREATE TYPE learning_private.answer_status AS ENUM ('EXACT','SOFT_ERROR','INCORRECT');
 END IF;
 IF to_regtype('learning_private.soft_error_reason') IS NULL THEN
  CREATE TYPE learning_private.soft_error_reason AS ENUM ('punctuation','capitalization','umlaut','typo');
 END IF;
END $types$;

CREATE OR REPLACE FUNCTION learning_private.normalize_answer(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path TO '' AS $function$
 SELECT btrim(regexp_replace(p_value,'\s+',' ','g'))
$function$;

CREATE OR REPLACE FUNCTION learning_private.expand_german_letters(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path TO '' AS $function$
 SELECT replace(replace(replace(replace(replace(replace(replace(replace(
  p_value,'ä','ae'),'ö','oe'),'ü','ue'),'ß','ss'),'Ä','Ae'),'Ö','Oe'),'Ü','Ue'),'ẞ','SS')
$function$;

-- Thresholded Unicode Levenshtein: 0, 1, or 2 (= distance greater than one).
-- At most one insertion, deletion or substitution; transposition costs two.
-- Arrays avoid byte slicing and a quadratic distance matrix for long answers.
CREATE OR REPLACE FUNCTION learning_private.levenshtein_at_most_one(p_left text,p_right text) RETURNS integer
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path TO '' AS $function$
DECLARE left_chars text[]; right_chars text[]; left_length integer:=char_length(p_left);
 right_length integer:=char_length(p_right); i integer:=1; j integer:=1; distance integer:=0;
BEGIN
 IF p_left=p_right THEN RETURN 0; END IF;
 IF abs(left_length-right_length)>1 THEN RETURN 2; END IF;
 left_chars:=regexp_split_to_array(p_left,''); right_chars:=regexp_split_to_array(p_right,'');
 WHILE i<=left_length AND j<=right_length LOOP
  IF left_chars[i]=right_chars[j] THEN i:=i+1; j:=j+1;
  ELSE
   distance:=distance+1; IF distance>1 THEN RETURN 2; END IF;
   IF left_length>=right_length THEN i:=i+1; END IF;
   IF right_length>=left_length THEN j:=j+1; END IF;
  END IF;
 END LOOP;
 RETURN least(2,distance+(left_length-i+1)+(right_length-j+1));
END $function$;

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
REVOKE ALL ON FUNCTION learning_private.normalize_answer(text),learning_private.expand_german_letters(text),
 learning_private.levenshtein_at_most_one(text,text),learning_private.grade_answer(text,text[]) FROM PUBLIC,anon,authenticated;

-- Consolidate both answer lists, preserving canonical order and all distinct legacy
-- answers. Invalid source arrays abort the whole migration rather than losing data.
DO $validate$ BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_exercises e CROSS JOIN LATERAL
  (VALUES(e.content->'accepted_answers'),(e.content->'alternative_answers')) arrays(value)
  WHERE arrays.value IS NOT NULL AND (jsonb_typeof(arrays.value) IS DISTINCT FROM 'array'
   OR jsonb_path_exists(arrays.value,'$[*] ? (@.type() != "string")'))) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='invalid_accepted_answers',DETAIL='Review malformed legacy answer arrays before migration.';
 END IF;
END $validate$;
UPDATE public.learning_exercises SET content=jsonb_set(content-'alternative_answers','{accepted_answers}',
 coalesce((SELECT jsonb_agg(answer ORDER BY position) FROM (
  SELECT DISTINCT ON (lower(learning_private.normalize_answer(answer))) answer,position
  FROM jsonb_array_elements_text(jsonb_build_array(content->>'correct_answer')||coalesce(content->'accepted_answers','[]'::jsonb)
   ||coalesce(content->'alternative_answers','[]'::jsonb)) WITH ORDINALITY entries(answer,position)
  WHERE nullif(learning_private.normalize_answer(answer),'') IS NOT NULL
  ORDER BY lower(learning_private.normalize_answer(answer)),position
 ) accepted),'[]'::jsonb))
WHERE content ? 'alternative_answers';

CREATE OR REPLACE FUNCTION grammar_private.valid_accepted_answers(p_content jsonb,p_type public.exercise_type) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE answers jsonb:=p_content->'accepted_answers';
BEGIN
 IF jsonb_typeof(p_content) IS DISTINCT FROM 'object' OR p_content ? 'alternative_answers'
  OR jsonb_typeof(answers) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(answers)>21 OR EXISTS(SELECT 1 FROM jsonb_array_elements(answers) a
  WHERE jsonb_typeof(a) IS DISTINCT FROM 'string' OR length(btrim(a#>>'{}')) NOT BETWEEN 1 AND 1000) THEN RETURN false; END IF;
 IF p_type='multiple_choice' AND jsonb_array_length(answers)<>1 THEN RETURN false; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements_text(answers))<>(SELECT count(DISTINCT lower(regexp_replace(btrim(a),'\s+',' ','g')))
  FROM jsonb_array_elements_text(answers) a) THEN RETURN false; END IF;
 RETURN p_type='sentence_building' OR (nullif(btrim(p_content->>'correct_answer'),'') IS NOT NULL AND EXISTS(
  SELECT 1 FROM jsonb_array_elements_text(answers) a WHERE lower(regexp_replace(btrim(a),'\s+',' ','g'))=
   lower(regexp_replace(btrim(p_content->>'correct_answer'),'\s+',' ','g'))));
END $function$;
-- Revalidate after changing the immutable validator; disallow new legacy keys.
ALTER TABLE public.learning_exercises DROP CONSTRAINT IF EXISTS learning_exercises_accepted_answers_check;
ALTER TABLE public.learning_exercises ADD CONSTRAINT learning_exercises_accepted_answers_check
 CHECK(grammar_private.valid_accepted_answers(content,type));

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
 profile public.profiles; canonical text; translated text; prompt text; previous_card uuid; grade jsonb;
 accepted text[]; correct boolean; sentence boolean; soft boolean; old_phase integer; new_phase integer;
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
 SELECT translation,context_sentence INTO translated,prompt FROM public.vocabulary_translations WHERE card_id=card.id AND locale=p_ui_language;
 sentence:=card.sentence_practice AND progress.direction='native_to_de';
 IF sentence THEN
  SELECT context_sentence INTO canonical FROM public.vocabulary_translations WHERE card_id=card.id AND locale='de';
  IF nullif(btrim(prompt),'') IS NULL OR nullif(btrim(canonical),'') IS NULL THEN
   RAISE EXCEPTION 'sentence_content_missing' USING ERRCODE='23514'; END IF;
  accepted:=ARRAY[canonical]||coalesce(card.alternative_answers_de,ARRAY[]::text[]);
 ELSIF progress.direction='native_to_de' THEN
  canonical:=concat_ws(' ',nullif(nullif(card.article::text,'none'),''),card.word_de);
  accepted:=ARRAY[canonical];
 ELSE
  canonical:=translated; accepted:=ARRAY[canonical];
 END IF;
 IF nullif(btrim(canonical),'') IS NULL THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='23514'; END IF;
 -- Every answer, in either direction, is graded from stored content. The legacy
 -- p_is_correct argument remains payload-bound for receipt compatibility only.
 grade:=learning_private.grade_answer(p_typed_answer,accepted);
 PERFORM platform_private.require_rpc_success(grade);
 correct:=grade->>'status' IN('EXACT','SOFT_ERROR'); soft:=grade->>'status'='SOFT_ERROR';
 is_alternative:=correct AND grade->>'matched' IS DISTINCT FROM canonical;
 old_phase:=least(6,greatest(1,coalesce(progress.box_number,1)));
 new_phase:=CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;
 new_box:=CASE WHEN correct AND old_phase=6 THEN 7 ELSE new_phase END;
 days:=CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
 previous_days:=CASE old_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
 IF soft THEN days:=least(days,previous_days); END IF;
 SELECT coalesce(t.is_difficult,false) INTO difficult FROM public.vocabulary_translations t WHERE t.card_id=card.id AND t.locale=profile.native_language;
 IF difficult THEN days:=greatest(1,days/2); END IF;
 UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=now()+make_interval(days=>days),
  lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now() WHERE id=progress.id;
 INSERT INTO public.vocabulary_learning_state(auth_user_id,last_card_id,last_reviewed_at) VALUES(actor,progress.card_id,now())
 ON CONFLICT(auth_user_id) DO UPDATE SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
  'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days,
  'correctAnswer',canonical,'isAlternative',is_alternative,'softError',grade->'reason');
END $function$;
-- Enrich previously committed, server-graded sentence receipts without changing
-- their verdict, cursor, timestamps or progress. Legacy bool-only word receipts
-- have no server-derived correctAnswer and must never authorize a new rating.
UPDATE vocabulary_private.answer_receipts SET response=response
 || CASE WHEN response ? 'softError' THEN '{}'::jsonb ELSE jsonb_build_object('softError',NULL) END
 || CASE WHEN response ? 'isAlternative' THEN '{}'::jsonb ELSE jsonb_build_object('isAlternative',false) END
WHERE typed_answer IS NOT NULL AND response ? 'correctAnswer'
 AND (NOT response ? 'softError' OR NOT response ? 'isAlternative');

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid,p_progress_id uuid,p_is_correct boolean,p_typed_answer text,p_ui_language text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE actor uuid:=auth.uid(); receipt vocabulary_private.answer_receipts; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_progress_id IS NULL OR p_ui_language IS NULL
  OR p_ui_language NOT IN('de','en','ru','uk','tr') OR length(p_typed_answer)>4000 THEN
  RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
 -- Required before receipt lookup: an old bool-only request cannot bypass R5.
 IF p_typed_answer IS NULL OR learning_private.normalize_answer(p_typed_answer)='' THEN
  RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  WHERE v.id=p_progress_id AND v.auth_user_id=actor AND learning_private.unit_allowed(c.unit_id)) THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_ui_language='de' THEN RAISE EXCEPTION 'invalid_learning_language' USING ERRCODE='42501'; END IF;
 SELECT * INTO receipt FROM vocabulary_private.answer_receipts WHERE auth_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.progress_id IS DISTINCT FROM p_progress_id OR receipt.is_correct IS DISTINCT FROM p_is_correct
   OR convert_to(receipt.typed_answer,'UTF8') IS DISTINCT FROM convert_to(p_typed_answer,'UTF8')
   OR receipt.ui_language IS DISTINCT FROM p_ui_language THEN
   RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE='22023'; END IF;
  IF NOT receipt.response ? 'correctAnswer' OR NOT receipt.response ? 'softError' THEN
   RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
  -- Return before due/spacing checks; the already committed response is final.
  RETURN receipt.response;
 END IF;
 result:=vocabulary_private.submit_answer(p_progress_id,p_is_correct,p_typed_answer,p_ui_language);
 PERFORM platform_private.require_rpc_success(result);
 INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response)
 VALUES(actor,p_request_id,p_progress_id,p_is_correct,p_typed_answer,p_ui_language,result);
 RETURN result;
END $function$;
-- CREATE OR REPLACE retains existing EXECUTE ACLs. Public JSONB boundaries roll
-- back grade, cursor and receipt together whenever a private caller raises.

-- ROLLBACK (R9): stop app/mail workers; restore the verified pre-06 R8 database
-- backup and the matching app release, then reload PostgREST's schema cache.
-- Scoped SQL rollback, using exact pre-06 pg_get_functiondef definitions/ACLs:
-- 1. Restore grammar_private.record_attempt, vocabulary_private.submit_answer and
--    vocabulary_private.submit_answer_once.
-- 2. Restore grammar_private.valid_accepted_answers and revalidate its CHECK.
-- 3. Restore learning_exercises.content from the backup for the pre-06 row IDs
--    (only the obsolete JSON key was removed; no exercise or progress was deleted).
-- 4. DROP FUNCTION learning_private.grade_answer(text,text[]) RESTRICT;
--    DROP FUNCTION learning_private.levenshtein_at_most_one(text,text) RESTRICT;
--    DROP FUNCTION learning_private.expand_german_letters(text) RESTRICT;
--    DROP FUNCTION learning_private.normalize_answer(text) RESTRICT;
--    DROP TYPE learning_private.soft_error_reason RESTRICT;
--    DROP TYPE learning_private.answer_status RESTRICT;
-- Never use CASCADE. Restore matching receipt/progress data if reverting learning
-- attempts submitted after deployment; otherwise retain the newer earned progress.
