-- Defines an opt-in, resumable reset. This migration does not reset any account.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
CREATE SCHEMA learning_reset_private;
REVOKE ALL ON SCHEMA learning_reset_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA learning_reset_private TO authenticated;
CREATE TABLE learning_reset_private.jobs (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 active boolean NOT NULL DEFAULT true,
 requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz
);
CREATE TABLE learning_reset_private.audio_objects (
 user_id uuid NOT NULL REFERENCES learning_reset_private.jobs(user_id) ON DELETE CASCADE,
 object_id uuid NOT NULL,
 bucket_id text NOT NULL CHECK (bucket_id IN ('audio_submissions','pronunciation_audio')),
 object_name text NOT NULL,
 PRIMARY KEY(user_id, object_id)
);
ALTER TABLE learning_reset_private.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_reset_private.audio_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON learning_reset_private.jobs, learning_reset_private.audio_objects FROM PUBLIC, anon, authenticated;
-- No API table grants. Only the owner-checked functions below access this schema.

CREATE FUNCTION learning_reset_private.matches_audio(p_reference text,p_bucket text,p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(p_reference='storage://' || p_bucket || '/' || p_name OR
 split_part(p_reference,'?',1) IN (
 'https://wcaslabeiwtvygxtzcio.supabase.co/storage/v1/object/public/' || p_bucket || '/' || p_name,
 'https://wcaslabeiwtvygxtzcio.supabase.co/storage/v1/object/sign/' || p_bucket || '/' || p_name,
 'https://wcaslabeiwtvygxtzcio.supabase.co/storage/v1/object/authenticated/' || p_bucket || '/' || p_name),false);
$$;
REVOKE ALL ON FUNCTION learning_reset_private.matches_audio(text,text,text) FROM PUBLIC,anon,authenticated;

-- Lock order matches the existing vocabulary RPCs, then serializes all learning
-- writes for this learner. A pending reset cannot be repopulated by other tabs.
CREATE FUNCTION learning_reset_private.assert_writable(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE was_active boolean;
BEGIN
 IF p_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 SELECT active INTO was_active FROM learning_reset_private.jobs WHERE user_id=p_user;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:' || p_user::text,0));
 IF coalesce(was_active,false) OR EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE user_id=p_user AND
   (active OR completed_at > transaction_timestamp())) THEN
  RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000';
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.assert_writable(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION learning_reset_private.guard_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE learner uuid; reference text;
BEGIN
 -- Only the reset owner may detach an unchanged foreign legacy child before
 -- deleting its own parent. Do not cascade-delete another learner's submission.
 IF TG_TABLE_NAME='submissions' THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.parent_id IS NULL AND OLD.parent_id IS NOT NULL
    AND (to_jsonb(NEW)-'parent_id')=(to_jsonb(OLD)-'parent_id')
    AND EXISTS(SELECT 1 FROM public.submissions s JOIN learning_reset_private.jobs j ON j.user_id=s.user_id
      WHERE s.id=OLD.parent_id AND j.active AND s.user_id=(SELECT auth.uid())) THEN RETURN NEW; END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME IN ('submissions','pronunciation_messages','teacher_feedback') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
  IF TG_TABLE_NAME='submissions' THEN reference:=NEW.content_url;
  ELSIF TG_TABLE_NAME='pronunciation_messages' THEN reference:=NEW.audio_path;
  ELSE reference:=NEW.feedback_audio_url; END IF;
  IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
    WHERE j.active AND learning_reset_private.matches_audio(reference,a.bucket_id,a.object_name)) THEN
   RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000';
  END IF;
 END IF;
 IF TG_TABLE_NAME IN ('pronunciation_messages','teacher_feedback') THEN
  SELECT user_id INTO learner FROM public.submissions WHERE id=NEW.submission_id;
 ELSE learner:=NEW.user_id;
 END IF;
 IF learner IS NOT NULL THEN PERFORM learning_reset_private.assert_writable(learner); END IF;
 IF TG_TABLE_NAME='submissions' THEN
  IF NEW.parent_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.submissions WHERE id=NEW.parent_id AND user_id<>NEW.user_id) THEN
   RAISE EXCEPTION 'submission_owner_mismatch' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.guard_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.user_vocabulary_progress FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.vocabulary_direction_progress FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.vocabulary_learning_state FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.vocabulary_onboarding FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON vocabulary_private.answer_receipts FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.user_exercise_progress FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.teacher_feedback FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.pronunciation_messages FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();

CREATE FUNCTION learning_reset_private.storage_writable(p_bucket text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_bucket NOT IN ('audio_submissions','pronunciation_audio') THEN RETURN true; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
   WHERE a.object_id=p_id AND j.active) THEN RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000'; END IF;
 PERFORM learning_reset_private.assert_writable((SELECT auth.uid()));
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.storage_writable(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_reset_private.storage_writable(text,uuid) TO authenticated;
CREATE POLICY "No audio uploads during learning reset" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (learning_reset_private.storage_writable(bucket_id,id));
CREATE POLICY "No audio overwrites during learning reset" ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (learning_reset_private.storage_writable(bucket_id,id)) WITH CHECK (learning_reset_private.storage_writable(bucket_id,id));

CREATE FUNCTION learning_reset_private.begin_reset(p_confirmation text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); job learning_reset_private.jobs;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor) THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_confirmation IS DISTINCT FROM 'RESET_LEARNING_DATA' THEN RAISE EXCEPTION 'confirmation_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:' || actor::text,0));
 SELECT * INTO job FROM learning_reset_private.jobs WHERE user_id=actor FOR UPDATE;
 IF FOUND AND job.active THEN RETURN job.token; END IF;
 INSERT INTO learning_reset_private.jobs(user_id) VALUES(actor)
 ON CONFLICT(user_id) DO UPDATE SET token=gen_random_uuid(),active=true,requested_at=clock_timestamp(),completed_at=NULL
 RETURNING * INTO job;
 DELETE FROM learning_reset_private.audio_objects WHERE user_id=actor;
 -- Storage is read-only in SQL: snapshot object identities; the Action uses remove().
 -- Never trust a student's arbitrary content_url as proof of file ownership.
 INSERT INTO learning_reset_private.audio_objects(user_id,object_id,bucket_id,object_name)
 SELECT actor,o.id,o.bucket_id,o.name FROM storage.objects o
 WHERE o.bucket_id IN ('audio_submissions','pronunciation_audio') AND (
   o.owner_id=actor::text
   OR (o.owner_id IS NULL AND (o.name LIKE actor::text || '/%' OR o.name LIKE actor::text || '-%'))
   OR EXISTS(SELECT 1 FROM public.teacher_feedback f JOIN public.submissions s ON s.id=f.submission_id
     WHERE s.user_id=actor AND (o.owner_id=f.teacher_id::text OR (o.owner_id IS NULL AND o.name LIKE 'feedback/' || s.id::text || '_%'))
     AND learning_reset_private.matches_audio(f.feedback_audio_url,o.bucket_id,o.name))
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id
     WHERE s.user_id=actor AND o.owner_id=m.sender_id::text AND learning_reset_private.matches_audio(m.audio_path,o.bucket_id,o.name))
 )
 -- A teacher's clip shared with another learner must remain available there.
 AND NOT EXISTS(SELECT 1 FROM public.submissions s WHERE s.user_id<>actor AND learning_reset_private.matches_audio(s.content_url,o.bucket_id,o.name))
 AND NOT EXISTS(SELECT 1 FROM public.teacher_feedback f JOIN public.submissions s ON s.id=f.submission_id
   WHERE s.user_id<>actor AND learning_reset_private.matches_audio(f.feedback_audio_url,o.bucket_id,o.name))
 AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id
   WHERE s.user_id<>actor AND learning_reset_private.matches_audio(m.audio_path,o.bucket_id,o.name));
 RETURN job.token;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.begin_reset(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_reset_private.begin_reset(text) TO authenticated;
CREATE FUNCTION public.begin_learning_reset(p_confirmation text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT learning_reset_private.begin_reset(p_confirmation); $$;
REVOKE ALL ON FUNCTION public.begin_learning_reset(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_learning_reset(text) TO authenticated;

CREATE FUNCTION learning_reset_private.can_remove_audio(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
 SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
 WHERE a.user_id=(SELECT auth.uid()) AND a.object_id=p_id AND j.active);
$$;
REVOKE ALL ON FUNCTION learning_reset_private.can_remove_audio(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_reset_private.can_remove_audio(uuid) TO authenticated;
CREATE POLICY "Learning reset reads approved audio objects" ON storage.objects FOR SELECT TO authenticated
 USING (learning_reset_private.can_remove_audio(id));
CREATE POLICY "Learning reset deletes approved audio objects" ON storage.objects FOR DELETE TO authenticated
 USING (learning_reset_private.can_remove_audio(id));

CREATE FUNCTION learning_reset_private.audio_batch(p_token uuid)
RETURNS TABLE(bucket_id text,object_name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid());
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE user_id=actor AND token=p_token) THEN
  RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT a.bucket_id,a.object_name FROM learning_reset_private.audio_objects a
 JOIN storage.objects o ON o.id=a.object_id AND o.bucket_id=a.bucket_id AND o.name=a.object_name
 JOIN learning_reset_private.jobs j ON j.user_id=a.user_id
 WHERE a.user_id=actor AND j.active ORDER BY a.bucket_id,a.object_name LIMIT 500;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.audio_batch(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_reset_private.audio_batch(uuid) TO authenticated;
CREATE FUNCTION public.learning_reset_audio_batch(p_token uuid)
RETURNS TABLE(bucket_id text,object_name text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM learning_reset_private.audio_batch(p_token);
$$;
REVOKE ALL ON FUNCTION public.learning_reset_audio_batch(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.learning_reset_audio_batch(uuid) TO authenticated;

CREATE FUNCTION learning_reset_private.finish_reset(p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); job learning_reset_private.jobs;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:' || actor::text,0));
 SELECT * INTO job FROM learning_reset_private.jobs WHERE user_id=actor AND token=p_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501'; END IF;
 IF NOT job.active THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN storage.objects o ON o.id=a.object_id
   WHERE a.user_id=actor) THEN RAISE EXCEPTION 'audio_removal_incomplete' USING ERRCODE='55000'; END IF;
 -- Keep other learners' data even if an old row had an invalid cross-user parent.
 UPDATE public.submissions SET parent_id=NULL WHERE user_id<>actor AND parent_id IN(SELECT id FROM public.submissions WHERE user_id=actor);
 DELETE FROM public.pronunciation_messages WHERE submission_id IN(SELECT id FROM public.submissions WHERE user_id=actor);
 DELETE FROM public.teacher_feedback WHERE submission_id IN(SELECT id FROM public.submissions WHERE user_id=actor);
 DELETE FROM public.submissions WHERE user_id=actor;
 DELETE FROM vocabulary_private.answer_receipts WHERE user_id=actor;
 DELETE FROM public.user_vocabulary_progress WHERE user_id=actor;
 DELETE FROM public.vocabulary_direction_progress WHERE user_id=actor;
 DELETE FROM public.vocabulary_learning_state WHERE user_id=actor;
 DELETE FROM public.vocabulary_onboarding WHERE user_id=actor;
 DELETE FROM public.user_exercise_progress WHERE user_id=actor;
 DELETE FROM learning_reset_private.audio_objects WHERE user_id=actor;
 UPDATE learning_reset_private.jobs SET active=false,completed_at=clock_timestamp() WHERE user_id=actor;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.finish_reset(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_reset_private.finish_reset(uuid) TO authenticated;
CREATE FUNCTION public.finish_learning_reset(p_token uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT learning_reset_private.finish_reset(p_token); $$;
REVOKE ALL ON FUNCTION public.finish_learning_reset(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finish_learning_reset(uuid) TO authenticated;
COMMIT;
