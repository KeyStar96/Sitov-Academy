-- Sitov Academy: only assigned staff may erase simulation progress.
-- A durable job fences old pages and signed uploads before private file cleanup.
CREATE TABLE IF NOT EXISTS sitov_simulation_private.reset_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 generation bigint NOT NULL CHECK(generation>0),
 requested_by uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','completed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz,
 UNIQUE(id,student_id), UNIQUE(student_id,generation),
 CHECK((status='pending' AND completed_at IS NULL) OR (status='completed' AND completed_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS sitov_simulation_private.reset_media (
 job_id uuid NOT NULL REFERENCES sitov_simulation_private.reset_jobs(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 bucket text NOT NULL CHECK(bucket='sitov-exam-submissions'),
 path text NOT NULL CHECK(length(path)<=300 AND strpos(path,'..')=0 AND path LIKE student_id::text||'/speaking/%'),
 PRIMARY KEY(job_id,path),
 FOREIGN KEY(job_id,student_id) REFERENCES sitov_simulation_private.reset_jobs(id,student_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS sitov_simulation_reset_media_path_idx ON sitov_simulation_private.reset_media(path);
CREATE TABLE IF NOT EXISTS sitov_simulation_private.reset_requests (
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, job_id uuid NOT NULL,
 requested_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(student_id,request_id),
 FOREIGN KEY(job_id,student_id) REFERENCES sitov_simulation_private.reset_jobs(id,student_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.sitov_simulation_learning_state (
 student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 generation bigint NOT NULL DEFAULT 0 CHECK(generation>=0),
 reset_pending uuid REFERENCES sitov_simulation_private.reset_jobs(id) ON DELETE SET NULL
);
ALTER TABLE public.sitov_simulation_runs ADD COLUMN IF NOT EXISTS generation bigint NOT NULL DEFAULT 0 CHECK(generation>=0);
ALTER TABLE public.sitov_simulation_learning_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sitov_simulation_learning_state FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.sitov_simulation_learning_state TO service_role;
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['reset_jobs','reset_media','reset_requests'] LOOP
  EXECUTE format('ALTER TABLE sitov_simulation_private.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('REVOKE ALL ON sitov_simulation_private.%I FROM PUBLIC,anon,authenticated',name);
  EXECUTE format('GRANT ALL ON sitov_simulation_private.%I TO service_role',name);
 END LOOP;
END $$;

-- Always obtain current authorization after the shared learner lock.
ALTER FUNCTION sitov_simulation_private.feature_allowed(uuid) VOLATILE;
CREATE OR REPLACE FUNCTION sitov_simulation_private.assert_reset_staff(p_student uuid,p_staff uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student AND role='student')
 OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_staff AND (p.role='admin' OR (p.role='teacher' AND EXISTS(
  SELECT 1 FROM public.sitov_exam_teacher_assignments a WHERE a.student_id=p_student AND a.teacher_id=p_staff))))
 THEN RAISE EXCEPTION 'unauthorized_simulation_reset' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.assert_reset_staff(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sitov_simulation_private.assert_reset_staff(uuid,uuid) TO service_role;

-- Existing learning-reset internals stay private; this helper exposes no rows.
CREATE OR REPLACE FUNCTION sitov_simulation_private.assert_no_global_reset(p_student uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE auth_user_id=p_student AND
  (active OR completed_at>transaction_timestamp()))
 THEN RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000'; END IF;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.assert_no_global_reset(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sitov_simulation_private.assert_no_global_reset(uuid) TO service_role;

CREATE OR REPLACE FUNCTION sitov_simulation_private.lock_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||CASE WHEN TG_OP='DELETE' THEN OLD.student_id ELSE NEW.student_id END::text,0));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.lock_assignment() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_simulation_assignment_lock ON public.sitov_exam_teacher_assignments;
CREATE TRIGGER sitov_simulation_assignment_lock BEFORE INSERT OR UPDATE OR DELETE ON public.sitov_exam_teacher_assignments FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.lock_assignment();

CREATE OR REPLACE FUNCTION sitov_simulation_private.guard_reset_run() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_generation bigint; pending uuid; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||NEW.student_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 SELECT generation,reset_pending INTO current_generation,pending FROM public.sitov_simulation_learning_state WHERE student_id=NEW.student_id;
 IF pending IS NOT NULL THEN RAISE EXCEPTION 'simulation_reset_in_progress' USING ERRCODE='55000'; END IF;
 IF NEW.generation<>coalesce(current_generation,0) THEN RAISE EXCEPTION 'simulation_generation_changed' USING ERRCODE='55000'; END IF;
 IF TG_OP='UPDATE' AND NEW.generation<>OLD.generation THEN RAISE EXCEPTION 'immutable_simulation_assignment' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.guard_reset_run() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_simulation_reset_epoch_guard ON public.sitov_simulation_runs;
CREATE TRIGGER sitov_simulation_reset_epoch_guard BEFORE INSERT OR UPDATE ON public.sitov_simulation_runs FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.guard_reset_run();

CREATE OR REPLACE FUNCTION sitov_simulation_private.guard_retired_ticket() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||NEW.student_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 IF EXISTS(SELECT 1 FROM sitov_simulation_private.reset_media WHERE path=NEW.path)
 THEN RAISE EXCEPTION 'simulation_recording_retired' USING ERRCODE='55000'; END IF;
 IF NEW.simulation_run_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.sitov_simulation_learning_state WHERE student_id=NEW.student_id AND reset_pending IS NOT NULL)
 THEN RAISE EXCEPTION 'simulation_reset_in_progress' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.guard_retired_ticket() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_simulation_retired_ticket_guard ON public.sitov_exam_upload_tickets;
CREATE TRIGGER sitov_simulation_retired_ticket_guard BEFORE INSERT OR UPDATE ON public.sitov_exam_upload_tickets FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.guard_retired_ticket();

CREATE OR REPLACE FUNCTION sitov_simulation_private.guard_retired_storage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE learner uuid; BEGIN
 IF NEW.bucket_id<>'sitov-exam-submissions' THEN RETURN NEW; END IF;
 SELECT student_id INTO learner FROM public.sitov_exam_upload_tickets WHERE path=NEW.name;
 IF learner IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||learner::text,0)); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 IF EXISTS(SELECT 1 FROM sitov_simulation_private.reset_media WHERE path=NEW.name)
 THEN RAISE EXCEPTION 'simulation_recording_retired' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.guard_retired_storage() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_simulation_retired_storage_guard ON storage.objects;
CREATE TRIGGER sitov_simulation_retired_storage_guard BEFORE INSERT OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.guard_retired_storage();

-- A preparation edit may not acquire a file after staff queued its deletion.
CREATE OR REPLACE FUNCTION sitov_simulation_private.guard_retired_preparation_media() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||NEW.student_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 IF EXISTS(SELECT 1 FROM sitov_simulation_private.reset_media WHERE path=NEW.media_path OR path=NEW.photo_path)
 THEN RAISE EXCEPTION 'simulation_recording_retired' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.guard_retired_preparation_media() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_simulation_preparation_media_guard ON public.sitov_exam_submissions;
CREATE TRIGGER sitov_simulation_preparation_media_guard BEFORE INSERT OR UPDATE ON public.sitov_exam_submissions FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.guard_retired_preparation_media();

CREATE OR REPLACE FUNCTION public.sitov_begin_simulation_reset(p_student_id uuid,p_staff_id uuid,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE state public.sitov_simulation_learning_state; job sitov_simulation_private.reset_jobs; receipt sitov_simulation_private.reset_requests; media jsonb; BEGIN
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'simulation_reset_request_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||p_student_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM sitov_simulation_private.assert_reset_staff(p_student_id,p_staff_id);
 PERFORM sitov_simulation_private.assert_no_global_reset(p_student_id);
 SELECT * INTO receipt FROM sitov_simulation_private.reset_requests WHERE student_id=p_student_id AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.requested_by<>p_staff_id THEN RAISE EXCEPTION 'simulation_reset_request_reused' USING ERRCODE='23514'; END IF;
  SELECT * INTO job FROM sitov_simulation_private.reset_jobs WHERE id=receipt.job_id;
 ELSE
  INSERT INTO public.sitov_simulation_learning_state(student_id) VALUES(p_student_id) ON CONFLICT DO NOTHING;
  SELECT * INTO state FROM public.sitov_simulation_learning_state WHERE student_id=p_student_id FOR UPDATE;
  IF state.reset_pending IS NOT NULL THEN
   SELECT * INTO job FROM sitov_simulation_private.reset_jobs WHERE id=state.reset_pending;
  ELSE
   INSERT INTO sitov_simulation_private.reset_jobs(student_id,generation,requested_by) VALUES(p_student_id,state.generation+1,p_staff_id) RETURNING * INTO job;
   UPDATE public.sitov_simulation_learning_state SET generation=job.generation,reset_pending=job.id WHERE student_id=p_student_id;
   -- Capture before deleting snapshots/tickets, including unused uploaded files.
   -- A real preparation submission keeps its shared recording and upload ticket.
   INSERT INTO sitov_simulation_private.reset_media(job_id,student_id,bucket,path)
   SELECT job.id,p_student_id,'sitov-exam-submissions',candidate.path FROM (
    SELECT t.path FROM public.sitov_exam_upload_tickets t WHERE t.student_id=p_student_id AND t.simulation_run_id IS NOT NULL
    UNION
    SELECT a.value->>'audioPath' FROM public.sitov_simulation_runs r
     CROSS JOIN LATERAL jsonb_each(r.server_snapshot->'answers') a WHERE r.student_id=p_student_id AND jsonb_typeof(a.value)='object'
   ) candidate WHERE candidate.path LIKE p_student_id::text||'/speaking/%' AND length(candidate.path)<=300 AND strpos(candidate.path,'..')=0
    AND NOT EXISTS(SELECT 1 FROM public.sitov_exam_submissions s WHERE s.media_path=candidate.path OR s.photo_path=candidate.path);
   -- Convert shared preparation references to their original independent ticket.
   -- Otherwise the run FK cascade would silently remove their upload ownership.
   UPDATE public.sitov_exam_upload_tickets t SET simulation_run_id=NULL
    WHERE t.student_id=p_student_id AND t.simulation_run_id IS NOT NULL
     AND EXISTS(SELECT 1 FROM public.sitov_exam_submissions s WHERE s.media_path=t.path OR s.photo_path=t.path);
   DELETE FROM public.sitov_exam_upload_tickets t WHERE t.student_id=p_student_id AND EXISTS(
    SELECT 1 FROM sitov_simulation_private.reset_media m WHERE m.job_id=job.id AND m.path=t.path);
   DELETE FROM public.sitov_simulation_runs WHERE student_id=p_student_id;
  END IF;
  INSERT INTO sitov_simulation_private.reset_requests(student_id,request_id,job_id,requested_by) VALUES(p_student_id,p_request_id,job.id,p_staff_id);
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',m.bucket,'path',m.path) ORDER BY m.path),'[]'::jsonb) INTO media
  FROM sitov_simulation_private.reset_media m JOIN storage.objects o ON o.bucket_id=m.bucket AND o.name=m.path
  WHERE m.job_id=job.id AND job.status='pending';
 RETURN jsonb_build_object('jobId',job.id,'status',job.status,'generation',job.generation,'media',media);
END $$;
CREATE OR REPLACE FUNCTION public.sitov_finish_simulation_reset(p_job_id uuid,p_staff_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE job sitov_simulation_private.reset_jobs; BEGIN
 SELECT * INTO job FROM sitov_simulation_private.reset_jobs WHERE id=p_job_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'simulation_reset_not_found' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||job.student_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM sitov_simulation_private.assert_reset_staff(job.student_id,p_staff_id);
 SELECT * INTO job FROM sitov_simulation_private.reset_jobs WHERE id=p_job_id FOR UPDATE;
 IF job.status='completed' THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM sitov_simulation_private.reset_media m JOIN storage.objects o ON o.bucket_id=m.bucket AND o.name=m.path WHERE m.job_id=job.id)
 THEN RAISE EXCEPTION 'simulation_audio_removal_incomplete' USING ERRCODE='55000'; END IF;
 UPDATE public.sitov_simulation_learning_state SET reset_pending=NULL WHERE student_id=job.student_id AND reset_pending=job.id AND generation=job.generation;
 IF NOT FOUND THEN RAISE EXCEPTION 'simulation_reset_generation_changed' USING ERRCODE='55000'; END IF;
 UPDATE sitov_simulation_private.reset_jobs SET status='completed',completed_at=clock_timestamp() WHERE id=job.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.sitov_begin_simulation_reset(uuid,uuid,uuid),public.sitov_finish_simulation_reset(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sitov_begin_simulation_reset(uuid,uuid,uuid),public.sitov_finish_simulation_reset(uuid,uuid) TO service_role;

-- General learner reset deliberately preserves all simulation evidence.
-- NULL preparation tickets reused in a frozen simulation count as evidence too.
CREATE OR REPLACE FUNCTION sitov_simulation_private.preserve_media(p_student uuid,p_path text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sitov_exam_upload_tickets t WHERE t.student_id=p_student AND t.path=p_path AND t.simulation_run_id IS NOT NULL)
 OR EXISTS(SELECT 1 FROM public.sitov_simulation_runs r CROSS JOIN LATERAL jsonb_each(r.server_snapshot->'answers') a
  WHERE r.student_id=p_student AND jsonb_typeof(a.value)='object' AND a.value->>'audioPath'=p_path)
 OR EXISTS(SELECT 1 FROM sitov_simulation_private.reset_media m JOIN sitov_simulation_private.reset_jobs j ON j.id=m.job_id
  WHERE m.student_id=p_student AND m.path=p_path AND j.status='pending')
$$;
REVOKE ALL ON FUNCTION sitov_simulation_private.preserve_media(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION sitov_exam_private.capture_reset_media(p_student uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NULL OR p_student IS DISTINCT FROM auth.uid() OR NOT EXISTS(
 SELECT 1 FROM learning_reset_private.jobs WHERE auth_user_id=p_student AND active)
 THEN RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501'; END IF;
 DELETE FROM learning_reset_private.audio_objects a WHERE a.auth_user_id=p_student AND a.bucket_id='sitov-exam-submissions'
  AND sitov_simulation_private.preserve_media(p_student,a.object_name);
 INSERT INTO learning_reset_private.audio_objects(auth_user_id,object_id,bucket_id,object_name)
 SELECT p_student,o.id,o.bucket_id,o.name FROM storage.objects o
 WHERE o.bucket_id='sitov-exam-submissions' AND split_part(o.name,'/',1)=p_student::text
 AND NOT sitov_simulation_private.preserve_media(p_student,o.name)
 AND NOT EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a WHERE a.auth_user_id=p_student AND a.object_id=o.id);
END $$;
-- Also protect simulations captured by an unfinished reset before this upgrade.
DELETE FROM learning_reset_private.audio_objects a WHERE a.bucket_id='sitov-exam-submissions'
 AND sitov_simulation_private.preserve_media(a.auth_user_id,a.object_name);
CREATE OR REPLACE FUNCTION learning_reset_private.can_remove_audio(p_id uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
 SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(auth_user_id)
 WHERE a.auth_user_id=(SELECT auth.uid()) AND a.object_id=p_id AND j.active
  AND (a.bucket_id<>'sitov-exam-submissions' OR NOT sitov_simulation_private.preserve_media(a.auth_user_id,a.object_name)))
$$;
CREATE OR REPLACE FUNCTION learning_reset_private.audio_batch(p_token uuid) RETURNS TABLE(bucket_id text,object_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE auth_user_id=actor AND token=p_token)
 THEN RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT a.bucket_id,a.object_name FROM learning_reset_private.audio_objects a
  JOIN storage.objects o ON o.id=a.object_id AND o.bucket_id=a.bucket_id AND o.name=a.object_name
  JOIN learning_reset_private.jobs j ON j.auth_user_id=a.auth_user_id
  WHERE a.auth_user_id=actor AND j.active
   AND (a.bucket_id<>'sitov-exam-submissions' OR NOT sitov_simulation_private.preserve_media(actor,a.object_name))
  ORDER BY a.bucket_id,a.object_name LIMIT 500;
END $$;
CREATE OR REPLACE FUNCTION sitov_exam_private.guard_storage_upload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE learner uuid; issued timestamptz; BEGIN
 IF NEW.bucket_id<>'sitov-exam-submissions' THEN RETURN NEW; END IF;
 SELECT t.student_id,t.created_at INTO learner,issued FROM public.sitov_exam_upload_tickets t JOIN public.profiles p ON p.id=t.student_id WHERE t.path=NEW.name;
 IF learner IS NULL THEN RAISE EXCEPTION 'exam_upload_ticket_expired' USING ERRCODE='55000'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||learner::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM learning_reset_private.assert_writable(learner);
 IF NOT EXISTS(SELECT 1 FROM public.sitov_exam_upload_tickets WHERE path=NEW.name)
 OR (EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE auth_user_id=learner AND completed_at>=issued)
  AND NOT sitov_simulation_private.preserve_media(learner,NEW.name))
 THEN RAISE EXCEPTION 'exam_upload_ticket_expired' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
DO $sitov$ DECLARE body text; previous text; replacement text; BEGIN
 body:=pg_get_functiondef('learning_reset_private.finish_reset(uuid)'::regprocedure);
 IF strpos(body,'sitov-simulation-preserve-queued-media')=0 THEN
  previous:='IF NOT job.active THEN RETURN true; END IF;';
  IF strpos(body,previous)=0 THEN RAISE EXCEPTION 'sitov_simulation_global_reset_queue_contract_changed'; END IF;
  body:=replace(body,previous,previous||$fragment$
 -- sitov-simulation-preserve-queued-media: an old token cannot acquire simulation evidence.
 DELETE FROM learning_reset_private.audio_objects a WHERE a.auth_user_id=actor AND a.bucket_id='sitov-exam-submissions'
  AND sitov_simulation_private.preserve_media(actor,a.object_name);$fragment$);
 END IF;
 previous:='DELETE FROM public.sitov_simulation_runs WHERE student_id=actor;';
 IF strpos(body,previous)>0 THEN body:=replace(body,previous,'-- Simulation history is reset only by assigned staff.'); END IF;
 previous:='DELETE FROM public.sitov_exam_upload_tickets WHERE student_id=actor;';
 replacement:='DELETE FROM public.sitov_exam_upload_tickets WHERE student_id=actor AND NOT sitov_simulation_private.preserve_media(actor,path);';
 IF strpos(body,replacement)=0 THEN
  IF strpos(body,previous)=0 THEN RAISE EXCEPTION 'sitov_simulation_global_reset_contract_changed'; END IF;
  body:=replace(body,previous,replacement);
 END IF;
 EXECUTE body;
END $sitov$;
REVOKE ALL ON FUNCTION sitov_exam_private.capture_reset_media(uuid),sitov_exam_private.guard_storage_upload() FROM PUBLIC,anon,authenticated,service_role;
-- Account deletion retains its existing broad private-file manifest and FK cascades.
NOTIFY pgrst,'reload schema';
