-- Stop app; take a fresh backup; run atomically on VPS with psql -1.
-- Removes the functions and the trigger of migration 57 and restores the staff
-- pronunciation tab. Nothing is deleted or restored: the two tables
-- pronunciation_private.staff_hidden_* stay as an archive (R9), so conversations
-- removed from the staff view simply become visible to staff again; accounts
-- deleted through the profile functions stay deleted. The matching app release
-- calls these functions; roll it back together.
DROP TRIGGER IF EXISTS pronunciation_message_reveal ON public.pronunciation_messages;
DROP FUNCTION IF EXISTS pronunciation_private.reveal_conversation();
DROP FUNCTION IF EXISTS public.get_staff_pronunciation_view();
DROP FUNCTION IF EXISTS public.set_pronunciation_message_hidden(uuid,boolean);
DROP FUNCTION IF EXISTS public.set_pronunciation_submission_hidden(uuid,boolean);
DROP FUNCTION IF EXISTS public.delete_student_learning_profile(uuid,text);
DROP FUNCTION IF EXISTS public.delete_own_learning_profile(text);
DROP FUNCTION IF EXISTS identity_private.remove_learning_profile(uuid);
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.get_teacher_student_detail(uuid,text,text)'::regprocedure) INTO definition;
 IF position('staff-hidden-v1' IN definition)>0 THEN
  definition:=replace(definition,$new$ /* staff-hidden-v1 */ AND NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_messages hidden WHERE hidden.message_id=unanswered.id)$new$,'');
  definition:=replace(definition,$new$ AND NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_messages hidden WHERE hidden.message_id=m.id)$new$,'');
  definition:=replace(definition,$new$ AND NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_submissions hidden WHERE hidden.submission_id=s.id)$new$,'');
  IF position('staff_hidden' IN definition)>0 THEN RAISE EXCEPTION 'Unexpected get_teacher_student_detail definition'; END IF;
  EXECUTE definition;
 END IF;
END $patch$;
NOTIFY pgrst, 'reload schema';
