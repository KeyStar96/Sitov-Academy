-- Stop app/mail; take a fresh backup; run atomically on VPS with psql -1.
-- Removes the three public functions, the internal helper and the trainer stamp
-- trigger. Nothing is deleted: learning_first_visits, learning_seen_receipts, the
-- enum and the columns granted_at / enabled_at / created_at stay as an archive (R9).
-- The matching app release only calls the functions defensively (a failing call
-- shows nothing new); roll it back together with this file.
DROP FUNCTION IF EXISTS public.get_learning_new_counts();
DROP FUNCTION IF EXISTS public.get_learning_new_items(text);
DROP FUNCTION IF EXISTS public.mark_learning_seen(text,text);
DROP FUNCTION IF EXISTS learning_private.new_objects();
DROP TRIGGER IF EXISTS stamp_trainer_enabled ON public.learning_trainer_grants;
DROP FUNCTION IF EXISTS learning_private.stamp_trainer_enabled();
