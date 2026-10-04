-- Sitov Academy: every learner starts with the simulation feature locked.
-- No existing course or advanced level grant creates a feature grant.
CREATE TABLE IF NOT EXISTS public.sitov_simulation_feature_grants (
 student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 granted_by uuid NOT NULL,
 granted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.sitov_simulation_feature_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sitov_simulation_feature_grants FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.sitov_simulation_feature_grants TO service_role;

CREATE OR REPLACE FUNCTION sitov_simulation_private.feature_allowed(p_student uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_student AND (
  p.role IN('teacher','admin') OR (p.role='student' AND EXISTS(
   SELECT 1 FROM public.sitov_simulation_feature_grants g WHERE g.student_id=p.id))))
$$;
REVOKE ALL ON FUNCTION sitov_simulation_private.feature_allowed(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sitov_simulation_private.feature_allowed(uuid) TO service_role;

CREATE OR REPLACE FUNCTION sitov_simulation_private.guard_feature_grant() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE learner uuid; BEGIN
 learner:=CASE WHEN TG_OP='DELETE' THEN OLD.student_id ELSE NEW.student_id END;
 -- Revoke and answer/upload transactions share a lock, so the latest grant wins.
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||learner::text,0));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.student_id AND role='student')
 OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=NEW.granted_by AND (p.role='admin' OR (p.role='teacher' AND EXISTS(
  SELECT 1 FROM public.sitov_exam_teacher_assignments a WHERE a.student_id=NEW.student_id AND a.teacher_id=NEW.granted_by))))
 THEN RAISE EXCEPTION 'unauthorized_simulation_feature_grant' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.guard_feature_grant() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_simulation_feature_grant_guard ON public.sitov_simulation_feature_grants;
CREATE TRIGGER sitov_simulation_feature_grant_guard BEFORE INSERT OR UPDATE OR DELETE ON public.sitov_simulation_feature_grants FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.guard_feature_grant();

CREATE OR REPLACE FUNCTION sitov_simulation_private.guard_feature_run() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_OP='INSERT' OR OLD.status='active' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||NEW.student_id::text,0));
  IF NOT sitov_simulation_private.feature_allowed(NEW.student_id)
  THEN RAISE EXCEPTION 'simulation_feature_not_granted' USING ERRCODE='42501'; END IF;
 END IF;
 -- Completed answers remain available for assigned staff review after a revoke.
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.guard_feature_run() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_simulation_feature_guard ON public.sitov_simulation_runs;
CREATE TRIGGER sitov_simulation_feature_guard BEFORE INSERT OR UPDATE ON public.sitov_simulation_runs FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.guard_feature_run();

-- A previously issued signed upload must also stop working after feature revoke.
-- Existing preparation uploads keep their contract and remain independent.
ALTER TABLE public.sitov_exam_upload_tickets ADD COLUMN IF NOT EXISTS simulation_run_id uuid REFERENCES public.sitov_simulation_runs(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION sitov_simulation_private.guard_feature_ticket() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.simulation_run_id IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||NEW.student_id::text,0));
  IF NOT sitov_simulation_private.feature_allowed(NEW.student_id)
  THEN RAISE EXCEPTION 'simulation_feature_not_granted' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.sitov_simulation_runs r WHERE r.id=NEW.simulation_run_id AND r.student_id=NEW.student_id AND r.status='active' AND r.expires_at>clock_timestamp())
  THEN RAISE EXCEPTION 'simulation_upload_not_active' USING ERRCODE='55000'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.guard_feature_ticket() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_simulation_feature_ticket_guard ON public.sitov_exam_upload_tickets;
CREATE TRIGGER sitov_simulation_feature_ticket_guard BEFORE INSERT OR UPDATE ON public.sitov_exam_upload_tickets FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.guard_feature_ticket();

CREATE OR REPLACE FUNCTION sitov_simulation_private.guard_feature_storage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE learner uuid; simulation uuid; BEGIN
 IF NEW.bucket_id<>'sitov-exam-submissions' THEN RETURN NEW; END IF;
 SELECT t.student_id,t.simulation_run_id INTO learner,simulation FROM public.sitov_exam_upload_tickets t WHERE t.path=NEW.name;
 IF simulation IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||learner::text,0));
  IF NOT sitov_simulation_private.feature_allowed(learner)
  THEN RAISE EXCEPTION 'simulation_feature_not_granted' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.sitov_simulation_runs r WHERE r.id=simulation AND r.student_id=learner AND r.status='active' AND r.expires_at>clock_timestamp())
  THEN RAISE EXCEPTION 'simulation_upload_not_active' USING ERRCODE='55000'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.guard_feature_storage() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_simulation_feature_storage_guard ON storage.objects;
CREATE TRIGGER sitov_simulation_feature_storage_guard BEFORE INSERT OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.guard_feature_storage();

-- Check feature access inside the same transaction, before any receipt replay.
CREATE OR REPLACE FUNCTION public.sitov_store_simulation_change(
 p_run_id uuid,p_student_id uuid,p_revision integer,p_snapshot jsonb,
 p_request_id uuid,p_kind text,p_payload_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target public.sitov_simulation_runs; receipt public.sitov_simulation_receipts; BEGIN
 -- Same lock order as global learning reset and profile deletion.
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||p_student_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 -- The guarded UPDATE below calls assert_writable as the existing reset guard owner.
 SELECT * INTO target FROM public.sitov_simulation_runs WHERE id=p_run_id AND student_id=p_student_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'simulation_not_found' USING ERRCODE='42501'; END IF;
 IF p_kind IN('answer','finish') AND NOT sitov_simulation_private.feature_allowed(p_student_id)
 THEN RAISE EXCEPTION 'simulation_feature_not_granted' USING ERRCODE='42501'; END IF;
 SELECT * INTO receipt FROM public.sitov_simulation_receipts WHERE student_id=p_student_id AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.run_id<>p_run_id OR receipt.kind<>p_kind OR receipt.payload_hash<>p_payload_hash
  THEN RAISE EXCEPTION 'simulation_request_reused' USING ERRCODE='23514'; END IF;
  RETURN jsonb_build_object('snapshot',target.server_snapshot,'revision',target.revision,'replayed',true);
 END IF;
 IF target.revision<>p_revision THEN RETURN jsonb_build_object('conflict',true); END IF;
 IF p_kind='answer' AND (target.status<>'active' OR clock_timestamp()>=target.expires_at)
 THEN RAISE EXCEPTION 'simulation_time_expired' USING ERRCODE='55000'; END IF;
 IF p_kind='review' AND target.status<>'completed' THEN RAISE EXCEPTION 'simulation_not_completed' USING ERRCODE='23514'; END IF;
 IF p_kind NOT IN('answer','finish','review') THEN RAISE EXCEPTION 'invalid_simulation_change' USING ERRCODE='23514'; END IF;
 IF (p_kind='answer' AND p_snapshot->>'status' IS DISTINCT FROM 'active')
 OR (p_kind IN('finish','review') AND p_snapshot->>'status' IS DISTINCT FROM 'completed')
 OR (p_kind='finish' AND p_snapshot->'answers' IS DISTINCT FROM target.server_snapshot->'answers')
 THEN RAISE EXCEPTION 'invalid_simulation_transition' USING ERRCODE='23514'; END IF;
 UPDATE public.sitov_simulation_runs SET server_snapshot=p_snapshot,status=p_snapshot->>'status',
  completed_at=(p_snapshot->>'completedAt')::timestamptz,revision=revision+1 WHERE id=p_run_id RETURNING * INTO target;
 INSERT INTO public.sitov_simulation_receipts(student_id,request_id,run_id,kind,payload_hash) VALUES(p_student_id,p_request_id,p_run_id,p_kind,p_payload_hash);
 RETURN jsonb_build_object('snapshot',target.server_snapshot,'revision',target.revision,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.sitov_store_simulation_change(uuid,uuid,integer,jsonb,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sitov_store_simulation_change(uuid,uuid,integer,jsonb,uuid,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
