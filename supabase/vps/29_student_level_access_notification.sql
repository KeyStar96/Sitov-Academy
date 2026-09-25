-- Backup with migrate-local.py before applying. 28 must have committed first.
-- Rollback: supabase/vps/rollback/29_student_level_access_notification.sql.
--
-- Lernende über freigeschaltete Niveaus informieren: Bisher bekam nur info@ eine
-- Mail bei einer neuen Registrierung (Migration 27). Schaltete die Lehrkraft
-- danach ein Niveau frei, erfuhr die Person davon nichts.
--
--   * Ein Trigger auf student_level_access legt je neu freigeschaltetem Niveau
--     genau eine Outbox-Mail an die Lernenden an (dedupe_key
--     level-access:<user id>:<level>). Entziehen und erneutes Freischalten
--     desselben Niveaus verschickt keine zweite Mail.
--   * Sprache aus profiles.ui_language, Adresse aus people bzw. auth.users.
--   * Die Freischaltung darf daran nie scheitern: Fehler beim Einreihen werden
--     als WARNING protokolliert, der Zugriff bleibt bestehen.
--   * Kein Nachholen: bestehende Freigaben lösen keine Mail aus.
CREATE OR REPLACE FUNCTION business_private.notify_student_of_level_access() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text; v_name text; v_locale text; v_result jsonb;
BEGIN
 BEGIN
  SELECT coalesce(nullif(btrim(pe.email),''),nullif(btrim(u.email),'')),
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
DROP TRIGGER IF EXISTS on_student_level_access_granted_notify ON public.student_level_access;
CREATE TRIGGER on_student_level_access_granted_notify AFTER INSERT ON public.student_level_access
 FOR EACH ROW EXECUTE FUNCTION business_private.notify_student_of_level_access();
