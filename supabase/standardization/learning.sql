-- Canonical learning catalog. Apply after foundation.sql and identity.sql.
-- Preserve all content IDs, text, translations, grants, progress and audio references.
CREATE TEMP TABLE canonical_learning_before ON COMMIT DROP AS
 SELECT 'vocabulary' kind,id,to_jsonb(c) payload FROM public.learning_vocabulary_cards c
 UNION ALL SELECT 'exercises',id,to_jsonb(e) FROM public.learning_exercises e
 UNION ALL SELECT 'pronunciation',id,to_jsonb(r)-'legacy_cefr_level'-'unit_id' FROM public.learning_reading_texts r
 UNION ALL SELECT 'videos',id,to_jsonb(v) FROM public.learning_videos v;

CREATE TABLE public.cefr_levels(code text PRIMARY KEY CHECK(code IN('A1','A2','B1','B2','C1','C2')));
INSERT INTO public.cefr_levels VALUES ('A1'),('A2'),('B1'),('B2'),('C1'),('C2');
CREATE TABLE public.learning_trainers(code text PRIMARY KEY CHECK(code IN('vocabulary','exercises','pronunciation','videos')));
INSERT INTO public.learning_trainers VALUES ('vocabulary'),('exercises'),('pronunciation'),('videos');
ALTER TABLE public.cefr_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_trainers ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_read ON public.cefr_levels FOR SELECT TO authenticated USING(true);
CREATE POLICY catalog_read ON public.learning_trainers FOR SELECT TO authenticated USING(true);
REVOKE ALL ON public.cefr_levels,public.learning_trainers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cefr_levels,public.learning_trainers TO authenticated;
GRANT ALL ON public.cefr_levels,public.learning_trainers TO service_role;
ALTER TABLE public.learning_levels ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.learning_levels ADD CONSTRAINT learning_levels_cefr_fk FOREIGN KEY(cefr_level) REFERENCES public.cefr_levels(code);
ALTER TABLE public.learning_units ADD CONSTRAINT learning_units_trainer_fk FOREIGN KEY(trainer) REFERENCES public.learning_trainers(code);
ALTER TABLE public.learning_trainer_grants ADD CONSTRAINT learning_grants_trainer_fk FOREIGN KEY(trainer) REFERENCES public.learning_trainers(code);
ALTER TABLE public.vocabulary_translations ADD CONSTRAINT vocabulary_locale_fk FOREIGN KEY(locale) REFERENCES public.locales(code);
ALTER TABLE public.grammar_translations ADD CONSTRAINT grammar_locale_fk FOREIGN KEY(locale) REFERENCES public.locales(code);
CREATE INDEX vocabulary_translations_locale_idx ON public.vocabulary_translations(locale);
CREATE INDEX grammar_translations_locale_idx ON public.grammar_translations(locale);
INSERT INTO public.learning_levels(code,cefr_level,sort_order,is_active) VALUES ('B2','B2',7,false),('C1','C1',8,false),('C2','C2',9,false);
-- These 30 texts carried only a CEFR family, so keep that exact family rather
-- than inventing a sub-level. Existing 119 unit assignments remain unchanged.
INSERT INTO public.learning_units(id,level,trainer,label,sort_order,is_active)
 SELECT r.id,r.legacy_cefr_level,'pronunciation',left(r.sentence_de,120),
 row_number() OVER(PARTITION BY r.legacy_cefr_level ORDER BY r.created_at,r.id),false
 FROM public.learning_reading_texts r WHERE r.unit_id IS NULL;
UPDATE public.learning_reading_texts SET unit_id=id WHERE unit_id IS NULL;
ALTER TABLE public.learning_reading_texts ALTER COLUMN unit_id SET NOT NULL;

ALTER TABLE public.vocabulary_onboarding ADD COLUMN started_unit_id uuid;
UPDATE public.vocabulary_onboarding o SET started_unit_id=u.id FROM public.learning_units u
 WHERE u.level=o.level AND u.trainer='vocabulary' AND u.label=o.started_lesson;
ALTER TABLE public.vocabulary_onboarding ALTER COLUMN started_unit_id SET NOT NULL;
ALTER TABLE public.vocabulary_onboarding ADD CONSTRAINT vocabulary_onboarding_unit_fk FOREIGN KEY(started_unit_id) REFERENCES public.learning_units(id) ON DELETE CASCADE;
ALTER TABLE public.vocabulary_onboarding ADD CONSTRAINT vocabulary_onboarding_level_fk FOREIGN KEY(level) REFERENCES public.learning_levels(code);
CREATE INDEX vocabulary_onboarding_unit_idx ON public.vocabulary_onboarding(started_unit_id);

CREATE OR REPLACE FUNCTION vocabulary_private.initialize_cards(p_decisions jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  actor uuid := auth.uid();
  item jsonb;
  target uuid;
  known boolean;
  selected_direction text;
  touched integer;
  known_count integer := 0;
  new_count integer := 0;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_decisions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_decisions) > 1000 THEN
    RAISE EXCEPTION 'invalid_decisions' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text, 0));
  FOR item IN SELECT value FROM jsonb_array_elements(p_decisions) LOOP
    IF jsonb_typeof(item->'alreadyKnown') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'invalid_decision' USING ERRCODE = '22023';
    END IF;
    selected_direction := item->>'direction';
    IF selected_direction IS NOT NULL AND selected_direction NOT IN ('de_to_native','native_to_de') THEN
      RAISE EXCEPTION 'invalid_direction' USING ERRCODE='22023';
    END IF;
    target := (item->>'cardId')::uuid;
    known := (item->>'alreadyKnown')::boolean;
    IF NOT EXISTS (
      SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.id=target AND learning_private.unit_allowed(c.unit_id)
    ) THEN RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.vocabulary_direction_progress(user_id, card_id, direction, box_number, next_review_date)
      SELECT actor, target, d, CASE WHEN known THEN 6 ELSE 1 END,
        CASE WHEN known THEN now() + interval '90 days' ELSE now() END
      FROM unnest(CASE WHEN selected_direction IS NULL THEN ARRAY['de_to_native','native_to_de'] ELSE ARRAY[selected_direction] END) d
      ON CONFLICT (user_id, card_id, direction) DO NOTHING;
    GET DIAGNOSTICS touched = ROW_COUNT;
    -- The UI reports words, while each word has two independent records.
    IF touched > 0 THEN
      IF known THEN known_count := known_count + 1; ELSE new_count := new_count + 1; END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('addedKnown', known_count, 'addedNew', new_count);
END;
$$;

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  actor uuid := auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
  profile public.profiles; german_sentence text; previous_card uuid; prompt text; correct boolean; sentence boolean;
  old_phase integer; new_phase integer; new_box integer; days integer; difficult boolean;
  is_alternative boolean := false;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_ui_language NOT IN ('de','en','ru','uk','tr') OR p_ui_language IS NULL THEN
    RAISE EXCEPTION 'invalid_language' USING ERRCODE = '22023';
  END IF;
  IF length(p_typed_answer) > 4000 THEN RAISE EXCEPTION 'answer_too_long' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text, 0));
  SELECT * INTO progress FROM public.vocabulary_direction_progress WHERE id = p_progress_id AND user_id = actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'progress_not_found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id = progress.card_id;
  SELECT * INTO profile FROM public.profiles WHERE id = actor;
  IF NOT learning_private.unit_allowed(card.unit_id) OR p_ui_language='de' THEN
    RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
  END IF;
  IF progress.box_number = 7 OR progress.next_review_date > now() THEN
    RAISE EXCEPTION 'review_not_due' USING ERRCODE = 'PT409';
  END IF;
  SELECT last_card_id INTO previous_card FROM public.vocabulary_learning_state WHERE user_id = actor;
  IF previous_card = progress.card_id THEN
    RAISE EXCEPTION 'vocabulary_spacing_required' USING ERRCODE = 'PT409';
  END IF;
  SELECT context_sentence INTO prompt FROM public.vocabulary_translations WHERE card_id=card.id AND locale=p_ui_language;
  SELECT context_sentence INTO german_sentence FROM public.vocabulary_translations WHERE card_id=card.id AND locale='de';
  sentence := card.sentence_practice AND progress.direction = 'native_to_de';
  IF sentence AND (nullif(btrim(prompt),'') IS NULL OR nullif(btrim(german_sentence),'') IS NULL) THEN
    RAISE EXCEPTION 'sentence_content_missing' USING ERRCODE='23514';
  END IF;
  IF sentence THEN
    -- Byte-exact comparison: no trimming, case folding, punctuation removal or client grading.
    correct := coalesce(convert_to(p_typed_answer,'UTF8') = convert_to(german_sentence,'UTF8'),false);
    IF NOT correct AND card.alternative_answers_de IS NOT NULL AND array_length(card.alternative_answers_de, 1) > 0 THEN
      IF coalesce(convert_to(p_typed_answer,'UTF8') = ANY (
           SELECT convert_to(alt, 'UTF8') FROM unnest(card.alternative_answers_de) alt
         ), false) THEN
        correct := true;
        is_alternative := true;
      END IF;
    END IF;
  ELSE
    IF p_is_correct IS NULL THEN RAISE EXCEPTION 'answer_required' USING ERRCODE = '22023'; END IF;
    correct := p_is_correct;
  END IF;
  old_phase := least(6,greatest(1,coalesce(progress.box_number,1)));
  new_phase := CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;
  new_box := CASE WHEN correct AND old_phase=6 THEN 7 ELSE new_phase END;
  days := CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
  SELECT coalesce(t.is_difficult,false) INTO difficult FROM public.vocabulary_translations t WHERE t.card_id=card.id AND t.locale=profile.native_language;
  IF difficult THEN days := greatest(1,days/2); END IF;
  UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=now()+make_interval(days=>days),
    lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now()
    WHERE id = progress.id;
  INSERT INTO public.vocabulary_learning_state(user_id,last_card_id,last_reviewed_at)
    VALUES(actor,progress.card_id,now()) ON CONFLICT(user_id) DO UPDATE
    SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
  RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
    'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days)
    || CASE WHEN sentence THEN jsonb_build_object('correctAnswer',german_sentence,'isAlternative',is_alternative) ELSE '{}'::jsonb END;
END;
$$;

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  actor uuid := auth.uid();
  receipt vocabulary_private.answer_receipts;
  result jsonb;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_progress_id IS NULL
    OR p_ui_language IS NULL OR p_ui_language NOT IN ('de','en','ru','uk','tr')
    OR length(p_typed_answer) > 4000 THEN
    RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE = '22023';
  END IF;

  -- Use the SAME first lock as submit_answer. PostgreSQL transaction advisory
  -- locks are reentrant, so its nested acquisition cannot deadlock with us.
  -- Serialize lookup + grade + receipt together, including concurrent retries.
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
    WHERE v.id=p_progress_id AND v.user_id=actor AND learning_private.unit_allowed(c.unit_id)) THEN
    RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
  END IF;
  IF p_ui_language='de' THEN
    RAISE EXCEPTION 'invalid_learning_language' USING ERRCODE='42501';
  END IF;
  SELECT * INTO receipt FROM vocabulary_private.answer_receipts
    WHERE user_id = actor AND request_id = p_request_id;
  IF FOUND THEN
    IF receipt.progress_id IS DISTINCT FROM p_progress_id
      OR receipt.is_correct IS DISTINCT FROM p_is_correct
      OR convert_to(receipt.typed_answer, 'UTF8') IS DISTINCT FROM convert_to(p_typed_answer, 'UTF8')
      OR receipt.ui_language IS DISTINCT FROM p_ui_language THEN
      RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE = '22023';
    END IF;
    -- Return before due/spacing checks: the first call already committed this
    -- exact answer, and a later review may have moved the persistent cursor.
    RETURN receipt.response;
  END IF;

  result := vocabulary_private.submit_answer(p_progress_id, p_is_correct, p_typed_answer, p_ui_language);
  INSERT INTO vocabulary_private.answer_receipts(
    user_id, request_id, progress_id, is_correct, typed_answer, ui_language, response
  ) VALUES (actor, p_request_id, p_progress_id, p_is_correct, p_typed_answer, p_ui_language, result);
  -- Both grading and receipt commit with this RPC; any exception rolls back both.
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  actor uuid := auth.uid();
  target public.learning_exercises;
  correct boolean;
  answer_normalized text;
  attempt_count integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_answer IS NULL OR length(btrim(p_answer)) = 0 OR length(p_answer) > 1000 THEN
    RAISE EXCEPTION 'invalid_answer' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.learning_exercises WHERE id = p_exercise_id;
  IF NOT FOUND OR target.type NOT IN ('fill_in_blank', 'multiple_choice') THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  IF NOT learning_private.unit_allowed(target.unit_id) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
  IF coalesce(target.content->>'correct_answer', '') = '' THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  answer_normalized := lower(regexp_replace(btrim(p_answer), '\s+', ' ', 'g'));
  correct := answer_normalized = lower(regexp_replace(btrim(target.content->>'correct_answer'), '\s+', ' ', 'g'));

  IF NOT correct AND target.type='fill_in_blank' AND jsonb_typeof(target.content->'alternative_answers')='array' THEN
    correct := EXISTS(SELECT 1 FROM jsonb_array_elements_text(target.content->'alternative_answers') alt
      WHERE answer_normalized=lower(regexp_replace(btrim(alt), '\s+', ' ', 'g')));
  END IF;

  INSERT INTO public.user_exercise_progress AS progress
    (user_id, exercise_id, attempts, completed, score, hint_shown, updated_at)
  VALUES (actor, p_exercise_id, 1, correct, CASE WHEN correct THEN 100 ELSE 0 END, coalesce(p_hint_shown,false), now())
  ON CONFLICT (user_id, exercise_id) DO UPDATE SET
    attempts = progress.attempts + 1,
    completed = coalesce(progress.completed, false) OR correct,
    hint_shown = progress.hint_shown OR coalesce(p_hint_shown, false),
    score = greatest(coalesce(progress.score, 0), CASE WHEN correct THEN
      CASE WHEN progress.attempts + 1 <= 1 THEN 100 WHEN progress.attempts + 1 = 2 THEN 80
        WHEN progress.attempts + 1 = 3 THEN 60 ELSE 40 END ELSE 0 END),
    updated_at = now()
  RETURNING attempts INTO attempt_count;
  RETURN jsonb_build_object('success', true, 'attempts', attempt_count, 'isCorrect', correct);
END;
$$;

CREATE OR REPLACE FUNCTION pronunciation_private.create_submission(p_prompt_id uuid, p_audio_path text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid := (SELECT auth.uid()); prompt public.learning_reading_texts%ROWTYPE; unit public.learning_units; result uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT * INTO prompt FROM public.learning_reading_texts WHERE id=p_prompt_id;
 IF NOT FOUND OR NOT learning_private.unit_allowed(prompt.unit_id) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO unit FROM public.learning_units WHERE id=prompt.unit_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_content' USING ERRCODE='42501'; END IF;
 IF p_audio_path NOT LIKE 'storage://pronunciation_audio/' || actor::text || '/%' OR NOT EXISTS(
 SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pronunciation_audio' AND 'storage://pronunciation_audio/' || o.name = p_audio_path)
 THEN RAISE EXCEPTION 'Invalid recording'; END IF;
 INSERT INTO public.submissions(user_id,type,content_url,text_content,status,level,prompt_id,prompt_title)
 VALUES(actor,'audio',p_audio_path,prompt.sentence_de,'pending',unit.level,prompt.id,unit.label) RETURNING id INTO result;
 RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION learning_private.reset_student_level(p_student_id uuid, p_level text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$ BEGIN
 IF auth.uid() IS NULL OR coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id) THEN RAISE EXCEPTION 'Invalid learner/level' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||p_student_id::text,0));
 DELETE FROM public.vocabulary_direction_progress p USING public.learning_vocabulary_cards c,public.learning_units u WHERE u.id=c.unit_id AND p.card_id=c.id AND p.user_id=p_student_id AND u.level=p_level;
 DELETE FROM public.user_exercise_progress p USING public.learning_exercises e,public.learning_units u WHERE u.id=e.unit_id AND p.exercise_id=e.id AND p.user_id=p_student_id AND u.level=p_level;
 DELETE FROM public.vocabulary_onboarding WHERE user_id=p_student_id AND level=p_level;
 UPDATE public.vocabulary_learning_state SET last_card_id=NULL WHERE user_id=p_student_id AND last_card_id IN(SELECT c.id FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id WHERE u.level=p_level);
END $$;

CREATE OR REPLACE FUNCTION trainer_access_private.allowed(p_level text, p_trainer text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND(
 p.role IN('teacher','admin') OR(p.ui_language<>'de' AND p_trainer IN('vocabulary','exercises','pronunciation','videos')
 AND EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.user_id=p.id AND l.level=p_level)
 AND coalesce((SELECT a.enabled FROM public.learning_trainer_grants a WHERE a.user_id=p.id AND a.level=p_level AND a.trainer=p_trainer),true))));
$$;

CREATE OR REPLACE FUNCTION trainer_access_private.unit_allowed(p_level text, p_trainer text, p_unit text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT trainer_access_private.allowed(p_level,p_trainer) AND EXISTS(SELECT 1 FROM public.learning_units u
 WHERE u.level=p_level AND u.trainer=p_trainer AND u.id::text=p_unit AND(
 (SELECT identity_private.current_profile_role()) IN('teacher','admin') OR(u.is_active AND NOT EXISTS(
 SELECT 1 FROM public.learning_trainer_grants a WHERE a.user_id=(SELECT auth.uid()) AND a.level=p_level AND a.trainer=p_trainer
 AND a.unit_mode='selected' AND NOT EXISTS(SELECT 1 FROM public.learning_unit_grants g
 WHERE g.user_id=a.user_id AND g.level=a.level AND g.trainer=a.trainer AND g.unit_id=u.id)))));
$$;

CREATE OR REPLACE FUNCTION learning_private.unit_allowed(p_unit_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit_id
 AND trainer_access_private.unit_allowed(u.level,u.trainer,u.id::text));
$$;

CREATE OR REPLACE FUNCTION pronunciation_private.can_access_submission(p_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.submissions s WHERE s.id=p_id AND
   ((SELECT identity_private.current_profile_role()) IN ('teacher','admin') OR
    (s.user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.learning_reading_texts r WHERE r.id=s.prompt_id AND learning_private.unit_allowed(r.unit_id))))
 );
$$;

CREATE OR REPLACE FUNCTION pronunciation_private.mark_seen(p_submission_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF NOT pronunciation_private.can_access_submission(p_submission_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 UPDATE public.pronunciation_messages SET seen_at = now()
 WHERE submission_id = p_submission_id AND sender_id <> (SELECT auth.uid()) AND seen_at IS NULL
 AND (CASE WHEN (SELECT identity_private.current_profile_role()) IN ('teacher','admin') THEN sender_role = 'student' ELSE sender_role IN ('teacher','admin') END);
END;
$$;

CREATE OR REPLACE FUNCTION pronunciation_private.validate_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid := (SELECT auth.uid()); actual_role text;
BEGIN
 IF actor IS NULL OR NEW.sender_id <> actor OR NOT pronunciation_private.can_access_submission(NEW.submission_id) THEN
   RAISE EXCEPTION 'Not authorized';
 END IF;
 actual_role := (SELECT p.role FROM public.profiles p WHERE p.id = actor);
 NEW.sender_role := CASE WHEN actual_role IN ('teacher','admin') THEN actual_role ELSE 'student' END;
 NEW.created_at := now(); NEW.seen_at := NULL;
 IF NEW.audio_path IS NOT NULL AND (
   NEW.audio_path NOT LIKE 'storage://pronunciation_audio/' || actor::text || '/%'
   OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pronunciation_audio' AND 'storage://pronunciation_audio/' || o.name = NEW.audio_path)
 ) THEN RAISE EXCEPTION 'Invalid recording'; END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trainer_access_private.can_record() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND
 (p.role IN('teacher','admin') OR EXISTS(SELECT 1 FROM public.learning_units u WHERE u.trainer='pronunciation'
 AND trainer_access_private.unit_allowed(u.level,u.trainer,u.id::text))));
$$;


CREATE OR REPLACE FUNCTION vocabulary_private.skip_assessment(p_level text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := auth.uid(); first_unit public.learning_units; decisions jsonb; result jsonb;
BEGIN
 IF actor IS NULL OR NOT trainer_access_private.allowed(p_level,'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 SELECT u.* INTO first_unit FROM public.learning_units u WHERE u.level=p_level AND u.trainer='vocabulary'
 AND learning_private.unit_allowed(u.id) AND EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
 ORDER BY u.sort_order,u.label,u.id LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'lesson_not_found' USING ERRCODE='22023'; END IF;
 SELECT jsonb_agg(jsonb_build_object('cardId',id,'alreadyKnown',false)) INTO decisions FROM public.learning_vocabulary_cards WHERE unit_id=first_unit.id;
 result:=vocabulary_private.initialize_cards(decisions);
 INSERT INTO public.vocabulary_onboarding(user_id,level,status,started_unit_id) VALUES(actor,p_level,'skipped',first_unit.id)
 ON CONFLICT(user_id,level) DO UPDATE SET status='skipped',started_unit_id=excluded.started_unit_id,updated_at=now();
 RETURN result||jsonb_build_object('lesson',first_unit.label);
END $$;
DROP FUNCTION public.reset_vocabulary_lesson_progress(text,text);
DROP FUNCTION vocabulary_private.reset_lesson(text,text);
CREATE FUNCTION vocabulary_private.reset_lesson(p_unit_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); BEGIN
 IF actor IS NULL OR NOT learning_private.unit_allowed(p_unit_id)
 OR NOT EXISTS(SELECT 1 FROM public.learning_units WHERE id=p_unit_id AND trainer='vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 DELETE FROM public.vocabulary_direction_progress v USING public.learning_vocabulary_cards c WHERE v.user_id=actor AND v.card_id=c.id AND c.unit_id=p_unit_id;
END $$;
CREATE FUNCTION public.reset_vocabulary_lesson_progress(p_unit_id uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT vocabulary_private.reset_lesson(p_unit_id); $$;
REVOKE ALL ON FUNCTION vocabulary_private.reset_lesson(uuid),public.reset_vocabulary_lesson_progress(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vocabulary_private.reset_lesson(uuid),public.reset_vocabulary_lesson_progress(uuid) TO authenticated;
ALTER TABLE public.vocabulary_onboarding DROP COLUMN started_lesson;
CREATE FUNCTION learning_private.validate_onboarding_unit() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.learning_units WHERE id=NEW.started_unit_id AND level=NEW.level AND trainer='vocabulary') THEN
 RAISE EXCEPTION 'Invalid onboarding unit' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION learning_private.validate_onboarding_unit() FROM PUBLIC,anon;
CREATE TRIGGER validate_onboarding_unit BEFORE INSERT OR UPDATE OF started_unit_id,level ON public.vocabulary_onboarding
FOR EACH ROW EXECUTE FUNCTION learning_private.validate_onboarding_unit();

-- Content writes accept a normalized unit, canonical fields and translation rows.
-- Updating a card cannot rename the lesson used by its siblings.
CREATE OR REPLACE FUNCTION public.save_learning_content(p_trainer text,p_payload jsonb,p_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_fields jsonb; fields jsonb; unit_data jsonb:=p_payload->'unit'; translations jsonb:=p_payload->'translations';
 item uuid:=coalesce(p_id,gen_random_uuid()); old_unit uuid; target_unit uuid; old_meta public.learning_units; translation_row jsonb;
BEGIN
 IF current_user NOT IN('service_role','postgres') AND coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_trainer IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_trainers WHERE code=p_trainer)
 OR jsonb_typeof(unit_data) IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'fields') IS DISTINCT FROM 'object'
 OR nullif(btrim(unit_data->>'label'),'') IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=unit_data->>'level') THEN
 RAISE EXCEPTION 'Invalid content' USING ERRCODE='23514'; END IF;
 IF p_id IS NOT NULL THEN
  IF p_trainer='vocabulary' THEN SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_vocabulary_cards c WHERE c.id=p_id;
  ELSIF p_trainer='exercises' THEN SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_exercises c WHERE c.id=p_id;
  ELSIF p_trainer='pronunciation' THEN SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_reading_texts c WHERE c.id=p_id;
  ELSE SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_videos c WHERE c.id=p_id; END IF;
  IF old_fields IS NULL THEN RAISE EXCEPTION 'Content unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO old_meta FROM public.learning_units WHERE id=old_unit;
 END IF;
 fields:=coalesce(old_fields,'{}'::jsonb)||(p_payload->'fields');
 IF p_trainer IN('vocabulary','exercises') THEN
  IF old_unit IS NOT NULL AND old_meta.level=unit_data->>'level' AND old_meta.label=unit_data->>'label' THEN target_unit:=old_unit;
  ELSE target_unit:=learning_private.ensure_unit(NULL,unit_data->>'level',p_trainer,unit_data->>'label'); END IF;
 ELSE
  target_unit:=learning_private.ensure_unit(old_unit,unit_data->>'level',p_trainer,unit_data->>'label',
    coalesce((unit_data->>'is_active')::boolean,old_meta.is_active,true),coalesce((unit_data->>'sort_order')::integer,old_meta.sort_order,100));
 END IF;
 IF p_trainer IN('vocabulary','exercises') THEN
  IF jsonb_typeof(translations) IS DISTINCT FROM 'array'
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(translations) t WHERE NOT EXISTS(SELECT 1 FROM public.locales WHERE code=t->>'locale'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(translations) t GROUP BY t->>'locale' HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Invalid translations' USING ERRCODE='23514'; END IF;
 END IF;
 IF p_trainer='vocabulary' THEN
  IF coalesce((fields->>'sentence_practice')::boolean,false) AND EXISTS(SELECT 1 FROM public.locales l WHERE NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(translations) t WHERE t->>'locale'=l.code AND nullif(btrim(t->>'context_sentence'),'') IS NOT NULL)) THEN
  RAISE EXCEPTION 'Sentence translations required' USING ERRCODE='23514'; END IF;
  INSERT INTO public.learning_vocabulary_cards(id,unit_id,word_de,article,plural,image_url,audio_url,sentence_practice,alternative_answers_de)
  VALUES(item,target_unit,fields->>'word_de',fields->>'article',fields->>'plural',fields->>'image_url',fields->>'audio_url',coalesce((fields->>'sentence_practice')::boolean,false),
  ARRAY(SELECT jsonb_array_elements_text(coalesce(fields->'alternative_answers_de','[]'::jsonb))))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,word_de=excluded.word_de,article=excluded.article,plural=excluded.plural,
  image_url=excluded.image_url,audio_url=excluded.audio_url,sentence_practice=excluded.sentence_practice,alternative_answers_de=excluded.alternative_answers_de;
  DELETE FROM public.vocabulary_translations WHERE card_id=item;
  FOR translation_row IN SELECT value FROM jsonb_array_elements(translations) LOOP
   INSERT INTO public.vocabulary_translations(card_id,locale,translation,context_sentence,is_difficult)
   VALUES(item,translation_row->>'locale',translation_row->>'translation',translation_row->>'context_sentence',coalesce((translation_row->>'is_difficult')::boolean,false));
  END LOOP;
 ELSIF p_trainer='exercises' THEN
  IF fields->>'type' NOT IN('fill_in_blank','multiple_choice') OR jsonb_typeof(fields->'content') IS DISTINCT FROM 'object'
  OR nullif(btrim(fields->'content'->>'correct_answer'),'') IS NULL OR (fields->'content') ?| ARRAY['smart_hint','explanation'] THEN
  RAISE EXCEPTION 'Invalid exercise' USING ERRCODE='23514'; END IF;
  INSERT INTO public.learning_exercises(id,unit_id,topic,type,content,solution_audio_url)
  VALUES(item,target_unit,fields->>'topic',fields->>'type',fields->'content',fields->>'solution_audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,topic=excluded.topic,type=excluded.type,content=excluded.content,solution_audio_url=excluded.solution_audio_url;
  DELETE FROM public.grammar_translations WHERE exercise_id=item;
  FOR translation_row IN SELECT value FROM jsonb_array_elements(translations) LOOP
   INSERT INTO public.grammar_translations(exercise_id,locale,hint,smart_hint,explanation)
   VALUES(item,translation_row->>'locale',translation_row->>'hint',translation_row->>'smart_hint',translation_row->>'explanation');
  END LOOP;
 ELSIF p_trainer='pronunciation' THEN
  INSERT INTO public.learning_reading_texts(id,unit_id,sentence_de,focus,audio_url)
  VALUES(item,target_unit,fields->>'sentence_de',fields->>'focus',fields->>'audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,sentence_de=excluded.sentence_de,focus=excluded.focus,audio_url=excluded.audio_url;
 ELSE
  INSERT INTO public.learning_videos(id,unit_id,description,video_url,external_url,is_external)
  VALUES(item,target_unit,fields->>'description',fields->>'video_url',fields->>'external_url',coalesce((fields->>'is_external')::boolean,true))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,description=excluded.description,video_url=excluded.video_url,external_url=excluded.external_url,is_external=excluded.is_external;
 END IF;
 IF old_unit IS NOT NULL AND old_unit<>target_unit THEN
  DELETE FROM public.learning_units u WHERE u.id=old_unit
  AND NOT EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_exercises c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_reading_texts c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_videos c WHERE c.unit_id=u.id);
 END IF;
 RETURN jsonb_build_object('id',item);
END $$;

-- Old feedback RPC had no callers and targeted the removed compatibility view.
DROP FUNCTION public.mark_feedback_seen(uuid);
DROP VIEW public.vocabulary_cards,public.exercises,public.pronunciation_prompts,public.videos,
 public.user_vocabulary_progress,public.teacher_feedback,public.student_trainer_access;
ALTER TABLE public.learning_reading_texts DROP CONSTRAINT reading_text_level;
ALTER TABLE public.learning_reading_texts DROP COLUMN legacy_cefr_level;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM canonical_learning_before b LEFT JOIN public.learning_reading_texts r ON r.id=b.id
 WHERE b.kind='pronunciation' AND (r.id IS NULL OR b.payload IS DISTINCT FROM (to_jsonb(r)-'unit_id')))
 OR (SELECT count(*) FROM canonical_learning_before WHERE kind='pronunciation')<>(SELECT count(*) FROM public.learning_reading_texts)
 THEN RAISE EXCEPTION 'Reading text preservation failed'; END IF;
 IF EXISTS(SELECT 1 FROM canonical_learning_before b WHERE b.kind<>'pronunciation' AND NOT EXISTS(
  SELECT 1 FROM (SELECT 'vocabulary' kind,id,to_jsonb(c) payload FROM public.learning_vocabulary_cards c
   UNION ALL SELECT 'exercises',id,to_jsonb(e) FROM public.learning_exercises e
   UNION ALL SELECT 'videos',id,to_jsonb(v) FROM public.learning_videos v) a
  WHERE a.kind=b.kind AND a.id=b.id AND a.payload=b.payload)) THEN RAISE EXCEPTION 'Learning catalog preservation failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.learning_reading_texts WHERE unit_id IS NULL) THEN RAISE EXCEPTION 'Unassigned reading text'; END IF;
END $$;

CREATE OR REPLACE FUNCTION learning_reset_private.finish_reset(p_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=(SELECT auth.uid()); job learning_reset_private.jobs;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:'||actor::text,0));
 SELECT * INTO job FROM learning_reset_private.jobs WHERE user_id=actor AND token=p_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501'; END IF;
 IF NOT job.active THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN storage.objects o ON o.id=a.object_id WHERE a.user_id=actor) THEN
  RAISE EXCEPTION 'audio_removal_incomplete' USING ERRCODE='55000'; END IF;
 DELETE FROM public.pronunciation_messages WHERE submission_id IN(SELECT id FROM public.submissions WHERE user_id=actor);
 DELETE FROM public.submissions WHERE user_id=actor;
 DELETE FROM vocabulary_private.answer_receipts WHERE user_id=actor;
 DELETE FROM public.vocabulary_direction_progress WHERE user_id=actor;
 DELETE FROM public.vocabulary_learning_state WHERE user_id=actor;
 DELETE FROM public.vocabulary_onboarding WHERE user_id=actor;
 DELETE FROM public.user_exercise_progress WHERE user_id=actor;
 DELETE FROM learning_reset_private.audio_objects WHERE user_id=actor;
 UPDATE learning_reset_private.jobs SET active=false,completed_at=clock_timestamp() WHERE user_id=actor;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION learning_reset_private.guard_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE learner uuid; reference text;
BEGIN
 IF TG_TABLE_NAME IN('submissions','pronunciation_messages') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
  reference:=CASE WHEN TG_TABLE_NAME='submissions' THEN to_jsonb(NEW)->>'content_url' ELSE to_jsonb(NEW)->>'audio_path' END;
  IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
   WHERE j.active AND learning_reset_private.matches_audio(reference,a.bucket_id,a.object_name)) THEN
   RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000'; END IF;
 END IF;
 IF TG_TABLE_NAME='pronunciation_messages' THEN SELECT user_id INTO learner FROM public.submissions WHERE id=NEW.submission_id;
 ELSE learner:=NEW.user_id; END IF;
 IF learner IS NOT NULL THEN PERFORM learning_reset_private.assert_writable(learner); END IF;
 RETURN NEW;
END $$;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.submissions WHERE parent_id IS NOT NULL OR coalesce(attempt_number,1)<>1) THEN
 RAISE EXCEPTION 'Historical resubmission data requires explicit conversation migration'; END IF;
END $$;
ALTER TABLE public.submissions DROP COLUMN parent_id,DROP COLUMN attempt_number;
ALTER TABLE public.submissions ADD CONSTRAINT submissions_level_fk FOREIGN KEY(level) REFERENCES public.learning_levels(code);
