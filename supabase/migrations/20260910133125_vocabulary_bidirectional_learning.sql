BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Existing progress IDs, phases, dates and answers are retained verbatim.
ALTER TABLE public.vocabulary_cards
  ADD COLUMN translation_uk text,
  ADD COLUMN context_sentence_de text,
  ADD COLUMN context_sentence_en text,
  ADD COLUMN context_sentence_ru text,
  ADD COLUMN context_sentence_uk text,
  ADD COLUMN context_sentence_tr text,
  ADD COLUMN sentence_practice boolean NOT NULL DEFAULT false;
ALTER TABLE public.vocabulary_cards ADD CONSTRAINT vocabulary_sentence_target_check
  CHECK (NOT sentence_practice OR (
    nullif(btrim(context_sentence_de), '') IS NOT NULL AND nullif(btrim(context_sentence_en), '') IS NOT NULL
    AND nullif(btrim(context_sentence_ru), '') IS NOT NULL AND nullif(btrim(context_sentence_uk), '') IS NOT NULL
    AND nullif(btrim(context_sentence_tr), '') IS NOT NULL));

-- Keep the deployed legacy table and its API contract intact during rollout.
CREATE TABLE public.vocabulary_direction_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.vocabulary_cards(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('de_to_native','native_to_de')),
  box_number integer CHECK (box_number BETWEEN 1 AND 7) DEFAULT 1,
  next_review_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  lapses integer NOT NULL DEFAULT 0,
  last_answered_at timestamptz,
  UNIQUE (user_id,card_id,direction)
);
-- Lock only legacy writes during snapshot + trigger installation, never discard a row.
LOCK TABLE public.user_vocabulary_progress IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO public.vocabulary_direction_progress(id,user_id,card_id,direction,box_number,next_review_date,created_at,updated_at,lapses,last_answered_at)
SELECT id,user_id,card_id,'de_to_native',box_number,next_review_date,created_at,updated_at,lapses,last_answered_at
FROM public.user_vocabulary_progress;
INSERT INTO public.vocabulary_direction_progress(user_id,card_id,direction,box_number,next_review_date)
SELECT user_id,card_id,'native_to_de',1,now() FROM public.user_vocabulary_progress;
CREATE INDEX vocabulary_direction_due_idx ON public.vocabulary_direction_progress(user_id,next_review_date) WHERE box_number < 7;
CREATE INDEX vocabulary_direction_card_idx ON public.vocabulary_direction_progress(card_id);
ALTER TABLE public.vocabulary_direction_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vocabulary_direction_progress FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vocabulary_direction_progress TO authenticated;
GRANT ALL ON public.vocabulary_direction_progress TO service_role;
CREATE POLICY vocabulary_direction_owner_read ON public.vocabulary_direction_progress FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE SCHEMA vocabulary_private;
REVOKE ALL ON SCHEMA vocabulary_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA vocabulary_private TO authenticated, service_role;

-- The legacy client can continue updating its original rows. New reverse/sentence
-- progress is never taken from a legacy client-controlled value.
CREATE FUNCTION vocabulary_private.mirror_legacy_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
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
  INSERT INTO public.vocabulary_direction_progress(id,user_id,card_id,direction,box_number,next_review_date,created_at,updated_at,lapses,last_answered_at)
  VALUES(NEW.id,NEW.user_id,NEW.card_id,'de_to_native',NEW.box_number,NEW.next_review_date,NEW.created_at,NEW.updated_at,NEW.lapses,NEW.last_answered_at)
  ON CONFLICT(user_id,card_id,direction) DO UPDATE SET box_number=excluded.box_number,next_review_date=excluded.next_review_date,
    updated_at=excluded.updated_at,lapses=excluded.lapses,last_answered_at=excluded.last_answered_at;
  INSERT INTO public.vocabulary_direction_progress(user_id,card_id,direction)
    VALUES(NEW.user_id,NEW.card_id,'native_to_de') ON CONFLICT(user_id,card_id,direction) DO NOTHING;
  IF NEW.last_answered_at IS NOT NULL AND (TG_OP='INSERT' OR NEW.last_answered_at IS DISTINCT FROM OLD.last_answered_at) THEN
    INSERT INTO public.vocabulary_learning_state(user_id,last_card_id,last_reviewed_at)
      VALUES(NEW.user_id,NEW.card_id,NEW.last_answered_at)
      ON CONFLICT(user_id) DO UPDATE SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at
      WHERE public.vocabulary_learning_state.last_reviewed_at IS NULL
        OR excluded.last_reviewed_at >= public.vocabulary_learning_state.last_reviewed_at;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION vocabulary_private.mirror_legacy_progress() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER mirror_legacy_vocabulary_progress AFTER INSERT OR UPDATE OR DELETE ON public.user_vocabulary_progress
  FOR EACH ROW EXECUTE FUNCTION vocabulary_private.mirror_legacy_progress();

CREATE TABLE public.vocabulary_learning_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_card_id uuid REFERENCES public.vocabulary_cards(id) ON DELETE SET NULL,
  last_reviewed_at timestamptz
);
INSERT INTO public.vocabulary_learning_state(user_id,last_card_id,last_reviewed_at)
SELECT DISTINCT ON (user_id) user_id,card_id,last_answered_at
FROM public.user_vocabulary_progress WHERE last_answered_at IS NOT NULL
ORDER BY user_id,last_answered_at DESC,id;
CREATE INDEX vocabulary_learning_last_card_idx ON public.vocabulary_learning_state(last_card_id);
CREATE TABLE public.vocabulary_onboarding (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2')),
  status text NOT NULL CHECK (status IN ('skipped', 'completed')),
  started_lesson text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);
ALTER TABLE public.vocabulary_learning_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_onboarding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vocabulary_learning_state, public.vocabulary_onboarding FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vocabulary_learning_state, public.vocabulary_onboarding TO authenticated;
GRANT ALL ON public.vocabulary_learning_state, public.vocabulary_onboarding TO service_role;
CREATE POLICY vocabulary_state_owner_read ON public.vocabulary_learning_state FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY vocabulary_onboarding_owner_read ON public.vocabulary_onboarding FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- New progress and cursor tables are read-only to clients. Private mutation
-- procedures derive the actor from auth.uid() and explicitly verify level access.
CREATE FUNCTION vocabulary_private.initialize_cards(p_decisions jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid();
  item jsonb;
  target uuid;
  known boolean;
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
    target := (item->>'cardId')::uuid;
    known := (item->>'alreadyKnown')::boolean;
    IF NOT EXISTS (
      SELECT 1 FROM public.vocabulary_cards c JOIN public.profiles p ON p.id = actor
      WHERE c.id = target AND (p.role IN ('teacher','admin') OR c.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))
    ) THEN RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.vocabulary_direction_progress(user_id, card_id, direction, box_number, next_review_date)
      SELECT actor, target, d, CASE WHEN known THEN 6 ELSE 1 END,
        CASE WHEN known THEN now() + interval '90 days' ELSE now() END
      FROM unnest(ARRAY['de_to_native','native_to_de']) d
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
$fn$;
REVOKE ALL ON FUNCTION vocabulary_private.initialize_cards(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vocabulary_private.initialize_cards(jsonb) TO authenticated;
CREATE FUNCTION public.initialize_vocabulary_cards(p_decisions jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT vocabulary_private.initialize_cards(p_decisions);
$fn$;
REVOKE ALL ON FUNCTION public.initialize_vocabulary_cards(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initialize_vocabulary_cards(jsonb) TO authenticated;

CREATE FUNCTION vocabulary_private.skip_assessment(p_level text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE actor uuid := auth.uid(); first_lesson text; decisions jsonb; result jsonb;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = actor
    AND (p.role IN ('teacher','admin') OR p_level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  SELECT c.lesson INTO first_lesson FROM public.vocabulary_cards c WHERE c.level = p_level
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
$fn$;
REVOKE ALL ON FUNCTION vocabulary_private.skip_assessment(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vocabulary_private.skip_assessment(text) TO authenticated;
CREATE FUNCTION public.skip_vocabulary_assessment(p_level text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT vocabulary_private.skip_assessment(p_level);
$fn$;
REVOKE ALL ON FUNCTION public.skip_vocabulary_assessment(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.skip_vocabulary_assessment(text) TO authenticated;

CREATE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid(); progress public.vocabulary_direction_progress; card public.vocabulary_cards;
  profile public.profiles; previous_card uuid; prompt text; correct boolean; sentence boolean;
  old_phase integer; new_phase integer; new_box integer; days integer; difficult boolean;
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
    || CASE WHEN sentence THEN jsonb_build_object('correctAnswer',card.context_sentence_de) ELSE '{}'::jsonb END;
END;
$fn$;
REVOKE ALL ON FUNCTION vocabulary_private.submit_answer(uuid,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vocabulary_private.submit_answer(uuid,boolean,text,text) TO authenticated;
CREATE FUNCTION public.submit_vocabulary_answer(p_progress_id uuid,p_is_correct boolean DEFAULT NULL,p_typed_answer text DEFAULT NULL,p_ui_language text DEFAULT 'de')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT vocabulary_private.submit_answer(p_progress_id,p_is_correct,p_typed_answer,p_ui_language);
$fn$;
REVOKE ALL ON FUNCTION public.submit_vocabulary_answer(uuid,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_vocabulary_answer(uuid,boolean,text,text) TO authenticated;
COMMIT;
