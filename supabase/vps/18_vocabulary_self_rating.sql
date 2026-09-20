-- Phase 5.x. Backup with migrate-local.py before applying. migrate-local wraps
-- regular files in one transaction; every statement here is idempotent.
-- Rollback: supabase/vps/rollback/18_vocabulary_self_rating.sql.
--
-- Mixed trainer modes without weakening R5. The typed path (submit_answer)
-- always grades stored content; the client never decides a typed result. This
-- migration adds a *self-rating* path for the flashcard mode ("Kenn ich /
-- Kenn ich nicht"). The learner's self-report is an INPUT; PostgreSQL still
-- DETERMINES the box, interval and next review from it, exactly like the
-- onboarding assessment. Two guards keep it manipulation-safe:
--   1. The mode is derived here from the card's current Leitner box, the same
--      rule the session read uses. A client cannot self-rate a card that must
--      be typed — sentences and boxes above the flashcard band are rejected.
--   2. Idempotency reuses answer_receipts, so a retried request returns the
--      already committed receipt instead of moving the box twice.

-- Flashcard band: only the two lowest boxes use recognition; higher boxes and
-- every sentence stay on typed recall. Keep this identical to the TypeScript
-- helper lib/leitner.ts:vocabularyReviewMode and the session read.
CREATE OR REPLACE FUNCTION vocabulary_private.self_rating_allowed(p_box integer, p_sentence boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
 SELECT NOT p_sentence AND least(6,greatest(1,coalesce(p_box,1))) <= 2
$$;
REVOKE ALL ON FUNCTION vocabulary_private.self_rating_allowed(integer,boolean) FROM PUBLIC;

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
 -- R5 guard: a self-rating is only valid where the server itself puts the card
 -- in flashcard mode. Otherwise the learner must type an answer that is graded.
 IF NOT vocabulary_private.self_rating_allowed(progress.box_number,sentence) THEN
  RAISE EXCEPTION 'flashcard_not_allowed' USING ERRCODE='PT409'; END IF;
 SELECT translation INTO translated FROM public.vocabulary_translations WHERE card_id=card.id AND locale=p_ui_language;
 IF progress.direction='native_to_de' THEN
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

CREATE OR REPLACE FUNCTION vocabulary_private.submit_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=auth.uid(); receipt vocabulary_private.answer_receipts; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_progress_id IS NULL OR p_known IS NULL OR p_ui_language IS NULL
  OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  WHERE v.id=p_progress_id AND v.auth_user_id=actor AND learning_private.unit_allowed(c.unit_id)) THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_ui_language='de' THEN RAISE EXCEPTION 'invalid_learning_language' USING ERRCODE='42501'; END IF;
 -- Self-rating receipts share the table; they carry a null typed answer.
 SELECT * INTO receipt FROM vocabulary_private.answer_receipts WHERE auth_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.progress_id IS DISTINCT FROM p_progress_id OR receipt.is_correct IS DISTINCT FROM p_known
   OR receipt.typed_answer IS NOT NULL OR receipt.ui_language IS DISTINCT FROM p_ui_language THEN
   RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE='22023'; END IF;
  IF NOT receipt.response ? 'correctAnswer' OR NOT receipt.response ? 'softError' THEN
   RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
  RETURN receipt.response;
 END IF;
 result:=vocabulary_private.submit_self_rating(p_progress_id,p_known,p_ui_language);
 PERFORM platform_private.require_rpc_success(result);
 INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response)
 VALUES(actor,p_request_id,p_progress_id,p_known,NULL,p_ui_language,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.submit_self_rating_once(uuid,uuid,boolean,text) FROM PUBLIC;

-- Public boundary wrapper: stable domain codes only, never raw SQL text.
CREATE OR REPLACE FUNCTION public.submit_vocabulary_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text DEFAULT 'de'::text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE boundary_state text; boundary_message text; boundary_code text;
BEGIN
 RETURN to_jsonb((SELECT vocabulary_private.submit_self_rating_once(p_request_id,p_progress_id,p_known,p_ui_language)));
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','trainer_access_denied','flashcard_not_allowed','invalid_language',
   'answer_required','progress_not_found','review_not_due','vocabulary_spacing_required',
   'exercise_unavailable','invalid_answer_request','invalid_learning_language',
   'vocabulary_request_conflict','not_authorized','not_authenticated','invalid_input',
   'request_failed','conflict','not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_code='vocabulary_spacing_required' THEN 'Review another card before this card.'
   WHEN boundary_code='review_not_due' THEN 'This review is not due yet.'
   WHEN boundary_code='flashcard_not_allowed' THEN 'This card must be typed, not self-rated.'
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END $$;
REVOKE ALL ON FUNCTION public.submit_vocabulary_self_rating_once(uuid,uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_vocabulary_self_rating_once(uuid,uuid,boolean,text) TO authenticated,service_role;
