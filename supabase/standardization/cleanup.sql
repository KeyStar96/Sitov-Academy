-- Replace the single shared role helper in every retained policy/function.
-- ALTER POLICY preserves its role list, command and permissive/restrictive mode.
DO $$ DECLARE f record; p record; statement text; BEGIN
 FOR f IN SELECT pg_get_functiondef(proc.oid) definition FROM pg_proc proc
  JOIN pg_namespace ns ON ns.oid=proc.pronamespace
  WHERE ns.nspname IN('public','business_private','grammar_private','learning_private','learning_reset_private',
   'platform_private','pronunciation_private','trainer_access_private','vocabulary_private')
   AND proc.prokind='f' AND proc.prosrc LIKE '%monthly_booking_private.current_profile_role%'
 LOOP
  EXECUTE replace(f.definition,'monthly_booking_private.current_profile_role','identity_private.current_profile_role');
 END LOOP;
 FOR p IN SELECT pol.polname,ns.nspname,t.relname,pg_get_expr(pol.polqual,pol.polrelid) using_expression,
   pg_get_expr(pol.polwithcheck,pol.polrelid) check_expression
  FROM pg_policy pol JOIN pg_class t ON t.oid=pol.polrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace
  WHERE coalesce(pg_get_expr(pol.polqual,pol.polrelid),'')||coalesce(pg_get_expr(pol.polwithcheck,pol.polrelid),'')
   LIKE '%monthly_booking_private.current_profile_role%'
 LOOP
  statement:=format('ALTER POLICY %I ON %I.%I',p.polname,p.nspname,p.relname);
  IF p.using_expression IS NOT NULL THEN statement:=statement||' USING ('||replace(p.using_expression,'monthly_booking_private.current_profile_role','identity_private.current_profile_role')||')'; END IF;
  IF p.check_expression IS NOT NULL THEN statement:=statement||' WITH CHECK ('||replace(p.check_expression,'monthly_booking_private.current_profile_role','identity_private.current_profile_role')||')'; END IF;
  EXECUTE statement;
 END LOOP;
END $$;
DROP VIEW public.profile_details;
-- The old registrations table is gone; its detached trigger function must not
-- remain as a callable reference to a nonexistent enrollment model.
DROP FUNCTION public.handle_registration_confirmation();
ALTER TABLE public.profiles DROP COLUMN subscription_status,DROP COLUMN stripe_customer_id,DROP COLUMN stripe_subscription_id;
DROP FUNCTION monthly_booking_private.current_profile_role();
DROP SCHEMA monthly_booking_private;

ALTER TABLE private.mail_outbox ADD CONSTRAINT mail_outbox_locale_fkey FOREIGN KEY(locale) REFERENCES public.locales(code);
CREATE INDEX mail_outbox_locale_idx ON private.mail_outbox(locale);
-- BEGIN canonical reset storage
-- The retired bucket is removed separately through the Storage API, never SQL.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects WHERE bucket_id<>'pronunciation_audio') THEN
  RAISE EXCEPTION 'Non-canonical reset manifest objects require resolution before migration';
 END IF;
END $$;
ALTER TABLE learning_reset_private.audio_objects DROP CONSTRAINT audio_objects_bucket_id_check;
ALTER TABLE learning_reset_private.audio_objects ADD CONSTRAINT audio_objects_bucket_id_check CHECK(bucket_id='pronunciation_audio');
CREATE OR REPLACE FUNCTION learning_reset_private.storage_writable(p_bucket text,p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_bucket<>'pronunciation_audio' THEN RETURN true; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
  WHERE a.object_id=p_id AND j.active) THEN RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000'; END IF;
 PERFORM learning_reset_private.assert_writable((SELECT auth.uid()));
 RETURN true;
END $$;
-- END canonical reset storage

-- RLS tables, physical foreign keys and canonical names are checked again after
-- restore and by the deployment preflight; historical migrations stay immutable.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND(column_name LIKE '%legacy%' OR column_name IN('translation_key','stripe_customer_id','stripe_subscription_id','discount_percent','is_blackboard'))) THEN
  RAISE EXCEPTION 'Obsolete public columns remain';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity) THEN
  RAISE EXCEPTION 'Public tables must use row-level security';
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
