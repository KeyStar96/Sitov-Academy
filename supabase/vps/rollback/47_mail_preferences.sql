-- Rollback of 47_mail_preferences.sql. Apply with migrate-local.py after a backup.
-- Deploy a worker/client without learning reminders and the two new switches first.
-- The two switch columns are removed; the pronunciation switch (41) stays.
DO $$ DECLARE saved record; BEGIN
 FOR saved IN SELECT definition FROM business_private.mail_preference_function_backups LOOP
  EXECUTE saved.definition;
 END LOOP;
END $$;
DROP TRIGGER IF EXISTS mail_outbox_respect_preferences ON private.mail_outbox;
DROP TRIGGER IF EXISTS on_optional_mail_opt_out ON public.profiles;
DROP FUNCTION IF EXISTS public.queue_learning_reminders(timestamptz);
DROP FUNCTION IF EXISTS business_private.skip_opted_out_mail();
DROP FUNCTION IF EXISTS business_private.drop_opted_out_mail();
DROP FUNCTION IF EXISTS business_private.cancel_optional_mail_on_opt_out();
DROP FUNCTION IF EXISTS business_private.mail_allowed(text,text,jsonb);
DROP FUNCTION IF EXISTS business_private.mail_preference(text);
DELETE FROM private.mail_outbox WHERE kind::text='learning_reminder' AND status::text='pending';
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notify_new_content;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notify_learning_reminders;
REVOKE ALL ON FUNCTION public.claim_mail_jobs(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mail_jobs(uuid,integer) TO service_role;
