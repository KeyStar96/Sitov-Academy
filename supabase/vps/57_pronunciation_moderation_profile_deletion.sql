-- Master-Prompt Phase 2: Lehrkräfte räumen ihre Aussprache-Ansicht auf und
-- löschen Lernplattform-Profile von Schülern; Lernende löschen ihr eigenes Profil.
-- Backup with migrate-local.py before applying. Requires 39, 41, 47 and 54.
-- Rollback: supabase/vps/rollback/57_pronunciation_moderation_profile_deletion.sql.
--
-- Rein additiv (Live-Kundendaten): zwei private Tabellen, ein Trigger und neue
-- Funktionen. Die Migration selbst ändert oder löscht keinen Datensatz.
--
-- A. Aussprache: aus der Lehreransicht entfernen (nichts wird gelöscht)
--   * set_pronunciation_submission_hidden(): Lehrkraft blendet eine Einreichung
--     samt Gespräch aus dem Lehrer-Dashboard aus oder holt sie zurück.
--   * set_pronunciation_message_hidden(): dasselbe für eine einzelne Nachricht
--     eines Lernenden.
--   * get_staff_pronunciation_view(): was ausgeblendet ist und wie viele
--     Gespräche aus Sicht der Lehrkräfte noch auf eine Antwort warten.
--   Für Lernende ändert sich nichts: Aufnahme, Nachrichten, Status und Dateien
--   bleiben unverändert. Die Markierung liegt in privaten Tabellen, die
--   Lernende nicht lesen können. Schreibt die Person erneut in ein
--   ausgeblendetes Gespräch, erscheint es wieder – keine Nachricht geht unter.
--
-- B. Lernplattform-Profil löschen (endgültig, mit Bestätigung)
--   * delete_own_learning_profile(): Lernende löschen ihr eigenes Profil. Kein
--     vom Aufrufer gelieferter Nutzer – die Identität kommt aus der Sitzung.
--   * delete_student_learning_profile(): Lehrkraft löscht ein Schülerprofil.
--   Gelöscht wird das Anmeldekonto (auth.users); profiles und alle Lerndaten
--   hängen per ON DELETE CASCADE daran. public.people (Name, Adresse) bleibt
--   erhalten: people.auth_user_id wird per ON DELETE SET NULL gelöst. Buchungen,
--   Rechnungen, Teilnahmezeiten und Zertifikate verweisen auf people.id und
--   bleiben damit unberührt.
--   Storage und PostgreSQL teilen keine Transaktion. Die Funktion meldet deshalb
--   zuerst die noch vorhandenen Aufnahmen (pendingAudio) und löscht erst, wenn
--   die Storage-API sie entfernt hat – derselbe Grundsatz wie beim
--   Lernstand-Reset. Ein abgebrochener Vorgang lässt sich jederzeit wiederholen.

-- ── 1. Aussprache: Markierungen der Lehreransicht ────────────────────────
-- Eigene Tabellen statt Spalten: submissions und pronunciation_messages sind
-- für Lernende lesbar, diese Markierungen nicht.
CREATE TABLE IF NOT EXISTS pronunciation_private.staff_hidden_submissions(
 submission_id uuid PRIMARY KEY REFERENCES public.submissions(id) ON DELETE CASCADE,
 hidden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 hidden_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS pronunciation_private.staff_hidden_messages(
 message_id uuid PRIMARY KEY REFERENCES public.pronunciation_messages(id) ON DELETE CASCADE,
 hidden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 hidden_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE pronunciation_private.staff_hidden_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pronunciation_private.staff_hidden_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pronunciation_private.staff_hidden_submissions,pronunciation_private.staff_hidden_messages FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE pronunciation_private.staff_hidden_submissions IS 'Pronunciation conversations removed from the staff view (master prompt phase 2). The learner keeps recording, messages and status; nothing is deleted.';
COMMENT ON TABLE pronunciation_private.staff_hidden_messages IS 'Single learner messages removed from the staff view (master prompt phase 2). The learner still sees and plays them.';

CREATE OR REPLACE FUNCTION public.set_pronunciation_submission_hidden(p_submission_id uuid,p_hidden boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid());
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 IF p_submission_id IS NULL OR p_hidden IS NULL THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.submissions WHERE id=p_submission_id) THEN
  RETURN jsonb_build_object('error','not_found','message','Submission not found.'); END IF;
 IF p_hidden THEN
  INSERT INTO pronunciation_private.staff_hidden_submissions(submission_id,hidden_by) VALUES(p_submission_id,actor) ON CONFLICT(submission_id) DO NOTHING;
 ELSE
  DELETE FROM pronunciation_private.staff_hidden_submissions WHERE submission_id=p_submission_id;
 END IF;
 RETURN jsonb_build_object('success',true,'hidden',p_hidden);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.set_pronunciation_submission_hidden(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_pronunciation_submission_hidden(uuid,boolean) TO authenticated;

-- Nur Nachrichten der Lernenden; die eigenen Antworten der Lehrkräfte gehören
-- zum Gespräch. Die erste Aufnahme ist die Einreichung selbst (Funktion oben).
CREATE OR REPLACE FUNCTION public.set_pronunciation_message_hidden(p_message_id uuid,p_hidden boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); sender text;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 IF p_message_id IS NULL OR p_hidden IS NULL THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 SELECT sender_role::text INTO sender FROM public.pronunciation_messages WHERE id=p_message_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found','message','Message not found.'); END IF;
 IF p_hidden THEN
  IF sender<>'student' THEN RETURN jsonb_build_object('error','not_authorized','message','Only learner messages can be removed from the staff view.'); END IF;
  INSERT INTO pronunciation_private.staff_hidden_messages(message_id,hidden_by) VALUES(p_message_id,actor) ON CONFLICT(message_id) DO NOTHING;
 ELSE
  DELETE FROM pronunciation_private.staff_hidden_messages WHERE message_id=p_message_id;
 END IF;
 RETURN jsonb_build_object('success',true,'hidden',p_hidden);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.set_pronunciation_message_hidden(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_pronunciation_message_hidden(uuid,boolean) TO authenticated;

-- Die Warteschlange der Lehrkräfte richtet sich nach der letzten sichtbaren
-- Nachricht: Antwortete zuletzt eine Lehrkraft, ist das Gespräch beantwortet.
-- Der gespeicherte Status (den auch Lernende sehen) bleibt unverändert.
CREATE OR REPLACE FUNCTION public.get_staff_pronunciation_view() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 SELECT jsonb_build_object('success',true,
  'hiddenSubmissions',coalesce((SELECT jsonb_agg(h.submission_id ORDER BY h.submission_id) FROM pronunciation_private.staff_hidden_submissions h),'[]'::jsonb),
  'hiddenMessages',coalesce((SELECT jsonb_agg(h.message_id ORDER BY h.message_id) FROM pronunciation_private.staff_hidden_messages h),'[]'::jsonb),
  'pendingCount',(SELECT count(*) FROM public.submissions s
   WHERE NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_submissions h WHERE h.submission_id=s.id)
    AND coalesce(
     (SELECT CASE WHEN m.sender_role::text IN('teacher','admin') THEN 'reviewed' ELSE 'pending' END FROM public.pronunciation_messages m
       WHERE m.submission_id=s.id AND NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_messages h WHERE h.message_id=m.id)
       ORDER BY m.created_at DESC,m.id DESC LIMIT 1),
     -- Only removed learner messages are left: the first recording still waits for an answer.
     CASE WHEN EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.submission_id=s.id) THEN 'pending' ELSE s.status::text END)='pending'))
 INTO result;
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.get_staff_pronunciation_view() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_staff_pronunciation_view() TO authenticated;

-- ── 2. Aussprache: neue Nachricht holt das Gespräch zurück ───────────────
CREATE OR REPLACE FUNCTION pronunciation_private.reveal_conversation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM pronunciation_private.staff_hidden_submissions WHERE submission_id=NEW.submission_id;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION pronunciation_private.reveal_conversation() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS pronunciation_message_reveal ON public.pronunciation_messages;
CREATE TRIGGER pronunciation_message_reveal AFTER INSERT ON public.pronunciation_messages
 FOR EACH ROW WHEN (NEW.sender_role='student') EXECUTE FUNCTION pronunciation_private.reveal_conversation();

-- Aussprache-Reiter im Schülerprofil: Ausgeblendetes erscheint auch dort nicht.
DO $patch$
DECLARE definition text; previous text; replacement text;
BEGIN
 SELECT pg_get_functiondef('public.get_teacher_student_detail(uuid,text,text)'::regprocedure) INTO definition;
 IF position('staff-hidden-v1' IN definition)=0 THEN
  previous:=$old$unanswered.sender_role='student' AND unanswered.audio_path IS NOT NULL$old$;
  replacement:=$new$unanswered.sender_role='student' AND unanswered.audio_path IS NOT NULL /* staff-hidden-v1 */ AND NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_messages hidden WHERE hidden.message_id=unanswered.id)$new$;
  IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'Unexpected get_teacher_student_detail unanswered definition'; END IF;
  definition:=replace(definition,previous,replacement);
  previous:=$old$FROM public.submissions s LEFT JOIN public.pronunciation_messages m ON m.submission_id=s.id WHERE s.auth_user_id=p_student_id AND s.type='audio' GROUP BY s.id)$old$;
  replacement:=$new$FROM public.submissions s LEFT JOIN public.pronunciation_messages m ON m.submission_id=s.id AND NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_messages hidden WHERE hidden.message_id=m.id) WHERE s.auth_user_id=p_student_id AND s.type='audio' AND NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_submissions hidden WHERE hidden.submission_id=s.id) GROUP BY s.id)$new$;
  IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'Unexpected get_teacher_student_detail conversations definition'; END IF;
  EXECUTE replace(definition,previous,replacement);
 END IF;
END $patch$;

-- ── 3. Lernplattform-Profil löschen ──────────────────────────────────────
-- Nur von den beiden öffentlichen Funktionen aus erreichbar; sie prüfen die
-- Berechtigung. Fehler steigen dorthin auf und machen den Vorgang rückgängig.
CREATE OR REPLACE FUNCTION identity_private.remove_learning_profile(p_target uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pending jsonb;
BEGIN
 IF p_target IS NULL THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 -- Same order as the learning reset, so both can never deadlock each other.
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||p_target::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:'||p_target::text,0));
 SELECT jsonb_agg(x.name ORDER BY x.name) INTO pending FROM (
  SELECT o.name FROM storage.objects o
  WHERE o.bucket_id='pronunciation_audio'
   AND (o.name LIKE p_target::text||'/%' OR o.owner_id=p_target::text
    -- Teacher replies inside this learner's conversations leave with them.
    OR EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id
     WHERE s.auth_user_id=p_target AND m.audio_path='storage://pronunciation_audio/'||o.name))
   AND NOT EXISTS(SELECT 1 FROM public.submissions s WHERE s.auth_user_id<>p_target AND s.content_url='storage://pronunciation_audio/'||o.name)
   AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id
    WHERE s.auth_user_id<>p_target AND m.audio_path='storage://pronunciation_audio/'||o.name)
  ORDER BY o.name LIMIT 200) x;
 IF pending IS NOT NULL THEN RETURN jsonb_build_object('success',true,'deleted',false,'pendingAudio',pending); END IF;
 -- Messages name their sender without a cascade, and that check runs before the
 -- cascade through submissions would reach them: remove the conversations first.
 DELETE FROM public.pronunciation_messages WHERE submission_id IN(SELECT id FROM public.submissions WHERE auth_user_id=p_target);
 DELETE FROM public.submissions WHERE auth_user_id=p_target;
 -- Learner data without a foreign key to the profile.
 DELETE FROM vocabulary_private.answer_receipts WHERE auth_user_id=p_target;
 DELETE FROM learning_reset_private.jobs WHERE auth_user_id=p_target;
 -- Optional learning mails still waiting; booking and invoice mails are untouched.
 DELETE FROM private.mail_outbox WHERE status::text='pending'
  AND kind::text IN('feedback_available','level_access_granted','learning_reminder')
  AND (payload->>'authUserId'=p_target::text OR dedupe_key LIKE 'level-access:'||p_target::text||':%'
   OR dedupe_key LIKE 'learning-reminder:'||p_target::text||':%');
 -- profiles and every learning table cascade from the account;
 -- people.auth_user_id is ON DELETE SET NULL, so contact and billing data stay.
 DELETE FROM auth.users WHERE id=p_target;
 RETURN jsonb_build_object('success',true,'deleted',true);
END $$;
REVOKE ALL ON FUNCTION identity_private.remove_learning_profile(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.delete_own_learning_profile(p_confirmation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); actor_role text;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 SELECT coalesce(role::text,'student') INTO actor_role FROM public.profiles WHERE id=actor;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found','message','Profile not found.'); END IF;
 -- Staff accounts carry bookings and invoices they confirmed; an administrator changes the role first.
 IF actor_role<>'student' THEN RETURN jsonb_build_object('error','not_authorized','message','Only learner profiles can be deleted here.'); END IF;
 IF p_confirmation IS DISTINCT FROM 'DELETE_LEARNING_PROFILE' THEN
  RETURN jsonb_build_object('error','invalid_input','message','Confirmation is required.'); END IF;
 RETURN identity_private.remove_learning_profile(actor);
EXCEPTION
 WHEN foreign_key_violation THEN
  RETURN jsonb_build_object('error','conflict','message','The profile is still referenced by staff records.','sqlstate',SQLSTATE);
 WHEN OTHERS THEN
  RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.delete_own_learning_profile(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_own_learning_profile(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_student_learning_profile(p_student_id uuid,p_confirmation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); target_role text;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 IF p_student_id IS NULL OR p_confirmation IS DISTINCT FROM 'DELETE_STUDENT_PROFILE' THEN
  RETURN jsonb_build_object('error','invalid_input','message','Confirmation is required.'); END IF;
 SELECT coalesce(role::text,'student') INTO target_role FROM public.profiles WHERE id=p_student_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found','message','Profile not found.'); END IF;
 -- Never the own account and never another teacher or administrator.
 IF p_student_id=actor OR target_role<>'student' THEN
  RETURN jsonb_build_object('error','not_authorized','message','Only learner profiles can be deleted.'); END IF;
 RETURN identity_private.remove_learning_profile(p_student_id);
EXCEPTION
 WHEN foreign_key_violation THEN
  RETURN jsonb_build_object('error','conflict','message','The profile is still referenced by staff records.','sqlstate',SQLSTATE);
 WHEN OTHERS THEN
  RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.delete_student_learning_profile(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_student_learning_profile(uuid,text) TO authenticated;

-- Regression guards (R10, maschinenlesbar).
DO $migration$
BEGIN
 IF has_table_privilege('authenticated','pronunciation_private.staff_hidden_submissions','SELECT')
  OR has_table_privilege('authenticated','pronunciation_private.staff_hidden_messages','SELECT')
  OR has_table_privilege('anon','pronunciation_private.staff_hidden_submissions','SELECT')
  OR has_table_privilege('anon','pronunciation_private.staff_hidden_messages','SELECT') THEN
  RAISE EXCEPTION 'phase2_staff_view_readable' USING ERRCODE='42501';
 END IF;
 IF has_function_privilege('anon','public.set_pronunciation_submission_hidden(uuid,boolean)','EXECUTE')
  OR has_function_privilege('anon','public.set_pronunciation_message_hidden(uuid,boolean)','EXECUTE')
  OR has_function_privilege('anon','public.get_staff_pronunciation_view()','EXECUTE')
  OR has_function_privilege('anon','public.delete_own_learning_profile(text)','EXECUTE')
  OR has_function_privilege('anon','public.delete_student_learning_profile(uuid,text)','EXECUTE')
  OR has_function_privilege('anon','identity_private.remove_learning_profile(uuid)','EXECUTE')
  OR has_function_privilege('authenticated','identity_private.remove_learning_profile(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'phase2_delete_functions_public' USING ERRCODE='42501';
 END IF;
 -- The contract of this migration: deleting a profile must never delete the person.
 IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.contype='f' AND c.conrelid='public.people'::regclass
   AND c.confrelid='public.profiles'::regclass AND c.confdeltype='n') THEN
  RAISE EXCEPTION 'people_profile_link_must_be_set_null' USING ERRCODE='55000';
 END IF;
 IF NOT has_table_privilege(current_user,'auth.users','DELETE') THEN
  RAISE EXCEPTION 'function_owner_cannot_delete_accounts' USING ERRCODE='42501';
 END IF;
END $migration$;

NOTIFY pgrst, 'reload schema';
