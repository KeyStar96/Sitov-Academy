-- Rollback of supabase/vps/24_learning_activity_days.sql.
-- Roll out a client that no longer reads learning_activity_days or calls
-- pronunciation_reply_senders() first. Deletes the recorded learning days.
DROP TRIGGER IF EXISTS learning_activity_vocabulary ON public.vocabulary_direction_progress;
DROP TRIGGER IF EXISTS learning_activity_grammar ON public.user_exercise_progress;
DROP TRIGGER IF EXISTS learning_activity_pronunciation ON public.submissions;
DROP FUNCTION IF EXISTS learning_private.record_activity_day();
DROP FUNCTION IF EXISTS public.pronunciation_reply_senders();
DROP TABLE IF EXISTS public.learning_activity_days;
