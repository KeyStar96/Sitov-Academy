-- Sitov Academy: build the access catalogue of a level from sets.
-- get_sitov_access_catalog() resolved every item of the whole database one by one before it
-- filtered by level and trainer, then asked item_allowed() per remaining item. For learners it
-- always ran into the 8 s API limit, so the learning path waited 8 s for its recommendations and
-- every content check that reads the catalogue failed. The references below are resolve_item()
-- without its single-item filter, restricted to the requested units first; the rule per item is
-- the unit scope of migration 119 (verbs: migration 122). Uploaded media and presentations keep
-- the per-item rule, as do callers with trial rules.
CREATE OR REPLACE FUNCTION public.get_sitov_access_catalog(p_level text,p_trainer text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT sitov_access_private.actor_allowed(auth.uid()) THEN RETURN jsonb_build_object('error','forbidden');END IF;
 IF p_level NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 OR p_trainer NOT IN('vocabulary','exercises','pronunciation','videos','verbs') THEN RETURN jsonb_build_object('error','invalid_input');END IF;
 RETURN (WITH scope AS MATERIALIZED (
 SELECT u.id,u.is_active published FROM public.learning_units u
 WHERE u.level=p_level AND u.trainer::text=p_trainer AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=auth.uid())
 ),refs AS (
 SELECT 'vocabulary_card' kind,c.id::text id,c.unit_id,false media FROM public.learning_vocabulary_cards c
 UNION ALL SELECT CASE WHEN e.node_id IS NULL THEN 'exercise' ELSE 'path_task' END,e.id::text,e.unit_id,false FROM public.learning_exercises e WHERE e.node_id IS NULL OR e.path_is_active
 UNION ALL SELECT 'reading_text',r.id::text,r.unit_id,false FROM public.learning_reading_texts r
 UNION ALL SELECT 'video',v.id::text,v.unit_id,v.storage_path IS NOT NULL AND v.folder_id IS NOT NULL FROM public.learning_videos v
 WHERE v.folder_id IS NULL OR EXISTS(SELECT 1 FROM public.lms_media_folder f JOIN public.learning_units u ON u.id=v.unit_id WHERE f.folder_id=v.folder_id AND f.level=u.level)
 UNION ALL SELECT 'verb',v.id,v.unit_id,false FROM public.sitov_verb_catalog v
 UNION ALL SELECT 'path_node',n.id::text,n.unit_id,false FROM public.path_nodes n WHERE n.is_active
 UNION ALL SELECT 'path_special',n.id::text,n.unit_id,false FROM public.path_nodes n JOIN public.path_nodes anchor ON anchor.id=n.anchor_node_id AND anchor.unit_id=n.unit_id
 WHERE n.kind='special' AND n.is_active
 UNION ALL SELECT 'path_special_item',e.id::text,e.unit_id,false FROM public.learning_exercises e JOIN public.path_nodes n ON n.id=e.node_id AND n.unit_id=e.unit_id
 JOIN public.path_nodes anchor ON anchor.id=n.anchor_node_id AND anchor.unit_id=n.unit_id
 WHERE n.kind='special' AND n.is_active AND e.path_is_active AND e.content_status='ready'
 ),resolved AS (
 SELECT r.kind,r.id,s.id unit_id,s.published,r.media FROM refs r JOIN scope s ON s.id=r.unit_id
 UNION ALL SELECT 'presentation',a.asset_id::text,NULL::uuid,true,true FROM public.lms_presentation_asset a
 JOIN public.lms_media_folder f ON f.folder_id=a.folder_id WHERE f.level=p_level AND p_trainer='videos'
 ),items AS (SELECT r.kind,r.id,r.unit_id,r.published FROM resolved r WHERE CASE
 WHEN r.kind='verb' THEN r.id IN(SELECT sitov_access_private.sitov_verb_scope_ids(auth.uid()))
 WHEN r.media THEN sitov_access_private.item_allowed(auth.uid(),r.kind,r.id)
 ELSE r.unit_id IN(SELECT sitov_access_private.sitov_item_scope_unit_ids())
  OR ((SELECT sitov_access_private.sitov_item_scope_exact()) AND sitov_access_private.item_allowed(auth.uid(),r.kind,r.id)) END),
 units AS (SELECT i.unit_id,coalesce(u.label,'') label,jsonb_agg(jsonb_build_object('kind',i.kind,'id',i.id,'label',coalesce(u.label,''),'published',i.published) ORDER BY i.kind,i.id) items
 FROM items i LEFT JOIN public.learning_units u ON u.id=i.unit_id GROUP BY i.unit_id,u.label)
 SELECT jsonb_build_object('version',1,'level',p_level,'trainer',p_trainer,'units',coalesce(jsonb_agg(jsonb_build_object('id',unit_id,'label',label,'items',items) ORDER BY unit_id),'[]'::jsonb)) FROM units);
END $$;
-- The recommendation sources of a path asked item_allowed() per station. Each row there is an
-- active station of the requested unit (a special one with its anchor in the same unit), which
-- is all resolve_item() adds, so the unit scope decides it as well.
DO $sitov$
DECLARE body text; unit_rule text:='(n.unit_id IN(SELECT sitov_access_private.sitov_item_scope_unit_ids()) OR ((SELECT sitov_access_private.sitov_item_scope_exact()) AND %s))';
 node_rule text:='sitov_access_private.item_allowed(actor,CASE WHEN n.kind=''special'' THEN ''path_special'' ELSE ''path_node'' END,n.id::text)';
 anchor_rule text:='sitov_access_private.item_allowed(actor,''path_node'',anchor.id::text)';
BEGIN
 body:=pg_get_functiondef('learning_private.sitov_recommendation_sources(text,uuid[])'::regprocedure);
 IF position('sitov_item_scope_unit_ids' IN body)=0 THEN
  IF position('AND '||node_rule IN body)=0 OR position('AND '||anchor_rule IN body)=0 THEN RAISE EXCEPTION 'sitov_recommendation_sources_contract_changed'; END IF;
  body:=replace(body,'AND '||node_rule,'AND '||format(unit_rule,node_rule));
  body:=replace(body,'AND '||anchor_rule,'AND '||format(unit_rule,anchor_rule));
  EXECUTE body;
 END IF;
END $sitov$;
NOTIFY pgrst,'reload schema';
