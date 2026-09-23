-- Phase 5.11. Backup with migrate-local.py before applying. migrate-local wraps
-- regular files in one transaction; every statement here is idempotent.
-- Rollback: supabase/vps/rollback/23_vocabulary_own_words.sql.
--
-- „Eigene Wörter": Jede lernende Person hat pro Niveau eine private Lektion
-- für selbst eingetragene Vokabeln. Sie ist eine echte Unit mit echten Karten,
-- damit Leitner-Lernstand, Fälligkeit, Bewertung (R5), Fächer und Sitzungen
-- ohne zweite Logik mitlaufen — nur gehört sie genau einer Person:
--
--   * learning_units.owner_auth_user_id markiert die private Unit. Es gibt
--     höchstens eine je Person und Niveau, ihr Name ist fest „Eigene Wörter"
--     (die App übersetzt ihn), und kein Kursinhalt darf so heißen.
--   * Zugriff: Die Besitzerin sieht und lernt ihre Unit, sobald sie den
--     Vokabeltrainer des Niveaus nutzen darf — Lektionsfreigaben einzelner
--     Units gelten für sie nicht. Niemand sonst sieht sie über die normalen
--     Leserechte, auch Lehrkräfte nicht (Admin-CMS listet nur Kursinhalt).
--   * Kursfortschritt und Lehrer-Auswertung zählen nur Kursvokabeln.
--   * Eintragen/Löschen nur über add_own_vocabulary / delete_own_vocabulary.
--     Ist die Lektion schon aktiviert (es gibt Lernstand), startet ein neues
--     Wort sofort in Phase 1; sonst legt die erste Aktivierung alle Wörter
--     in Phase 1 (initialize_vocabulary_cards), ohne Einstufung.
--   * Sprachwechsel: Ein eigenes Wort hat genau eine Übersetzung, in der
--     Sprache, in der es eingetragen wurde. card_translation() lässt sie auch
--     nach einem Wechsel der Oberflächensprache gelten (answer_key und
--     submit_self_rating); Kursvokabeln bleiben streng bei der Oberfläche.

-- ── Datenmodell ───────────────────────────────────────────────────────────
ALTER TABLE public.learning_units
 ADD COLUMN IF NOT EXISTS owner_auth_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

DO $migration$
BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_units WHERE owner_auth_user_id IS NULL AND label='Eigene Wörter') THEN
  RAISE EXCEPTION 'own_words_label_taken'
   USING ERRCODE='23514', DETAIL='A course unit is already called "Eigene Wörter"; rename it before applying 23.';
 END IF;
END $migration$;

ALTER TABLE public.learning_units DROP CONSTRAINT IF EXISTS learning_units_own_words_check;
ALTER TABLE public.learning_units ADD CONSTRAINT learning_units_own_words_check CHECK (
 (owner_auth_user_id IS NULL AND label<>'Eigene Wörter')
 OR (owner_auth_user_id IS NOT NULL AND trainer='vocabulary' AND label='Eigene Wörter'));

-- Kurslektionen bleiben je Niveau eindeutig benannt; private Units heißen alle
-- gleich und sind stattdessen je Person und Niveau eindeutig.
DROP INDEX IF EXISTS public.learning_units_named_lesson_idx;
CREATE UNIQUE INDEX learning_units_named_lesson_idx ON public.learning_units(level,trainer,label)
 WHERE trainer IN('vocabulary','exercises') AND owner_auth_user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS learning_units_own_words_idx ON public.learning_units(owner_auth_user_id,level,trainer)
 WHERE owner_auth_user_id IS NOT NULL;

-- Wird die Person gelöscht, fällt ihre Unit per Kaskade weg. Die Karten hängen
-- ohne Kaskade an der Unit (Kursinhalt soll nie still mitverschwinden), daher
-- räumt dieser Trigger die Karten einer privaten Unit vorher ab — Übersetzungen
-- und Lernstand folgen den Karten per Kaskade.
CREATE OR REPLACE FUNCTION vocabulary_private.delete_own_unit_cards() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 DELETE FROM public.learning_vocabulary_cards WHERE unit_id=OLD.id;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.delete_own_unit_cards() FROM PUBLIC;
DROP TRIGGER IF EXISTS learning_units_own_words_cleanup ON public.learning_units;
CREATE TRIGGER learning_units_own_words_cleanup BEFORE DELETE ON public.learning_units
 FOR EACH ROW WHEN (OLD.owner_auth_user_id IS NOT NULL) EXECUTE FUNCTION vocabulary_private.delete_own_unit_cards();

-- ── Zugriff ───────────────────────────────────────────────────────────────
-- Aus 10_rls_performance.sql; neu ist nur der Zweig für private Units.
CREATE OR REPLACE FUNCTION learning_private.allowed_unit_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT COALESCE(array_agg(u.id), ARRAY[]::uuid[])
 FROM public.profiles p
 CROSS JOIN public.learning_units u
 LEFT JOIN public.student_level_access l ON l.auth_user_id=p.id AND l.level=u.level
 LEFT JOIN public.learning_trainer_grants a
   ON a.auth_user_id=p.id AND a.level=u.level AND a.trainer=u.trainer
 WHERE p.id=(SELECT auth.uid()) AND CASE WHEN u.owner_auth_user_id IS NULL THEN (p.role IN ('teacher','admin') OR (
   p.ui_language<>'de' AND u.is_active AND l.auth_user_id IS NOT NULL
   AND u.trainer::text IN ('vocabulary','exercises','pronunciation','videos')
   AND COALESCE(a.enabled,true) AND (a.unit_mode IS DISTINCT FROM 'selected' OR EXISTS (
     SELECT 1 FROM public.learning_unit_grants g WHERE g.auth_user_id=p.id
       AND g.level=u.level AND g.trainer=u.trainer AND g.unit_id=u.id))))
  -- Eigene Unit: dieselbe Bedingung wie trainer_access_private.allowed(),
  -- ohne Lektionsauswahl.
  ELSE u.owner_auth_user_id=p.id AND (p.role IN ('teacher','admin') OR (
   p.ui_language<>'de' AND l.auth_user_id IS NOT NULL AND COALESCE(a.enabled,true))) END;
$$;
REVOKE ALL ON FUNCTION learning_private.allowed_unit_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION learning_private.allowed_unit_ids() TO authenticated, service_role;

-- Gilt für jede Vokabel-RPC (Antworten, Selbsteinschätzung, Wiederholung,
-- Initialisierung, Lektion zurücksetzen). Muss mit allowed_unit_ids() übereinstimmen.
CREATE OR REPLACE FUNCTION learning_private.unit_allowed(p_unit_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit_id AND CASE
  WHEN u.owner_auth_user_id IS NULL THEN trainer_access_private.unit_allowed(u.level,u.trainer::text,u.id::text)
  ELSE u.owner_auth_user_id=(SELECT auth.uid()) AND trainer_access_private.allowed(u.level,u.trainer::text) END);
$$;
REVOKE ALL ON FUNCTION learning_private.unit_allowed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION learning_private.unit_allowed(uuid) TO authenticated, service_role;

-- Kursinhalt (CMS) findet und ändert nie eine private Unit.
CREATE OR REPLACE FUNCTION learning_private.ensure_unit(p_id uuid, p_level text, p_trainer text, p_label text, p_active boolean DEFAULT true, p_sort integer DEFAULT 100) RETURNS uuid
LANGUAGE plpgsql SET search_path TO '' AS $$ DECLARE result uuid; BEGIN
 IF p_id IS NOT NULL THEN
  DELETE FROM public.learning_unit_grants WHERE unit_id=p_id AND level<>p_level;
  UPDATE public.learning_units SET level=p_level,label=p_label,is_active=p_active,sort_order=p_sort
  WHERE id=p_id AND trainer::text=p_trainer AND owner_auth_user_id IS NULL RETURNING id INTO result;
  IF result IS NULL THEN INSERT INTO public.learning_units(id,level,trainer,label,is_active,sort_order)
   VALUES(p_id,p_level,p_trainer::public.trainer_code,p_label,p_active,p_sort) RETURNING id INTO result; END IF;
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended('learning-unit:'||p_level||':'||p_trainer||':'||p_label,0));
  IF p_trainer IN('vocabulary','exercises') THEN
   SELECT id INTO result FROM public.learning_units WHERE level=p_level AND trainer::text=p_trainer AND label=p_label AND owner_auth_user_id IS NULL;
  END IF;
  IF result IS NULL THEN INSERT INTO public.learning_units(level,trainer,label,is_active,sort_order)
   VALUES(p_level,p_trainer::public.trainer_code,p_label,p_active,p_sort) RETURNING id INTO result; END IF;
 END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'Unit unavailable' USING ERRCODE='23514'; END IF;
 RETURN result;
END $$;

-- „Einstufung überspringen" startet immer die erste Kurslektion.
CREATE OR REPLACE FUNCTION vocabulary_private.skip_assessment(p_level text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid := auth.uid(); first_unit public.learning_units; decisions jsonb; result jsonb;
BEGIN
 IF actor IS NULL OR NOT trainer_access_private.allowed(p_level,'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 SELECT u.* INTO first_unit FROM public.learning_units u WHERE u.level=p_level AND u.trainer='vocabulary'
 AND u.owner_auth_user_id IS NULL
 AND learning_private.unit_allowed(u.id) AND EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
 ORDER BY u.sort_order,u.label,u.id LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'lesson_not_found' USING ERRCODE='22023'; END IF;
 SELECT jsonb_agg(jsonb_build_object('cardId',id,'alreadyKnown',false)) INTO decisions FROM public.learning_vocabulary_cards WHERE unit_id=first_unit.id;
 result:=vocabulary_private.initialize_cards(decisions);
 INSERT INTO public.vocabulary_onboarding(auth_user_id,level,status,started_unit_id) VALUES(actor,p_level,'skipped',first_unit.id)
 ON CONFLICT(auth_user_id,level) DO UPDATE SET status='skipped',started_unit_id=excluded.started_unit_id,updated_at=now();
 RETURN result||jsonb_build_object('lesson',first_unit.label);
END $$;

-- ── Eintragen und Löschen ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION vocabulary_private.add_own_word(p_level text, p_word_de text, p_article text, p_translation text, p_locale text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=auth.uid(); own_unit uuid; new_card uuid; activated boolean;
 word text:=btrim(regexp_replace(coalesce(p_word_de,''),'\s+',' ','g'));
 translated text:=btrim(regexp_replace(coalesce(p_translation,''),'\s+',' ','g'));
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF NOT trainer_access_private.allowed(p_level,'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 -- Die Übersetzung steht in der Sprache der Oberfläche: Daraus fragt der
 -- Trainer die Richtung Deutsch → eigene Sprache ab (answer_key).
 IF p_locale IS NULL OR p_locale NOT IN('en','ru','uk','tr') THEN RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF length(word) NOT BETWEEN 1 AND 120 OR length(translated) NOT BETWEEN 1 AND 200
  OR (p_article IS NOT NULL AND p_article NOT IN('der','die','das')) THEN
  RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 SELECT id INTO own_unit FROM public.learning_units WHERE owner_auth_user_id=actor AND level=p_level AND trainer='vocabulary';
 IF own_unit IS NULL THEN
  INSERT INTO public.learning_units(level,trainer,label,sort_order,is_active,owner_auth_user_id)
   VALUES(p_level,'vocabulary','Eigene Wörter',1000000,true,actor) RETURNING id INTO own_unit;
 END IF;
 -- 1000 = eine initialize_vocabulary_cards-Anfrage aktiviert die ganze Lektion.
 IF (SELECT count(*) FROM public.learning_vocabulary_cards c WHERE c.unit_id=own_unit)>=1000 THEN
  RAISE EXCEPTION 'own_word_limit' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=own_unit
  AND lower(c.word_de)=lower(word) AND coalesce(c.article::text,'')=coalesce(p_article,'')) THEN
  RAISE EXCEPTION 'own_word_exists' USING ERRCODE='23505'; END IF;
 activated:=EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  WHERE v.auth_user_id=actor AND c.unit_id=own_unit);
 INSERT INTO public.learning_vocabulary_cards(unit_id,word_de,article,sentence_practice)
  VALUES(own_unit,word,p_article::public.grammatical_article,false) RETURNING id INTO new_card;
 INSERT INTO public.vocabulary_translations(card_id,locale,translation) VALUES(new_card,p_locale,translated);
 IF activated THEN
  INSERT INTO public.vocabulary_direction_progress(auth_user_id,card_id,direction,box_number,next_review_date)
   SELECT actor,new_card,d::public.vocabulary_direction,1,now() FROM unnest(ARRAY['de_to_native','native_to_de']) d;
 END IF;
 RETURN jsonb_build_object('cardId',new_card,'activated',activated);
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.add_own_word(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vocabulary_private.add_own_word(text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION vocabulary_private.delete_own_word(p_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 DELETE FROM public.learning_vocabulary_cards c USING public.learning_units u
  WHERE c.id=p_card_id AND u.id=c.unit_id AND u.owner_auth_user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 RETURN jsonb_build_object('success',true);
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.delete_own_word(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vocabulary_private.delete_own_word(uuid) TO authenticated;

-- Öffentliche RPCs mit derselben Fehlergrenze wie 05_rpc_errors.sql (R10).
CREATE OR REPLACE FUNCTION public.add_own_vocabulary(p_level text, p_word_de text, p_article text, p_translation text, p_locale text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE boundary_state text; boundary_message text; boundary_code text;
BEGIN
 RETURN vocabulary_private.add_own_word(p_level,p_word_de,p_article,p_translation,p_locale);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','trainer_access_denied','invalid_language','own_word_exists','own_word_limit',
   'not_authorized','not_authenticated','invalid_input','request_failed','conflict','not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_code='own_word_exists' THEN 'This word is already in your own words.'
   WHEN boundary_code='own_word_limit' THEN 'Your own words list is full.'
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END $$;
REVOKE ALL ON FUNCTION public.add_own_vocabulary(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_own_vocabulary(text,text,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_own_vocabulary(p_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE boundary_state text; boundary_message text; boundary_code text;
BEGIN
 RETURN vocabulary_private.delete_own_word(p_card_id);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','not_authorized','not_authenticated','invalid_input','request_failed','conflict','not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END $$;
REVOKE ALL ON FUNCTION public.delete_own_vocabulary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_vocabulary(uuid) TO authenticated, service_role;

-- ── Auswertung: nur Kursvokabeln ──────────────────────────────────────────
-- Aus 09_progress_aggregate.sql; neu sind die beiden owner-Filter.
CREATE OR REPLACE FUNCTION public.get_all_students_progress_data()
RETURNS jsonb
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb := '{}'::jsonb;
BEGIN
    IF NOT business_private.is_staff() THEN
        RETURN jsonb_build_object('error', 'not_authorized', 'message', 'Staff access required.');
    END IF;

    WITH totals AS (
        SELECT u.level, COUNT(e.id) as total_items
        FROM public.learning_units u
        JOIN public.learning_exercises e ON e.unit_id = u.id
        GROUP BY u.level
        UNION ALL
        SELECT u.level, COUNT(v.id) as total_items
        FROM public.learning_units u
        JOIN public.learning_vocabulary_cards v ON v.unit_id = u.id
        WHERE u.owner_auth_user_id IS NULL
        GROUP BY u.level
    ),
    level_totals AS (
        SELECT level, SUM(total_items) as total_items
        FROM totals
        GROUP BY level
    ),
    completed_exercises AS (
        SELECT p.auth_user_id, u.level, COUNT(p.exercise_id) as completed_items
        FROM public.user_exercise_progress p
        JOIN public.learning_exercises e ON e.id = p.exercise_id
        JOIN public.learning_units u ON u.id = e.unit_id
        WHERE p.completed = true
        GROUP BY p.auth_user_id, u.level
    ),
    learned_vocab AS (
        SELECT p1.auth_user_id, p1.card_id
        FROM public.vocabulary_direction_progress p1
        JOIN public.vocabulary_direction_progress p2
          ON p1.auth_user_id = p2.auth_user_id AND p1.card_id = p2.card_id
        WHERE p1.direction = 'de_to_native' AND p1.box_number = 7
          AND p2.direction = 'native_to_de' AND p2.box_number = 7
    ),
    completed_vocab AS (
        SELECT lv.auth_user_id, u.level, COUNT(lv.card_id) as completed_items
        FROM learned_vocab lv
        JOIN public.learning_vocabulary_cards v ON v.id = lv.card_id
        JOIN public.learning_units u ON u.id = v.unit_id
        WHERE u.owner_auth_user_id IS NULL
        GROUP BY lv.auth_user_id, u.level
    ),
    user_level_completed AS (
        SELECT auth_user_id, level, SUM(completed_items) as total_completed
        FROM (
            SELECT * FROM completed_exercises
            UNION ALL
            SELECT * FROM completed_vocab
        ) sub
        GROUP BY auth_user_id, level
    ),
    user_percentages AS (
        SELECT
            users.auth_user_id,
            t.level,
            ROUND((COALESCE(c.total_completed, 0)::numeric / t.total_items) * 100) as percentage
        FROM (SELECT DISTINCT auth_user_id FROM user_level_completed) users
        CROSS JOIN level_totals t
        LEFT JOIN user_level_completed c ON c.auth_user_id = users.auth_user_id AND c.level = t.level
        WHERE t.total_items > 0
    )
    SELECT COALESCE(
        jsonb_object_agg(
            agg.auth_user_id::text,
            agg.levels_obj
        ),
        '{}'::jsonb
    ) INTO result
    FROM (
        SELECT
            auth_user_id,
            jsonb_object_agg(level, percentage) as levels_obj
        FROM user_percentages
        GROUP BY auth_user_id
    ) agg;

    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'request_failed',
        'message', 'Progress could not be loaded.', 'sqlstate', SQLSTATE);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_all_students_progress_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_all_students_progress_data() TO authenticated;

-- Aus 11_teacher_analytics.sql; neu sind die beiden owner-Filter.
CREATE OR REPLACE FUNCTION public.get_all_students_progress_data(p_student_id uuid, p_course_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
 selected_level text;
 percentages jsonb;
 distribution jsonb;
 history jsonb;
 today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
 IF NOT business_private.is_staff() THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.');
 END IF;
 IF p_student_id IS NULL THEN
  RETURN jsonb_build_object('error','invalid_input','message','A student is required.');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student') THEN
  RETURN jsonb_build_object('error','not_found','message','Student not found.');
 END IF;
 IF p_course_id IS NOT NULL THEN
  SELECT level INTO selected_level FROM public.courses WHERE id=p_course_id;
  IF NOT FOUND THEN
   RETURN jsonb_build_object('error','not_found','message','Course not found.');
  END IF;
 END IF;
 percentages := public.get_all_students_progress_data();
 IF percentages ? 'error' THEN RETURN percentages; END IF;

 WITH cards AS (
  SELECT c.id, CASE WHEN count(p.id)=0 THEN NULL
   WHEN count(p.id)=2 AND bool_and(p.box_number=7) THEN 7
   ELSE least(6,min(p.box_number)) END AS phase
  FROM public.learning_vocabulary_cards c
  JOIN public.learning_units u ON u.id=c.unit_id
  LEFT JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=p_student_id
  WHERE (p_course_id IS NULL OR u.level=selected_level) AND u.owner_auth_user_id IS NULL
  GROUP BY c.id
 ), buckets AS (
  SELECT phase_number, count(c.id) AS count
  FROM generate_series(1,7) phase_number LEFT JOIN cards c ON c.phase=phase_number
  GROUP BY phase_number
 ) SELECT jsonb_build_object(
  'buckets',(SELECT jsonb_agg(jsonb_build_object('key',CASE WHEN phase_number=7 THEN to_jsonb('learned'::text) ELSE to_jsonb(phase_number) END,'count',count) ORDER BY phase_number) FROM buckets),
  'totalCards',count(*),'totalInBox',count(phase),
  'overallPercent',CASE WHEN count(*)=0 THEN 0 ELSE round(coalesce(sum(phase),0)::numeric/(count(*)*7)*100) END
 ) INTO distribution FROM cards;

 WITH days AS (SELECT today-29+n AS day FROM generate_series(0,29) n),
 events AS (
  SELECT (r.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,
   count(*) AS answers, count(*) FILTER(WHERE r.response->>'isCorrect'='true') AS correct
  FROM vocabulary_private.answer_receipts r
  JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=r.auth_user_id
  JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
  JOIN public.learning_units u ON u.id=c.unit_id
  WHERE r.auth_user_id=p_student_id
   AND r.created_at>=((today-29)::timestamp AT TIME ZONE 'Europe/Berlin')
   AND r.created_at<((today+1)::timestamp AT TIME ZONE 'Europe/Berlin')
   AND (p_course_id IS NULL OR u.level=selected_level)
   AND u.owner_auth_user_id IS NULL
  GROUP BY (r.created_at AT TIME ZONE 'Europe/Berlin')::date
 ) SELECT jsonb_agg(jsonb_build_object('date',d.day,'answers',coalesce(e.answers,0),'correct',coalesce(e.correct,0)) ORDER BY d.day)
 INTO history FROM days d LEFT JOIN events e USING(day);

 RETURN jsonb_build_object('studentId',p_student_id,'courseId',p_course_id,'level',selected_level,
  'completionByLevel',coalesce(percentages->p_student_id::text,'{}'::jsonb),
  'distribution',distribution,'history',history,'timezone','Europe/Berlin');
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','Learning analytics could not be loaded.','sqlstate',SQLSTATE);
END $$;
REVOKE EXECUTE ON FUNCTION public.get_all_students_progress_data(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_all_students_progress_data(uuid,uuid) TO authenticated;

-- ── Sprachwechsel ─────────────────────────────────────────────────────────
-- Übersetzung einer Karte für Abfrage und Bewertung. Kursvokabeln: nur in der
-- Sprache der Oberfläche (unverändert). Eigene Wörter haben genau eine
-- Übersetzung — in der Sprache, in der sie eingetragen wurden — und die gilt
-- auch nach einem Sprachwechsel der Oberfläche. Spiegelt
-- lib/vocabulary-languages.ts:resolveCardInterfaceTranslation (gleiche Reihenfolge).
CREATE OR REPLACE FUNCTION vocabulary_private.card_translation(p_card_id uuid, p_ui_language text) RETURNS text
LANGUAGE sql STABLE SET search_path TO '' AS $$
 SELECT coalesce(
  (SELECT t.translation FROM public.vocabulary_translations t
    WHERE t.card_id=p_card_id AND t.locale=p_ui_language AND nullif(btrim(t.translation),'') IS NOT NULL),
  (SELECT t.translation FROM public.vocabulary_translations t
    JOIN public.learning_vocabulary_cards c ON c.id=t.card_id
    JOIN public.learning_units u ON u.id=c.unit_id
    WHERE t.card_id=p_card_id AND u.owner_auth_user_id IS NOT NULL AND t.locale<>'de'
     AND nullif(btrim(t.translation),'') IS NOT NULL
    ORDER BY t.locale LIMIT 1));
$$;
REVOKE ALL ON FUNCTION vocabulary_private.card_translation(uuid,text) FROM PUBLIC;
-- submit_self_rating und submit_answer gehören live noch postgres (siehe 22).
GRANT EXECUTE ON FUNCTION vocabulary_private.card_translation(uuid,text) TO postgres;

-- Aus 22_vocabulary_phase6_rules.sql; neu ist nur die Zeile mit card_translation.
CREATE OR REPLACE FUNCTION vocabulary_private.answer_key(p_card_id uuid, p_direction text, p_ui_language text,
 OUT canonical text, OUT accepted text[])
LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE card public.learning_vocabulary_cards; translated text; prompt text; plural text;
BEGIN
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=p_card_id;
 SELECT translation,context_sentence INTO translated,prompt FROM public.vocabulary_translations WHERE card_id=card.id AND locale=p_ui_language;
 translated:=vocabulary_private.card_translation(card.id,p_ui_language);
 IF card.sentence_practice AND p_direction='native_to_de' THEN
  SELECT context_sentence INTO canonical FROM public.vocabulary_translations WHERE card_id=card.id AND locale='de';
  IF nullif(btrim(prompt),'') IS NULL OR nullif(btrim(canonical),'') IS NULL THEN
   RAISE EXCEPTION 'sentence_content_missing' USING ERRCODE='23514'; END IF;
  accepted:=ARRAY[canonical]||coalesce(card.alternative_answers_de,ARRAY[]::text[]);
 ELSIF p_direction='native_to_de' THEN
  canonical:=concat_ws(' ',nullif(nullif(card.article::text,'none'),''),card.word_de);
  accepted:=ARRAY[canonical];
  -- Vokabeln werden oft als "der Papa / die Papas" gelernt. Für echte Nomen
  -- (mit Artikel) mit echtem Plural (nicht dem Platzhalter "-") gelten daher
  -- auch die Pluralform, der stehende Plural-Artikel "die" und die kombinierte
  -- Wörterbuchform als richtig. Der Singular bleibt die angezeigte Musterlösung.
  plural:=nullif(btrim(coalesce(card.plural,'')),'');
  IF card.article IS NOT NULL AND card.article::text<>'none'
     AND plural IS NOT NULL AND plural NOT IN ('-','–','—') THEN
   accepted:=accepted
     ||('die '||plural)
     ||plural
     ||(canonical||' / die '||plural)
     ||(canonical||', die '||plural);
  END IF;
 ELSE
  canonical:=translated; accepted:=ARRAY[canonical];
 END IF;
 IF nullif(btrim(canonical),'') IS NULL THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='23514'; END IF;
END $$;

-- Aus 22_vocabulary_phase6_rules.sql; neu ist nur die Zeile mit card_translation.
CREATE OR REPLACE FUNCTION vocabulary_private.submit_self_rating(p_progress_id uuid, p_known boolean, p_ui_language text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 profile public.profiles; canonical text; translated text; previous_card uuid;
 sentence boolean; correct boolean; old_phase integer; new_phase integer; new_box integer; days integer; difficult boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF p_known IS NULL THEN RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
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
 sentence:=card.sentence_practice AND progress.direction='native_to_de';
 -- R5 guard: a self-rating is only valid where the server itself allows the
 -- flashcard mode. Seit Phase 5.9 ist das jede Karte, Satz eingeschlossen.
 IF NOT vocabulary_private.self_rating_allowed(progress.box_number,sentence) THEN
  RAISE EXCEPTION 'flashcard_not_allowed' USING ERRCODE='PT409'; END IF;
 translated:=vocabulary_private.card_translation(card.id,p_ui_language);
 IF sentence THEN
  SELECT context_sentence INTO canonical FROM public.vocabulary_translations WHERE card_id=card.id AND locale='de';
 ELSIF progress.direction='native_to_de' THEN
  canonical:=concat_ws(' ',nullif(nullif(card.article::text,'none'),''),card.word_de);
 ELSE
  canonical:=translated;
 END IF;
 IF nullif(btrim(canonical),'') IS NULL THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='23514'; END IF;
 correct:=p_known;
 old_phase:=least(6,greatest(1,coalesce(progress.box_number,1)));
 new_phase:=CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;
 new_box:=CASE WHEN correct AND old_phase=6 THEN 7 ELSE new_phase END;
 IF correct THEN
  days:=CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
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
  'correctAnswer',canonical,'isAlternative',false,'softError',null);
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.submit_self_rating(uuid,boolean,text) FROM PUBLIC;

-- Regression guards (R10, maschinenlesbar).
DO $migration$
BEGIN
 IF NOT has_function_privilege('authenticated','public.add_own_vocabulary(text,text,text,text,text)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.delete_own_vocabulary(uuid)','EXECUTE')
  OR NOT has_function_privilege('authenticated','vocabulary_private.add_own_word(text,text,text,text,text)','EXECUTE')
  OR NOT has_function_privilege('authenticated','vocabulary_private.delete_own_word(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'own_words_grant_missing' USING ERRCODE='42501';
 END IF;
 IF NOT has_function_privilege('postgres','vocabulary_private.card_translation(uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'own_words_translation_grant_missing'
   USING ERRCODE='42501', DETAIL='the legacy owner of submit_answer/submit_self_rating cannot resolve translations';
 END IF;
 IF has_function_privilege('anon','public.add_own_vocabulary(text,text,text,text,text)','EXECUTE')
  OR has_function_privilege('anon','public.delete_own_vocabulary(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'own_words_exposed_to_anon' USING ERRCODE='42501';
 END IF;
END $migration$;

-- ROLLBACK (R9): supabase/vps/rollback/23_vocabulary_own_words.sql. Vorher einen
-- Client ausrollen, der add_own_vocabulary/delete_own_vocabulary nicht mehr
-- aufruft. Der Rollback LÖSCHT alle eigenen Wörter samt Lernstand.
