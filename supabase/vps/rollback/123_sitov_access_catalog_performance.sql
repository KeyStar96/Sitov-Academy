-- Sitov Academy: resolve and check every item of the access catalogue one by one again (migration 93).
CREATE OR REPLACE FUNCTION public.get_sitov_access_catalog(p_level text, p_trainer text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN
 IF NOT sitov_access_private.actor_allowed(auth.uid()) THEN RETURN jsonb_build_object('error','forbidden');END IF;
 IF p_level NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 OR p_trainer NOT IN('vocabulary','exercises','pronunciation','videos','verbs') THEN RETURN jsonb_build_object('error','invalid_input');END IF;
 RETURN (WITH refs AS (
 SELECT 'vocabulary_card' kind,id::text id FROM public.learning_vocabulary_cards
 UNION ALL SELECT CASE WHEN node_id IS NULL THEN 'exercise' ELSE 'path_task' END,id::text FROM public.learning_exercises
 UNION ALL SELECT 'reading_text',id::text FROM public.learning_reading_texts
 UNION ALL SELECT 'video',id::text FROM public.learning_videos
 UNION ALL SELECT 'verb',id FROM public.sitov_verb_catalog
 UNION ALL SELECT 'path_node',id::text FROM public.path_nodes
 UNION ALL SELECT 'path_special',id::text FROM public.path_nodes WHERE kind='special'
 UNION ALL SELECT 'path_special_item',e.id::text FROM public.learning_exercises e JOIN public.path_nodes n ON n.id=e.node_id AND n.unit_id=e.unit_id WHERE n.kind='special'
 UNION ALL SELECT 'presentation',asset_id::text FROM public.lms_presentation_asset
 ),items AS (SELECT r.kind,r.id,i.unit_id,i.published FROM refs r CROSS JOIN LATERAL sitov_access_private.resolve_item(r.kind,r.id) i
 WHERE i.level=p_level AND i.trainer=p_trainer AND (i.owner_id IS NULL OR i.owner_id=auth.uid()) AND sitov_access_private.item_allowed(auth.uid(),r.kind,r.id)),
 units AS (SELECT i.unit_id,coalesce(u.label,'') label,jsonb_agg(jsonb_build_object('kind',i.kind,'id',i.id,'label',coalesce(u.label,''),'published',i.published) ORDER BY i.kind,i.id) items
 FROM items i LEFT JOIN public.learning_units u ON u.id=i.unit_id GROUP BY i.unit_id,u.label)
 SELECT jsonb_build_object('version',1,'level',p_level,'trainer',p_trainer,'units',coalesce(jsonb_agg(jsonb_build_object('id',unit_id,'label',label,'items',items) ORDER BY unit_id),'[]'::jsonb)) FROM units);
END $function$;
DO $sitov$
DECLARE body text; unit_rule text:='(n.unit_id IN(SELECT sitov_access_private.sitov_item_scope_unit_ids()) OR ((SELECT sitov_access_private.sitov_item_scope_exact()) AND %s))';
 node_rule text:='sitov_access_private.item_allowed(actor,CASE WHEN n.kind=''special'' THEN ''path_special'' ELSE ''path_node'' END,n.id::text)';
 anchor_rule text:='sitov_access_private.item_allowed(actor,''path_node'',anchor.id::text)';
BEGIN
 body:=pg_get_functiondef('learning_private.sitov_recommendation_sources(text,uuid[])'::regprocedure);
 body:=replace(replace(body,format(unit_rule,node_rule),node_rule),format(unit_rule,anchor_rule),anchor_rule);
 IF position('sitov_item_scope_unit_ids' IN body)>0 THEN RAISE EXCEPTION 'sitov_recommendation_sources_contract_changed'; END IF;
 EXECUTE body;
END $sitov$;
NOTIFY pgrst,'reload schema';
