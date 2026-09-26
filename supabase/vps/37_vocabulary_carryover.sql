-- Master 4, Phase 5: carry started, unfinished words into a later level.
-- Apply only through deploy/vps/migrate-local.py after its verified R8 backup.
-- No vocabulary/progress is copied. Broad catalog/RLS grants remain unchanged.
-- Rollback: rollback/37_vocabulary_carryover.sql (archives preferences).

-- A first-ever prompt must not reappear for established learners at rollout.
-- Only reliable historical activity counts: a scored review, an explicitly
-- completed assessment, or a box above 1 (including an assessment as known).
-- All-new assessment rows are indistinguishable from bulk initialization in
-- the historic schema; do not invent an activity date for untouched box 1.
DO $$ DECLARE initial_install boolean:=to_regclass('public.vocabulary_carryover_preferences') IS NULL; BEGIN
CREATE TABLE IF NOT EXISTS public.vocabulary_carryover_preferences(
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 target_level text NOT NULL REFERENCES public.learning_levels(code),
 enabled boolean NOT NULL DEFAULT false,
 started_at timestamptz,
 decided_at timestamptz,
 is_active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(auth_user_id,target_level));
 IF initial_install THEN
  INSERT INTO public.vocabulary_carryover_preferences(auth_user_id,target_level,enabled,started_at,decided_at)
  SELECT auth_user_id,level,false,min(moment),min(moment) FROM (
   SELECT p.auth_user_id,u.level,coalesce(p.last_answered_at,p.created_at,p.updated_at,now()) moment
    FROM public.vocabulary_direction_progress p JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
    JOIN public.learning_units u ON u.id=c.unit_id
    WHERE p.last_answered_at IS NOT NULL OR p.box_number>1
   UNION ALL
   SELECT auth_user_id,level,updated_at FROM public.vocabulary_onboarding WHERE status='completed'
  ) evidence GROUP BY auth_user_id,level ON CONFLICT DO NOTHING;
 END IF;
END $$;
DROP TRIGGER IF EXISTS learning_reset_guard ON public.vocabulary_carryover_preferences;
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.vocabulary_carryover_preferences
 FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
ALTER TABLE public.vocabulary_carryover_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vocabulary_carryover_own_read ON public.vocabulary_carryover_preferences;
CREATE POLICY vocabulary_carryover_own_read ON public.vocabulary_carryover_preferences
 FOR SELECT TO authenticated USING(auth_user_id=(SELECT auth.uid()) AND is_active);
REVOKE ALL ON public.vocabulary_carryover_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vocabulary_carryover_preferences TO authenticated;
GRANT ALL ON public.vocabulary_carryover_preferences TO service_role;

CREATE TABLE IF NOT EXISTS vocabulary_private.carryover_function_backups(
 signature text PRIMARY KEY, definition text NOT NULL);
ALTER TABLE vocabulary_private.carryover_function_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vocabulary_private.carryover_function_backups FROM PUBLIC,anon,authenticated;
-- Bind idempotent receipts to the selected target; historical receipts retain NULL.
ALTER TABLE vocabulary_private.answer_receipts ADD COLUMN IF NOT EXISTS target_level text REFERENCES public.learning_levels(code);

CREATE OR REPLACE FUNCTION vocabulary_private.carryover_error(p_message text,p_state text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('error',CASE WHEN p_message=ANY(ARRAY[
  'authentication_required','trainer_access_denied','invalid_input','invalid_language','answer_required',
  'answer_too_long','progress_not_found','review_not_due','vocabulary_spacing_required',
  'exercise_unavailable','invalid_answer_request','invalid_learning_language','vocabulary_request_conflict',
  'retry_not_available','flashcard_not_allowed','sentence_content_missing','learning_reset_in_progress'])
 THEN p_message WHEN p_state='42501' THEN 'not_authorized' ELSE 'request_failed' END,
 'message','The vocabulary request could not be completed.','sqlstate',p_state)
$$;

-- This guard deliberately authorizes the target, never an incidental source grant.
-- It is called before receipt lookup too, so switching off revokes cached answers.
-- Completed rows remain authorized for an exact receipt/retry; fresh grading
-- still rejects box 7 and candidate reads exclude fully learned words.
CREATE OR REPLACE FUNCTION vocabulary_private.progress_allowed(p_progress_id uuid,p_target_level text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress p
  JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
  JOIN public.learning_units u ON u.id=c.unit_id
  JOIN public.learning_levels source ON source.code=u.level
  JOIN public.learning_levels target ON target.code=p_target_level
  WHERE p.id=p_progress_id AND p.auth_user_id=(SELECT auth.uid())
   AND target.is_active AND trainer_access_private.allowed(target.code,'vocabulary')
   AND u.trainer='vocabulary' AND u.is_active
   AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=(SELECT auth.uid()))
   AND CASE WHEN u.level=p_target_level THEN learning_private.unit_allowed(u.id)
    ELSE source.sort_order<target.sort_order
     AND EXISTS(SELECT 1 FROM public.vocabulary_carryover_preferences pref
      WHERE pref.auth_user_id=p.auth_user_id AND pref.target_level=p_target_level AND pref.enabled AND pref.is_active)
     AND NOT EXISTS(SELECT 1 FROM public.vocabulary_lesson_pauses paused
      WHERE paused.auth_user_id=p.auth_user_id AND paused.unit_id=u.id) END)
$$;

-- Dedicated card-level read boundary: a source unit grant would expose never
-- started course words or somebody else's private unit. Never widen unit_allowed.
CREATE OR REPLACE FUNCTION vocabulary_private.carryover_candidates(p_target_level text)
RETURNS TABLE(card_id uuid,origin_level text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT c.id,u.level FROM public.learning_vocabulary_cards c
 JOIN public.learning_units u ON u.id=c.unit_id
 JOIN public.learning_levels source ON source.code=u.level
 JOIN public.learning_levels target ON target.code=p_target_level
 JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=(SELECT auth.uid())
 WHERE target.is_active AND trainer_access_private.allowed(target.code,'vocabulary')
  AND source.sort_order<target.sort_order AND u.trainer='vocabulary' AND u.is_active
  AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=(SELECT auth.uid()))
  AND NOT EXISTS(SELECT 1 FROM public.vocabulary_lesson_pauses paused
   WHERE paused.auth_user_id=p.auth_user_id AND paused.unit_id=u.id)
 GROUP BY c.id,u.level,source.sort_order
 HAVING count(*) FILTER(WHERE p.box_number=7)<2
 ORDER BY source.sort_order,c.id
$$;

CREATE OR REPLACE FUNCTION public.get_vocabulary_carryover(p_target_level text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); pref public.vocabulary_carryover_preferences; cards jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_target_level IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_target_level AND is_active)
 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 IF NOT trainer_access_private.allowed(p_target_level,'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO pref FROM public.vocabulary_carryover_preferences WHERE auth_user_id=actor AND target_level=p_target_level AND is_active;
 SELECT coalesce(jsonb_agg(jsonb_build_object('cardId',card_id,'originLevel',origin_level)),'[]') INTO cards
 FROM vocabulary_private.carryover_candidates(p_target_level);
 RETURN jsonb_build_object('success',true,'targetLevel',p_target_level,'enabled',coalesce(pref.enabled,false),
  'startedAt',pref.started_at,'decidedAt',pref.decided_at,
  'promptRequired',pref.started_at IS NOT NULL AND pref.decided_at IS NULL AND jsonb_array_length(cards)>0,'cards',cards);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.begin_vocabulary_level(p_target_level text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); state jsonb; moment timestamptz:=clock_timestamp();
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 state:=public.get_vocabulary_carryover(p_target_level); PERFORM platform_private.require_rpc_success(state);
 INSERT INTO public.vocabulary_carryover_preferences(auth_user_id,target_level,started_at,decided_at)
 VALUES(actor,p_target_level,moment,CASE WHEN jsonb_array_length(state->'cards')=0 THEN moment END)
 ON CONFLICT(auth_user_id,target_level) DO UPDATE SET
  started_at=CASE WHEN vocabulary_carryover_preferences.is_active THEN coalesce(vocabulary_carryover_preferences.started_at,moment) ELSE moment END,
  decided_at=CASE WHEN vocabulary_carryover_preferences.is_active THEN coalesce(vocabulary_carryover_preferences.decided_at,
   CASE WHEN vocabulary_carryover_preferences.started_at IS NULL AND jsonb_array_length(state->'cards')=0 THEN moment END)
   ELSE CASE WHEN jsonb_array_length(state->'cards')=0 THEN moment END END,
  enabled=CASE WHEN vocabulary_carryover_preferences.is_active THEN vocabulary_carryover_preferences.enabled ELSE false END,is_active=true;
 RETURN public.get_vocabulary_carryover(p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.set_vocabulary_carryover(p_target_level text,p_enabled boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); state jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 state:=public.get_vocabulary_carryover(p_target_level); PERFORM platform_private.require_rpc_success(state);
 INSERT INTO public.vocabulary_carryover_preferences(auth_user_id,target_level,enabled,decided_at)
 VALUES(actor,p_target_level,p_enabled,clock_timestamp())
 ON CONFLICT(auth_user_id,target_level) DO UPDATE SET enabled=excluded.enabled,decided_at=excluded.decided_at,is_active=true;
 RETURN public.get_vocabulary_carryover(p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.get_vocabulary_carryover_cards(p_target_level text,p_offset integer DEFAULT 0,p_limit integer DEFAULT 500) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); state jsonb; cards jsonb; progress jsonb; selected_ids uuid[];
BEGIN
 state:=public.get_vocabulary_carryover(p_target_level); PERFORM platform_private.require_rpc_success(state);
 IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500
 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT coalesce(array_agg(card_id),'{}') INTO selected_ids FROM(
  SELECT card_id FROM vocabulary_private.carryover_candidates(p_target_level) LIMIT p_limit OFFSET p_offset) selected;
 SELECT coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('unit',jsonb_build_object(
  'id',u.id,'level',u.level,'label',u.label,'sort_order',u.sort_order,'is_active',u.is_active,'owner_auth_user_id',u.owner_auth_user_id),
  'translations',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.locale),'[]') FROM public.vocabulary_translations t WHERE t.card_id=c.id))
  ORDER BY c.id),'[]') INTO cards FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id WHERE c.id=ANY(selected_ids);
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') INTO progress FROM public.vocabulary_direction_progress p
 WHERE p.auth_user_id=actor AND p.card_id=ANY(selected_ids);
 RETURN jsonb_build_object('success',true,'cards',cards,'progress',progress);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;

-- Latest complete grading bodies, copied from 30 (typed/retry), 23 (self),
-- 06 (typed receipt) and 18 (self receipt). Only authorization/context changes.

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid,p_is_correct boolean,p_typed_answer text,p_ui_language text, p_target_level text) RETURNS jsonb
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
 IF NOT vocabulary_private.progress_allowed(progress.id,p_target_level) OR p_ui_language='de' THEN
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

CREATE OR REPLACE FUNCTION vocabulary_private.check_retry_answer(p_progress_id uuid, p_typed_answer text, p_ui_language text, p_target_level text)
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
 IF NOT vocabulary_private.progress_allowed(progress.id,p_target_level) OR p_ui_language='de' THEN
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

CREATE OR REPLACE FUNCTION vocabulary_private.submit_self_rating(p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text)
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
 IF NOT vocabulary_private.progress_allowed(progress.id,p_target_level) OR p_ui_language='de' THEN
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

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid,p_progress_id uuid,p_is_correct boolean,p_typed_answer text,p_ui_language text, p_target_level text) RETURNS jsonb
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
  WHERE v.id=p_progress_id AND v.auth_user_id=actor AND vocabulary_private.progress_allowed(v.id,p_target_level)) THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_ui_language='de' THEN RAISE EXCEPTION 'invalid_learning_language' USING ERRCODE='42501'; END IF;
 SELECT * INTO receipt FROM vocabulary_private.answer_receipts WHERE auth_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.progress_id IS DISTINCT FROM p_progress_id OR receipt.is_correct IS DISTINCT FROM p_is_correct
   OR convert_to(receipt.typed_answer,'UTF8') IS DISTINCT FROM convert_to(p_typed_answer,'UTF8')
   OR receipt.ui_language IS DISTINCT FROM p_ui_language OR receipt.target_level IS DISTINCT FROM p_target_level THEN
   RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE='22023'; END IF;
  IF NOT receipt.response ? 'correctAnswer' OR NOT receipt.response ? 'softError' THEN
   RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
  -- Return before due/spacing checks; the already committed response is final.
  RETURN receipt.response;
 END IF;
 result:=vocabulary_private.submit_answer(p_progress_id,p_is_correct,p_typed_answer,p_ui_language,p_target_level);
 PERFORM platform_private.require_rpc_success(result);
 INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response,target_level)
 VALUES(actor,p_request_id,p_progress_id,p_is_correct,p_typed_answer,p_ui_language,result,p_target_level);
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION vocabulary_private.submit_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=auth.uid(); receipt vocabulary_private.answer_receipts; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_progress_id IS NULL OR p_known IS NULL OR p_ui_language IS NULL
  OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  WHERE v.id=p_progress_id AND v.auth_user_id=actor AND vocabulary_private.progress_allowed(v.id,p_target_level)) THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_ui_language='de' THEN RAISE EXCEPTION 'invalid_learning_language' USING ERRCODE='42501'; END IF;
 -- Self-rating receipts share the table; they carry a null typed answer.
 SELECT * INTO receipt FROM vocabulary_private.answer_receipts WHERE auth_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.progress_id IS DISTINCT FROM p_progress_id OR receipt.is_correct IS DISTINCT FROM p_known
   OR receipt.typed_answer IS NOT NULL OR receipt.ui_language IS DISTINCT FROM p_ui_language OR receipt.target_level IS DISTINCT FROM p_target_level THEN
   RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE='22023'; END IF;
  IF NOT receipt.response ? 'correctAnswer' OR NOT receipt.response ? 'softError' THEN
   RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
  RETURN receipt.response;
 END IF;
 result:=vocabulary_private.submit_self_rating(p_progress_id,p_known,p_ui_language,p_target_level);
 PERFORM platform_private.require_rpc_success(result);
 INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response,target_level)
 VALUES(actor,p_request_id,p_progress_id,p_known,NULL,p_ui_language,result,p_target_level);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.submit_vocabulary_answer(p_progress_id uuid,p_is_correct boolean,p_typed_answer text,p_ui_language text,p_target_level text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN vocabulary_private.submit_answer(p_progress_id,p_is_correct,p_typed_answer,p_ui_language,p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid,p_progress_id uuid,p_is_correct boolean,p_typed_answer text,p_ui_language text,p_target_level text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN vocabulary_private.submit_answer_once(p_request_id,p_progress_id,p_is_correct,p_typed_answer,p_ui_language,p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.submit_vocabulary_self_rating_once(p_request_id uuid,p_progress_id uuid,p_known boolean,p_ui_language text,p_target_level text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN vocabulary_private.submit_self_rating_once(p_request_id,p_progress_id,p_known,p_ui_language,p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.check_vocabulary_retry(p_progress_id uuid,p_typed_answer text,p_ui_language text,p_target_level text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN vocabulary_private.check_retry_answer(p_progress_id,p_typed_answer,p_ui_language,p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;

-- Preserve the Phase-3 path reset extensions and capture them only once.
DO $$ DECLARE saved_signature text; body text; marker text:='DELETE FROM public.user_exercise_progress'; BEGIN
 FOREACH saved_signature IN ARRAY ARRAY['learning_private.reset_student_level(uuid,text)','learning_reset_private.finish_reset(uuid)'] LOOP
  INSERT INTO vocabulary_private.carryover_function_backups VALUES(saved_signature,pg_get_functiondef(saved_signature::regprocedure)) ON CONFLICT DO NOTHING;
 END LOOP;
 SELECT definition INTO body FROM vocabulary_private.carryover_function_backups WHERE signature='learning_private.reset_student_level(uuid,text)';
 IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'carryover_level_reset_drift'; END IF;
 EXECUTE replace(body,marker,'DELETE FROM public.vocabulary_carryover_preferences WHERE auth_user_id=p_student_id AND target_level=p_level; '||marker);
 SELECT definition INTO body FROM vocabulary_private.carryover_function_backups WHERE signature='learning_reset_private.finish_reset(uuid)';
 IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'carryover_full_reset_drift'; END IF;
 EXECUTE replace(body,marker,'DELETE FROM public.vocabulary_carryover_preferences WHERE auth_user_id=actor; '||marker);
END $$;

-- Only JSONB public boundaries are exposed. Private helpers and contextual
-- grading bodies remain callable by the definer, not directly by a client.

REVOKE ALL ON FUNCTION vocabulary_private.carryover_error(text,text) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION vocabulary_private.progress_allowed(uuid,text) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION vocabulary_private.carryover_candidates(text) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION vocabulary_private.submit_answer(uuid,boolean,text,text,text) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION vocabulary_private.check_retry_answer(uuid,text,text,text) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION vocabulary_private.submit_self_rating(uuid,boolean,text,text) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION vocabulary_private.submit_answer_once(uuid,uuid,boolean,text,text,text) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION vocabulary_private.submit_self_rating_once(uuid,uuid,boolean,text,text) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.get_vocabulary_carryover(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_vocabulary_carryover(text) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.begin_vocabulary_level(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_vocabulary_level(text) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.set_vocabulary_carryover(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_vocabulary_carryover(text,boolean) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.get_vocabulary_carryover_cards(text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_vocabulary_carryover_cards(text,integer,integer) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.submit_vocabulary_answer(uuid,boolean,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_vocabulary_answer(uuid,boolean,text,text,text) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.submit_vocabulary_answer_once(uuid,uuid,boolean,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_vocabulary_answer_once(uuid,uuid,boolean,text,text,text) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.submit_vocabulary_self_rating_once(uuid,uuid,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_vocabulary_self_rating_once(uuid,uuid,boolean,text,text) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.check_vocabulary_retry(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_vocabulary_retry(uuid,text,text,text) TO authenticated,service_role;
