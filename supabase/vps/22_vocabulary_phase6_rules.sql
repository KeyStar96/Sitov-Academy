-- Phase 5.10. Backup with migrate-local.py before applying. migrate-local wraps
-- regular files in one transaction; every statement here is idempotent.
-- Rollback: supabase/vps/rollback/22_vocabulary_phase6_rules.sql.
--
-- Der Karteikasten folgt jetzt den Kernregeln des Phase-6-Systems:
--
--   1. Ein falscher erster Versuch stuft um genau eine Phase zurück (mindestens
--      Phase 1) und macht die Vokabel am NÄCHSTEN TAG wieder fällig. Bisher
--      bekam sie das Intervall der niedrigeren Phase — ein Fehler in Phase 6
--      schob die Vokabel 29 Tage weg, statt sie morgen erneut abzufragen.
--
--   2. Termine liegen auf Kalendertagen (Europe/Berlin). „1 Tag" heißt „ab
--      morgen früh", nicht „in exakt 24 Stunden". Wer heute um 20 Uhr lernt,
--      bekommt die Vokabel morgen auch um 9 Uhr — sonst verschöbe sich jede
--      Wiederholung um einen ganzen Tag, sobald man morgens früher lernt.
--      Zugleich zählt damit nur der ERSTE Versuch des Tages: Nach jeder
--      gewerteten Antwort ist die Karte frühestens ab morgen wieder fällig.
--
--   3. Wiederholen in derselben Sitzung. Eine falsch beantwortete Vokabel wird
--      in der laufenden Sitzung so lange erneut gezeigt, bis sie einmal richtig
--      beantwortet ist. Diese Wiederholungen ändern Phase und Termin NICHT.
--      `check_retry_answer` bewertet eine getippte Wiederholung dafür aus dem
--      gespeicherten Inhalt (R5), ohne etwas zu schreiben — und nur, nachdem der
--      gewertete Versuch des Tages schon gespeichert ist.
--
-- Unverändert bleiben: Intervalle 1/3/9/29/90 beim Aufstieg (≈132 Tage bis
-- „gelernt"), halbierte Intervalle für kontrastiv schwere Vokabeln, der
-- Tippfehler-Deckel (ein weicher Fehler steigt auf, behält aber das bisherige
-- Intervall) und die Abstandsregel zwischen den beiden Richtungen.
--
-- lib/leitner.ts:applyLeitnerAnswer spiegelt diese Regeln und muss mit dieser
-- Datei deckungsgleich bleiben.

-- (2) Beginn des Kalendertags in p_days Tagen, deutsche Zeit. Sommerzeit ist
-- eingerechnet: Der Wechsel passiert in der lokalen Wanduhr, nicht in UTC.
CREATE OR REPLACE FUNCTION vocabulary_private.review_day(p_days integer)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path TO '' AS $$
 SELECT (date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') + make_interval(days => p_days)) AT TIME ZONE 'Europe/Berlin'
$$;
REVOKE ALL ON FUNCTION vocabulary_private.review_day(integer) FROM PUBLIC;

-- Musterlösung und angenommene Antworten einer Karte in einer Richtung. Aus
-- 21_vocabulary_sentence_learner_choice.sql:submit_answer herausgelöst, damit
-- der gewertete Versuch und die Wiederholung garantiert gleich bewerten.
CREATE OR REPLACE FUNCTION vocabulary_private.answer_key(p_card_id uuid, p_direction text, p_ui_language text,
 OUT canonical text, OUT accepted text[])
LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE card public.learning_vocabulary_cards; translated text; prompt text; plural text;
BEGIN
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=p_card_id;
 SELECT translation,context_sentence INTO translated,prompt FROM public.vocabulary_translations WHERE card_id=card.id AND locale=p_ui_language;
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
REVOKE ALL ON FUNCTION vocabulary_private.answer_key(uuid,text,text) FROM PUBLIC;

-- Live gehört submit_answer noch dem Alt-Eigentümer postgres (NOSUPERUSER),
-- neue Hilfsfunktionen gehören supabase_admin. Ohne diese beiden Rechte liefe
-- jede getippte Antwort in 42501 — genau der Fehler, den 15 behoben hat.
GRANT EXECUTE ON FUNCTION vocabulary_private.review_day(integer),
 vocabulary_private.answer_key(uuid,text,text) TO postgres;

-- (1)/(2) Getippter, gewerteter Versuch.
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

-- (1)/(2) Karteikarte „Wusste ich / Wusste ich nicht", gewerteter Versuch.
-- Ansonsten wörtlich aus 21_vocabulary_sentence_learner_choice.sql.
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
 SELECT translation INTO translated FROM public.vocabulary_translations WHERE card_id=card.id AND locale=p_ui_language;
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

-- (3) Wiederholung in derselben Sitzung: bewertet eine getippte Antwort aus dem
-- gespeicherten Inhalt, schreibt aber nichts. Erlaubt nur, wenn der gewertete
-- Versuch des Tages schon gespeichert ist — so lässt sich die Lösung nicht vor
-- dem ersten Versuch „ertasten", und Phase und Termin bleiben unberührt.
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
REVOKE ALL ON FUNCTION vocabulary_private.check_retry_answer(uuid,text,text) FROM PUBLIC;
-- Der öffentliche Wrapper ist SECURITY INVOKER; ohne dieses Recht liefe jede
-- Wiederholung in 42501 (vgl. 19_vocabulary_self_rating_fix.sql).
GRANT EXECUTE ON FUNCTION vocabulary_private.check_retry_answer(uuid,text,text) TO authenticated;

-- Public boundary wrapper: stable domain codes only, never raw SQL text.
CREATE OR REPLACE FUNCTION public.check_vocabulary_retry(p_progress_id uuid, p_typed_answer text, p_ui_language text DEFAULT 'de'::text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE boundary_state text; boundary_message text; boundary_code text;
BEGIN
 RETURN to_jsonb((SELECT vocabulary_private.check_retry_answer(p_progress_id,p_typed_answer,p_ui_language)));
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','trainer_access_denied','invalid_language','answer_required','answer_too_long',
   'progress_not_found','retry_not_available','exercise_unavailable','sentence_content_missing',
   'not_authorized','not_authenticated','invalid_input','request_failed','conflict','not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_code='retry_not_available' THEN 'Answer the scheduled review of this card first.'
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END $$;
REVOKE ALL ON FUNCTION public.check_vocabulary_retry(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_vocabulary_retry(uuid,text,text) TO authenticated, service_role;

-- Regression guards (R10, maschinenlesbar): fehlende Rechte würden den Trainer
-- live mit „konnte nicht gespeichert werden" stilllegen; ein falscher Tag würde
-- „am nächsten Tag" still zu „heute" oder „übermorgen" machen.
DO $migration$
BEGIN
 IF NOT has_function_privilege('postgres','vocabulary_private.review_day(integer)','EXECUTE')
  OR NOT has_function_privilege('postgres','vocabulary_private.answer_key(uuid,text,text)','EXECUTE') THEN
  RAISE EXCEPTION 'phase6_helper_grant_missing'
   USING ERRCODE='42501', DETAIL='the legacy owner of submit_answer cannot execute the new helpers';
 END IF;
 IF NOT has_function_privilege('authenticated','vocabulary_private.check_retry_answer(uuid,text,text)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.check_vocabulary_retry(uuid,text,text)','EXECUTE') THEN
  RAISE EXCEPTION 'phase6_retry_grant_missing' USING ERRCODE='42501';
 END IF;
 IF has_function_privilege('anon','public.check_vocabulary_retry(uuid,text,text)','EXECUTE') THEN
  RAISE EXCEPTION 'phase6_retry_exposed_to_anon' USING ERRCODE='42501';
 END IF;
 IF NOT (vocabulary_private.review_day(1)>now() AND vocabulary_private.review_day(1)<=now()+interval '25 hours'
  AND vocabulary_private.review_day(0)<=now()) THEN
  RAISE EXCEPTION 'phase6_review_day_invalid' USING ERRCODE='23514';
 END IF;
END $migration$;

-- ROLLBACK (R9): supabase/vps/rollback/22_vocabulary_phase6_rules.sql stellt
-- submit_answer/submit_self_rating aus Migration 21 wieder her und entfernt die
-- neuen Funktionen. Vorher einen Client ausrollen, der check_vocabulary_retry
-- nicht mehr aufruft. Bereits gesetzte Termine bleiben gültige Zeitpunkte.
