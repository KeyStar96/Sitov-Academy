-- Backup with migrate-local.py before applying. 40 must have committed first.
-- Rollback: supabase/vps/rollback/41_mail_notifications.sql.
--
-- Phase 6.2 + 6.4: Benachrichtigungen per Mail.
--
-- 6.2 Antwort der Lehrkraft in der Aussprache
--   * profiles.notify_pronunciation_feedback (Standard: an) ist der Schalter der
--     Person. Die Person darf ihn selbst ändern (Spaltenrecht wie ui_language).
--   * Die Mail wird jetzt in der Datenbank eingereiht (Trigger auf
--     pronunciation_messages), nicht mehr in der App. Dadurch kann kein Weg
--     (App, REST, spätere Werkzeuge) den Schalter umgehen.
--   * Bündeln: Die erste Antwort legt eine Mail an, die erst nach 10 Minuten
--     versendet wird (available_at). Jede weitere Antwort im selben Gespräch
--     innerhalb dieser Zeit wird an dieselbe, noch nicht abgeholte Mail
--     angehängt. Kein neuer Dienst: der vorhandene Mail-Worker holt nur
--     Zeilen mit available_at <= now().
--   * Wird der Schalter ausgeschaltet, verfallen noch nicht versendete
--     Aussprache-Mails dieser Person.
--   * Empfänger wie in Migration 40: nur die bestätigte Login-Adresse.
--
-- 6.4 Freischalt-Mail für mehrere Niveaus
--   * Der Zeilen-Trigger von Migration 29/40 wird durch einen Anweisungs-Trigger
--     ersetzt: je Person und Speichervorgang genau eine Mail mit allen neu
--     freigeschalteten Niveaus in Kursreihenfolge.
--   * Zusagen aus Migration 29 gelten weiter: ein schon angekündigtes Niveau
--     wird nie wieder angekündigt (Tabelle level_access_announcements, gefüllt
--     aus den bisherigen Mails), bestehende Freigaben lösen keine Mail aus,
--     Fehler beim Einreihen bleiben ein WARNING und die Freischaltung besteht.

-- 6.2 ---------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_pronunciation_feedback boolean NOT NULL DEFAULT true;
GRANT UPDATE(notify_pronunciation_feedback) ON TABLE public.profiles TO authenticated;
COMMENT ON COLUMN public.profiles.notify_pronunciation_feedback IS 'Learner opt-out for the mail sent when a teacher replies in a pronunciation conversation (Phase 6.2). Checked inside the database where the mail is queued.';

CREATE OR REPLACE FUNCTION business_private.notify_student_of_pronunciation_reply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_learner uuid; v_level text; v_email text; v_name text; v_locale text; v_notify boolean;
 v_reply jsonb; v_updated integer; v_result jsonb;
BEGIN
 BEGIN
  IF new.sender_role NOT IN('teacher','admin') THEN RETURN new; END IF;
  SELECT s.auth_user_id,s.level INTO v_learner,v_level FROM public.submissions s WHERE s.id=new.submission_id;
  IF v_learner IS NULL THEN RETURN new; END IF;
  SELECT pr.notify_pronunciation_feedback,
         CASE WHEN u.email_confirmed_at IS NOT NULL
              THEN coalesce(nullif(btrim(u.email),''),nullif(btrim(pe.email),'')) END,
         left(coalesce(nullif(btrim(pe.display_name),''),''),150),
         CASE WHEN pr.ui_language IN('de','en','ru','uk','tr') THEN pr.ui_language ELSE 'de' END
    INTO v_notify,v_email,v_name,v_locale
    FROM auth.users u
    JOIN public.profiles pr ON pr.id=u.id
    LEFT JOIN public.people pe ON pe.auth_user_id=u.id
   WHERE u.id=v_learner
   LIMIT 1;
  IF v_notify IS NOT TRUE OR v_email IS NULL THEN RETURN new; END IF;
  -- Gleichzeitige Antworten im selben Gespräch werden nacheinander gebündelt.
  PERFORM pg_advisory_xact_lock(hashtextextended('pronunciation-mail:'||new.submission_id::text,0));
  v_reply:=jsonb_build_object('text',left(btrim(new.text_content),200),'audio',new.audio_path IS NOT NULL);
  UPDATE private.mail_outbox SET payload=jsonb_set(payload,'{replies}',(payload->'replies')||v_reply)
   WHERE kind::text='feedback_available' AND status::text='pending'
     AND payload->>'submissionId'=new.submission_id::text
     AND CASE WHEN jsonb_typeof(payload->'replies')='array' THEN jsonb_array_length(payload->'replies')<10 ELSE false END;
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated=0 THEN
   v_result:=public.queue_transactional_email('pronunciation-thread:'||new.submission_id||':'||new.id,'feedback_available',v_email,v_locale,
    jsonb_build_object('name',v_name,'authUserId',v_learner,'submissionId',new.submission_id,'replies',jsonb_build_array(v_reply),
     'path','/'||v_locale||'/dashboard/level/'||v_level||'/pronunciation?tab=mailbox&conversation='||new.submission_id));
   IF jsonb_typeof(v_result)='object' AND v_result ? 'error' THEN RAISE WARNING 'pronunciation_notification_failed'; END IF;
   -- Erst nach dem Bündelungsfenster versenden.
   UPDATE private.mail_outbox SET available_at=now()+interval '10 minutes'
    WHERE dedupe_key='pronunciation-thread:'||new.submission_id||':'||new.id AND status::text='pending';
  END IF;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'pronunciation_notification_failed';
 END;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION business_private.notify_student_of_pronunciation_reply() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS on_pronunciation_reply_notify ON public.pronunciation_messages;
CREATE TRIGGER on_pronunciation_reply_notify AFTER INSERT ON public.pronunciation_messages
 FOR EACH ROW WHEN (new.sender_role IN('teacher','admin')) EXECUTE FUNCTION business_private.notify_student_of_pronunciation_reply();

CREATE OR REPLACE FUNCTION business_private.cancel_pronunciation_mail_on_opt_out() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 BEGIN
  DELETE FROM private.mail_outbox WHERE kind::text='feedback_available' AND status::text='pending'
   AND payload->>'authUserId'=new.id::text AND dedupe_key LIKE 'pronunciation-thread:%';
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'pronunciation_opt_out_cleanup_failed';
 END;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION business_private.cancel_pronunciation_mail_on_opt_out() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS on_pronunciation_opt_out ON public.profiles;
CREATE TRIGGER on_pronunciation_opt_out AFTER UPDATE OF notify_pronunciation_feedback ON public.profiles
 FOR EACH ROW WHEN (old.notify_pronunciation_feedback AND NOT new.notify_pronunciation_feedback)
 EXECUTE FUNCTION business_private.cancel_pronunciation_mail_on_opt_out();

-- 6.4 ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_private.level_access_announcements (
 auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 level text NOT NULL,
 announced_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(auth_user_id,level)
);
ALTER TABLE business_private.level_access_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON business_private.level_access_announcements FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE business_private.level_access_announcements IS 'Levels already announced to a learner by mail. A level is never announced twice, also not after revoking and granting it again (Phase 6.4).';

-- Bisher angekündigte Niveaus (eine Mail je Niveau, Migration 29) übernehmen.
INSERT INTO business_private.level_access_announcements(auth_user_id,level,announced_at)
SELECT split_part(o.dedupe_key,':',2)::uuid,split_part(o.dedupe_key,':',3),o.created_at
  FROM private.mail_outbox o
 WHERE o.kind::text='level_access_granted'
   AND o.dedupe_key ~ '^level-access:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[^:+,]+$'
   AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=split_part(o.dedupe_key,':',2)::uuid)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION business_private.notify_students_of_level_access() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; v_result jsonb; v_key text;
BEGIN
 BEGIN
  FOR r IN
   SELECT n.auth_user_id,array_agg(n.level ORDER BY l.sort_order NULLS LAST,n.level) levels,
          max(CASE WHEN u.email_confirmed_at IS NOT NULL
                   THEN coalesce(nullif(btrim(u.email),''),(SELECT nullif(btrim(p.email),'') FROM public.people p WHERE p.auth_user_id=u.id LIMIT 1)) END) email,
          max(left(coalesce((SELECT nullif(btrim(p.display_name),'') FROM public.people p WHERE p.auth_user_id=u.id LIMIT 1),''),150)) name,
          max(CASE WHEN pr.ui_language IN('de','en','ru','uk','tr') THEN pr.ui_language ELSE 'de' END) locale
     FROM (SELECT DISTINCT auth_user_id,level FROM new_rows) n
     JOIN auth.users u ON u.id=n.auth_user_id
     LEFT JOIN public.learning_levels l ON l.code=n.level
     LEFT JOIN public.profiles pr ON pr.id=n.auth_user_id
    WHERE NOT EXISTS(SELECT 1 FROM business_private.level_access_announcements a WHERE a.auth_user_id=n.auth_user_id AND a.level=n.level)
    GROUP BY n.auth_user_id
  LOOP
   BEGIN
    IF r.email IS NULL THEN CONTINUE; END IF;
    v_key:='level-access:'||r.auth_user_id||':'||array_to_string(r.levels,'+');
    v_result:=public.queue_transactional_email(v_key,'level_access_granted',r.email,r.locale,
     jsonb_build_object('name',r.name,'levels',to_jsonb(r.levels),'path','/'||r.locale||'/dashboard/level/'||r.levels[1]));
    IF jsonb_typeof(v_result)='object' AND v_result ? 'error' THEN RAISE WARNING 'level_access_notification_failed'; CONTINUE; END IF;
    INSERT INTO business_private.level_access_announcements(auth_user_id,level) SELECT r.auth_user_id,x FROM unnest(r.levels) x ON CONFLICT DO NOTHING;
   EXCEPTION WHEN OTHERS THEN RAISE WARNING 'level_access_notification_failed';
   END;
  END LOOP;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'level_access_notification_failed';
 END;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION business_private.notify_students_of_level_access() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS on_student_level_access_granted_notify ON public.student_level_access;
CREATE TRIGGER on_student_level_access_granted_notify AFTER INSERT ON public.student_level_access
 REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION business_private.notify_students_of_level_access();
