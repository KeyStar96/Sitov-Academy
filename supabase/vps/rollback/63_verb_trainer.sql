-- Roll back the application release first. Preserve selected verbs and learned
-- forms for recovery; this rollback deliberately does not drop learner data.
-- The database backup from migrate-local.py is available for full restoration.
REVOKE EXECUTE ON FUNCTION public.sitov_set_verb_box(text,text[],boolean),public.sitov_submit_verb_answer(uuid,jsonb) FROM authenticated;
CREATE OR REPLACE FUNCTION trainer_access_private.allowed(p_level text,p_trainer text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND(
 p.role IN('teacher','admin') OR(p.ui_language<>'de' AND p_trainer IN('vocabulary','exercises','pronunciation','videos')
 AND EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.auth_user_id=p.id AND l.level=p_level)
 AND coalesce((SELECT a.enabled FROM public.learning_trainer_grants a WHERE a.auth_user_id=p.id AND a.level=p_level AND a.trainer::text=p_trainer),true))));
$$;
-- Enum labels remain unused: PostgreSQL cannot safely remove enum values.
-- Retain reset hooks so existing account deletions/resets cover preserved data.
CREATE OR REPLACE FUNCTION media_private.folder_allowed(p_folder_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.lms_media_folder f WHERE f.folder_id=p_folder_id AND
 (identity_private.current_profile_role() IN('teacher','admin') OR EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=auth.uid() AND a.level=f.level)));
$$;
CREATE OR REPLACE FUNCTION media_private.published_video_unit_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(array_agg(DISTINCT u.id),ARRAY[]::uuid[]) FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id
 JOIN public.lms_media_folder f ON f.folder_id=v.folder_id AND f.level=u.level WHERE v.storage_path IS NOT NULL AND u.trainer='videos' AND u.is_active
 AND ((SELECT identity_private.current_profile_role()) IN('teacher','admin') OR EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=(SELECT auth.uid()) AND a.level=f.level));
$$;
