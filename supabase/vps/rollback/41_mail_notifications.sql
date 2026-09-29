-- Stop app/mail; take a fresh backup; run atomically on VPS with psql -1.
-- Restores the per-row level-access mail of migration 29/40 and removes the
-- database-side pronunciation mail. Nothing is deleted: the opt-out column,
-- the announcement table and all outbox rows stay (archive, R9).
-- The matching app release re-queues pronunciation mails itself; roll the
-- release back together with this file, otherwise replies send no mail.
DROP TRIGGER IF EXISTS on_pronunciation_reply_notify ON public.pronunciation_messages;
DROP TRIGGER IF EXISTS on_pronunciation_opt_out ON public.profiles;
DROP TRIGGER IF EXISTS on_student_level_access_granted_notify ON public.student_level_access;
CREATE TRIGGER on_student_level_access_granted_notify AFTER INSERT ON public.student_level_access
 FOR EACH ROW EXECUTE FUNCTION business_private.notify_student_of_level_access();
