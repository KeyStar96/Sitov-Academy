-- Backup with migrate-local.py before applying. 29 must have committed first.
-- Rollback: supabase/vps/rollback/40_level_access_verified_email.sql.
--
-- Freischalt-Mails nur an bestätigte Login-Adressen (Befund 28.09.2026):
-- Die Lehrkraft schaltete A1.1 auch für ein doppelt angelegtes Konto frei,
-- dessen Adresse einen Tippfehler hatte und nie bestätigt wurde. Die Mail
-- ging an ein nicht existierendes Gmail-Postfach und kam als Bounce zurück.
--
--   * Empfänger ist die per Bestätigungsmail geprüfte auth.users.email;
--     people.email dient nur noch als Rückfall für bestätigte Konten ohne
--     Login-Adresse.
--   * Unbestätigte Konten bekommen keine Freischalt-Mail. Die Freischaltung
--     selbst bleibt unverändert bestehen; ein späteres Nachholen gibt es
--     wie bisher nicht.
--   * Alle übrigen Zusagen aus Migration 29 gelten weiter: eine Mail je
--     Person und Niveau (dedupe_key level-access:<user id>:<level>), Fehler
--     beim Einreihen nur als WARNING.
CREATE OR REPLACE FUNCTION business_private.notify_student_of_level_access() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text; v_name text; v_locale text; v_result jsonb;
BEGIN
 BEGIN
  SELECT CASE WHEN u.email_confirmed_at IS NOT NULL
              THEN coalesce(nullif(btrim(u.email),''),nullif(btrim(pe.email),'')) END,
         left(coalesce(nullif(btrim(pe.display_name),''),''),150),
         CASE WHEN pr.ui_language IN('de','en','ru','uk','tr') THEN pr.ui_language ELSE 'de' END
    INTO v_email,v_name,v_locale
    FROM auth.users u
    LEFT JOIN public.profiles pr ON pr.id=u.id
    LEFT JOIN public.people pe ON pe.auth_user_id=u.id
   WHERE u.id=new.auth_user_id
   LIMIT 1;
  IF v_email IS NULL THEN RETURN new; END IF;
  v_result:=public.queue_transactional_email('level-access:'||new.auth_user_id||':'||new.level,'level_access_granted',v_email,v_locale,
   jsonb_build_object('name',v_name,'level',new.level,'path','/'||v_locale||'/dashboard/level/'||new.level));
  IF jsonb_typeof(v_result)='object' AND v_result ? 'error' THEN RAISE WARNING 'level_access_notification_failed'; END IF;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'level_access_notification_failed';
 END;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION business_private.notify_student_of_level_access() FROM PUBLIC,anon,authenticated;
