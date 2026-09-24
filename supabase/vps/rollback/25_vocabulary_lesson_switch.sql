-- Rollback of supabase/vps/25_vocabulary_lesson_switch.sql.
-- Run atomically on the VPS with psql -1 after a fresh backup.
-- The app reads vocabulary_lesson_pauses fault-tolerantly: without the table
-- every started lesson counts as switched on, so no client rollout is needed
-- first. Switching a lesson off fails with a visible message until 25 is back.
-- Deletes the stored switch-off choices; learning progress is untouched.
DROP FUNCTION IF EXISTS public.set_vocabulary_lesson_paused(uuid,boolean);
DROP TABLE IF EXISTS public.vocabulary_lesson_pauses;
