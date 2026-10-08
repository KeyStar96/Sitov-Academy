-- Sitov Academy: media totals follow the target learner's current library
-- access, including viewer grants. Staff analytics use that learner's rights.
-- Historical view counters and all learning/content rows remain untouched.
-- Patch only the media block, retaining later verb/level changes and RPC ACLs.
DO $sitov$
DECLARE
 definition text;
 previous_available constant text:=$old$ WITH available AS (
  SELECT v.id,v.title,CASE WHEN v.storage_path IS NULL THEN 'link' ELSE 'video' END kind
  FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id AND u.is_active
  WHERE u.level=ANY(scope) AND (v.folder_id IS NULL OR EXISTS(SELECT 1 FROM public.lms_media_folder f WHERE f.folder_id=v.folder_id AND f.level=u.level))
  UNION ALL
  SELECT a.asset_id,a.file_name,'presentation' FROM public.lms_presentation_asset a JOIN public.lms_media_folder f ON f.folder_id=a.folder_id
  WHERE f.level=ANY(scope)),$old$;
 current_available constant text:=$new$ -- sitov-media-visibility-v1: use learner, never the staff caller's rights.
 WITH media_levels AS (
  SELECT a.level,p.ui_language,g.unit_mode
  FROM public.student_level_access a JOIN public.profiles p ON p.id=a.auth_user_id AND p.role='student'
  LEFT JOIN public.learning_trainer_grants g ON g.auth_user_id=p.id AND g.level=a.level AND g.trainer='videos'
  WHERE p.id=learner AND a.level=ANY(scope)
   AND a.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
   AND coalesce(g.enabled,true)
 ), available AS (
  SELECT v.id,coalesce(v.title,u.label) title,CASE WHEN v.storage_path IS NULL THEN 'link' ELSE 'video' END kind
  FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id AND u.is_active AND u.trainer='videos'
  JOIN media_levels l ON l.level=u.level
  LEFT JOIN public.lms_media_folder f ON f.folder_id=v.folder_id AND f.level=u.level
  WHERE u.owner_auth_user_id IS NULL AND (v.folder_id IS NULL OR f.folder_id IS NOT NULL)
   AND CASE WHEN v.storage_path IS NOT NULL THEN
    -- Published uploads use folder/level access, independently of link unit selection.
    f.folder_id IS NOT NULL AND nullif(btrim(v.storage_path),'') IS NOT NULL AND v.file_size>0
   ELSE
    -- External links retain their existing language and selected-unit access.
    l.ui_language<>'de' AND nullif(btrim(v.source_url),'') IS NOT NULL
    AND (l.unit_mode IS DISTINCT FROM 'selected' OR EXISTS(
     SELECT 1 FROM public.learning_unit_grants g WHERE g.auth_user_id=learner
      AND g.level=u.level AND g.trainer='videos' AND g.unit_id=u.id))
   END
  UNION ALL
  SELECT a.asset_id,a.file_name,'presentation'
  FROM public.lms_presentation_asset a JOIN public.lms_media_folder f ON f.folder_id=a.folder_id
  JOIN media_levels l ON l.level=f.level
 ),$new$;
 previous_recent constant text:=$old$FROM (SELECT s.kind,coalesce(v.title,p.file_name) title,s.last_viewed_at,s.views FROM seen s
    LEFT JOIN public.learning_videos v ON v.id=s.object_id AND s.kind IN('video','link')
    LEFT JOIN public.lms_presentation_asset p ON p.asset_id=s.object_id AND s.kind='presentation'
    WHERE coalesce(v.title,p.file_name) IS NOT NULL ORDER BY s.last_viewed_at DESC LIMIT 8) r)$old$;
 current_recent constant text:=$new$FROM (SELECT s.kind,a.title,s.last_viewed_at,s.views FROM seen s
    JOIN available a ON a.id=s.object_id AND a.kind=s.kind
    ORDER BY s.last_viewed_at DESC,s.kind,s.object_id LIMIT 8) r)$new$;
BEGIN
 definition:=pg_get_functiondef('public.get_learning_progress(uuid,text,integer)'::regprocedure);
 IF position('sitov-media-visibility-v1' IN definition)>0 THEN
  IF position(current_available IN definition)=0 OR position(current_recent IN definition)=0 THEN
   RAISE EXCEPTION 'sitov_media_progress_contract_changed';
  END IF;
  RETURN;
 END IF;
 IF position(previous_available IN definition)=0 OR position(previous_recent IN definition)=0 THEN
  RAISE EXCEPTION 'sitov_media_progress_contract_changed';
 END IF;
 EXECUTE replace(replace(definition,previous_available,current_available),previous_recent,current_recent);
END $sitov$;

COMMENT ON FUNCTION public.get_learning_progress(uuid,text,integer) IS
 'Per-mode learning analytics; media totals and recent items follow the target learner''s current viewer rights while daily view history is preserved.';
NOTIFY pgrst,'reload schema';
