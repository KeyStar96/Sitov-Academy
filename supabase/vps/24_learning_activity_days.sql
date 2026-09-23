-- Phase 5.12. Backup with migrate-local.py before applying. migrate-local wraps
-- regular files in one transaction; every statement here is idempotent.
-- Rollback: supabase/vps/rollback/24_learning_activity_days.sql.
--
-- Zwei kleine Bausteine für die neue Startseite:
--
--   * learning_activity_days: an welchen Tagen (Berliner Kalender) jemand
--     gelernt hat — Grundlage des ruhigen Wochenkalenders „Diese Woche an
--     5 von 7 Tagen gelernt". Die Lern-Tabellen merken sich nur den jeweils
--     letzten Zeitpunkt, ein Wochenrückblick braucht aber jeden Tag. Trigger
--     tragen den Tag ein, sobald eine Vokabel beantwortet, eine Grammatik-
--     aufgabe versucht oder eine Aufnahme eingereicht wird; die App schreibt
--     nie selbst. Zurücksetzen des Lernstands löscht keine Lerntage — sie
--     sind ein Rückblick, kein Fortschritt.
--   * pronunciation_reply_senders(): der Anzeigename der Lehrkraft, die auf
--     die eigenen Aufnahmen geantwortet hat. people ist per RLS nur für die
--     eigene Zeile lesbar; diese Funktion gibt ausschließlich Namen von
--     Lehrkräften heraus, die der aufrufenden Person selbst geantwortet haben.

-- ── Lerntage ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_activity_days(
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 day date NOT NULL,
 PRIMARY KEY(auth_user_id,day));

ALTER TABLE public.learning_activity_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_activity_days_read ON public.learning_activity_days;
CREATE POLICY learning_activity_days_read ON public.learning_activity_days
 FOR SELECT TO authenticated USING(auth_user_id=(SELECT auth.uid()));
REVOKE ALL ON public.learning_activity_days FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.learning_activity_days TO authenticated;
GRANT ALL ON public.learning_activity_days TO service_role;

-- Ein Trigger für drei Tabellen. Er schreibt nur, wenn wirklich gelernt wurde:
-- eine neue Antwortzeit, ein weiterer Versuch, eine neue Aufnahme. Das
-- Aktivieren einer Lektion legt Lernstand ohne Antwort an und zählt nicht.
CREATE OR REPLACE FUNCTION learning_private.record_activity_day() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
 learner uuid;
 happened timestamptz;
BEGIN
 IF TG_TABLE_NAME='vocabulary_direction_progress' THEN
  IF NEW.last_answered_at IS NULL
   OR (TG_OP='UPDATE' AND NEW.last_answered_at IS NOT DISTINCT FROM OLD.last_answered_at) THEN RETURN NULL; END IF;
  learner:=NEW.auth_user_id; happened:=NEW.last_answered_at;
 ELSIF TG_TABLE_NAME='user_exercise_progress' THEN
  IF coalesce(NEW.attempts,0)=0 AND NOT coalesce(NEW.completed,false) THEN RETURN NULL; END IF;
  IF TG_OP='UPDATE' AND NEW.attempts IS NOT DISTINCT FROM OLD.attempts
   AND NEW.completed IS NOT DISTINCT FROM OLD.completed THEN RETURN NULL; END IF;
  learner:=NEW.auth_user_id; happened:=now();
 ELSIF TG_TABLE_NAME='submissions' THEN
  learner:=NEW.auth_user_id; happened:=coalesce(NEW.created_at,now());
 ELSE
  RETURN NULL;
 END IF;
 INSERT INTO public.learning_activity_days(auth_user_id,day)
 VALUES(learner,(happened AT TIME ZONE 'Europe/Berlin')::date)
 ON CONFLICT DO NOTHING;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION learning_private.record_activity_day() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS learning_activity_vocabulary ON public.vocabulary_direction_progress;
CREATE TRIGGER learning_activity_vocabulary AFTER INSERT OR UPDATE OF last_answered_at
 ON public.vocabulary_direction_progress FOR EACH ROW EXECUTE FUNCTION learning_private.record_activity_day();
DROP TRIGGER IF EXISTS learning_activity_grammar ON public.user_exercise_progress;
CREATE TRIGGER learning_activity_grammar AFTER INSERT OR UPDATE OF attempts, completed
 ON public.user_exercise_progress FOR EACH ROW EXECUTE FUNCTION learning_private.record_activity_day();
DROP TRIGGER IF EXISTS learning_activity_pronunciation ON public.submissions;
CREATE TRIGGER learning_activity_pronunciation AFTER INSERT
 ON public.submissions FOR EACH ROW EXECUTE FUNCTION learning_private.record_activity_day();

-- Rückblick: Die letzten acht Wochen lassen sich aus den vorhandenen
-- Zeitstempeln rekonstruieren (je Karte/Aufgabe der letzte Tag — lückenhaft,
-- aber nie erfunden). Ab jetzt schreibt der Trigger jeden Tag mit.
INSERT INTO public.learning_activity_days(auth_user_id,day)
SELECT source.auth_user_id,source.day FROM (
 SELECT auth_user_id,(last_answered_at AT TIME ZONE 'Europe/Berlin')::date AS day
  FROM public.vocabulary_direction_progress WHERE last_answered_at>now()-interval '56 days'
 UNION
 SELECT auth_user_id,(updated_at AT TIME ZONE 'Europe/Berlin')::date
  FROM public.user_exercise_progress
  WHERE updated_at>now()-interval '56 days' AND (coalesce(attempts,0)>0 OR coalesce(completed,false))
 UNION
 SELECT auth_user_id,(created_at AT TIME ZONE 'Europe/Berlin')::date
  FROM public.submissions WHERE created_at>now()-interval '56 days'
) source
WHERE EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=source.auth_user_id)
ON CONFLICT DO NOTHING;

-- ── Name der antwortenden Lehrkraft ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pronunciation_reply_senders()
RETURNS TABLE(sender_id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT DISTINCT m.sender_id, nullif(btrim(p.display_name),'')
 FROM public.pronunciation_messages m
 JOIN public.submissions s ON s.id=m.submission_id AND s.auth_user_id=(SELECT auth.uid())
 LEFT JOIN public.people p ON p.auth_user_id=m.sender_id
 WHERE m.sender_role::text IN('teacher','admin') AND (SELECT auth.uid()) IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.pronunciation_reply_senders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pronunciation_reply_senders() TO authenticated, service_role;

-- Regression guards (R10, maschinenlesbar).
DO $migration$
BEGIN
 IF has_table_privilege('authenticated','public.learning_activity_days','INSERT')
  OR has_table_privilege('authenticated','public.learning_activity_days','UPDATE')
  OR has_table_privilege('authenticated','public.learning_activity_days','DELETE')
  OR has_table_privilege('anon','public.learning_activity_days','SELECT') THEN
  RAISE EXCEPTION 'activity_days_writable' USING ERRCODE='42501';
 END IF;
 IF NOT has_function_privilege('authenticated','public.pronunciation_reply_senders()','EXECUTE')
  OR has_function_privilege('anon','public.pronunciation_reply_senders()','EXECUTE') THEN
  RAISE EXCEPTION 'reply_senders_grant_wrong' USING ERRCODE='42501';
 END IF;
END $migration$;

-- ROLLBACK (R9): supabase/vps/rollback/24_learning_activity_days.sql. Vorher
-- einen Client ausrollen, der learning_activity_days und
-- pronunciation_reply_senders nicht mehr liest.
