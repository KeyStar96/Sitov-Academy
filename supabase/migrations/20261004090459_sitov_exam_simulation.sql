-- Sitov Academy: independently persisted exam rehearsals and released simulations.
-- Frozen task keys remain server-only. Existing preparation receipts are untouched.
CREATE SCHEMA IF NOT EXISTS sitov_simulation_private;
REVOKE ALL ON SCHEMA sitov_simulation_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA sitov_simulation_private TO service_role;
-- Advanced simulation permissions are independent from existing A1–B1 trainers.
CREATE TABLE IF NOT EXISTS public.sitov_simulation_level_grants (
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 level text NOT NULL CHECK(level IN('B2','C1','C2')),
 granted_by uuid NOT NULL,
 granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(student_id,level)
);
ALTER TABLE public.sitov_simulation_level_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sitov_simulation_level_grants FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.sitov_simulation_level_grants TO service_role;
CREATE OR REPLACE FUNCTION sitov_simulation_private.validate_grant() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.student_id AND role='student')
 OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=NEW.granted_by AND (p.role='admin' OR (p.role='teacher' AND EXISTS(
  SELECT 1 FROM public.sitov_exam_teacher_assignments a WHERE a.student_id=NEW.student_id AND a.teacher_id=NEW.granted_by))))
 THEN RAISE EXCEPTION 'unauthorized_simulation_level_grant' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sitov_simulation_grant_valid ON public.sitov_simulation_level_grants;
CREATE TRIGGER sitov_simulation_grant_valid BEFORE INSERT OR UPDATE ON public.sitov_simulation_level_grants FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.validate_grant();
CREATE TABLE IF NOT EXISTS public.sitov_simulation_runs (
 id uuid PRIMARY KEY,
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 level text NOT NULL CHECK(level IN('A1','A2','B1','B2','C1','C2')),
 provider text NOT NULL CHECK(provider IN('sitov','telc','goethe','oesd','dtz')),
 mode text NOT NULL CHECK(mode IN('practice','exam')),
 status text NOT NULL CHECK(status IN('active','completed')),
 started_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 completed_at timestamptz,
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 start_request_id uuid NOT NULL,
 start_request_hash text NOT NULL,
 server_snapshot jsonb NOT NULL CHECK(jsonb_typeof(server_snapshot)='object' AND octet_length(server_snapshot::text)<=1000000),
 UNIQUE(student_id,start_request_id),
 CHECK(expires_at>started_at),
 CHECK((status='active' AND completed_at IS NULL) OR (status='completed' AND completed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS sitov_simulation_student_history_idx ON public.sitov_simulation_runs(student_id,started_at DESC,id);
-- An active rehearsal is resumed rather than silently replaced on another device.
CREATE UNIQUE INDEX IF NOT EXISTS sitov_simulation_one_active_idx ON public.sitov_simulation_runs(student_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS public.sitov_simulation_receipts (
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 run_id uuid NOT NULL REFERENCES public.sitov_simulation_runs(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('answer','finish','review')),
 payload_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(student_id,request_id)
);
ALTER TABLE public.sitov_simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sitov_simulation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sitov_simulation_runs,public.sitov_simulation_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.sitov_simulation_runs,public.sitov_simulation_receipts TO service_role;

CREATE OR REPLACE FUNCTION sitov_simulation_private.guard_run() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||NEW.student_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM learning_reset_private.assert_writable(NEW.student_id);
 IF NEW.server_snapshot->>'id' IS DISTINCT FROM NEW.id::text
 OR NEW.server_snapshot->>'level' IS DISTINCT FROM NEW.level
 OR NEW.server_snapshot->>'provider' IS DISTINCT FROM NEW.provider
 OR NEW.server_snapshot->>'mode' IS DISTINCT FROM NEW.mode
 OR NEW.server_snapshot->>'status' IS DISTINCT FROM NEW.status
 OR (NEW.server_snapshot->>'startedAt')::timestamptz IS DISTINCT FROM NEW.started_at
 OR (NEW.server_snapshot->>'expiresAt')::timestamptz IS DISTINCT FROM NEW.expires_at
 OR (NEW.server_snapshot->>'completedAt')::timestamptz IS DISTINCT FROM NEW.completed_at
 OR jsonb_typeof(NEW.server_snapshot->'tasks') IS DISTINCT FROM 'array'
 OR jsonb_array_length(NEW.server_snapshot->'tasks')=0
 OR jsonb_typeof(NEW.server_snapshot->'answers') IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'invalid_simulation_snapshot' USING ERRCODE='23514'; END IF;
 IF NEW.provider='sitov' AND NEW.mode='exam' AND (
  NEW.server_snapshot->'coverage'->>'fullExam' IS DISTINCT FROM 'true'
  OR jsonb_typeof(NEW.server_snapshot->'coverage'->'missing') IS DISTINCT FROM 'array'
  OR jsonb_array_length(NEW.server_snapshot->'coverage'->'missing')<>0)
 THEN RAISE EXCEPTION 'incomplete_universal_simulation' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.student_id,NEW.level,NEW.provider,NEW.mode,NEW.started_at,NEW.expires_at,NEW.start_request_id,NEW.start_request_hash)
    IS DISTINCT FROM ROW(OLD.id,OLD.student_id,OLD.level,OLD.provider,OLD.mode,OLD.started_at,OLD.expires_at,OLD.start_request_id,OLD.start_request_hash)
   OR NEW.server_snapshot->'version' IS DISTINCT FROM OLD.server_snapshot->'version'
   OR NEW.server_snapshot->'profileId' IS DISTINCT FROM OLD.server_snapshot->'profileId'
   OR NEW.server_snapshot->'tasks' IS DISTINCT FROM OLD.server_snapshot->'tasks'
   OR NEW.server_snapshot->'coverage' IS DISTINCT FROM OLD.server_snapshot->'coverage'
   OR NEW.server_snapshot->'rubric' IS DISTINCT FROM OLD.server_snapshot->'rubric'
   OR NEW.revision<>OLD.revision+1
  THEN RAISE EXCEPTION 'immutable_simulation_assignment' USING ERRCODE='23514'; END IF;
  IF OLD.status='completed' AND (NEW.status<>'completed' OR NEW.completed_at IS DISTINCT FROM OLD.completed_at OR NEW.server_snapshot->'answers' IS DISTINCT FROM OLD.server_snapshot->'answers')
  THEN RAISE EXCEPTION 'completed_simulation_is_frozen' USING ERRCODE='23514'; END IF;
  IF clock_timestamp()>=OLD.expires_at AND NEW.server_snapshot->'answers' IS DISTINCT FROM OLD.server_snapshot->'answers'
  THEN RAISE EXCEPTION 'simulation_time_expired' USING ERRCODE='55000'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sitov_simulation_guard ON public.sitov_simulation_runs;
CREATE TRIGGER sitov_simulation_guard BEFORE INSERT OR UPDATE ON public.sitov_simulation_runs FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.guard_run();

-- Only a validated server action can submit a complete server snapshot.
-- Locking, revision comparison and the receipt are atomic, including concurrent devices.
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
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitov_simulation_private FROM PUBLIC,anon,authenticated,service_role;

-- The established reset also clears rehearsals, without changing preparation IDs.
DO $sitov$ DECLARE body text; marker text:='DELETE FROM public.sitov_exam_submissions'; BEGIN
 body:=pg_get_functiondef('learning_reset_private.finish_reset(uuid)'::regprocedure);
 IF strpos(body,'DELETE FROM public.sitov_simulation_runs')=0 THEN
  IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'sitov_simulation_reset_contract_changed'; END IF;
  EXECUTE replace(body,marker,E'DELETE FROM public.sitov_simulation_runs WHERE student_id=actor;\n  '||marker);
 END IF;
END $sitov$;
NOTIFY pgrst,'reload schema';
