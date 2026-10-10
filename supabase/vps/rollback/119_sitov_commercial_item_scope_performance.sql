-- Sitov Academy: return to the per-row commercial item checks of migration 93.
-- The rule and all data stay the same; only the evaluation strategy changes back.
ALTER POLICY sitov_commercial_item_scope ON public.learning_vocabulary_cards
 USING(sitov_access_private.item_allowed(auth.uid(),'vocabulary_card',id::text));
ALTER POLICY sitov_vocabulary_exact_read ON public.learning_vocabulary_cards
 USING(sitov_access_private.item_allowed(auth.uid(),'vocabulary_card',id::text));
ALTER POLICY sitov_commercial_item_scope ON public.learning_exercises
 USING(sitov_access_private.item_allowed(auth.uid(),CASE WHEN node_id IS NULL THEN 'exercise' ELSE 'path_task' END,id::text));
ALTER POLICY sitov_commercial_item_scope ON public.learning_reading_texts
 USING(sitov_access_private.item_allowed(auth.uid(),'reading_text',id::text));
DO $sitov_vocab$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vocabulary_direction_progress' AND policyname='sitov_vocabulary_progress_scope') THEN
  EXECUTE 'ALTER POLICY sitov_vocabulary_progress_scope ON public.vocabulary_direction_progress USING(auth_user_id=auth.uid() AND sitov_access_private.item_allowed(auth.uid(),''vocabulary_card'',card_id::text))';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vocabulary_translations' AND policyname='sitov_vocabulary_translation_scope') THEN
  EXECUTE 'ALTER POLICY sitov_vocabulary_translation_scope ON public.vocabulary_translations USING(sitov_access_private.item_allowed(auth.uid(),''vocabulary_card'',card_id::text))';
 END IF;
END $sitov_vocab$;
ALTER POLICY sitov_vocabulary_unit_metadata ON public.learning_units
 USING(trainer='vocabulary' AND sitov_access_private.vocabulary_unit_visible(id));
DROP FUNCTION IF EXISTS sitov_access_private.sitov_vocabulary_visible_unit_ids();
DROP FUNCTION IF EXISTS sitov_access_private.sitov_item_scope_card_ids();
DROP FUNCTION IF EXISTS sitov_access_private.sitov_item_scope_unit_ids();
DROP FUNCTION IF EXISTS sitov_access_private.sitov_item_scope_exact();
CREATE OR REPLACE FUNCTION sitov_access_private.resolve_item(p_kind text,p_item_id text)
RETURNS TABLE(unit_id uuid,level text,trainer text,owner_id uuid,published boolean,legacy_media boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH refs AS (
 SELECT c.unit_id,false media FROM public.learning_vocabulary_cards c WHERE p_kind='vocabulary_card' AND c.id::text=p_item_id
 UNION ALL SELECT e.unit_id,false FROM public.learning_exercises e WHERE p_kind='exercise' AND e.id::text=p_item_id AND e.node_id IS NULL
 UNION ALL SELECT e.unit_id,false FROM public.learning_exercises e WHERE p_kind='path_task' AND e.id::text=p_item_id AND e.node_id IS NOT NULL AND e.path_is_active
 UNION ALL SELECT r.unit_id,false FROM public.learning_reading_texts r WHERE p_kind='reading_text' AND r.id::text=p_item_id
 UNION ALL SELECT v.unit_id,v.storage_path IS NOT NULL AND v.folder_id IS NOT NULL FROM public.learning_videos v
 WHERE p_kind='video' AND v.id::text=p_item_id AND (v.folder_id IS NULL OR EXISTS(
 SELECT 1 FROM public.lms_media_folder f JOIN public.learning_units u ON u.id=v.unit_id WHERE f.folder_id=v.folder_id AND f.level=u.level))
 UNION ALL SELECT v.unit_id,false FROM public.sitov_verb_catalog v WHERE p_kind='verb' AND v.id=p_item_id
 UNION ALL SELECT n.unit_id,false FROM public.path_nodes n WHERE p_kind='path_node' AND n.id::text=p_item_id AND n.is_active
 UNION ALL SELECT n.unit_id,false FROM public.path_nodes n JOIN public.path_nodes anchor ON anchor.id=n.anchor_node_id AND anchor.unit_id=n.unit_id
 WHERE p_kind='path_special' AND n.id::text=p_item_id AND n.kind='special' AND n.is_active
 UNION ALL SELECT e.unit_id,false FROM public.learning_exercises e JOIN public.path_nodes n ON n.id=e.node_id AND n.unit_id=e.unit_id
 JOIN public.path_nodes anchor ON anchor.id=n.anchor_node_id AND anchor.unit_id=n.unit_id
 WHERE p_kind='path_special_item' AND e.id::text=p_item_id AND n.kind='special' AND n.is_active AND e.path_is_active AND e.content_status='ready'
 ) SELECT u.id,u.level,u.trainer::text,u.owner_auth_user_id,u.is_active,r.media FROM refs r JOIN public.learning_units u ON u.id=r.unit_id
 UNION ALL SELECT NULL::uuid,f.level,'videos',NULL::uuid,true,true FROM public.lms_presentation_asset a
 JOIN public.lms_media_folder f ON f.folder_id=a.folder_id WHERE p_kind='presentation' AND a.asset_id::text=p_item_id
$$;
NOTIFY pgrst,'reload schema';
