-- Approved canonical schema migration; requires a verified full local backup.
BEGIN;
SET LOCAL lock_timeout='10s';
-- Natural lookup codes are stable; all independently managed entities use UUIDs.
CREATE TABLE public.locales (
 code text PRIMARY KEY CHECK(code ~ '^[a-z]{2}$')
);
INSERT INTO public.locales(code) VALUES ('de'),('en'),('ru'),('uk'),('tr');
ALTER TABLE public.locales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.locales FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.locales TO anon,authenticated;
GRANT ALL ON public.locales TO service_role;
CREATE POLICY locales_read ON public.locales FOR SELECT TO anon,authenticated USING(true);


-- Apply after foundation.sql, within the standardization transaction.
-- Historical migrations are retained separately; this is the canonical identity contract.
CREATE SCHEMA IF NOT EXISTS identity_private;
REVOKE ALL ON SCHEMA identity_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA identity_private TO authenticated, service_role;
CREATE OR REPLACE FUNCTION identity_private.current_profile_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT role FROM public.profiles WHERE id=(SELECT auth.uid()) AND (SELECT auth.uid()) IS NOT NULL
$$;
REVOKE ALL ON FUNCTION identity_private.current_profile_role() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION identity_private.current_profile_role() TO authenticated,service_role;

-- Removing the old read view is deferred to cleanup.sql, after its consumers migrate.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_native_language_check;
UPDATE public.profiles SET native_language=CASE native_language
 WHEN 'Deutsch' THEN 'de' WHEN 'Englisch' THEN 'en' WHEN 'Russisch' THEN 'ru'
 WHEN 'Türkisch' THEN 'tr' WHEN 'Ukrainisch' THEN 'uk'
 WHEN 'de' THEN 'de' WHEN 'en' THEN 'en' WHEN 'ru' THEN 'ru' WHEN 'tr' THEN 'tr' WHEN 'uk' THEN 'uk'
 ELSE NULL END;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_native_language_fkey FOREIGN KEY(native_language) REFERENCES public.locales(code);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_ui_language_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_ui_language_fkey FOREIGN KEY(ui_language) REFERENCES public.locales(code);
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_preferred_locale_check;
ALTER TABLE public.people ADD CONSTRAINT people_preferred_locale_fkey FOREIGN KEY(preferred_locale) REFERENCES public.locales(code);
-- Stripe columns are removed in cleanup.sql after the dependent old view is removed.
UPDATE auth.users u SET raw_user_meta_data=(coalesce(u.raw_user_meta_data,'{}')-'name') ||
 jsonb_build_object('native_language',p.native_language,'display_name',person.display_name)
 FROM public.profiles p JOIN public.people person ON person.auth_user_id=p.id WHERE u.id=p.id;

CREATE OR REPLACE FUNCTION business_private.provision_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE native text; locale text; display_name text;
BEGIN
 native:=CASE WHEN new.raw_user_meta_data->>'native_language' IN('de','en','ru','uk','tr') THEN new.raw_user_meta_data->>'native_language' END;
 locale:=CASE WHEN new.raw_user_meta_data->>'ui_language' IN('de','en','ru','uk','tr') THEN new.raw_user_meta_data->>'ui_language' ELSE coalesce(native,'de') END;
 display_name:=left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),split_part(new.email,'@',1),'Student'),160);
 INSERT INTO public.profiles(id,role,native_language,ui_language) VALUES(new.id,'student',native,locale) ON CONFLICT(id) DO NOTHING;
 -- A signup always receives its own fresh person. No unverified address lookup.
 INSERT INTO public.people(auth_user_id,display_name,email,preferred_locale)
 VALUES(new.id,display_name,coalesce(new.email,''),locale) ON CONFLICT(auth_user_id) DO NOTHING;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION business_private.provision_profile() FROM PUBLIC,anon,authenticated;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.claim_verified_person() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT business_private.claim_person()$$;
REVOKE ALL ON FUNCTION public.claim_verified_person() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_verified_person() TO authenticated;
DROP FUNCTION IF EXISTS public.claim_verified_legacy_profile();

-- Profiles remain protected against role/identity mass assignment, even for staff.
DO $$ DECLARE policy_name text; BEGIN
 FOR policy_name IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
  EXECUTE format('DROP POLICY %I ON public.profiles',policy_name);
 END LOOP;
END $$;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon,authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(native_language,ui_language) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING(
 id=(SELECT auth.uid()) OR (SELECT identity_private.current_profile_role()) IN('teacher','admin'));
CREATE POLICY profiles_update_preferences ON public.profiles FOR UPDATE TO authenticated
 USING(id=(SELECT auth.uid())) WITH CHECK(id=(SELECT auth.uid()));

-- Contact data is readable only by its verified account or staff. Email and linkage
-- stay outside client UPDATE grants and are maintained by verified Auth operations.
DO $$ DECLARE policy_name text; BEGIN
 FOR policy_name IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='people' LOOP
  EXECUTE format('DROP POLICY %I ON public.people',policy_name);
 END LOOP;
END $$;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.people FROM anon,authenticated;
GRANT SELECT ON public.people TO authenticated;
GRANT UPDATE(display_name,phone,street,postal_code,city,preferred_locale) ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
CREATE POLICY people_read ON public.people FOR SELECT TO authenticated USING(auth_user_id=(SELECT auth.uid()) OR (SELECT identity_private.current_profile_role()) IN('teacher','admin'));
CREATE POLICY people_update_contact ON public.people FOR UPDATE TO authenticated
 USING(auth_user_id=(SELECT auth.uid()) OR (SELECT identity_private.current_profile_role()) IN('teacher','admin'))
 WITH CHECK(auth_user_id=(SELECT auth.uid()) OR (SELECT identity_private.current_profile_role()) IN('teacher','admin'));

-- Preserve all existing note prose in a single canonical row. Refuse truncation.
DROP TRIGGER IF EXISTS validate_teacher_student_note ON public.teacher_student_notes;
DROP FUNCTION IF EXISTS monthly_booking_private.validate_teacher_note();
DROP FUNCTION IF EXISTS public.save_student_blackboard(uuid,text,uuid);
ALTER TABLE public.teacher_student_notes DROP CONSTRAINT IF EXISTS teacher_student_notes_note_text_check;
DO $$ DECLARE student uuid; canonical uuid; combined text; BEGIN
 FOR student IN SELECT DISTINCT student_id FROM public.teacher_student_notes LOOP
  SELECT id INTO canonical FROM public.teacher_student_notes WHERE student_id=student ORDER BY is_blackboard DESC,id LIMIT 1;
  SELECT string_agg(prose,E'\n\n' ORDER BY is_blackboard DESC,id) INTO combined FROM
   (SELECT id,is_blackboard,btrim(replace(note_text,U&'\2060','')) prose FROM public.teacher_student_notes WHERE student_id=student) notes WHERE prose<>'';
  IF length(coalesce(combined,''))>5000 THEN RAISE EXCEPTION 'Combined note exceeds limit; review backed-up student notes before migration'; END IF;
  UPDATE public.teacher_student_notes SET note_text=coalesce(combined,'') WHERE id=canonical;
  DELETE FROM public.teacher_student_notes WHERE student_id=student AND id<>canonical;
 END LOOP;
END $$;
ALTER TABLE public.teacher_student_notes DROP COLUMN discount_percent,DROP COLUMN is_blackboard;
ALTER TABLE public.teacher_student_notes ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
 ADD CONSTRAINT teacher_student_notes_student_unique UNIQUE(student_id),
 ADD CONSTRAINT teacher_student_notes_text_length CHECK(length(note_text)<=5000);
DROP INDEX IF EXISTS public.teacher_student_notes_student_idx;

CREATE FUNCTION identity_private.validate_teacher_note() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF new.id IS DISTINCT FROM old.id OR new.student_id IS DISTINCT FROM old.student_id OR new.teacher_id IS DISTINCT FROM old.teacher_id OR new.created_at IS DISTINCT FROM old.created_at THEN
   RAISE check_violation USING message='Note identity and authorship are immutable';
  END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=new.student_id AND role='student') OR
     NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=new.teacher_id AND role IN('teacher','admin')) THEN
   RAISE check_violation USING message='Invalid student or teacher';
  END IF;
 END IF;
 new.updated_at:=now();
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION identity_private.validate_teacher_note() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_teacher_student_note BEFORE INSERT OR UPDATE ON public.teacher_student_notes FOR EACH ROW EXECUTE FUNCTION identity_private.validate_teacher_note();
DO $$ DECLARE policy_name text; BEGIN
 FOR policy_name IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='teacher_student_notes' LOOP
  EXECUTE format('DROP POLICY %I ON public.teacher_student_notes',policy_name);
 END LOOP;
END $$;
ALTER TABLE public.teacher_student_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teacher_student_notes FROM anon,authenticated;
GRANT SELECT,DELETE ON public.teacher_student_notes TO authenticated;
GRANT INSERT(student_id,teacher_id,note_text),UPDATE(note_text) ON public.teacher_student_notes TO authenticated;
GRANT ALL ON public.teacher_student_notes TO service_role;
CREATE POLICY teacher_notes_read ON public.teacher_student_notes FOR SELECT TO authenticated USING((SELECT identity_private.current_profile_role()) IN('teacher','admin'));
CREATE POLICY teacher_notes_insert ON public.teacher_student_notes FOR INSERT TO authenticated WITH CHECK((SELECT identity_private.current_profile_role()) IN('teacher','admin') AND teacher_id=(SELECT auth.uid()));
CREATE POLICY teacher_notes_update ON public.teacher_student_notes FOR UPDATE TO authenticated USING((SELECT identity_private.current_profile_role()) IN('teacher','admin')) WITH CHECK((SELECT identity_private.current_profile_role()) IN('teacher','admin'));
CREATE POLICY teacher_notes_delete ON public.teacher_student_notes FOR DELETE TO authenticated USING((SELECT identity_private.current_profile_role()) IN('teacher','admin'));

CREATE FUNCTION public.save_student_blackboard(p_student_id uuid,p_note_text text,p_expected_note_id uuid DEFAULT NULL)
RETURNS SETOF public.teacher_student_notes LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); board public.teacher_student_notes; prose text;
BEGIN
 IF actor IS NULL OR coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RAISE insufficient_privilege; END IF;
 IF p_note_text IS NULL OR length(p_note_text)>5000 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student') THEN
  RAISE check_violation USING message='Invalid student or note';
 END IF;
 prose:=btrim(p_note_text);
 PERFORM pg_advisory_xact_lock(hashtextextended('student-note:'||p_student_id::text,0));
 SELECT * INTO board FROM public.teacher_student_notes WHERE student_id=p_student_id FOR UPDATE;
 IF p_expected_note_id IS NOT NULL AND p_expected_note_id IS DISTINCT FROM board.id THEN
  RAISE EXCEPTION 'The note changed; reload and retry' USING ERRCODE='PT409';
 END IF;
 IF board.id IS NULL THEN
  IF prose='' THEN RETURN; END IF;
  RETURN QUERY INSERT INTO public.teacher_student_notes(student_id,teacher_id,note_text) VALUES(p_student_id,actor,prose) RETURNING *;
 ELSE
  RETURN QUERY UPDATE public.teacher_student_notes SET note_text=prose WHERE id=board.id AND student_id=p_student_id RETURNING *;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_student_blackboard(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_student_blackboard(uuid,text,uuid) TO authenticated,service_role;


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


-- Apply after learning.sql: a resource has one source URL; a missing source is a draft.
-- Existing DW links remain byte-for-byte unchanged. Never infer a provider from old flags.
CREATE TEMP TABLE canonical_videos_before ON COMMIT DROP AS
 SELECT id,to_jsonb(v)-'video_url'-'external_url'-'is_external' AS payload,
 coalesce(nullif(btrim(external_url),''),nullif(btrim(video_url),'')) AS source_url FROM public.learning_videos v;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_videos WHERE nullif(btrim(video_url),'') IS NOT NULL
  AND nullif(btrim(external_url),'') IS NOT NULL AND video_url IS DISTINCT FROM external_url)
 THEN RAISE EXCEPTION 'Conflicting video sources require explicit review'; END IF;
END $$;
ALTER TABLE public.learning_videos ADD COLUMN source_url text;
UPDATE public.learning_videos v SET source_url=b.source_url FROM canonical_videos_before b WHERE b.id=v.id;
UPDATE public.learning_units u SET is_active=false FROM public.learning_videos v WHERE v.unit_id=u.id AND v.source_url IS NULL;
ALTER TABLE public.learning_videos DROP COLUMN video_url,DROP COLUMN external_url,DROP COLUMN is_external;
ALTER TABLE public.learning_videos ADD CONSTRAINT learning_videos_source_url_check
 CHECK(source_url IS NULL OR source_url ~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$');
CREATE FUNCTION learning_private.validate_video_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id
  WHERE v.source_url IS NULL AND u.is_active
  AND ((TG_TABLE_NAME='learning_videos' AND v.id=NEW.id) OR (TG_TABLE_NAME='learning_units' AND u.id=NEW.id)))
 THEN RAISE EXCEPTION 'Published learning resources require a source URL' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION learning_private.validate_video_publication() FROM PUBLIC,anon;
CREATE CONSTRAINT TRIGGER validate_video_publication AFTER INSERT OR UPDATE ON public.learning_videos
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION learning_private.validate_video_publication();
CREATE CONSTRAINT TRIGGER validate_video_unit_publication AFTER INSERT OR UPDATE ON public.learning_units
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION learning_private.validate_video_publication();
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
  INSERT INTO public.learning_videos(id,unit_id,description,source_url)
  VALUES(item,target_unit,fields->>'description',nullif(btrim(fields->>'source_url'),''))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,description=excluded.description,source_url=excluded.source_url;
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

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM canonical_videos_before b LEFT JOIN public.learning_videos v ON v.id=b.id
 WHERE v.id IS NULL OR b.payload IS DISTINCT FROM (to_jsonb(v)-'source_url') OR b.source_url IS DISTINCT FROM v.source_url)
 OR (SELECT count(*) FROM canonical_videos_before)<>(SELECT count(*) FROM public.learning_videos)
 THEN RAISE EXCEPTION 'Video resource preservation failed'; END IF;
END $$;


-- Exact catalog removal approved by the owner. Referencing bookings prevent
-- deletion; never cascade into business records or touch unrelated courses.
DELETE FROM public.courses WHERE id IN (
 '6eccd753-2182-4b6a-9700-c6340d9302e3', -- private, in person
 '6dda9c76-37eb-4803-ba83-ccdf74005295', -- retired speaking A2
 '614bba65-9154-4acc-90c3-4a81dfcb26b4'  -- retired A2 course
);
UPDATE public.courses c SET slug=m.slug FROM (VALUES
 ('901248ac-2816-4e93-be2e-5de7a9faa343'::uuid,'deutsch-level-1'),
 ('05cdec9b-9da7-43fb-b3b0-109515207789'::uuid,'deutsch-level-2'),
 ('a2602f45-acdb-42b2-b587-8aebabfdd218'::uuid,'deutsch-level-3'),
 ('cfc5f41f-0bf9-4295-aeaf-614afd0dba07'::uuid,'sprechtraining-montag'),
 ('ec33a7aa-86d8-4072-bde2-aed5b40be25e'::uuid,'sprechtraining-dienstag'),
 ('4f5da1ab-80c5-49d6-877e-e0c851698bd1'::uuid,'sprechtraining-mittwoch'),
 ('a8aca737-634b-4abb-8c81-e779ae81a5db'::uuid,'deutsch-a1-1-online'),
 ('33061240-08d7-45b9-aa6a-c06c7b63ac9b'::uuid,'deutsch-b1-online'),
 ('2d4bf352-4840-4213-8cfc-6a6ed6aa1e1d'::uuid,'privatunterricht-online')
) m(id,slug) WHERE c.id=m.id;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.course_schedules WHERE alternate_start_time IS NOT NULL OR alternate_end_time IS NOT NULL) THEN
  RAISE EXCEPTION 'Unexpected alternate course times; abort instead of discarding schedule data';
 END IF;
END $$;
ALTER TABLE public.courses RENAME COLUMN price TO unit_price;
ALTER TABLE public.courses RENAME COLUMN unit_duration TO unit_minutes;
ALTER TABLE public.courses DROP COLUMN translation_key,DROP COLUMN instructor;
ALTER TABLE public.courses RENAME CONSTRAINT courses_price_check TO courses_unit_price_check;
ALTER TABLE public.courses RENAME CONSTRAINT courses_unit_duration_check TO courses_unit_minutes_check;
ALTER TABLE public.course_schedules DROP COLUMN alternate_start_time,DROP COLUMN alternate_end_time;
ALTER TABLE public.course_translations DROP CONSTRAINT course_translations_locale_check;
ALTER TABLE public.course_translations ADD CONSTRAINT course_translations_locale_fkey FOREIGN KEY(locale) REFERENCES public.locales(code),
 ADD CONSTRAINT course_translations_non_source_locale CHECK(locale<>'de');
CREATE INDEX course_translations_locale_idx ON public.course_translations(locale);
UPDATE public.courses SET title='Privatunterricht – Online',
 description='Individueller Online-Unterricht in deinem Tempo. Wähle die gewünschte Anzahl an Einheiten à 45 Minuten. Eine Einheit kostet 25 €. Die Termine vereinbarst du anschließend persönlich mit deiner Lehrkraft.',
 trial_lessons=false,updated_at=now() WHERE slug='privatunterricht-online';
UPDATE public.course_translations t SET title=m.title,description=m.description FROM (VALUES
 ('en','Private lessons – Online','Individual online lessons at your pace. Choose the number of 45-minute units. Each unit costs €25. Arrange your lesson times personally with your teacher after booking.'),
 ('ru','Индивидуальные занятия – Онлайн','Индивидуальные онлайн-занятия в вашем темпе. Выберите количество занятий по 45 минут. Стоимость одного занятия — 25 €. После записи согласуйте расписание с преподавателем.'),
 ('uk','Індивідуальні заняття – Онлайн','Індивідуальні онлайн-заняття у вашому темпі. Оберіть кількість занять по 45 хвилин. Вартість одного заняття — 25 €. Після запису узгодьте розклад із викладачем.'),
 ('tr','Özel ders – Çevrim içi','Kendi hızınızda bire bir çevrim içi dersler. 45 dakikalık ders birimi sayısını seçin. Her birim 25 € tutarındadır. Kaydın ardından ders saatlerini öğretmeninizle birlikte belirleyin.')
) m(locale,title,description) WHERE t.locale=m.locale AND t.course_id='2d4bf352-4840-4213-8cfc-6a6ed6aa1e1d';
ALTER TABLE public.booking_items ADD COLUMN requested_units integer CHECK(requested_units BETWEEN 1 AND 1000);
-- No existing bookings may lose their unrecorded private-unit intention.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.booking_items i JOIN public.courses c ON c.id=i.course_id WHERE c.category='private') THEN
  RAISE EXCEPTION 'Existing private bookings require an explicit quantity reconciliation';
 END IF;
END $$;

-- Replace signatures instead of retaining old overloads or fallback adapters.
DROP FUNCTION public.submit_business_registration(jsonb,uuid[],date,jsonb,text,boolean);
DROP FUNCTION public.save_business_month(date,uuid[],boolean,uuid,integer);
DROP FUNCTION business_private.save_month(date,uuid[],boolean,uuid,integer);
DROP FUNCTION business_private.replace_items(uuid,uuid[]);
DROP FUNCTION business_private.course_quote(uuid,date,boolean);

CREATE FUNCTION business_private.validate_course_selections(p_selections jsonb,p_start date)
RETURNS TABLE(course_id uuid,requested_units integer) LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE item jsonb; seen uuid[]:='{}'; selected public.courses; quantity numeric;
BEGIN
 IF p_start IS NULL OR jsonb_typeof(p_selections) IS DISTINCT FROM 'array' THEN
  RAISE check_violation USING message='Course selections must be an array';
 END IF;
 IF jsonb_array_length(p_selections) NOT BETWEEN 1 AND 100 THEN RAISE check_violation USING message='Choose between 1 and 100 courses'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_selections) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'course_id') IS DISTINCT FROM 'string'
   OR item-'course_id'-'requested_units'<>'{}'::jsonb THEN
   RAISE check_violation USING message='Invalid course selection fields';
  END IF;
  SELECT * INTO selected FROM public.courses WHERE id=(item->>'course_id')::uuid AND archived_at IS NULL
   AND (end_date IS NULL OR end_date>=p_start)
   AND (start_date IS NULL OR start_date<(date_trunc('month',p_start)+interval '1 month')::date);
  IF selected.id IS NULL OR selected.id=ANY(seen) THEN RAISE check_violation USING message='Unavailable or duplicate course'; END IF;
  seen:=array_append(seen,selected.id);
  requested_units:=NULL;
  IF selected.category='private' THEN
   IF jsonb_typeof(item->'requested_units') IS DISTINCT FROM 'number' THEN RAISE check_violation USING message='Private lessons require a unit quantity'; END IF;
   quantity:=(item->>'requested_units')::numeric;
   IF quantity NOT BETWEEN 1 AND 1000 OR quantity<>trunc(quantity) THEN RAISE check_violation USING message='Unit quantity must be a whole number from 1 to 1000'; END IF;
   requested_units:=quantity::integer;
  ELSIF item ? 'requested_units' THEN
   RAISE check_violation USING message='Scheduled course quantities come from the calendar';
  END IF;
  course_id:=selected.id;
  RETURN NEXT;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION business_private.validate_course_selections(jsonb,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.validate_course_selections(jsonb,date) TO service_role;

CREATE FUNCTION business_private.course_quote(p_course uuid,p_start date,p_requested_units integer,p_trial boolean DEFAULT false)
RETURNS TABLE(units numeric,amount numeric) LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT CASE WHEN p_trial THEN 0 WHEN c.category='private' THEN p_requested_units::numeric ELSE calendar.units END,
 CASE WHEN p_trial THEN 0 WHEN c.category='private' THEN round(p_requested_units*c.unit_price,2) ELSE round(calendar.units*c.unit_price,2) END
 FROM public.courses c CROSS JOIN LATERAL (
  SELECT coalesce(sum(extract(epoch FROM(s.end_time-s.start_time))/60/c.unit_minutes),0) units
  FROM public.course_schedules s
  CROSS JOIN LATERAL generate_series(p_start::timestamp,(date_trunc('month',p_start)+interval '1 month - 1 day')::timestamp,interval '1 day') day
  WHERE s.course_id=c.id AND extract(isodow FROM day)=s.weekday
   AND(c.start_date IS NULL OR day::date>=c.start_date) AND(c.end_date IS NULL OR day::date<=c.end_date)
   AND NOT EXISTS(SELECT 1 FROM public.course_exceptions e WHERE e.date=day::date AND(e.course_id IS NULL OR e.course_id=c.id))
 ) calendar WHERE c.id=p_course;
$$;
REVOKE ALL ON FUNCTION business_private.course_quote(uuid,date,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.course_quote(uuid,date,integer,boolean) TO service_role;

CREATE FUNCTION business_private.replace_items(p_booking uuid,p_course_selections jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE b public.bookings;
BEGIN
 SELECT * INTO STRICT b FROM public.bookings WHERE id=p_booking;
 -- Materialize and validate everything before changing any existing items.
 PERFORM * FROM business_private.validate_course_selections(p_course_selections,b.start_date);
 DELETE FROM public.booking_items WHERE booking_id=b.id;
 INSERT INTO public.booking_items(booking_id,course_id,title_snapshot,unit_price,unit_minutes,requested_units,units,amount)
 SELECT b.id,c.id,c.title,c.unit_price,c.unit_minutes,s.requested_units,q.units,q.amount
 FROM business_private.validate_course_selections(p_course_selections,b.start_date) s JOIN public.courses c ON c.id=s.course_id
 CROSS JOIN LATERAL business_private.course_quote(c.id,b.start_date,s.requested_units,b.kind='trial') q;
END $$;
REVOKE ALL ON FUNCTION business_private.replace_items(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.replace_items(uuid,jsonb) TO service_role;

create function public.submit_business_registration(p_contact jsonb,p_course_selections jsonb,p_start date,p_consents jsonb,p_locale text default 'de',p_trial boolean default false)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_person uuid;v_booking uuid;v_email text;v_name text;v_matches integer;
begin
 if p_start is null or p_trial is null or p_start<(now() at time zone 'Europe/Berlin')::date or p_start>(now() at time zone 'Europe/Berlin')::date+366 or coalesce((p_consents->>'privacy')::boolean,false)=false or coalesce((p_consents->>'agb')::boolean,false)=false then raise check_violation;end if;
 perform * from business_private.validate_course_selections(p_course_selections,p_start);
 if not exists(select 1 from public.locales where code=p_locale) then raise check_violation;end if;
 v_email:=lower(btrim(p_contact->>'email'));v_name:=btrim(p_contact->>'name');
 if v_email is null or length(v_email) not between 3 and 254 or v_name is null or length(v_name) not between 1 and 160 then raise check_violation;end if;
 if p_trial then
  perform pg_advisory_xact_lock(hashtextextended(v_email||':'||lower(v_name),0));
  if exists(select 1 from public.bookings where kind='trial' and lower(contact_email)=v_email and lower(contact_name)=lower(v_name)) then raise unique_violation;end if;
  if jsonb_array_length(p_course_selections)<>1 or not exists(select 1 from public.courses c join public.course_schedules s on s.course_id=c.id
   where c.id=(p_course_selections->0->>'course_id')::uuid and c.category<>'private' and c.trial_lessons and c.archived_at is null and s.weekday=extract(isodow from p_start)
   and (c.start_date is null or p_start>=c.start_date) and (c.end_date is null or p_start<=c.end_date)
   and not exists(select 1 from public.course_exceptions e where e.date=p_start and (e.course_id is null or e.course_id=c.id))) then raise check_violation;end if;
 end if;
 -- Submitted details never update an existing identity. Exact identity reuse
 -- only attaches a pending application, exposing no personal data to the caller.
 perform pg_advisory_xact_lock(hashtextextended('application-person:'||v_email||':'||lower(v_name),0));
 select count(*),(array_agg(id))[1] into v_matches,v_person from public.people where lower(email)=v_email and lower(display_name)=lower(v_name)
 and birth_date is not distinct from (p_contact->>'birth_date')::date;
 if v_matches<>1 then
  insert into public.people(display_name,email,birth_date,phone,street,postal_code,city,preferred_locale)
  values(v_name,v_email,(p_contact->>'birth_date')::date,p_contact->>'phone',p_contact->>'street',p_contact->>'postal_code',p_contact->>'city',p_locale) returning id into v_person;
 end if;
 insert into public.bookings(person_id,target_month,start_date,kind,contact_name,contact_email,contact_birth_date,contact_phone,contact_street,contact_postal_code,contact_city,privacy_accepted,agb_accepted,revocation_accepted,recording_accepted)
 values(v_person,date_trunc('month',p_start)::date,p_start,case when p_trial then 'trial' else 'registration' end,v_name,v_email,(p_contact->>'birth_date')::date,p_contact->>'phone',p_contact->>'street',p_contact->>'postal_code',p_contact->>'city',true,true,coalesce((p_consents->>'revocation')::boolean,false),(p_consents->>'recording')::boolean) returning id into v_booking;
 perform business_private.replace_items(v_booking,p_course_selections);
 perform public.queue_transactional_email('registration:'||v_booking,'registration_received',v_email,p_locale,jsonb_build_object('name',v_name,'startDate',p_start,'courses',(select jsonb_agg(jsonb_build_object('title',title_snapshot,'units',units,'unitPrice',unit_price,'unitMinutes',unit_minutes,'price',amount)) from public.booking_items where booking_id=v_booking)));
 perform public.queue_transactional_email('staff-registration:'||v_booking,'new_enrollment','info@sitov-academy.com','de',jsonb_build_object('name',v_name,'path','/de/admin/registrations'));
 return v_booking;
end $$;
revoke all on function public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean) to service_role;

create function business_private.save_month(p_month date,p_course_selections jsonb,p_paused boolean,p_expected uuid,p_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.people;b public.bookings;v_next date;
begin
 perform business_private.claim_person();
 select * into strict p from public.people where auth_user_id=auth.uid() for update;
 v_next:=(date_trunc('month',now() at time zone 'Europe/Berlin')+interval '1 month')::date;
 if p_month is null or p_month<>v_next then raise sqlstate '22008';end if;
 if jsonb_typeof(p_course_selections) is distinct from 'array' or p_paused is null then raise check_violation using message='Courses and pause choice are required';end if;
 if p_paused and p_course_selections<>'[]'::jsonb then raise check_violation using message='A pause must have no selected courses';end if;
 select * into b from public.bookings where person_id=p.id and target_month=p_month and kind<>'trial' for update;
 if b.id is distinct from p_expected or (b.id is not null and b.revision is distinct from p_revision) then raise exception 'Booking revision changed' using errcode='PT409';end if;
 if exists(select 1 from public.invoice_cases where person_id=p.id and target_month=p_month and status='created') then raise check_violation using message='Invoice already created';end if;
 if b.id is null then
  insert into public.bookings(person_id,target_month,start_date,kind,status,contact_name,contact_email,contact_birth_date,contact_phone,contact_street,contact_postal_code,contact_city,privacy_accepted,agb_accepted)
  values(p.id,p_month,p_month,'monthly',case when p_paused then 'cancelled' else 'pending' end,p.display_name,p.email,p.birth_date,p.phone,p.street,p.postal_code,p.city,true,true) returning * into b;
 else
  update public.bookings set status=case when p_paused then 'cancelled' else 'pending' end,updated_at=now(),revision=revision+1 where id=b.id;
 end if;
 if p_paused then delete from public.booking_items where booking_id=b.id;
 else perform business_private.replace_items(b.id,p_course_selections);end if;
 return b.id;
end $$;
revoke all on function business_private.save_month(date,jsonb,boolean,uuid,integer) from public,anon;
grant execute on function business_private.save_month(date,jsonb,boolean,uuid,integer) to authenticated;
create function public.save_business_month(p_month date,p_course_selections jsonb,p_paused boolean,p_expected uuid default null,p_revision integer default null) returns uuid
language sql security invoker set search_path='' as $$select business_private.save_month(p_month,p_course_selections,p_paused,p_expected,p_revision);$$;
revoke all on function public.save_business_month(date,jsonb,boolean,uuid,integer) from public,anon;
grant execute on function public.save_business_month(date,jsonb,boolean,uuid,integer) to authenticated;

create or replace function business_private.save_course(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_schedule jsonb;v_translation jsonb;v_exception jsonb;
begin
 if not business_private.is_staff() then raise insufficient_privilege;end if;
 if jsonb_typeof(p_data) is distinct from 'object' or jsonb_typeof(p_data->'schedules') is distinct from 'array' or jsonb_typeof(p_data->'translations') is distinct from 'array' or jsonb_typeof(p_data->'exceptions') is distinct from 'array' then raise check_violation;end if;
 if p_data->>'category'='private' and ((p_data->'schedules')<>'[]'::jsonb or coalesce((p_data->>'trial_lessons')::boolean,true)) then raise check_violation using message='Private lessons use requested units and have no fixed schedule or trial';end if;
 v_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
 -- Hold the course row while checking its booking references. A scheduled
 -- booking has no requested quantity and cannot become a private renewal.
 perform 1 from public.courses where id=v_id for update;
 if nullif(p_data->>'id','') is not null and not exists(select 1 from public.courses where id=v_id) then raise no_data_found;end if;
 if exists(select 1 from public.courses c where c.id=v_id
   and (c.category='private') is distinct from (p_data->>'category'='private')
   and exists(select 1 from public.booking_items i where i.course_id=c.id)) then
  raise check_violation using message='The pricing model of a booked course cannot be changed';
 end if;
 insert into public.courses(id,slug,title,description,type,category,level,unit_price,unit_minutes,start_date,end_date,trial_lessons,sort_order,archived_at)
 values(v_id,p_data->>'slug',p_data->>'title',coalesce(p_data->>'description',''),p_data->>'type',p_data->>'category',coalesce(p_data->>'level',''),(p_data->>'unit_price')::numeric,
 (p_data->>'unit_minutes')::integer,nullif(p_data->>'start_date','')::date,nullif(p_data->>'end_date','')::date,(p_data->>'trial_lessons')::boolean,(p_data->>'sort_order')::integer,
 case when (p_data->>'archived')::boolean then now() else null end)
 on conflict(id) do update set slug=excluded.slug,title=excluded.title,description=excluded.description,type=excluded.type,category=excluded.category,level=excluded.level,
 unit_price=excluded.unit_price,unit_minutes=excluded.unit_minutes,start_date=excluded.start_date,end_date=excluded.end_date,trial_lessons=excluded.trial_lessons,
 sort_order=excluded.sort_order,archived_at=excluded.archived_at,updated_at=now();
 delete from public.course_schedules where course_id=v_id;
 for v_schedule in select value from jsonb_array_elements(p_data->'schedules') loop
  insert into public.course_schedules(course_id,weekday,start_time,end_time)
  values(v_id,(v_schedule->>'weekday')::smallint,(v_schedule->>'start_time')::time,(v_schedule->>'end_time')::time);
 end loop;
 delete from public.course_translations where course_id=v_id;
 for v_translation in select value from jsonb_array_elements(p_data->'translations') loop
  insert into public.course_translations(course_id,locale,title,description) values(v_id,v_translation->>'locale',v_translation->>'title',coalesce(v_translation->>'description',''));
 end loop;
 delete from public.course_exceptions where course_id=v_id;
 for v_exception in select value from jsonb_array_elements(p_data->'exceptions') loop
  insert into public.course_exceptions(course_id,date,reason) values(v_id,(v_exception->>'date')::date,v_exception->>'reason');
 end loop;
 return v_id;
end $$;
revoke all on function business_private.save_course(jsonb) from public,anon;
grant execute on function business_private.save_course(jsonb) to authenticated;
create or replace function public.save_business_course(p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select business_private.save_course(p_data);$$;
revoke all on function public.save_business_course(jsonb) from public,anon;
grant execute on function public.save_business_course(jsonb) to authenticated;

create or replace function business_private.prepare_month(p_month date) returns integer language plpgsql security definer set search_path='' as $$
declare p public.people;previous public.bookings;v_id uuid;selections jsonb;v_count integer:=0;
begin
 if not business_private.is_staff() then raise insufficient_privilege;end if;
 if p_month is null or extract(day from p_month)<>1 or p_month>(date_trunc('month',now() at time zone 'Europe/Berlin')+interval '1 month')::date then raise check_violation;end if;
 for p in select * from public.people order by id for update loop
  if exists(select 1 from public.bookings where person_id=p.id and target_month=p_month and kind<>'trial') then continue;end if;
  select * into previous from public.bookings where person_id=p.id and target_month<p_month and kind<>'trial' order by target_month desc limit 1;
  if previous.id is null or previous.status<>'confirmed' then continue;end if;
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('course_id',i.course_id,'requested_units',case when c.category='private' then i.requested_units end))) into selections from public.booking_items i join public.courses c on c.id=i.course_id where i.booking_id=previous.id and c.archived_at is null
   and (c.start_date is null or c.start_date<(p_month+interval '1 month')::date) and (c.end_date is null or c.end_date>=p_month);
  if selections is null then continue;end if;
  insert into public.bookings(person_id,target_month,start_date,kind,status,contact_name,contact_email,contact_birth_date,contact_phone,contact_street,contact_postal_code,contact_city,privacy_accepted,agb_accepted,revocation_accepted,recording_accepted,confirmed_at,confirmed_by)
  values(p.id,p_month,p_month,'monthly','confirmed',p.display_name,p.email,p.birth_date,p.phone,p.street,p.postal_code,p.city,previous.privacy_accepted,previous.agb_accepted,previous.revocation_accepted,previous.recording_accepted,now(),auth.uid()) returning id into v_id;
  perform business_private.replace_items(v_id,selections);
  insert into public.invoice_cases(person_id,target_month,booking_id) values(p.id,p_month,v_id) on conflict(person_id,target_month) do nothing;
  v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
revoke all on function business_private.prepare_month(date) from public,anon;
grant execute on function business_private.prepare_month(date) to authenticated;
create or replace function public.prepare_business_month(p_month date) returns integer language sql security invoker set search_path='' as $$select business_private.prepare_month(p_month);$$;
revoke all on function public.prepare_business_month(date) from public,anon;
grant execute on function public.prepare_business_month(date) to authenticated;

create or replace function business_private.confirm_booking(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings;p public.people;
begin
 if not business_private.is_staff() then raise insufficient_privilege;end if;
 select * into strict b from public.bookings where id=p_id for update;
 if b.status='confirmed' then return;end if;
 if b.status<>'pending' then raise check_violation;end if;
 if not exists(select 1 from public.booking_items where booking_id=b.id) then raise check_violation;end if;
 update public.bookings set status='confirmed',confirmed_at=now(),confirmed_by=auth.uid(),updated_at=now(),revision=revision+1 where id=b.id;
 if b.kind<>'trial' then insert into public.invoice_cases(person_id,target_month,booking_id) values(b.person_id,b.target_month,b.id) on conflict(person_id,target_month) do nothing;end if;
 select * into strict p from public.people where id=b.person_id;
 perform public.queue_transactional_email('confirmed:'||b.id,case when b.kind='trial' then 'trial_confirmed' else 'registration_confirmed' end,b.contact_email,p.preferred_locale,
 jsonb_build_object('name',b.contact_name,'startDate',b.start_date,'courses',(select jsonb_agg(jsonb_build_object('title',title_snapshot,'units',units,'unitPrice',unit_price,'unitMinutes',unit_minutes,'price',amount)) from public.booking_items where booking_id=b.id)));
end $$;
revoke all on function business_private.confirm_booking(uuid) from public,anon;
grant execute on function business_private.confirm_booking(uuid) to authenticated;
create or replace function public.confirm_business_booking(p_id uuid) returns void language sql security invoker set search_path='' as $$select business_private.confirm_booking(p_id);$$;
revoke all on function public.confirm_business_booking(uuid) from public,anon;
grant execute on function public.confirm_business_booking(uuid) to authenticated;


-- Replace the single shared role helper in every retained policy/function.
-- ALTER POLICY preserves its role list, command and permissive/restrictive mode.
DO $$ DECLARE f record; p record; statement text; BEGIN
 FOR f IN SELECT pg_get_functiondef(proc.oid) definition FROM pg_proc proc
  JOIN pg_namespace ns ON ns.oid=proc.pronamespace
  WHERE ns.nspname IN('public','business_private','grammar_private','learning_private','learning_reset_private',
   'platform_private','pronunciation_private','trainer_access_private','vocabulary_private')
   AND proc.prokind='f' AND proc.prosrc LIKE '%monthly_booking_private.current_profile_role%'
 LOOP
  EXECUTE replace(f.definition,'monthly_booking_private.current_profile_role','identity_private.current_profile_role');
 END LOOP;
 FOR p IN SELECT pol.polname,ns.nspname,t.relname,pg_get_expr(pol.polqual,pol.polrelid) using_expression,
   pg_get_expr(pol.polwithcheck,pol.polrelid) check_expression
  FROM pg_policy pol JOIN pg_class t ON t.oid=pol.polrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace
  WHERE coalesce(pg_get_expr(pol.polqual,pol.polrelid),'')||coalesce(pg_get_expr(pol.polwithcheck,pol.polrelid),'')
   LIKE '%monthly_booking_private.current_profile_role%'
 LOOP
  statement:=format('ALTER POLICY %I ON %I.%I',p.polname,p.nspname,p.relname);
  IF p.using_expression IS NOT NULL THEN statement:=statement||' USING ('||replace(p.using_expression,'monthly_booking_private.current_profile_role','identity_private.current_profile_role')||')'; END IF;
  IF p.check_expression IS NOT NULL THEN statement:=statement||' WITH CHECK ('||replace(p.check_expression,'monthly_booking_private.current_profile_role','identity_private.current_profile_role')||')'; END IF;
  EXECUTE statement;
 END LOOP;
END $$;
DROP VIEW public.profile_details;
-- The old registrations table is gone; its detached trigger function must not
-- remain as a callable reference to a nonexistent enrollment model.
DROP FUNCTION public.handle_registration_confirmation();
ALTER TABLE public.profiles DROP COLUMN subscription_status,DROP COLUMN stripe_customer_id,DROP COLUMN stripe_subscription_id;
DROP FUNCTION monthly_booking_private.current_profile_role();
DROP SCHEMA monthly_booking_private;

ALTER TABLE private.mail_outbox ADD CONSTRAINT mail_outbox_locale_fkey FOREIGN KEY(locale) REFERENCES public.locales(code);
CREATE INDEX mail_outbox_locale_idx ON private.mail_outbox(locale);
-- BEGIN canonical reset storage
-- The retired bucket is removed separately through the Storage API, never SQL.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects WHERE bucket_id<>'pronunciation_audio') THEN
  RAISE EXCEPTION 'Non-canonical reset manifest objects require resolution before migration';
 END IF;
END $$;
ALTER TABLE learning_reset_private.audio_objects DROP CONSTRAINT audio_objects_bucket_id_check;
ALTER TABLE learning_reset_private.audio_objects ADD CONSTRAINT audio_objects_bucket_id_check CHECK(bucket_id='pronunciation_audio');
CREATE OR REPLACE FUNCTION learning_reset_private.storage_writable(p_bucket text,p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_bucket<>'pronunciation_audio' THEN RETURN true; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
  WHERE a.object_id=p_id AND j.active) THEN RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000'; END IF;
 PERFORM learning_reset_private.assert_writable((SELECT auth.uid()));
 RETURN true;
END $$;
-- END canonical reset storage

-- RLS tables, physical foreign keys and canonical names are checked again after
-- restore and by the deployment preflight; historical migrations stay immutable.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND(column_name LIKE '%legacy%' OR column_name IN('translation_key','stripe_customer_id','stripe_subscription_id','discount_percent','is_blackboard'))) THEN
  RAISE EXCEPTION 'Obsolete public columns remain';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity) THEN
  RAISE EXCEPTION 'Public tables must use row-level security';
 END IF;
END $$;
NOTIFY pgrst,'reload schema';

COMMIT;
