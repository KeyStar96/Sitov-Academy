-- Sitov Academy: atomic quotas cover Storage API writes, including service_role,
-- signed uploads, TUS final metadata and INSERT ... ON CONFLICT replacements.
-- Keep existing objects, paths, learning records and prepared German audio intact.
CREATE SCHEMA IF NOT EXISTS sitov_storage_private;
REVOKE ALL ON SCHEMA sitov_storage_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA sitov_storage_private TO service_role;
CREATE TABLE IF NOT EXISTS sitov_storage_private.limits (
 bucket_id text PRIMARY KEY, file_bytes bigint NOT NULL, bucket_bytes bigint NOT NULL,
 bucket_objects bigint NOT NULL, user_bytes bigint, user_objects bigint,
 daily_objects bigint, daily_bytes bigint
);
INSERT INTO sitov_storage_private.limits VALUES
 ('pronunciation_audio',26214400,5368709120,20000,262144000,200,25,536870912),
 ('sitov-exam-submissions',20971520,10737418240,40000,524288000,400,40,629145600),
 ('audio_cache',2097152,8589934592,100000,NULL,NULL,NULL,NULL),
 ('course-assets',536870912,32212254720,20000,NULL,NULL,NULL,NULL)
ON CONFLICT(bucket_id) DO NOTHING;
CREATE TABLE IF NOT EXISTS sitov_storage_private.usage (
 scope text PRIMARY KEY, bytes bigint NOT NULL DEFAULT 0 CHECK(bytes>=0),
 objects bigint NOT NULL DEFAULT 0 CHECK(objects>=0)
);
CREATE TABLE IF NOT EXISTS sitov_storage_private.daily (
 day date NOT NULL, scope text NOT NULL, objects bigint NOT NULL DEFAULT 0 CHECK(objects>=0),
 bytes bigint NOT NULL DEFAULT 0 CHECK(bytes>=0), PRIMARY KEY(day,scope)
);
ALTER TABLE sitov_storage_private.limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitov_storage_private.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitov_storage_private.daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sitov_storage_private FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA sitov_storage_private TO service_role;

-- Storage initially inserts a row without final size for some upload protocols.
-- Reserve the full file maximum until the Storage service writes measured size.
-- user_metadata is deliberately never used as a trusted source of size/owner.
CREATE OR REPLACE FUNCTION sitov_storage_private.object_bytes(p_metadata jsonb,p_max bigint)
RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE value text; BEGIN
 value:=p_metadata->>'size';
 IF value IS NULL THEN RETURN p_max; END IF;
 IF value !~ '^[0-9]{1,18}$' THEN RAISE EXCEPTION 'sitov_invalid_storage_size' USING ERRCODE='23514'; END IF;
 RETURN value::bigint;
END $$;

-- Do not recalculate counters when reapplying: daily usage must survive deletes
-- and resets. The deployment runner executes this migration once under its lock.
LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE;
WITH objects AS (
 SELECT o.bucket_id,split_part(o.name,'/',1) owner,
 sitov_storage_private.object_bytes(o.metadata,l.file_bytes) bytes
 FROM storage.objects o JOIN sitov_storage_private.limits l USING(bucket_id)
), scopes AS (
 SELECT 'all' scope,bytes FROM objects
 UNION ALL SELECT 'protected-audio',bytes FROM objects WHERE bucket_id<>'course-assets'
 UNION ALL SELECT 'bucket:'||bucket_id,bytes FROM objects
 UNION ALL SELECT 'user:'||owner,bytes FROM objects WHERE bucket_id IN('pronunciation_audio','sitov-exam-submissions')
 UNION ALL SELECT 'user-bucket:'||bucket_id||':'||owner,bytes FROM objects WHERE bucket_id IN('pronunciation_audio','sitov-exam-submissions')
)
INSERT INTO sitov_storage_private.usage(scope,bytes,objects)
SELECT scope,sum(bytes),count(*) FROM scopes GROUP BY scope ON CONFLICT(scope) DO NOTHING;

-- UPDATE locks the current counter tuple and re-evaluates the bound after any
-- concurrent writer commits. SUM + advisory locking on a caller snapshot is not
-- the quota primitive. A failure rolls back all counters and the Storage write.
CREATE OR REPLACE FUNCTION sitov_storage_private.charge(p_scope text,p_bytes bigint,p_objects bigint,p_max_bytes bigint,p_max_objects bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 INSERT INTO sitov_storage_private.usage(scope) VALUES(p_scope) ON CONFLICT DO NOTHING;
 UPDATE sitov_storage_private.usage SET bytes=bytes+p_bytes,objects=objects+p_objects
 WHERE scope=p_scope AND bytes+p_bytes>=0 AND objects+p_objects>=0 AND (
  (p_bytes<=0 AND p_objects<=0) OR
  ((p_max_bytes IS NULL OR bytes+p_bytes<=p_max_bytes) AND (p_max_objects IS NULL OR objects+p_objects<=p_max_objects))
 );
 IF NOT FOUND THEN RAISE EXCEPTION 'sitov_storage_quota_exceeded' USING ERRCODE='PT413'; END IF;
END $$;
CREATE OR REPLACE FUNCTION sitov_storage_private.charge_daily(p_scope text,p_objects bigint,p_bytes bigint,p_max_objects bigint,p_max_bytes bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sitov_day date:=(clock_timestamp() AT TIME ZONE 'UTC')::date; BEGIN
 INSERT INTO sitov_storage_private.daily(day,scope) VALUES(sitov_day,p_scope) ON CONFLICT DO NOTHING;
 UPDATE sitov_storage_private.daily SET objects=objects+p_objects,bytes=bytes+p_bytes
 WHERE day=sitov_day AND scope=p_scope
 AND objects+p_objects<=p_max_objects AND bytes+p_bytes<=p_max_bytes;
 IF NOT FOUND THEN RAISE EXCEPTION 'sitov_daily_upload_limit' USING ERRCODE='PT429'; END IF;
END $$;
CREATE OR REPLACE FUNCTION sitov_storage_private.enforce_quota() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE bounds sitov_storage_private.limits; bucket text; owner text;
 new_bytes bigint:=0; old_bytes bigint:=0; byte_delta bigint; object_delta bigint:=0; BEGIN
 IF TG_OP='DELETE' THEN bucket:=OLD.bucket_id; owner:=split_part(OLD.name,'/',1);
 ELSE bucket:=NEW.bucket_id; owner:=split_part(NEW.name,'/',1); END IF;
 -- Moving into/out of a protected bucket must not bypass its ledger. Storage
 -- uploads use immutable names; a legitimate copy gets its own INSERT charge.
 IF TG_OP='UPDATE' AND ROW(NEW.bucket_id,NEW.name) IS DISTINCT FROM ROW(OLD.bucket_id,OLD.name)
 AND (EXISTS(SELECT 1 FROM sitov_storage_private.limits WHERE bucket_id=OLD.bucket_id)
 OR EXISTS(SELECT 1 FROM sitov_storage_private.limits WHERE bucket_id=NEW.bucket_id))
 THEN RAISE EXCEPTION 'sitov_storage_path_is_immutable' USING ERRCODE='23514'; END IF;
 SELECT * INTO bounds FROM sitov_storage_private.limits WHERE bucket_id=bucket;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF TG_OP<>'DELETE' AND bucket IN('pronunciation_audio','sitov-exam-submissions') AND owner !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 THEN RAISE EXCEPTION 'sitov_invalid_storage_owner' USING ERRCODE='23514'; END IF;
 IF TG_OP<>'DELETE' THEN
  new_bytes:=sitov_storage_private.object_bytes(NEW.metadata,bounds.file_bytes);
  IF new_bytes>bounds.file_bytes THEN RAISE EXCEPTION 'sitov_storage_file_too_large' USING ERRCODE='PT413'; END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN old_bytes:=sitov_storage_private.object_bytes(OLD.metadata,bounds.file_bytes); END IF;
 byte_delta:=new_bytes-old_bytes;
 IF TG_OP='INSERT' THEN object_delta:=1; ELSIF TG_OP='DELETE' THEN object_delta:=-1; END IF;
 -- Every writer takes the combined counter first: deterministic lock order.
 PERFORM sitov_storage_private.charge('all',byte_delta,object_delta,53687091200,180000);
 IF bucket<>'course-assets' THEN PERFORM sitov_storage_private.charge('protected-audio',byte_delta,object_delta,21474836480,160000); END IF;
 PERFORM sitov_storage_private.charge('bucket:'||bucket,byte_delta,object_delta,bounds.bucket_bytes,bounds.bucket_objects);
 IF bucket IN('pronunciation_audio','sitov-exam-submissions') THEN
  PERFORM sitov_storage_private.charge('user:'||owner,byte_delta,object_delta,786432000,600);
  PERFORM sitov_storage_private.charge('user-bucket:'||bucket||':'||owner,byte_delta,object_delta,bounds.user_bytes,bounds.user_objects);
  IF TG_OP='INSERT' OR byte_delta>0 THEN
   PERFORM sitov_storage_private.charge_daily('uploads:'||bucket||':'||owner,greatest(object_delta,0),greatest(byte_delta,0),bounds.daily_objects,bounds.daily_bytes);
  END IF;
 END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS sitov_storage_security_quota ON storage.objects;
CREATE TRIGGER sitov_storage_security_quota AFTER INSERT OR UPDATE OR DELETE ON storage.objects
FOR EACH ROW EXECUTE FUNCTION sitov_storage_private.enforce_quota();

ALTER TABLE public.sitov_exam_upload_tickets ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.sitov_exam_upload_tickets ADD COLUMN IF NOT EXISTS expected_bytes bigint;
-- Existing tickets retain valid lifetime; their stored files remain accessible.
-- Historical tickets can refer to completed/retired runs. Backfilling only a
-- deadline must not replay business write validation for those historical rows.
-- The runner owns one transaction: block all ticket writers, retain every
-- original trigger mode, disable only user triggers, then restore exact modes.
LOCK TABLE public.sitov_exam_upload_tickets IN ACCESS EXCLUSIVE MODE;
DO $$ DECLARE sitov_triggers text[]; sitov_modes "char"[]; sitov_index integer; BEGIN
 SELECT array_agg(tgname ORDER BY tgname),array_agg(tgenabled ORDER BY tgname)
 INTO sitov_triggers,sitov_modes FROM pg_trigger
 WHERE tgrelid='public.sitov_exam_upload_tickets'::regclass AND NOT tgisinternal AND tgenabled<>'D';
 IF sitov_triggers IS NOT NULL THEN
  FOR sitov_index IN 1..array_length(sitov_triggers,1) LOOP
   EXECUTE format('ALTER TABLE public.sitov_exam_upload_tickets DISABLE TRIGGER %I',sitov_triggers[sitov_index]);
  END LOOP;
 END IF;
 UPDATE public.sitov_exam_upload_tickets SET expires_at=created_at+interval '30 minutes' WHERE expires_at IS NULL;
 IF sitov_triggers IS NOT NULL THEN
  FOR sitov_index IN 1..array_length(sitov_triggers,1) LOOP
   EXECUTE format('ALTER TABLE public.sitov_exam_upload_tickets %s TRIGGER %I',
    CASE sitov_modes[sitov_index] WHEN 'A' THEN 'ENABLE ALWAYS' WHEN 'R' THEN 'ENABLE REPLICA' ELSE 'ENABLE' END,sitov_triggers[sitov_index]);
  END LOOP;
 END IF;
END $$;
ALTER TABLE public.sitov_exam_upload_tickets ALTER COLUMN expires_at SET DEFAULT (clock_timestamp()+interval '30 minutes');
ALTER TABLE public.sitov_exam_upload_tickets ALTER COLUMN expires_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS sitov_exam_ticket_expiry ON public.sitov_exam_upload_tickets(student_id,expires_at);
CREATE OR REPLACE FUNCTION sitov_storage_private.guard_exam_ticket() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.path,NEW.student_id,NEW.kind,NEW.created_at,NEW.expires_at,NEW.expected_bytes)
  IS DISTINCT FROM ROW(OLD.path,OLD.student_id,OLD.kind,OLD.created_at,OLD.expires_at,OLD.expected_bytes)
  THEN RAISE EXCEPTION 'sitov_upload_ticket_is_immutable' USING ERRCODE='23514'; END IF;
  IF NEW.simulation_run_id IS DISTINCT FROM OLD.simulation_run_id THEN
   -- The service-only staff reset must detach a recording also used by the
   -- same learner's preparation submission before deleting its simulation FK.
   -- Preserve the exact owner, path, lifetime and byte bound; no generic
   -- service-role exemption and no caller-settable reset flag authorizes this.
   IF OLD.simulation_run_id IS NULL OR NEW.simulation_run_id IS NOT NULL
   OR coalesce(nullif(current_setting('role',true),'none'),session_user)<>'service_role'
   OR NOT EXISTS(
    SELECT 1 FROM public.sitov_simulation_learning_state s
    JOIN sitov_simulation_private.reset_jobs j ON j.id=s.reset_pending AND j.student_id=s.student_id
    JOIN public.sitov_simulation_runs r ON r.id=OLD.simulation_run_id AND r.student_id=s.student_id
    WHERE s.student_id=OLD.student_id AND j.status='pending' AND j.generation=s.generation)
   OR NOT EXISTS(SELECT 1 FROM public.sitov_exam_submissions s
    WHERE s.student_id=OLD.student_id AND (s.media_path=OLD.path OR s.photo_path=OLD.path))
   THEN RAISE EXCEPTION 'sitov_upload_ticket_is_immutable' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.expires_at>clock_timestamp()+interval '30 minutes' OR NEW.expires_at<=clock_timestamp()
 OR NEW.expected_bytes IS NULL OR NEW.expected_bytes NOT BETWEEN 1 AND 20971520
 THEN RAISE EXCEPTION 'sitov_invalid_upload_ticket' USING ERRCODE='23514'; END IF;
 -- Issuance itself consumes quota, even if its URL is never used or deleted.
 PERFORM sitov_storage_private.charge_daily('tickets:'||NEW.student_id::text,1,NEW.expected_bytes,40,629145600);
 -- Discard stale unused authorizations, never Storage files or used tickets.
 DELETE FROM public.sitov_exam_upload_tickets t WHERE t.student_id=NEW.student_id AND t.expires_at<=clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='sitov-exam-submissions' AND o.name=t.path);
 IF (SELECT count(*) FROM public.sitov_exam_upload_tickets t
  WHERE t.student_id=NEW.student_id AND t.expires_at>clock_timestamp()
  AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='sitov-exam-submissions' AND o.name=t.path))>=10
 THEN RAISE EXCEPTION 'sitov_pending_upload_limit' USING ERRCODE='PT429'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sitov_upload_ticket_limit ON public.sitov_exam_upload_tickets;
CREATE TRIGGER sitov_upload_ticket_limit BEFORE INSERT OR UPDATE ON public.sitov_exam_upload_tickets
FOR EACH ROW EXECUTE FUNCTION sitov_storage_private.guard_exam_ticket();

-- Keep the reset fencing and lock order from 73; check the immutable ticket
-- again after waiting, and enforce expiry/size on creation and finalization.
CREATE OR REPLACE FUNCTION sitov_exam_private.guard_storage_upload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ticket public.sitov_exam_upload_tickets; needs_ticket boolean; BEGIN
 IF NEW.bucket_id<>'sitov-exam-submissions' THEN RETURN NEW; END IF;
 SELECT * INTO ticket FROM public.sitov_exam_upload_tickets WHERE path=NEW.name;
 IF ticket.student_id IS NULL THEN RAISE EXCEPTION 'exam_upload_ticket_expired' USING ERRCODE='55000'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||ticket.student_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM learning_reset_private.assert_writable(ticket.student_id);
 SELECT * INTO ticket FROM public.sitov_exam_upload_tickets WHERE path=NEW.name;
 IF ticket.student_id IS NULL OR (EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE auth_user_id=ticket.student_id AND completed_at>=ticket.created_at)
 AND NOT sitov_simulation_private.preserve_media(ticket.student_id,NEW.name))
 THEN RAISE EXCEPTION 'exam_upload_ticket_expired' USING ERRCODE='55000'; END IF;
 needs_ticket:=TG_OP='INSERT';
 IF TG_OP='UPDATE' THEN needs_ticket:=OLD.metadata->>'size' IS NULL OR NEW.metadata->>'size' IS DISTINCT FROM OLD.metadata->>'size'; END IF;
 IF needs_ticket AND ticket.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'exam_upload_ticket_expired' USING ERRCODE='55000'; END IF;
 IF needs_ticket AND ticket.expected_bytes IS NOT NULL AND
 sitov_storage_private.object_bytes(NEW.metadata,20971520)>ticket.expected_bytes AND NEW.metadata->>'size' IS NOT NULL
 THEN RAISE EXCEPTION 'sitov_storage_file_too_large' USING ERRCODE='PT413'; END IF;
 RETURN NEW;
END $$;

-- Only server-side, authenticated and content-authorized actions receive the
-- service-role RPC. The daily counters survive worker restarts and file deletes.
CREATE OR REPLACE FUNCTION public.sitov_reserve_audio_generation(p_user_id uuid,p_characters integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF p_characters NOT BETWEEN 1 AND 3000 OR p_characters IS NULL OR
 NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id AND role IN('student','teacher','admin'))
 THEN RETURN false; END IF;
 PERFORM sitov_storage_private.charge_daily('synthesis:all',1,p_characters,500,1000000);
 PERFORM sitov_storage_private.charge_daily('synthesis:user:'||p_user_id::text,1,p_characters,100,100000);
 RETURN true;
EXCEPTION WHEN SQLSTATE 'PT429' THEN RETURN false;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitov_storage_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sitov_storage_private TO service_role;
REVOKE ALL ON FUNCTION public.sitov_reserve_audio_generation(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sitov_reserve_audio_generation(uuid,integer) TO service_role;
REVOKE ALL ON FUNCTION sitov_exam_private.guard_storage_upload() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
