-- Units are lesson names for vocabulary/grammar and stable prompt UUIDs for pronunciation.
-- Preserve existing progress, submissions, billing and student identities.
-- null means all current/future units; an empty array means none.
ALTER TABLE public.student_trainer_access ADD COLUMN IF NOT EXISTS allowed_lessons text[];

CREATE FUNCTION trainer_access_private.unit_allowed(p_level text,p_trainer text,p_unit text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT trainer_access_private.allowed(p_level,p_trainer) AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND (
    p.role IN ('teacher','admin') OR NOT EXISTS(SELECT 1 FROM public.student_trainer_access a
     WHERE a.user_id=p.id AND a.level=p_level AND a.trainer=p_trainer AND a.allowed_lessons IS NOT NULL
       AND NOT COALESCE(p_unit=ANY(a.allowed_lessons),false))));
$$;
REVOKE ALL ON FUNCTION trainer_access_private.unit_allowed(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION trainer_access_private.unit_allowed(text,text,text) TO authenticated;
ALTER POLICY vocabulary_trainer_guard ON public.vocabulary_cards USING(trainer_access_private.unit_allowed(level,'vocabulary',lesson));
ALTER POLICY exercises_trainer_guard ON public.exercises USING(trainer_access_private.unit_allowed(level,'exercises',lesson));
ALTER POLICY pronunciation_trainer_guard ON public.pronunciation_prompts USING(trainer_access_private.unit_allowed(level,'pronunciation',id::text));
ALTER POLICY submission_trainer_read ON public.submissions USING(type IS DISTINCT FROM 'audio' OR trainer_access_private.unit_allowed(level,'pronunciation',prompt_id::text));
ALTER POLICY submission_trainer_insert ON public.submissions WITH CHECK(type IS DISTINCT FROM 'audio' OR trainer_access_private.unit_allowed(level,'pronunciation',prompt_id::text));

-- Convert old lesson-wide pronunciation restrictions to the exact existing texts.
UPDATE public.student_trainer_access a SET allowed_lessons=ARRAY(
 SELECT DISTINCT p.id::text FROM public.pronunciation_prompts p
 WHERE p.level=a.level AND (p.lesson=ANY(a.allowed_lessons) OR p.id::text=ANY(a.allowed_lessons)) ORDER BY p.id::text
) WHERE trainer='pronunciation' AND allowed_lessons IS NOT NULL;

-- Resolve malformed legacy grammar groups by topic while preserving IDs/progress.
CREATE TEMP TABLE grammar_unit_repair ON COMMIT DROP AS
 SELECT id,level,lesson old_lesson,
 CASE WHEN level='A1.1' AND lesson='A1.1' AND topic='Artikel' THEN 'A1.1 · 03'
      WHEN level='A1.1' AND lesson='A1.1' THEN 'A1.1 · 01'
      WHEN level='A1.2' AND lesson='Lektion 2' AND topic='Perfekt' THEN 'A1.2 · 07'
      WHEN level='A2.1' AND lesson='Lektion 1' AND topic='Urlaub' THEN 'A2.1 · 02'
      ELSE lesson END new_lesson FROM public.exercises;
UPDATE public.student_trainer_access a SET allowed_lessons=ARRAY(
 SELECT DISTINCT mapped FROM unnest(a.allowed_lessons) old
 CROSS JOIN LATERAL (SELECT r.new_lesson mapped FROM grammar_unit_repair r WHERE r.level=a.level AND r.old_lesson=old
   UNION SELECT old WHERE NOT EXISTS(SELECT 1 FROM grammar_unit_repair r WHERE r.level=a.level AND r.old_lesson=old)) m ORDER BY mapped
) WHERE trainer='exercises' AND allowed_lessons IS NOT NULL;
UPDATE public.exercises e SET lesson=r.new_lesson FROM grammar_unit_repair r WHERE e.id=r.id AND e.lesson IS DISTINCT FROM r.new_lesson;
-- Repair two unfinished sample exercises only if their exact original content remains.
UPDATE public.exercises SET topic='Perfekt mit sein',content=jsonb_build_object('text_before','Gestern ','correct_answer','bin','text_after',' ich im Park spazieren gegangen.','options',jsonb_build_array('bin','habe','hat'))
 WHERE level='A1.2' AND topic='Perfekt' AND content->>'text_before'='Ich' AND content->>'text_after'='Anastasia Sitov.' AND content->>'correct_answer'='bin';
UPDATE public.exercises SET topic='Dass-Sätze',content=jsonb_build_object('text_before','Ich hoffe, dass ich im Urlaub am Meer ','correct_answer','bin','text_after','.','options',jsonb_build_array('bin','bist','ist'))
 WHERE level='A2.1' AND topic='Urlaub' AND content->>'text_before'='Ich' AND content->>'text_after'='ein Mädchen.' AND content->>'correct_answer'='bin';
UPDATE public.pronunciation_prompts SET is_active=false WHERE level IS NULL AND title IS NULL AND is_active;
CREATE OR REPLACE FUNCTION trainer_access_private.allowed(p_level text, p_trainer text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS (
   SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND
   (p.role IN ('teacher','admin') OR (
     p.ui_language IS DISTINCT FROM 'de' AND p_level = ANY(COALESCE(p.allowed_levels, ARRAY[]::text[])) AND
     p_trainer IN ('vocabulary','exercises','pronunciation','videos') AND
     COALESCE((SELECT a.enabled FROM public.student_trainer_access a
       WHERE a.user_id = p.id AND a.level = p_level AND a.trainer = p_trainer), true)
   ))
 );
$function$
;

CREATE OR REPLACE FUNCTION pronunciation_private.can_access_submission(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.submissions s WHERE s.id=p_id AND
   ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin') OR
    (s.user_id=(SELECT auth.uid()) AND trainer_access_private.unit_allowed(s.level,'pronunciation',s.prompt_id::text)))
 );
$function$
;

CREATE OR REPLACE FUNCTION pronunciation_private.create_submission(p_prompt_id uuid, p_audio_path text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid := (SELECT auth.uid()); prompt public.pronunciation_prompts%ROWTYPE; result uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT * INTO prompt FROM public.pronunciation_prompts WHERE id = p_prompt_id AND is_active;
 IF NOT FOUND OR prompt.level IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = actor AND
   (p.role IN ('teacher','admin') OR prompt.level = ANY(COALESCE(p.allowed_levels,ARRAY[]::text[])))) THEN RAISE EXCEPTION 'Level not allowed'; END IF;
  IF NOT trainer_access_private.unit_allowed(prompt.level, 'pronunciation', prompt.id::text) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_audio_path NOT LIKE 'storage://pronunciation_audio/' || actor::text || '/%' OR NOT EXISTS(
 SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pronunciation_audio' AND 'storage://pronunciation_audio/' || o.name = p_audio_path)
 THEN RAISE EXCEPTION 'Invalid recording'; END IF;
 INSERT INTO public.submissions(user_id,type,content_url,text_content,status,level,prompt_id,prompt_title)
 VALUES(actor,'audio',p_audio_path,prompt.sentence_de,'pending',prompt.level,prompt.id,prompt.title) RETURNING id INTO result;
 RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.initialize_cards(p_decisions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      SELECT 1 FROM public.vocabulary_cards c JOIN public.profiles p ON p.id = actor
      WHERE c.id = target AND trainer_access_private.unit_allowed(c.level, 'vocabulary', c.lesson) AND (p.role IN ('teacher','admin') OR c.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))
    ) THEN RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.vocabulary_direction_progress(user_id, card_id, direction, box_number, next_review_date)
      SELECT actor, target, d, CASE WHEN known THEN 6 ELSE 1 END,
        CASE WHEN known THEN now() + interval '90 days' ELSE now() END
      FROM unnest(CASE WHEN selected_direction IS NULL THEN ARRAY['de_to_native','native_to_de'] ELSE ARRAY[selected_direction] END) d
      ON CONFLICT (user_id, card_id, direction) DO NOTHING;
    GET DIAGNOSTICS touched = ROW_COUNT;
    -- Retain the old application/dashboard contract. Its mirror only updates the
    -- forward direction; ON CONFLICT keeps an existing learner's legacy state.
    INSERT INTO public.user_vocabulary_progress(id,user_id,card_id,box_number,next_review_date,created_at,updated_at,lapses,last_answered_at)
    SELECT id,user_id,card_id,box_number,next_review_date,created_at,updated_at,lapses,last_answered_at
      FROM public.vocabulary_direction_progress WHERE user_id=actor AND card_id=target AND direction='de_to_native'
      ON CONFLICT(user_id,card_id) DO NOTHING;
    -- The UI reports words, while each word has two independent records.
    IF touched > 0 THEN
      IF known THEN known_count := known_count + 1; ELSE new_count := new_count + 1; END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('addedKnown', known_count, 'addedNew', new_count);
END;
$function$
;

CREATE OR REPLACE FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  target public.exercises;
  correct boolean;
  answer_normalized text;
  attempt_count integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_answer IS NULL OR length(btrim(p_answer)) = 0 OR length(p_answer) > 1000 THEN
    RAISE EXCEPTION 'invalid_answer' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.exercises WHERE id = p_exercise_id;
  IF NOT FOUND OR target.type NOT IN ('fill_in_blank', 'multiple_choice') THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = actor
    AND (p.role IN ('teacher','admin') OR target.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF NOT trainer_access_private.unit_allowed(target.level, 'exercises', target.lesson) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
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
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.skip_assessment(p_level text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid := auth.uid(); first_lesson text; decisions jsonb; result jsonb;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = actor
    AND (p.role IN ('teacher','admin') OR p_level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF NOT trainer_access_private.allowed(p_level, 'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
  SELECT c.lesson INTO first_lesson FROM public.vocabulary_cards c WHERE c.level = p_level AND trainer_access_private.unit_allowed(c.level,'vocabulary',c.lesson)
    ORDER BY nullif(substring(c.lesson from '[0-9]+'),'')::integer NULLS LAST, c.lesson, c.id LIMIT 1;
  IF first_lesson IS NULL THEN RAISE EXCEPTION 'lesson_not_found' USING ERRCODE = '22023'; END IF;
  SELECT jsonb_agg(jsonb_build_object('cardId',id,'alreadyKnown',false)) INTO decisions
    FROM public.vocabulary_cards WHERE level = p_level AND lesson = first_lesson;
  result := vocabulary_private.initialize_cards(decisions);
  INSERT INTO public.vocabulary_onboarding(user_id,level,status,started_lesson)
    VALUES(actor,p_level,'skipped',first_lesson)
    ON CONFLICT(user_id,level) DO UPDATE SET status='skipped',started_lesson=excluded.started_lesson,updated_at=now();
  RETURN result || jsonb_build_object('lesson',first_lesson);
END;
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid(); progress public.vocabulary_direction_progress; card public.vocabulary_cards;
  profile public.profiles; previous_card uuid; prompt text; correct boolean; sentence boolean;
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
  SELECT * INTO card FROM public.vocabulary_cards WHERE id = progress.card_id;
  SELECT * INTO profile FROM public.profiles WHERE id = actor;
  IF NOT (coalesce(profile.role IN ('teacher','admin'),false) OR card.level = ANY(coalesce(profile.allowed_levels,ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF NOT trainer_access_private.unit_allowed(card.level,'vocabulary',card.lesson) OR p_ui_language='de' THEN
    RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
  END IF;
  IF progress.box_number = 7 OR progress.next_review_date > now() THEN
    RAISE EXCEPTION 'review_not_due' USING ERRCODE = '40001';
  END IF;
  SELECT last_card_id INTO previous_card FROM public.vocabulary_learning_state WHERE user_id = actor;
  IF previous_card = progress.card_id THEN
    RAISE EXCEPTION 'vocabulary_spacing_required' USING ERRCODE = '40001';
  END IF;
  prompt := CASE p_ui_language WHEN 'de' THEN card.context_sentence_de WHEN 'en' THEN card.context_sentence_en
    WHEN 'ru' THEN card.context_sentence_ru WHEN 'uk' THEN card.context_sentence_uk WHEN 'tr' THEN card.context_sentence_tr END;
  sentence := card.sentence_practice AND progress.direction = 'native_to_de';
  IF sentence AND (nullif(btrim(prompt),'') IS NULL OR nullif(btrim(card.context_sentence_de),'') IS NULL) THEN
    RAISE EXCEPTION 'sentence_content_missing' USING ERRCODE='23514';
  END IF;
  IF sentence THEN
    -- Byte-exact comparison: no trimming, case folding, punctuation removal or client grading.
    correct := coalesce(convert_to(p_typed_answer,'UTF8') = convert_to(card.context_sentence_de,'UTF8'),false);
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
  difficult := CASE profile.native_language WHEN 'Russisch' THEN coalesce(card.is_hard_for_ru,false)
    WHEN 'Türkisch' THEN coalesce(card.is_hard_for_tr,false) ELSE false END;
  IF difficult THEN days := greatest(1,days/2); END IF;
  UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=now()+make_interval(days=>days),
    lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now()
    WHERE id = progress.id;
  IF progress.direction='de_to_native' THEN
    UPDATE public.user_vocabulary_progress SET box_number=new_box,next_review_date=now()+make_interval(days=>days),
      lapses=progress.lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now()
      WHERE user_id=actor AND card_id=progress.card_id;
  END IF;
  INSERT INTO public.vocabulary_learning_state(user_id,last_card_id,last_reviewed_at)
    VALUES(actor,progress.card_id,now()) ON CONFLICT(user_id) DO UPDATE
    SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
  RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
    'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days)
    || CASE WHEN sentence THEN jsonb_build_object('correctAnswer',card.context_sentence_de,'isAlternative',is_alternative) ELSE '{}'::jsonb END;
END;
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  IF NOT EXISTS (SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.vocabulary_cards c ON c.id=v.card_id
    WHERE v.id=p_progress_id AND v.user_id=actor AND trainer_access_private.unit_allowed(c.level,'vocabulary',c.lesson)) THEN
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
$function$
;

-- Avoid pre-assessing the reverse direction when synchronizing a directional assessment.
CREATE OR REPLACE FUNCTION vocabulary_private.mirror_legacy_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE had_forward boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> (CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END) THEN
    RAISE EXCEPTION 'progress_owner_required' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN
    DELETE FROM public.vocabulary_direction_progress WHERE user_id=OLD.user_id AND card_id=OLD.card_id;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.card_id IS DISTINCT FROM OLD.card_id) THEN
    RAISE EXCEPTION 'progress_identity_immutable' USING ERRCODE='23514';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress WHERE user_id=NEW.user_id AND card_id=NEW.card_id AND direction='de_to_native') INTO had_forward;
  INSERT INTO public.vocabulary_direction_progress(id,user_id,card_id,direction,box_number,next_review_date,created_at,updated_at,lapses,last_answered_at)
  VALUES(NEW.id,NEW.user_id,NEW.card_id,'de_to_native',NEW.box_number,NEW.next_review_date,NEW.created_at,NEW.updated_at,NEW.lapses,NEW.last_answered_at)
  ON CONFLICT(user_id,card_id,direction) DO UPDATE SET box_number=excluded.box_number,next_review_date=excluded.next_review_date,
    updated_at=excluded.updated_at,lapses=excluded.lapses,last_answered_at=excluded.last_answered_at;
  IF NOT had_forward THEN
    INSERT INTO public.vocabulary_direction_progress(user_id,card_id,direction)
      VALUES(NEW.user_id,NEW.card_id,'native_to_de') ON CONFLICT(user_id,card_id,direction) DO NOTHING;
  END IF;
  IF NEW.last_answered_at IS NOT NULL AND (TG_OP='INSERT' OR NEW.last_answered_at IS DISTINCT FROM OLD.last_answered_at) THEN
    INSERT INTO public.vocabulary_learning_state(user_id,last_card_id,last_reviewed_at)
      VALUES(NEW.user_id,NEW.card_id,NEW.last_answered_at)
      ON CONFLICT(user_id) DO UPDATE SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at
      WHERE public.vocabulary_learning_state.last_reviewed_at IS NULL
        OR excluded.last_reviewed_at >= public.vocabulary_learning_state.last_reviewed_at;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION trainer_access_private.can_record()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND
   (p.role IN ('teacher','admin') OR EXISTS(SELECT 1 FROM public.pronunciation_prompts prompt WHERE prompt.is_active AND trainer_access_private.unit_allowed(prompt.level,'pronunciation',prompt.id::text))));
$function$
;


-- A partially assessed word may have only the reverse direction and no legacy row.
CREATE FUNCTION vocabulary_private.reset_lesson(p_level text,p_lesson text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := (SELECT auth.uid());
BEGIN
 IF actor IS NULL OR NOT trainer_access_private.unit_allowed(p_level,'vocabulary',p_lesson) THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text,0));
 DELETE FROM public.user_vocabulary_progress v USING public.vocabulary_cards c
  WHERE v.user_id=actor AND v.card_id=c.id AND c.level=p_level AND c.lesson=p_lesson;
 DELETE FROM public.vocabulary_direction_progress v USING public.vocabulary_cards c
  WHERE v.user_id=actor AND v.card_id=c.id AND c.level=p_level AND c.lesson=p_lesson;
END;
$$;
REVOKE ALL ON FUNCTION vocabulary_private.reset_lesson(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vocabulary_private.reset_lesson(text,text) TO authenticated;
CREATE FUNCTION public.reset_vocabulary_lesson_progress(p_level text,p_lesson text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT vocabulary_private.reset_lesson(p_level,p_lesson); $$;
REVOKE ALL ON FUNCTION public.reset_vocabulary_lesson_progress(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reset_vocabulary_lesson_progress(text,text) TO authenticated;
