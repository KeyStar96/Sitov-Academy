-- Master 4 / Phase 7.3. LOCAL ONLY until explicitly authorized for production.
-- Apply with deploy/vps/migrate-local.py (verified backup before every run).
-- Sessions are inferred from committed answers, never clicks or keystrokes.
-- Duration is a conservative estimate between answers in the same mode/level:
-- a gap over five minutes starts a new session; no first-answer or idle tail
-- time is invented. Switching modes/levels also starts a new session.
DO $$ BEGIN
 IF to_regtype('public.learning_session_mode') IS NULL THEN
  CREATE TYPE public.learning_session_mode AS ENUM ('vocabulary','path','pronunciation');
 END IF;
END $$;

ALTER TABLE public.learning_activity_days ADD COLUMN IF NOT EXISTS study_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE public.learning_activity_days ADD COLUMN IF NOT EXISTS answer_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.learning_activity_days ADD COLUMN IF NOT EXISTS mode_seconds jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.learning_activity_days ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;
CREATE INDEX IF NOT EXISTS learning_activity_days_day_idx ON public.learning_activity_days(day,auth_user_id);
DROP TRIGGER IF EXISTS learning_sessions_archived_retention ON public.learning_activity_days;
DROP FUNCTION IF EXISTS learning_private.prune_sessions_on_activity_day();

CREATE TABLE IF NOT EXISTS public.learning_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 mode public.learning_session_mode NOT NULL,
 level text NOT NULL REFERENCES public.learning_levels(code),
 started_at timestamptz NOT NULL,
 ended_at timestamptz NOT NULL,
 answer_count integer NOT NULL DEFAULT 1 CHECK(answer_count>0),
 study_seconds integer NOT NULL DEFAULT 0 CHECK(study_seconds>=0),
 is_active boolean NOT NULL DEFAULT true,
 CHECK(ended_at>=started_at)
);
CREATE INDEX IF NOT EXISTS learning_sessions_user_end_idx ON public.learning_sessions(auth_user_id,ended_at DESC,id DESC) WHERE is_active;
CREATE INDEX IF NOT EXISTS learning_sessions_retention_idx ON public.learning_sessions(ended_at);
CREATE INDEX IF NOT EXISTS learning_sessions_level_idx ON public.learning_sessions(level);
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_sessions_read ON public.learning_sessions;
CREATE POLICY learning_sessions_read ON public.learning_sessions FOR SELECT TO authenticated
 USING(is_active AND (auth_user_id=(SELECT auth.uid()) OR (SELECT business_private.is_staff())));
REVOKE ALL ON public.learning_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.learning_sessions TO authenticated;
GRANT ALL ON public.learning_sessions TO service_role;
DROP POLICY IF EXISTS learning_activity_days_staff_read ON public.learning_activity_days;
CREATE POLICY learning_activity_days_staff_read ON public.learning_activity_days FOR SELECT TO authenticated
 USING((SELECT business_private.is_staff()));

-- Global indexed retention: a learning event by any person removes expired raw
-- sessions for everyone, including inactive accounts. Permanent daily totals
-- are written incrementally and never recomputed from the expiring raw rows.
CREATE OR REPLACE FUNCTION learning_private.prune_learning_sessions() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 DELETE FROM public.learning_sessions WHERE ended_at<statement_timestamp()-interval '180 days'
$$;
REVOKE ALL ON FUNCTION learning_private.prune_learning_sessions() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION learning_private.prune_learning_sessions() TO service_role;

-- The original migration24 AFTER triggers can touch a daily row before our
-- session trigger runs. Lock before that row is inserted, consistently with
-- path answers, so first-day concurrent modes cannot invert session/day locks.
CREATE OR REPLACE FUNCTION learning_private.lock_activity_day() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-session:'||NEW.auth_user_id::text,0));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION learning_private.lock_activity_day() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS learning_session_day_lock ON public.learning_activity_days;
CREATE TRIGGER learning_session_day_lock BEFORE INSERT ON public.learning_activity_days
 FOR EACH ROW EXECUTE FUNCTION learning_private.lock_activity_day();

-- Carryover records time against the level the learner is currently studying.
-- The progress row still belongs to its original level. Pass context only
-- immediately around its existing mutation; the AFTER trigger consumes it.
CREATE TABLE IF NOT EXISTS learning_private.session_function_backups(signature text PRIMARY KEY,definition text NOT NULL);
ALTER TABLE learning_private.session_function_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON learning_private.session_function_backups FROM PUBLIC,anon,authenticated;
DO $context$
DECLARE signature text; definition text; marker text:='UPDATE public.vocabulary_direction_progress SET box_number=new_box';
BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'vocabulary_private.submit_answer(uuid,boolean,text,text,text)',
  'vocabulary_private.submit_self_rating(uuid,boolean,text,text)'
 ] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
  IF position('learning.session_target_level' IN definition)>0 THEN CONTINUE; END IF;
  IF (length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 THEN
   RAISE EXCEPTION 'learning_session_function_drift' USING ERRCODE='22023';
  END IF;
  INSERT INTO learning_private.session_function_backups VALUES(signature,definition) ON CONFLICT DO NOTHING;
  EXECUTE replace(definition,marker,
   'PERFORM set_config(''learning.session_target_level'',coalesce(p_target_level,''''),true); '||marker);
 END LOOP;
END $context$;

CREATE OR REPLACE FUNCTION learning_private.record_learning_event(p_user uuid,p_mode public.learning_session_mode,p_level text,p_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.learning_sessions; starts timestamptz; ends timestamptz;
 day_start timestamptz; day_end timestamptz; seconds integer; added_seconds integer:=0; current_day date;
BEGIN
 IF p_user IS NULL OR p_level IS NULL OR p_at IS NULL THEN RETURN; END IF;
 -- Serialize all modes of one person, including concurrent tabs. This prevents
 -- overlapping sessions and lost increments without locking other learners.
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-session:'||p_user::text,0));
 PERFORM learning_private.prune_learning_sessions();
 SELECT * INTO previous FROM public.learning_sessions WHERE auth_user_id=p_user AND is_active
  ORDER BY ended_at DESC,id DESC LIMIT 1 FOR UPDATE;
 ends:=p_at;
 IF FOUND AND previous.mode=p_mode AND previous.level=p_level AND p_at>=previous.ended_at
  AND p_at-previous.ended_at<=interval '5 minutes' THEN
  starts:=previous.ended_at;
 ELSE
  starts:=p_at;
 END IF;

 -- Split elapsed seconds at local midnight, including 23/25-hour DST days.
 -- Round endpoints, not each gap, so rapid answers cannot lose fractions on
 -- every event. Only one daily row gets the answer count, on its actual day.
 current_day:=(starts AT TIME ZONE 'Europe/Berlin')::date;
 LOOP
  day_start:=current_day::timestamp AT TIME ZONE 'Europe/Berlin';
  day_end:=(current_day+1)::timestamp AT TIME ZONE 'Europe/Berlin';
  seconds:=greatest(0,floor(extract(epoch FROM least(ends,day_end)))::bigint
   -floor(extract(epoch FROM greatest(starts,day_start)))::bigint)::integer;
  added_seconds:=added_seconds+seconds;
  INSERT INTO public.learning_activity_days(auth_user_id,day,study_seconds,answer_count,mode_seconds,last_activity_at)
  VALUES(p_user,current_day,seconds,CASE WHEN current_day=(p_at AT TIME ZONE 'Europe/Berlin')::date THEN 1 ELSE 0 END,
   jsonb_build_object(p_mode::text,seconds),least(p_at,day_end))
  ON CONFLICT(auth_user_id,day) DO UPDATE SET
   study_seconds=public.learning_activity_days.study_seconds+excluded.study_seconds,
   answer_count=public.learning_activity_days.answer_count+excluded.answer_count,
   mode_seconds=jsonb_set(public.learning_activity_days.mode_seconds,ARRAY[p_mode::text],
    to_jsonb(coalesce((public.learning_activity_days.mode_seconds->>p_mode::text)::integer,0)+seconds),true),
   last_activity_at=greatest(public.learning_activity_days.last_activity_at,excluded.last_activity_at);
  EXIT WHEN current_day=(p_at AT TIME ZONE 'Europe/Berlin')::date;
  current_day:=current_day+1;
 END LOOP;

 IF previous.id IS NOT NULL AND starts=previous.ended_at AND previous.mode=p_mode AND previous.level=p_level
  AND p_at>=previous.ended_at AND p_at-previous.ended_at<=interval '5 minutes' THEN
  UPDATE public.learning_sessions SET ended_at=p_at,answer_count=answer_count+1,study_seconds=study_seconds+added_seconds WHERE id=previous.id;
 ELSE
  INSERT INTO public.learning_sessions(auth_user_id,mode,level,started_at,ended_at) VALUES(p_user,p_mode,p_level,p_at,p_at);
 END IF;
END $$;
REVOKE ALL ON FUNCTION learning_private.record_learning_event(uuid,public.learning_session_mode,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION learning_private.capture_learning_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE learner uuid; learning_level text; target_level text; learning_mode public.learning_session_mode; happened timestamptz:=clock_timestamp();
BEGIN
 IF TG_TABLE_NAME='vocabulary_direction_progress' THEN
  target_level:=nullif(current_setting('learning.session_target_level',true),'');
  PERFORM set_config('learning.session_target_level','',true);
  IF NEW.last_answered_at IS NULL OR (TG_OP='UPDATE' AND NEW.last_answered_at IS NOT DISTINCT FROM OLD.last_answered_at) THEN RETURN NULL; END IF;
  learner:=NEW.auth_user_id; learning_mode:='vocabulary'; happened:=NEW.last_answered_at;
  SELECT u.level INTO learning_level FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id WHERE c.id=NEW.card_id;
  learning_level:=coalesce(target_level,learning_level);
 ELSIF TG_TABLE_NAME='user_exercise_progress' THEN
  IF coalesce(NEW.attempts,0)=0 OR (TG_OP='UPDATE' AND NEW.attempts<=OLD.attempts) THEN RETURN NULL; END IF;
  learner:=NEW.auth_user_id; learning_mode:='path';
  SELECT u.level INTO learning_level FROM public.learning_exercises e JOIN public.learning_units u ON u.id=e.unit_id WHERE e.id=NEW.exercise_id;
 ELSIF TG_TABLE_SCHEMA='path_private' AND TG_TABLE_NAME='answer_receipts' THEN
  SELECT r.auth_user_id,u.level INTO learner,learning_level FROM public.path_practice_runs r
   JOIN public.path_nodes n ON n.id=r.node_id JOIN public.learning_units u ON u.id=n.unit_id WHERE r.id=NEW.run_id;
  learning_mode:='path';
 ELSIF TG_TABLE_NAME='path_test_answers' THEN
  SELECT a.auth_user_id,u.level INTO learner,learning_level FROM public.path_test_attempts a
   JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id WHERE a.id=NEW.attempt_id;
  learning_mode:='path'; happened:=NEW.answered_at;
 ELSIF TG_TABLE_NAME='submissions' THEN
  learner:=NEW.auth_user_id; learning_level:=NEW.level; learning_mode:='pronunciation'; happened:=NEW.created_at;
 ELSIF TG_TABLE_NAME='pronunciation_messages' THEN
  -- Follow-up learner recordings are learning; messages from teachers and
  -- conversational text are not. The first recording lives on submissions.
  IF NEW.sender_role<>'student' OR NEW.audio_path IS NULL THEN RETURN NULL; END IF;
  SELECT s.auth_user_id,s.level INTO learner,learning_level FROM public.submissions s WHERE s.id=NEW.submission_id AND s.auth_user_id=NEW.sender_id;
  learning_mode:='pronunciation'; happened:=NEW.created_at;
 ELSE RETURN NULL;
 END IF;
 PERFORM learning_private.record_learning_event(learner,learning_mode,learning_level,happened);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION learning_private.capture_learning_session() FROM PUBLIC,anon,authenticated,service_role;

DROP TRIGGER IF EXISTS learning_session_vocabulary ON public.vocabulary_direction_progress;
CREATE TRIGGER learning_session_vocabulary AFTER INSERT OR UPDATE OF last_answered_at ON public.vocabulary_direction_progress
 FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();
DROP TRIGGER IF EXISTS learning_session_grammar ON public.user_exercise_progress;
CREATE TRIGGER learning_session_grammar AFTER INSERT OR UPDATE OF attempts ON public.user_exercise_progress
 FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();
DROP TRIGGER IF EXISTS learning_session_path_practice ON path_private.answer_receipts;
CREATE TRIGGER learning_session_path_practice AFTER INSERT ON path_private.answer_receipts
 FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();
DROP TRIGGER IF EXISTS learning_session_path_test ON public.path_test_answers;
CREATE TRIGGER learning_session_path_test AFTER INSERT ON public.path_test_answers
 FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();
DROP TRIGGER IF EXISTS learning_session_pronunciation ON public.submissions;
CREATE TRIGGER learning_session_pronunciation AFTER INSERT ON public.submissions
 FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();
DROP TRIGGER IF EXISTS learning_session_pronunciation_reply ON public.pronunciation_messages;
CREATE TRIGGER learning_session_pronunciation_reply AFTER INSERT ON public.pronunciation_messages
 FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();

COMMENT ON TABLE public.learning_sessions IS 'Learning event sessions only. Raw rows expire after 180 days on any new learning event; durable Berlin daily totals remain in learning_activity_days.';
COMMENT ON COLUMN public.learning_activity_days.study_seconds IS 'Estimated answer-to-answer seconds since migration38; gaps over five minutes and time before first/after last answer are excluded. Historical days have zero, not reconstructed time.';
