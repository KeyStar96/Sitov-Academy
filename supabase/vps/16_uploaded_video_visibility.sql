-- Uploaded teaching videos follow level access and their existing publication flag.
-- External links and all other trainers retain their existing grant rules.
CREATE OR REPLACE FUNCTION media_private.published_video_unit_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT coalesce(array_agg(DISTINCT u.id),ARRAY[]::uuid[])
 FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id
 JOIN public.lms_media_folder f ON f.folder_id=v.folder_id AND f.level=u.level
 WHERE v.storage_path IS NOT NULL AND u.trainer='videos' AND u.is_active
 AND ((SELECT identity_private.current_profile_role()) IN('teacher','admin') OR EXISTS(
   SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=(SELECT auth.uid()) AND a.level=f.level));
$$;
REVOKE ALL ON FUNCTION media_private.published_video_unit_ids() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION media_private.published_video_unit_ids() TO postgres,authenticated,service_role;

ALTER POLICY released_units ON public.learning_units USING (
 id = ANY ((SELECT learning_private.allowed_unit_ids())::uuid[])
 OR id = ANY ((SELECT media_private.published_video_unit_ids())::uuid[]));
ALTER POLICY released_content_read ON public.learning_videos USING (
 ((storage_path IS NOT NULL AND unit_id = ANY ((SELECT media_private.published_video_unit_ids())::uuid[]))
 OR (storage_path IS NULL AND learning_private.unit_allowed(unit_id)))
 AND (folder_id IS NULL OR media_private.folder_allowed(folder_id)));

CREATE OR REPLACE FUNCTION media_private.path_allowed(p_name text, p_write boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
 OR (parts[3]='videos' AND EXISTS(SELECT 1 FROM public.learning_videos v WHERE v.folder_id=folder AND v.storage_path=p_name AND v.unit_id = ANY ((SELECT media_private.published_video_unit_ids())::uuid[])));
END $_$;

-- Rollback after an R8 backup: apply rollback/16_uploaded_video_visibility.sql.
-- Files, content and publication flags are preserved.
