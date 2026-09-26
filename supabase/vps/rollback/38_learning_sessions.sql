-- Roll back 39 first and deploy a client without Phase7 analytics before this.
-- R9: preserve all daily totals and archive raw sessions, never delete history.
DROP TRIGGER IF EXISTS learning_session_vocabulary ON public.vocabulary_direction_progress;
DROP TRIGGER IF EXISTS learning_session_grammar ON public.user_exercise_progress;
DROP TRIGGER IF EXISTS learning_session_path_practice ON path_private.answer_receipts;
DROP TRIGGER IF EXISTS learning_session_path_test ON public.path_test_answers;
DROP TRIGGER IF EXISTS learning_session_pronunciation ON public.submissions;
DROP TRIGGER IF EXISTS learning_session_pronunciation_reply ON public.pronunciation_messages;
DROP TRIGGER IF EXISTS learning_session_day_lock ON public.learning_activity_days;
DROP FUNCTION IF EXISTS learning_private.lock_activity_day();
DO $$ DECLARE saved record; BEGIN
 FOR saved IN SELECT definition FROM learning_private.session_function_backups LOOP EXECUTE saved.definition; END LOOP;
END $$;
UPDATE public.learning_sessions SET is_active=false;
DROP POLICY IF EXISTS learning_sessions_read ON public.learning_sessions;
REVOKE ALL ON public.learning_sessions FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS learning_activity_days_staff_read ON public.learning_activity_days;
DROP FUNCTION IF EXISTS learning_private.capture_learning_session();
DROP FUNCTION IF EXISTS learning_private.record_learning_event(uuid,public.learning_session_mode,text,timestamptz);
-- Retain retention cleanup even after rollback through the preexisting
-- learning-day writes. Service maintenance can also invoke the private helper.
CREATE OR REPLACE FUNCTION learning_private.prune_sessions_on_activity_day() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM learning_private.prune_learning_sessions(); RETURN NULL; END $$;
REVOKE ALL ON FUNCTION learning_private.prune_sessions_on_activity_day() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS learning_sessions_archived_retention ON public.learning_activity_days;
CREATE TRIGGER learning_sessions_archived_retention AFTER INSERT ON public.learning_activity_days
 FOR EACH STATEMENT EXECUTE FUNCTION learning_private.prune_sessions_on_activity_day();
