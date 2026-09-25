-- Stop app/mail; take a fresh backup; run atomically on VPS with psql -1.
-- Retain the new worker until any queued level_access_granted jobs are drained.
-- Existing outbox history and enum label remain valid; do not delete sent mail.
DROP TRIGGER IF EXISTS on_student_level_access_granted_notify ON public.student_level_access;
DROP FUNCTION IF EXISTS business_private.notify_student_of_level_access();
