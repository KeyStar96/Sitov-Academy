-- Sitov Academy: narrow current-rights source metadata; no table/RLS grant.
CREATE OR REPLACE FUNCTION learning_private.sitov_recommendation_sources(p_level text,p_node_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();path jsonb;catalog jsonb;sources jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('ok',false,'error','authentication_required','retryable',false);END IF;
 IF p_level IS NULL OR p_level NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 OR p_node_ids IS NULL OR cardinality(p_node_ids) NOT BETWEEN 1 AND 200 OR array_ndims(p_node_ids)<>1
 OR array_position(p_node_ids,NULL) IS NOT NULL OR cardinality(p_node_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_node_ids) id)
 THEN RETURN jsonb_build_object('ok',false,'error','invalid_input','retryable',false);END IF;
 IF NOT sitov_access_private.actor_allowed(actor) THEN RETURN jsonb_build_object('ok',false,'error','not_found','retryable',false);END IF;
 path:=public.get_learning_path(p_level,'de');catalog:=public.get_sitov_access_catalog(p_level,'exercises');
 IF path ? 'error' OR catalog ? 'error' THEN
  IF path->>'error' IN('path_locked','not_authorized') OR catalog->>'error'='forbidden' THEN RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('level',p_level,'sources','[]'::jsonb));END IF;
  RETURN jsonb_build_object('ok',false,'error','retryable_failure','retryable',true);
 END IF;
 IF jsonb_typeof(path->'paths') IS DISTINCT FROM 'array' OR jsonb_typeof(catalog->'units') IS DISTINCT FROM 'array'
 THEN RETURN jsonb_build_object('ok',false,'error','retryable_failure','retryable',true);END IF;
 WITH available AS MATERIALIZED (
  SELECT unit->>'id' unit_id,node->>'id' node_id FROM jsonb_array_elements(path->'paths') unit
  CROSS JOIN LATERAL jsonb_array_elements(unit->'nodes') node
  WHERE unit->'available'='true'::jsonb AND node->'available'='true'::jsonb
 ),commercial AS MATERIALIZED (
  SELECT unit->>'id' unit_id,item->>'id' item_id,item->>'kind' kind FROM jsonb_array_elements(catalog->'units') unit
  CROSS JOIN LATERAL jsonb_array_elements(unit->'items') item WHERE item->'published'='true'::jsonb
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('nodeId',n.id,'unitId',u.id,'pathSourceId',u.path_source_id,'nodeSourceId',n.source_id,
  'kind',n.kind,'anchorNodeId',CASE WHEN n.kind='special' THEN anchor.id ELSE NULL END,
  'anchorSourceId',CASE WHEN n.kind='special' THEN anchor.source_id ELSE NULL END,
  'goals',to_jsonb(n.goals),'anchorGoals',CASE WHEN n.kind='special' THEN to_jsonb(anchor.goals) ELSE '[]'::jsonb END) ORDER BY n.id),'[]'::jsonb)
 INTO sources FROM public.path_nodes n JOIN public.learning_units u ON u.id=n.unit_id
 LEFT JOIN public.path_nodes anchor ON anchor.id=n.anchor_node_id AND anchor.unit_id=n.unit_id
 WHERE n.id=ANY(p_node_ids) AND u.level=p_level AND u.is_active AND u.is_path AND n.is_active
 AND n.kind IN('practice','review','test','special') AND nullif(btrim(u.path_source_id),'') IS NOT NULL AND nullif(btrim(n.source_id),'') IS NOT NULL
 AND n.goals IS NOT NULL AND array_position(n.goals,NULL) IS NULL
 AND (SELECT count(*) FROM public.learning_units other WHERE other.level=u.level AND other.is_path AND other.path_source_id=u.path_source_id)=1
 AND (SELECT count(*) FROM public.path_nodes other WHERE other.unit_id=n.unit_id AND other.source_id=n.source_id)=1
 AND EXISTS(SELECT 1 FROM available a WHERE a.unit_id=u.id::text AND a.node_id=n.id::text)
 AND EXISTS(SELECT 1 FROM commercial c WHERE c.unit_id=u.id::text AND c.item_id=n.id::text AND c.kind=CASE WHEN n.kind='special' THEN 'path_special' ELSE 'path_node' END)
 AND sitov_access_private.item_allowed(actor,CASE WHEN n.kind='special' THEN 'path_special' ELSE 'path_node' END,n.id::text)
 AND (n.kind<>'special' OR (anchor.is_active AND anchor.kind IN('practice','review','test') AND nullif(btrim(anchor.source_id),'') IS NOT NULL
  AND anchor.goals IS NOT NULL AND array_position(anchor.goals,NULL) IS NULL
  AND EXISTS(SELECT 1 FROM available a WHERE a.unit_id=u.id::text AND a.node_id=anchor.id::text)
  AND EXISTS(SELECT 1 FROM commercial c WHERE c.unit_id=u.id::text AND c.item_id=anchor.id::text AND c.kind='path_node')
  AND sitov_access_private.item_allowed(actor,'path_node',anchor.id::text) AND sitov_special_private.available(n.id)
  AND EXISTS(SELECT 1 FROM sitov_special_private.activation active JOIN sitov_special_private.definitions d ON d.id=active.definition_id AND d.node_id=active.node_id
   WHERE active.node_id=n.id AND d.published AND sitov_special_private.definition_ready(d))));
 RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('level',p_level,'sources',sources));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'error','retryable_failure','retryable',true);
END $$;
REVOKE ALL ON FUNCTION learning_private.sitov_recommendation_sources(text,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION learning_private.sitov_recommendation_sources(text,uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.sitov_get_learning_recommendation_sources(p_level text,p_node_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT learning_private.sitov_recommendation_sources(p_level,p_node_ids) $$;
REVOKE ALL ON FUNCTION public.sitov_get_learning_recommendation_sources(text,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sitov_get_learning_recommendation_sources(text,uuid[]) TO authenticated;
NOTIFY pgrst,'reload schema';
