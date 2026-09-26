-- R8: run only through the backed-up migration adapter with the old app.
-- Preserve choices, receipts and every original progress row; archive choices.
DO $$ DECLARE saved record; BEGIN
 IF to_regclass('vocabulary_private.carryover_function_backups') IS NULL THEN RETURN; END IF;
 FOR saved IN SELECT definition FROM vocabulary_private.carryover_function_backups LOOP EXECUTE saved.definition; END LOOP;
 -- Archived rows are not writable by the old app. An active audio-reset job
 -- must not prevent rollback from preserving and hiding a saved choice.
 DROP TRIGGER IF EXISTS learning_reset_guard ON public.vocabulary_carryover_preferences;
 UPDATE public.vocabulary_carryover_preferences SET is_active=false;
END $$;
REVOKE ALL ON FUNCTION public.get_vocabulary_carryover(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.begin_vocabulary_level(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.set_vocabulary_carryover(text,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_vocabulary_carryover_cards(text,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.submit_vocabulary_answer(uuid,boolean,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.submit_vocabulary_answer_once(uuid,uuid,boolean,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.submit_vocabulary_self_rating_once(uuid,uuid,boolean,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.check_vocabulary_retry(uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
