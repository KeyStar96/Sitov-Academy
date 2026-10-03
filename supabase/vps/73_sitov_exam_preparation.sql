-- Global B1 exam preparation. Durable server-graded receipts and private submissions.
-- No teacher is inferred from a note author or from a course registration.
CREATE SCHEMA IF NOT EXISTS sitov_exam_private;
REVOKE ALL ON SCHEMA sitov_exam_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA sitov_exam_private TO authenticated,service_role;

CREATE TABLE IF NOT EXISTS public.sitov_exam_profiles (
 student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 profile_id text NOT NULL DEFAULT 'general_b1' CHECK(profile_id IN ('general_b1','dtz_a2_b1','telc_deutsch_b1','goethe_b1','oesd_zb1','telc_deutsch_a2_b1','oesd_zdoe_b1')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sitov_exam_teacher_assignments (
 student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 response_days integer NOT NULL DEFAULT 7 CHECK(response_days BETWEEN 1 AND 90),
 assigned_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), CHECK(student_id<>teacher_id)
);
CREATE INDEX IF NOT EXISTS sitov_exam_assignment_teacher_idx ON public.sitov_exam_teacher_assignments(teacher_id);
CREATE TABLE IF NOT EXISTS public.sitov_exam_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 task_id text NOT NULL, task_version integer NOT NULL CHECK(task_version>0), unit_id text NOT NULL,
 answer jsonb NOT NULL CHECK(jsonb_typeof(answer) IN('string','array') AND octet_length(answer::text)<=20000),
 correct boolean, helped boolean NOT NULL DEFAULT false, feedback_viewed boolean NOT NULL DEFAULT false,
 seconds integer NOT NULL DEFAULT 0 CHECK(seconds BETWEEN 0 AND 7200), mode text NOT NULL CHECK(mode IN('practice','checkpoint')),
 variant integer NOT NULL DEFAULT 0 CHECK(variant BETWEEN 0 AND 99), request_id uuid NOT NULL,
 feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(student_id,request_id)
);
CREATE INDEX IF NOT EXISTS sitov_exam_attempt_student_idx ON public.sitov_exam_attempts(student_id,created_at);
CREATE TABLE IF NOT EXISTS public.sitov_exam_hints (
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 task_id text NOT NULL, task_version integer NOT NULL CHECK(task_version>0), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,task_id,task_version)
);
CREATE TABLE IF NOT EXISTS public.sitov_exam_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 task_id text NOT NULL, task_version integer NOT NULL CHECK(task_version>0), unit_id text NOT NULL,
 request_id uuid NOT NULL DEFAULT gen_random_uuid(), explicit_submit boolean NOT NULL DEFAULT false,
 kind text NOT NULL CHECK(kind IN('writing','speaking')), helped boolean NOT NULL DEFAULT false, text_content text NOT NULL DEFAULT '' CHECK(length(text_content)<=20000),
 media_path text, photo_path text, teacher_id uuid,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','submitted','reviewed')),
 previous_id uuid REFERENCES public.sitov_exam_submissions(id) ON DELETE SET NULL,
 reflection text CHECK(length(reflection)<=5000), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status='draft' OR teacher_id IS NOT NULL),
 CHECK(media_path IS NULL OR media_path LIKE student_id::text||'/%'),
 CHECK(photo_path IS NULL OR photo_path LIKE student_id::text||'/%'),
 CHECK(length(trim(text_content))>0 OR media_path IS NOT NULL OR photo_path IS NOT NULL), CHECK(previous_id IS DISTINCT FROM id), UNIQUE(student_id,request_id)
);
CREATE INDEX IF NOT EXISTS sitov_exam_submission_student_idx ON public.sitov_exam_submissions(student_id,created_at);
CREATE INDEX IF NOT EXISTS sitov_exam_submission_teacher_idx ON public.sitov_exam_submissions(teacher_id,status,created_at);
CREATE TABLE IF NOT EXISTS public.sitov_exam_feedback (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.sitov_exam_submissions(id) ON DELETE CASCADE,
 teacher_id uuid NOT NULL, text_content text NOT NULL CHECK(length(trim(text_content)) BETWEEN 1 AND 10000),
 strengths text NOT NULL CHECK(length(strengths)<=5000), priorities jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(priorities)='array' AND jsonb_array_length(priorities)<=2),
 revision text NOT NULL CHECK(length(trim(revision)) BETWEEN 1 AND 5000), rating text NOT NULL CHECK(rating IN('practice','assisted','independent')),
 rubric jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(rubric)='array'), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sitov_exam_feedback_submission_idx ON public.sitov_exam_feedback(submission_id,created_at);
CREATE TABLE IF NOT EXISTS public.sitov_exam_unlocks (
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 module_id text NOT NULL, kind text NOT NULL CHECK(kind IN('teacher','fallback')),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 5000), created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(student_id,module_id,kind)
);
CREATE TABLE IF NOT EXISTS public.sitov_exam_audio_productions (
 audio_id text PRIMARY KEY, script_hash text NOT NULL, raw_path text, prepared_path text, raw_filename text, prepared_filename text,
 status text NOT NULL DEFAULT 'briefing' CHECK(status IN('briefing','script_review','ready_to_record','awaiting_recording','uploaded','reviewed','published')),
 created_by uuid NOT NULL, reviewed_by uuid,
 word_timings jsonb CHECK(word_timings IS NULL OR jsonb_typeof(word_timings)='array'), review_note text,
 reviewed_at timestamptz, published_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status NOT IN('reviewed','published') OR (prepared_path IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND length(trim(review_note))>0 AND coalesce(jsonb_array_length(word_timings),0)>0)),
 CHECK(status<>'published' OR published_at IS NOT NULL)
);

-- Historical authors, recipients and reviewers are immutable audit UUIDs.
-- Deleting a retired staff profile must preserve learner feedback and shared
-- human recordings. Live access always requires a profile and an assignment;
-- insert validation still requires a real, authorized staff member.
ALTER TABLE public.sitov_exam_teacher_assignments DROP CONSTRAINT IF EXISTS sitov_exam_teacher_assignments_assigned_by_fkey;
ALTER TABLE public.sitov_exam_submissions DROP CONSTRAINT IF EXISTS sitov_exam_submissions_teacher_id_fkey;
ALTER TABLE public.sitov_exam_feedback DROP CONSTRAINT IF EXISTS sitov_exam_feedback_teacher_id_fkey;
ALTER TABLE public.sitov_exam_unlocks DROP CONSTRAINT IF EXISTS sitov_exam_unlocks_created_by_fkey;
ALTER TABLE public.sitov_exam_audio_productions DROP CONSTRAINT IF EXISTS sitov_exam_audio_productions_created_by_fkey;
ALTER TABLE public.sitov_exam_audio_productions DROP CONSTRAINT IF EXISTS sitov_exam_audio_productions_reviewed_by_fkey;

-- Private ACL helper: authorization always derives from profiles and explicit assignments.
CREATE OR REPLACE FUNCTION sitov_exam_private.has_access(p_student uuid DEFAULT auth.uid()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND p_student=(SELECT auth.uid()) AND EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=p_student AND (p.role IN('teacher','admin') OR EXISTS(
 SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p.id AND a.level IN('B1.1','B1.2'))));
$$;
CREATE OR REPLACE FUNCTION sitov_exam_private.can_read(p_student uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND (
 (p_student=(SELECT auth.uid()) AND sitov_exam_private.has_access()) OR
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND (p.role='admin' OR (p.role='teacher' AND EXISTS(
 SELECT 1 FROM public.sitov_exam_teacher_assignments a WHERE a.student_id=p_student AND a.teacher_id=p.id)))));
$$;
CREATE OR REPLACE FUNCTION sitov_exam_private.is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role IN('admin','teacher'));
$$;
CREATE OR REPLACE FUNCTION sitov_exam_private.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role='admin');
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitov_exam_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sitov_exam_private TO authenticated,service_role;

CREATE OR REPLACE FUNCTION sitov_exam_private.validate_assignment() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.teacher_id AND role IN('teacher','admin')) OR
 NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.assigned_by AND role='admin') THEN RAISE check_violation USING message='invalid_exam_teacher_assignment'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sitov_exam_assignment_valid ON public.sitov_exam_teacher_assignments;
CREATE TRIGGER sitov_exam_assignment_valid BEFORE INSERT OR UPDATE ON public.sitov_exam_teacher_assignments FOR EACH ROW EXECUTE FUNCTION sitov_exam_private.validate_assignment();
CREATE OR REPLACE FUNCTION sitov_exam_private.validate_submission() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.previous_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sitov_exam_submissions s WHERE s.id=NEW.previous_id AND s.student_id=NEW.student_id AND s.task_id=NEW.task_id AND s.unit_id=NEW.unit_id AND s.kind=NEW.kind) THEN RAISE check_violation USING message='invalid_exam_revision'; END IF;
 IF NEW.status<>'draft' AND NOT EXISTS(SELECT 1 FROM public.sitov_exam_teacher_assignments a WHERE a.student_id=NEW.student_id AND a.teacher_id=NEW.teacher_id) THEN RAISE check_violation USING message='missing_exam_recipient'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sitov_exam_submission_valid ON public.sitov_exam_submissions;
CREATE TRIGGER sitov_exam_submission_valid BEFORE INSERT OR UPDATE ON public.sitov_exam_submissions FOR EACH ROW EXECUTE FUNCTION sitov_exam_private.validate_submission();


CREATE OR REPLACE FUNCTION sitov_exam_private.validate_feedback() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ DECLARE target public.sitov_exam_submissions; BEGIN
 SELECT * INTO target FROM public.sitov_exam_submissions WHERE id=NEW.submission_id FOR UPDATE;
 IF target.id IS NULL OR target.status='draft' OR NOT EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=NEW.teacher_id AND (p.role='admin' OR (p.role='teacher' AND target.teacher_id=p.id AND EXISTS(
 SELECT 1 FROM public.sitov_exam_teacher_assignments a WHERE a.student_id=target.student_id AND a.teacher_id=p.id))))
 THEN RAISE check_violation USING message='unauthorized_exam_feedback'; END IF;
 IF NEW.rating='independent' AND target.helped THEN RAISE check_violation USING message='assisted_exam_submission'; END IF;
 UPDATE public.sitov_exam_submissions SET status='reviewed' WHERE id=target.id;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sitov_exam_feedback_valid ON public.sitov_exam_feedback;
CREATE TRIGGER sitov_exam_feedback_valid BEFORE INSERT ON public.sitov_exam_feedback FOR EACH ROW EXECUTE FUNCTION sitov_exam_private.validate_feedback();

DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['sitov_exam_profiles','sitov_exam_teacher_assignments','sitov_exam_attempts','sitov_exam_hints','sitov_exam_submissions','sitov_exam_feedback','sitov_exam_unlocks','sitov_exam_audio_productions'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',name);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',name);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',name);
 END LOOP;
END $$;
DROP POLICY IF EXISTS sitov_exam_profile_read ON public.sitov_exam_profiles;
CREATE POLICY sitov_exam_profile_read ON public.sitov_exam_profiles FOR SELECT TO authenticated USING(sitov_exam_private.can_read(student_id));
DROP POLICY IF EXISTS sitov_exam_assignment_read ON public.sitov_exam_teacher_assignments;
CREATE POLICY sitov_exam_assignment_read ON public.sitov_exam_teacher_assignments FOR SELECT TO authenticated USING(sitov_exam_private.can_read(student_id));
DROP POLICY IF EXISTS sitov_exam_attempt_read ON public.sitov_exam_attempts;
CREATE POLICY sitov_exam_attempt_read ON public.sitov_exam_attempts FOR SELECT TO authenticated USING(sitov_exam_private.can_read(student_id));
DROP POLICY IF EXISTS sitov_exam_hint_read ON public.sitov_exam_hints;
CREATE POLICY sitov_exam_hint_read ON public.sitov_exam_hints FOR SELECT TO authenticated USING(sitov_exam_private.can_read(student_id));
DROP POLICY IF EXISTS sitov_exam_submission_read ON public.sitov_exam_submissions;
CREATE POLICY sitov_exam_submission_read ON public.sitov_exam_submissions FOR SELECT TO authenticated USING(
 (student_id=(SELECT auth.uid()) AND sitov_exam_private.has_access()) OR sitov_exam_private.is_admin() OR
 (status<>'draft' AND teacher_id=(SELECT auth.uid()) AND sitov_exam_private.can_read(student_id)));
DROP POLICY IF EXISTS sitov_exam_feedback_read ON public.sitov_exam_feedback;
CREATE POLICY sitov_exam_feedback_read ON public.sitov_exam_feedback FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.sitov_exam_submissions s WHERE s.id=submission_id));
DROP POLICY IF EXISTS sitov_exam_unlock_read ON public.sitov_exam_unlocks;
CREATE POLICY sitov_exam_unlock_read ON public.sitov_exam_unlocks FOR SELECT TO authenticated USING(sitov_exam_private.can_read(student_id));
DROP POLICY IF EXISTS sitov_exam_production_read ON public.sitov_exam_audio_productions;
CREATE POLICY sitov_exam_production_read ON public.sitov_exam_audio_productions FOR SELECT TO authenticated USING(sitov_exam_private.is_staff());

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('sitov-exam-submissions','sitov-exam-submissions',false,20971520,ARRAY['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-wav','audio/x-m4a','image/jpeg','image/png','image/webp']),
 ('sitov-exam-productions','sitov-exam-productions',false,20971520,ARRAY['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-wav','audio/x-m4a'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS sitov_exam_private_media_read ON storage.objects;
CREATE POLICY sitov_exam_private_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='sitov-exam-submissions' AND EXISTS(
 SELECT 1 FROM public.sitov_exam_submissions s WHERE (s.media_path=name OR s.photo_path=name)));
DROP POLICY IF EXISTS sitov_exam_production_media_read ON storage.objects;
CREATE POLICY sitov_exam_production_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='sitov-exam-productions' AND sitov_exam_private.is_staff());

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitov_exam_private FROM PUBLIC,anon;
NOTIFY pgrst,'reload schema';

-- Bound new private buckets even if an older deployment has a permissive generic policy.
DROP POLICY IF EXISTS sitov_exam_media_read_bounds ON storage.objects;
CREATE POLICY sitov_exam_media_read_bounds ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(
 bucket_id NOT IN('sitov-exam-submissions','sitov-exam-productions') OR
 (bucket_id='sitov-exam-submissions' AND EXISTS(SELECT 1 FROM public.sitov_exam_submissions s WHERE s.media_path=name OR s.photo_path=name)) OR
 (bucket_id='sitov-exam-productions' AND sitov_exam_private.is_staff()));
DROP POLICY IF EXISTS sitov_exam_media_insert_bounds ON storage.objects;
CREATE POLICY sitov_exam_media_insert_bounds ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(bucket_id NOT IN('sitov-exam-submissions','sitov-exam-productions'));
DROP POLICY IF EXISTS sitov_exam_media_update_bounds ON storage.objects;
CREATE POLICY sitov_exam_media_update_bounds ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(bucket_id NOT IN('sitov-exam-submissions','sitov-exam-productions')) WITH CHECK(bucket_id NOT IN('sitov-exam-submissions','sitov-exam-productions'));
DROP POLICY IF EXISTS sitov_exam_media_delete_bounds ON storage.objects;
CREATE POLICY sitov_exam_media_delete_bounds ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(bucket_id NOT IN('sitov-exam-submissions','sitov-exam-productions'));

-- Grade snapshots and solution feedback are server-only until a complete checkpoint ends.
REVOKE SELECT ON public.sitov_exam_attempts FROM authenticated;
GRANT SELECT(id,student_id,task_id,task_version,unit_id,answer,helped,feedback_viewed,seconds,mode,variant,request_id,created_at) ON public.sitov_exam_attempts TO authenticated;

-- Private learner files participate in the existing recoverable global reset.
-- A signed upload may outlive its page. Ticket deletion fences old upload URLs.
CREATE TABLE IF NOT EXISTS public.sitov_exam_upload_tickets (
 path text PRIMARY KEY, student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('speaking','photo')), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(path LIKE student_id::text||'/'||kind||'/%')
);
ALTER TABLE public.sitov_exam_upload_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sitov_exam_upload_tickets FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.sitov_exam_upload_tickets TO service_role;

CREATE OR REPLACE FUNCTION sitov_exam_private.guard_learning_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE learner uuid; BEGIN
 IF TG_TABLE_NAME='sitov_exam_feedback' THEN
  SELECT student_id INTO learner FROM public.sitov_exam_submissions WHERE id=NEW.submission_id;
 ELSE learner:=NEW.student_id; END IF;
 IF learner IS NULL THEN RAISE EXCEPTION 'invalid_exam_learner' USING ERRCODE='23514'; END IF;
 -- The same order as begin/finish reset and account deletion.
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||learner::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM learning_reset_private.assert_writable(learner);
 RETURN NEW;
END $$;
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['sitov_exam_profiles','sitov_exam_attempts','sitov_exam_hints','sitov_exam_submissions','sitov_exam_feedback','sitov_exam_unlocks','sitov_exam_upload_tickets'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS sitov_exam_reset_guard ON public.%I',name);
 EXECUTE format('CREATE TRIGGER sitov_exam_reset_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION sitov_exam_private.guard_learning_write()',name);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION sitov_exam_private.guard_storage_upload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE learner uuid; issued timestamptz; BEGIN
 IF NEW.bucket_id<>'sitov-exam-submissions' THEN RETURN NEW; END IF;
 SELECT t.student_id,t.created_at INTO learner,issued FROM public.sitov_exam_upload_tickets t
 JOIN public.profiles p ON p.id=t.student_id WHERE t.path=NEW.name;
 IF learner IS NULL THEN RAISE EXCEPTION 'exam_upload_ticket_expired' USING ERRCODE='55000'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||learner::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM learning_reset_private.assert_writable(learner);
 -- The ticket may have been deleted while this transaction waited for reset.
 IF NOT EXISTS(SELECT 1 FROM public.sitov_exam_upload_tickets WHERE path=NEW.name)
 OR EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE auth_user_id=learner AND completed_at>=issued)
 THEN RAISE EXCEPTION 'exam_upload_ticket_expired' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sitov_exam_storage_reset_guard ON storage.objects;
CREATE TRIGGER sitov_exam_storage_reset_guard BEFORE INSERT OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION sitov_exam_private.guard_storage_upload();

ALTER TABLE learning_reset_private.audio_objects DROP CONSTRAINT IF EXISTS audio_objects_bucket_id_check;
ALTER TABLE learning_reset_private.audio_objects ADD CONSTRAINT audio_objects_bucket_id_check CHECK(bucket_id IN('pronunciation_audio','sitov-exam-submissions'));
CREATE OR REPLACE FUNCTION sitov_exam_private.capture_reset_media(p_student uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NULL OR p_student IS DISTINCT FROM auth.uid() OR NOT EXISTS(
 SELECT 1 FROM learning_reset_private.jobs WHERE auth_user_id=p_student AND active)
 THEN RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501'; END IF;
 INSERT INTO learning_reset_private.audio_objects(auth_user_id,object_id,bucket_id,object_name)
 SELECT p_student,o.id,o.bucket_id,o.name FROM storage.objects o
 WHERE o.bucket_id='sitov-exam-submissions' AND split_part(o.name,'/',1)=p_student::text
 AND NOT EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a WHERE a.auth_user_id=p_student AND a.object_id=o.id);
END $$;

DO $sitov$ DECLARE body text; marker text; BEGIN
 body:=pg_get_functiondef('learning_reset_private.begin_reset(text)'::regprocedure);
 IF strpos(body,'capture_reset_media')=0 THEN
  marker:='IF FOUND AND job.active THEN RETURN job.token; END IF;';
  IF strpos(body,marker)=0 OR strpos(body,'RETURN job.token;')=0 THEN RAISE EXCEPTION 'sitov_exam_reset_begin_contract_changed'; END IF;
  body:=replace(body,marker,'IF FOUND AND job.active THEN PERFORM sitov_exam_private.capture_reset_media(actor); RETURN job.token; END IF;');
  -- Capture both a fresh reset and a job started before this migration.
  body:=replace(body,E'\n RETURN job.token;',E'\n PERFORM sitov_exam_private.capture_reset_media(actor);\n RETURN job.token;');
  EXECUTE body;
 END IF;
 body:=pg_get_functiondef('learning_reset_private.finish_reset(uuid)'::regprocedure);
 IF strpos(body,'DELETE FROM public.sitov_exam_attempts')=0 THEN
  marker:='DELETE FROM public.user_exercise_progress';
  IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'sitov_exam_reset_finish_contract_changed'; END IF;
  EXECUTE replace(body,marker,$fragment$
  DELETE FROM public.sitov_exam_submissions WHERE student_id=actor;
  DELETE FROM public.sitov_exam_attempts WHERE student_id=actor;
  DELETE FROM public.sitov_exam_hints WHERE student_id=actor;
  DELETE FROM public.sitov_exam_unlocks WHERE student_id=actor;
  DELETE FROM public.sitov_exam_upload_tickets WHERE student_id=actor;
  -- The chosen target profile and real teacher assignment are preferences.
  DELETE FROM public.user_exercise_progress$fragment$);
 END IF;
END $sitov$;

-- Keep the existing two-phase account deletion, adding explicit bucket identities.
DO $sitov$ DECLARE body text; marker text:='SELECT jsonb_agg(x.name ORDER BY x.name) INTO pending'; BEGIN
 body:=pg_get_functiondef('identity_private.remove_learning_profile(uuid)'::regprocedure);
 IF strpos(body,'''pendingFiles''')=0 THEN
  IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'sitov_exam_account_delete_contract_changed'; END IF;
  EXECUTE replace(body,marker,$fragment$
  SELECT jsonb_agg(jsonb_build_object('bucket_id',x.bucket_id,'object_name',x.name) ORDER BY x.name) INTO pending FROM (
   SELECT o.bucket_id,o.name FROM storage.objects o WHERE o.bucket_id='sitov-exam-submissions'
    AND split_part(o.name,'/',1)=p_target::text ORDER BY o.name LIMIT 200) x;
  IF pending IS NOT NULL THEN RETURN jsonb_build_object('success',true,'deleted',false,'pendingFiles',pending); END IF;
  SELECT jsonb_agg(x.name ORDER BY x.name) INTO pending$fragment$);
 END IF;
END $sitov$;

DROP POLICY IF EXISTS sitov_exam_reset_media_read ON storage.objects;
CREATE POLICY sitov_exam_reset_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id IN('pronunciation_audio','sitov-exam-submissions') AND learning_reset_private.can_remove_audio(id));
DROP POLICY IF EXISTS sitov_exam_reset_media_delete ON storage.objects;
CREATE POLICY sitov_exam_reset_media_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id IN('pronunciation_audio','sitov-exam-submissions') AND learning_reset_private.can_remove_audio(id));
DROP POLICY IF EXISTS sitov_exam_media_read_bounds ON storage.objects;
CREATE POLICY sitov_exam_media_read_bounds ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(
 bucket_id NOT IN('sitov-exam-submissions','sitov-exam-productions') OR
 (bucket_id='sitov-exam-submissions' AND (learning_reset_private.can_remove_audio(id) OR EXISTS(SELECT 1 FROM public.sitov_exam_submissions s WHERE s.media_path=name OR s.photo_path=name))) OR
 (bucket_id='sitov-exam-productions' AND sitov_exam_private.is_staff()));
DROP POLICY IF EXISTS sitov_exam_media_delete_bounds ON storage.objects;
CREATE POLICY sitov_exam_media_delete_bounds ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(
 bucket_id NOT IN('sitov-exam-submissions','sitov-exam-productions') OR (bucket_id='sitov-exam-submissions' AND learning_reset_private.can_remove_audio(id)));
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitov_exam_private FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION sitov_exam_private.guard_learning_write(),sitov_exam_private.guard_storage_upload(),sitov_exam_private.capture_reset_media(uuid) FROM authenticated,service_role;
NOTIFY pgrst,'reload schema';
