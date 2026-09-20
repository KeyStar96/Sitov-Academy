-- Phase 2.2–2.4. Apply AFTER 02_identity_alignment.sql; runner owns transaction.
-- Backup: PostgreSQL + Storage API dump with SHA256, including populated MinIO.
CREATE SCHEMA IF NOT EXISTS media_private;
REVOKE ALL ON SCHEMA media_private FROM PUBLIC;
GRANT USAGE ON SCHEMA media_private TO authenticated, service_role;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='media_format') THEN
  CREATE TYPE public.media_format AS ENUM ('mp4','webm','pdf','pptx','key');
 END IF;
END $$;
-- Full PPTX MIME exceeds PostgreSQL's 63-byte enum-label limit; normalize it.
CREATE TABLE IF NOT EXISTS public.media_mime_types (
 mime_type text PRIMARY KEY, format public.media_format NOT NULL UNIQUE
);
INSERT INTO public.media_mime_types(mime_type,format) VALUES
 ('video/mp4','mp4'),('video/webm','webm'),('application/pdf','pdf'),
 ('application/vnd.openxmlformats-officedocument.presentationml.presentation','pptx'),('application/vnd.apple.keynote','key')
ON CONFLICT(mime_type) DO NOTHING;
ALTER TABLE public.media_mime_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mime_catalog_read ON public.media_mime_types;
CREATE POLICY mime_catalog_read ON public.media_mime_types FOR SELECT TO authenticated USING(true);
GRANT SELECT ON public.media_mime_types TO authenticated;
GRANT ALL ON public.media_mime_types TO service_role;
CREATE TABLE IF NOT EXISTS public.lms_media_folder (
 folder_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 level text NOT NULL REFERENCES public.learning_levels(code),
 course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 180),
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(level,title)
);
CREATE INDEX IF NOT EXISTS lms_media_folder_course_idx ON public.lms_media_folder(course_id);
CREATE TABLE IF NOT EXISTS public.lms_presentation_asset (
 asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 folder_id uuid NOT NULL REFERENCES public.lms_media_folder(folder_id) ON DELETE CASCADE,
 file_name text NOT NULL CHECK(length(btrim(file_name)) BETWEEN 1 AND 255),
 storage_path text NOT NULL UNIQUE,
 mime_type text NOT NULL REFERENCES public.media_mime_types(mime_type),
 file_size bigint NOT NULL CHECK(file_size>0 AND file_size<=536870912),
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lms_presentation_asset_folder_idx ON public.lms_presentation_asset(folder_id,sort_order);
ALTER TABLE public.learning_videos ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.lms_media_folder(folder_id) ON DELETE RESTRICT;
ALTER TABLE public.learning_videos ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.learning_videos ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.learning_videos ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE public.learning_videos DROP CONSTRAINT IF EXISTS learning_videos_unit_id_key;
CREATE INDEX IF NOT EXISTS learning_videos_unit_idx ON public.learning_videos(unit_id);
CREATE INDEX IF NOT EXISTS learning_videos_folder_idx ON public.learning_videos(folder_id);
CREATE UNIQUE INDEX IF NOT EXISTS learning_videos_storage_path_key ON public.learning_videos(storage_path) WHERE storage_path IS NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.learning_videos'::regclass AND conname='learning_videos_upload_check') THEN
  ALTER TABLE public.learning_videos ADD CONSTRAINT learning_videos_upload_check CHECK (
   (title IS NULL OR length(btrim(title)) BETWEEN 1 AND 180) AND
   ((storage_path IS NULL AND file_size IS NULL) OR (storage_path IS NOT NULL AND folder_id IS NOT NULL AND title IS NOT NULL AND file_size IS NOT NULL AND file_size>0 AND file_size<=536870912)));
 END IF;
END $$;
CREATE OR REPLACE FUNCTION platform_private.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN NEW.updated_at:=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS set_updated_at ON public.lms_media_folder;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lms_media_folder FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.lms_presentation_asset;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lms_presentation_asset FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();

CREATE OR REPLACE FUNCTION media_private.folder_allowed(p_folder_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.lms_media_folder f WHERE f.folder_id=p_folder_id AND
  (identity_private.current_profile_role() IN('teacher','admin') OR EXISTS(
    SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=auth.uid() AND a.level=f.level)))
$$;
CREATE OR REPLACE FUNCTION media_private.path_allowed(p_name text,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE parts text[]:=string_to_array(p_name,'/'); folder uuid;
BEGIN
 IF cardinality(parts)<>4 OR parts[2]!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 OR parts[4]!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm|pdf|pptx|key)$'
 OR NOT ((parts[3]='videos' AND parts[4]~'\.(mp4|webm)$') OR (parts[3]='presentations' AND parts[4]~'\.(pdf|pptx|key)$')) THEN RETURN false; END IF;
 folder:=parts[2]::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.lms_media_folder f WHERE f.folder_id=folder AND f.level=parts[1]) THEN RETURN false; END IF;
 IF identity_private.current_profile_role() IN('teacher','admin') THEN RETURN true; END IF;
 IF p_write OR NOT media_private.folder_allowed(folder) THEN RETURN false; END IF;
 RETURN (parts[3]='presentations' AND EXISTS(SELECT 1 FROM public.lms_presentation_asset a WHERE a.folder_id=folder AND a.storage_path=p_name))
 OR (parts[3]='videos' AND EXISTS(SELECT 1 FROM public.learning_videos v WHERE v.folder_id=folder AND v.storage_path=p_name AND learning_private.unit_allowed(v.unit_id)));
END $$;
REVOKE ALL ON FUNCTION media_private.folder_allowed(uuid),media_private.path_allowed(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION media_private.folder_allowed(uuid),media_private.path_allowed(text,boolean) TO authenticated,service_role;
ALTER TABLE public.lms_media_folder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_presentation_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_videos ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.lms_media_folder,public.lms_presentation_asset TO authenticated;
GRANT ALL ON public.lms_media_folder,public.lms_presentation_asset TO service_role;
DROP POLICY IF EXISTS media_folder_read ON public.lms_media_folder;
CREATE POLICY media_folder_read ON public.lms_media_folder FOR SELECT TO authenticated USING(media_private.folder_allowed(folder_id));
DROP POLICY IF EXISTS media_presentation_read ON public.lms_presentation_asset;
CREATE POLICY media_presentation_read ON public.lms_presentation_asset FOR SELECT TO authenticated USING(media_private.folder_allowed(folder_id));
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['lms_media_folder','lms_presentation_asset'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS staff_manage ON public.%I',name);
  EXECUTE format('CREATE POLICY staff_manage ON public.%I TO authenticated USING ((SELECT identity_private.current_profile_role()) IN (''teacher'',''admin'')) WITH CHECK ((SELECT identity_private.current_profile_role()) IN (''teacher'',''admin''))',name);
 END LOOP;
END $$;
DROP POLICY IF EXISTS released_content_read ON public.learning_videos;
CREATE POLICY released_content_read ON public.learning_videos FOR SELECT TO authenticated USING(
 learning_private.unit_allowed(unit_id) AND (folder_id IS NULL OR media_private.folder_allowed(folder_id)));

CREATE OR REPLACE FUNCTION media_private.validate_asset() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE folder_level text; expected_category text; object_id uuid; expected_size bigint;
BEGIN
 IF NEW.storage_path IS NULL THEN RETURN NEW; END IF;
 SELECT level INTO folder_level FROM public.lms_media_folder WHERE folder_id=NEW.folder_id;
 IF TG_TABLE_NAME='learning_videos' THEN
  IF NOT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=NEW.unit_id AND u.level=folder_level) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='media_level_mismatch'; END IF;
  expected_category:='videos';object_id:=NEW.id;
 ELSE expected_category:='presentations';object_id:=NEW.asset_id; END IF;
 IF NEW.storage_path !~ ('^'||replace(folder_level,'.','\.')||'/'||NEW.folder_id||'/'||expected_category||'/'||object_id||'\.(mp4|webm|pdf|pptx|key)$')
 OR NOT media_private.path_allowed(NEW.storage_path,true) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='invalid_storage_path',DETAIL='{"error":"invalid_storage_path","message":"Asset path must match its level, folder and identifier."}';
 END IF;
 SELECT (metadata->>'size')::bigint INTO expected_size FROM storage.objects WHERE bucket_id='course-assets' AND name=NEW.storage_path;
 IF NEW.file_size IS NULL OR expected_size IS NULL OR expected_size<>NEW.file_size THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='invalid_storage_size',DETAIL='{"error":"invalid_storage_size","message":"Upload must exist with the declared file size."}';
 END IF;
 IF TG_TABLE_NAME='lms_presentation_asset' THEN
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='course-assets' AND o.name=NEW.storage_path
 AND o.metadata->>'mimetype'=NEW.mime_type::text AND
 ((NEW.storage_path~'\.pdf$' AND NEW.mime_type::text='application/pdf') OR
 (NEW.storage_path~'\.pptx$' AND NEW.mime_type::text='application/vnd.openxmlformats-officedocument.presentationml.presentation') OR
 (NEW.storage_path~'\.key$' AND NEW.mime_type::text='application/vnd.apple.keynote'))) THEN
 RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='media_mime_mismatch'; END IF;
 ELSE
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='course-assets' AND o.name=NEW.storage_path
 AND ((NEW.storage_path~'\.mp4$' AND o.metadata->>'mimetype'='video/mp4') OR
 (NEW.storage_path~'\.webm$' AND o.metadata->>'mimetype'='video/webm'))) THEN
 RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='media_mime_mismatch',
  DETAIL='{"error":"media_mime_mismatch","message":"Video extension and uploaded MIME type must match."}'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_media_asset ON public.learning_videos;
CREATE TRIGGER validate_media_asset BEFORE INSERT OR UPDATE ON public.learning_videos FOR EACH ROW EXECUTE FUNCTION media_private.validate_asset();
DROP TRIGGER IF EXISTS validate_media_asset ON public.lms_presentation_asset;
CREATE TRIGGER validate_media_asset BEFORE INSERT OR UPDATE ON public.lms_presentation_asset FOR EACH ROW EXECUTE FUNCTION media_private.validate_asset();
CREATE OR REPLACE FUNCTION learning_private.validate_video_publication() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id
  WHERE v.source_url IS NULL AND v.storage_path IS NULL AND u.is_active
  AND ((TG_TABLE_NAME='learning_videos' AND v.id=NEW.id) OR (TG_TABLE_NAME='learning_units' AND u.id=NEW.id))) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='missing_video_source',DETAIL='{"error":"missing_video_source","message":"Published videos need a URL or uploaded file."}';
 END IF;
 RETURN NULL;
END $$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('course-assets','course-assets',false,536870912,ARRAY['video/mp4','video/webm','application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.apple.keynote'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
DROP POLICY IF EXISTS course_assets_read ON storage.objects;
CREATE POLICY course_assets_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='course-assets' AND media_private.path_allowed(name));
DROP POLICY IF EXISTS course_assets_insert ON storage.objects;
CREATE POLICY course_assets_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='course-assets' AND media_private.path_allowed(name,true));
DROP POLICY IF EXISTS course_assets_update ON storage.objects;
CREATE POLICY course_assets_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='course-assets' AND media_private.path_allowed(name,true)) WITH CHECK(bucket_id='course-assets' AND media_private.path_allowed(name,true));
DROP POLICY IF EXISTS course_assets_delete ON storage.objects;
CREATE POLICY course_assets_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='course-assets' AND media_private.path_allowed(name,true));

-- Serialize quota writers per level. UPDATE rechecks final TUS metadata too.
CREATE OR REPLACE FUNCTION media_private.enforce_storage_quota() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE level_code text; total bigint; incoming bigint;
BEGIN
 IF NEW.bucket_id<>'course-assets' THEN RETURN NEW; END IF;
 level_code:=split_part(NEW.name,'/',1);
 IF NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=level_code) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='invalid_media_level'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('media-quota:'||level_code,0));
 incoming:=coalesce((NEW.metadata->>'size')::bigint,0);
 IF incoming<0 OR incoming>536870912 THEN RAISE EXCEPTION USING ERRCODE='PT413',MESSAGE='{"error":"file_too_large","message":"Maximum file size is 512 MiB."}'; END IF;
 SELECT coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) INTO total FROM storage.objects
 WHERE bucket_id='course-assets' AND split_part(name,'/',1)=level_code AND id<>NEW.id;
 IF total+incoming>21474836480 THEN RAISE EXCEPTION USING ERRCODE='PT413',MESSAGE='{"error":"level_quota_exceeded","message":"The level storage limit is 20 GiB."}'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS course_assets_quota ON storage.objects;
CREATE TRIGGER course_assets_quota BEFORE INSERT OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION media_private.enforce_storage_quota();
CREATE OR REPLACE FUNCTION public.media_storage_usage() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT business_private.is_staff() THEN RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 RETURN jsonb_build_object('levels',(SELECT jsonb_agg(jsonb_build_object('level',l.code,'bytes',coalesce(u.bytes,0),'limit_bytes',21474836480) ORDER BY l.code)
  FROM public.learning_levels l LEFT JOIN (SELECT split_part(name,'/',1) level,sum(coalesce((metadata->>'size')::bigint,0)) bytes FROM storage.objects WHERE bucket_id='course-assets' GROUP BY 1) u ON u.level=l.code),
  'total_bytes',(SELECT coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) FROM storage.objects WHERE bucket_id='course-assets'));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','storage_usage_failed','message','Storage usage could not be read.');
END $$;
REVOKE ALL ON FUNCTION public.media_storage_usage() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.media_storage_usage() TO authenticated;

CREATE OR REPLACE FUNCTION business_private.save_course_exception(p_course_id uuid,p_date date,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE result_id uuid;
BEGIN
 IF NOT business_private.is_staff() THEN RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 IF p_course_id IS NULL OR p_date IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 250 THEN RETURN jsonb_build_object('error','invalid_input','message','Course, date and reason are required.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.courses WHERE id=p_course_id) THEN RETURN jsonb_build_object('error','not_found','message','Course not found.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('exception:'||p_course_id||':'||p_date,0));
 SELECT id INTO result_id FROM public.course_exceptions WHERE course_id=p_course_id AND date=p_date ORDER BY id LIMIT 1;
 IF result_id IS NULL THEN INSERT INTO public.course_exceptions(course_id,date,reason) VALUES(p_course_id,p_date,btrim(p_reason)) RETURNING id INTO result_id;
 ELSE UPDATE public.course_exceptions SET reason=btrim(p_reason) WHERE id=result_id; END IF;
 RETURN jsonb_build_object('id',result_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','save_failed','message','Course exception could not be saved.');
END $$;
CREATE OR REPLACE FUNCTION business_private.delete_course_exception(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT business_private.is_staff() THEN RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 DELETE FROM public.course_exceptions WHERE id=p_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found','message','Course exception not found.'); END IF;
 RETURN jsonb_build_object('deleted',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','delete_failed','message','Course exception could not be deleted.');
END $$;
CREATE OR REPLACE FUNCTION public.save_course_exception(p_course_id uuid,p_date date,p_reason text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT business_private.save_course_exception(p_course_id,p_date,p_reason) $$;
CREATE OR REPLACE FUNCTION public.delete_course_exception(p_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT business_private.delete_course_exception(p_id) $$;
REVOKE ALL ON FUNCTION business_private.save_course_exception(uuid,date,text),business_private.delete_course_exception(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_course_exception(uuid,date,text),public.delete_course_exception(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_course_exception(uuid,date,text),public.delete_course_exception(uuid) TO authenticated;
-- Never grant direct writes on course_exceptions to browser roles.
REVOKE INSERT,UPDATE,DELETE ON public.course_exceptions FROM anon,authenticated;

-- R9 ROLLBACK (maintenance window; stop app/mail, preserve Storage files):
-- Restore the pre-migration postgres.dump into a NEW database using pg_restore,
-- verify sha256.json and storage-manifest.json, then switch the DB only after
-- integrity checks. Replay missing object files using Storage API, never DELETE
-- storage.objects directly. Restore matching pre-migration application release.
-- Forward-created media cannot fit UNIQUE(unit_id); export/retain new folder,
-- asset and video rows plus files before rollback. A destructive down migration
-- that silently discards those rows is intentionally not supplied.

-- Keep Storage paths reachable until the staff deletes their files through Storage API.
CREATE OR REPLACE FUNCTION media_private.guard_folder_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.level IS DISTINCT FROM OLD.level OR NEW.folder_id IS DISTINCT FROM OLD.folder_id THEN
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='course-assets' AND split_part(name,'/',2)=OLD.folder_id::text) THEN
   RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='media_folder_has_files',DETAIL='{"error":"media_folder_has_files","message":"Delete folder files through Storage API before removing or moving this folder."}';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_media_folder_change ON public.lms_media_folder;
CREATE TRIGGER guard_media_folder_change BEFORE DELETE OR UPDATE OF level,folder_id ON public.lms_media_folder FOR EACH ROW EXECUTE FUNCTION media_private.guard_folder_change();
REVOKE ALL ON FUNCTION media_private.validate_asset(),media_private.enforce_storage_quota(),media_private.guard_folder_change() FROM PUBLIC,anon,authenticated;

-- Preserve the public RPC signature and unrelated trainer branches.
DO $migration$
DECLARE definition text; old_fragment text; new_fragment text;
BEGIN
 SELECT pg_get_functiondef('public.save_learning_content(text,jsonb,uuid)'::regprocedure) INTO definition;
 old_fragment:=$old$INSERT INTO public.learning_videos(id,unit_id,description,source_url)
  VALUES(item,target_unit,fields->>'description',nullif(btrim(fields->>'source_url'),''))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,description=excluded.description,source_url=excluded.source_url;$old$;
 new_fragment:=$new$INSERT INTO public.learning_videos(id,unit_id,description,source_url,title,folder_id,storage_path,file_size)
  VALUES(item,target_unit,fields->>'description',nullif(btrim(fields->>'source_url'),''),coalesce(nullif(fields->>'title',''),unit_data->>'label'),
   (fields->>'folder_id')::uuid,fields->>'storage_path',(fields->>'file_size')::bigint)
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,description=excluded.description,source_url=excluded.source_url,
   title=excluded.title,folder_id=excluded.folder_id,storage_path=excluded.storage_path,file_size=excluded.file_size;$new$;
 IF position(old_fragment IN definition)>0 THEN definition:=replace(definition,old_fragment,new_fragment);
 ELSIF position(new_fragment IN definition)=0 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='media_function_drift'; END IF;
 definition:=replace(definition,$old$RETURN jsonb_build_object('id',item);
END$old$,$new$RETURN jsonb_build_object('id',item);
EXCEPTION WHEN insufficient_privilege THEN RETURN jsonb_build_object('error','not_authorized','message','Staff access required.');
 WHEN check_violation OR foreign_key_violation OR invalid_text_representation OR not_null_violation THEN RETURN jsonb_build_object('error','invalid_input','message','Content fields or uploaded file are invalid.');
 WHEN unique_violation THEN RETURN jsonb_build_object('error','conflict','message','Content already exists.');
 WHEN OTHERS THEN RETURN jsonb_build_object('error','save_failed','message','Content could not be saved.');
END$new$);
 EXECUTE definition;
END $migration$;
