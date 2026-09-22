-- Phase 5.9. Backup with migrate-local.py before applying. migrate-local wraps
-- regular files in one transaction; every statement here is idempotent.
-- Rollback: supabase/vps/rollback/21_vocabulary_sentence_learner_choice.sql.
--
-- Drei zusammenhängende Korrekturen am Vokabeltrainer:
--
--   1. Plural-Vokabeln als gültige Antwort. Bisher galt beim Ausschreiben nur
--      der Singular (Artikel + Wort). Wer "die Papas" oder die kombinierte
--      Wörterbuchform "der Papa / die Papas" tippte, bekam eine rote
--      Fehlermarkierung. `submit_answer` nimmt jetzt auch die Pluralform, den
--      stehenden Plural-Artikel "die" und die kombinierten Formen an.
--
--   2. Sätze werden wie Vokabeln behandelt. `self_rating_allowed` erzwang bei
--      Sätzen bislang das Ausschreiben (Migration 18/20: `NOT p_sentence`).
--      Sätze dürfen nun ebenfalls per Selbsteinschätzung ("Weiß ich / Weiß ich
--      nicht") gelernt werden; der Lernende wählt den Weg im Umschalter.
--
--   3. Karteikarten-Musterlösung für Sätze. `submit_self_rating` leitet die
--      `correctAnswer` eines Satzes jetzt aus dem deutschen Kontextsatz ab,
--      nicht mehr aus dem Einzelwort.
--
-- R5 bleibt unberührt: Der Client wählt nur den WEG. Der getippte Pfad
-- vergleicht weiterhin in PostgreSQL gegen den gespeicherten Inhalt, der
-- Karteikarten-Pfad nimmt die Selbsteinschätzung als EINGABE und leitet Fach,
-- Intervall und nächsten Termin selbst ab. Diese Datei muss deckungsgleich zu
-- lib/leitner.ts (vocabularyReviewMode/selfRatingAllowed) bleiben.

-- (1)/(2) Selbsteinschätzung ist jetzt für jede Karte erlaubt — Wort wie Satz.
-- Der einzige feste Weg (Deutsch → eigene Sprache) ist ohnehin die Karteikarte.
-- p_box/p_sentence bleiben in der Signatur, damit CREATE OR REPLACE greift und
-- der Aufrufer in submit_self_rating unverändert bleibt.
CREATE OR REPLACE FUNCTION vocabulary_private.self_rating_allowed(p_box integer, p_sentence boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
 SELECT true
$$;
REVOKE ALL ON FUNCTION vocabulary_private.self_rating_allowed(integer,boolean) FROM PUBLIC;

-- (1) Plural-Vokabeln annehmen. Nur der native_to_de-Wort-Zweig ändert sich;
-- alles andere ist wörtlich aus 06_soft_errors.sql übernommen.
CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid,p_is_correct boolean,p_typed_answer text,p_ui_language text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 profile public.profiles; canonical text; translated text; prompt text; previous_card uuid; grade jsonb;
 accepted text[]; correct boolean; sentence boolean; soft boolean; old_phase integer; new_phase integer;
 new_box integer; days integer; previous_days integer; difficult boolean; is_alternative boolean:=false; plural text;
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

-- (2)/(3) Selbsteinschätzung auch für Sätze; die Musterlösung eines Satzes ist
-- der deutsche Kontextsatz. Ansonsten wörtlich aus 18_vocabulary_self_rating.sql.
CREATE OR REPLACE FUNCTION vocabulary_private.submit_self_rating(p_progress_id uuid, p_known boolean, p_ui_language text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 profile public.profiles; canonical text; translated text; prompt text; previous_card uuid;
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
 days:=CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
 SELECT coalesce(t.is_difficult,false) INTO difficult FROM public.vocabulary_translations t WHERE t.card_id=card.id AND t.locale=profile.native_language;
 IF difficult THEN days:=greatest(1,days/2); END IF;
 UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=now()+make_interval(days=>days),
  lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now() WHERE id=progress.id;
 INSERT INTO public.vocabulary_learning_state(auth_user_id,last_card_id,last_reviewed_at) VALUES(actor,progress.card_id,now())
 ON CONFLICT(auth_user_id) DO UPDATE SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
  'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days,
  'correctAnswer',canonical,'isAlternative',false,'softError',null);
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.submit_self_rating(uuid,boolean,text) FROM PUBLIC;

-- Regression guard: jede Karte darf nun selbst eingeschätzt werden, Satz wie
-- Wort. Fällt das hier, ist der Umschalter in der UI nicht gedeckt und der
-- Trainer bräche live mit 'flashcard_not_allowed' ab. R10 — maschinenlesbar.
DO $migration$
DECLARE box integer;
BEGIN
 FOR box IN 1..7 LOOP
  IF NOT vocabulary_private.self_rating_allowed(box,false) THEN
   RAISE EXCEPTION 'self_rating_band_too_narrow'
    USING ERRCODE='23514', DETAIL=format('box %s rejects the flashcard mode the UI offers for words',box);
  END IF;
  IF NOT vocabulary_private.self_rating_allowed(box,true) THEN
   RAISE EXCEPTION 'self_rating_rejects_sentences'
    USING ERRCODE='23514', DETAIL=format('box %s rejects the flashcard mode the UI now offers for sentences',box);
  END IF;
 END LOOP;
END $migration$;

-- ROLLBACK (R9): supabase/vps/rollback/21_vocabulary_sentence_learner_choice.sql
-- stellt Migration 18/20 wieder her (Sätze wieder nur getippt, Plural wieder
-- abgelehnt). Vorher einen Client ausrollen, der den Satz-Umschalter nicht mehr
-- anbietet — sonst läuft jede Satz-Selbsteinschätzung in 'flashcard_not_allowed'.
