-- Backup with migrate-local.py before applying. 26 must have committed first.
-- Rollback: supabase/vps/rollback/27_staff_signup_notification.sql.
--
-- Neue Konten auf der Lernplattform melden: Bisher ging nur bei einer
-- Kursanmeldung (submit_business_registration) eine Mail an info@. Wer sich nur
-- ein Konto anlegt, blieb unbemerkt, bis jemand zufällig in „Lernende" schaute.
--
--   * Ein Trigger neben provision_profile legt je neuem auth.users-Eintrag genau
--     eine Outbox-Mail an (dedupe_key staff-signup:<user id>). Zustellung wie
--     jede andere Mail über sitov-mail.service.
--   * Die Registrierung darf daran nie scheitern: Fehler beim Einreihen werden
--     als WARNING protokolliert, der neue Zugang bleibt bestehen.
--   * Nachholen: Konten der letzten 3 Tage ohne Meldung werden einmalig
--     eingereiht, damit die gerade verpasste Registrierung ankommt.
CREATE OR REPLACE FUNCTION business_private.staff_signup_payload(p_email text,p_meta jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('path','/de/admin/students','message',concat_ws(E'\n',
  'Name: '||left(coalesce(nullif(btrim(p_meta->>'display_name'),''),nullif(btrim(p_meta->>'name'),''),split_part(p_email,'@',1)),160),
  'E-Mail: '||p_email,
  'Muttersprache: '||left(nullif(btrim(p_meta->>'native_language'),''),40)))
$$;

CREATE OR REPLACE FUNCTION business_private.notify_staff_of_signup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 IF nullif(btrim(new.email),'') IS NULL THEN RETURN new; END IF;
 BEGIN
  v_result:=public.queue_transactional_email('staff-signup:'||new.id,'new_signup','info@sitov-academy.com','de',
   business_private.staff_signup_payload(new.email,coalesce(new.raw_user_meta_data,'{}'::jsonb)));
  IF jsonb_typeof(v_result)='object' AND v_result ? 'error' THEN RAISE WARNING 'staff_signup_notification_failed'; END IF;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'staff_signup_notification_failed';
 END;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION business_private.staff_signup_payload(text,jsonb),business_private.notify_staff_of_signup() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created_notify_staff ON auth.users;
CREATE TRIGGER on_auth_user_created_notify_staff AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION business_private.notify_staff_of_signup();

SELECT public.queue_transactional_email('staff-signup:'||u.id,'new_signup','info@sitov-academy.com','de',
  business_private.staff_signup_payload(u.email,coalesce(u.raw_user_meta_data,'{}'::jsonb)))
 FROM auth.users u
 WHERE u.created_at>now()-interval '3 days' AND nullif(btrim(u.email),'') IS NOT NULL
 ORDER BY u.created_at;
