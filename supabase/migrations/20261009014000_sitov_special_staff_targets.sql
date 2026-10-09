-- Sitov Academy: bounded metadata-only staff index. No readiness or publication write.
CREATE OR REPLACE FUNCTION public.sitov_get_special_staff_targets(p_level text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE targets jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN sitov_special_private.error('authentication_required'); END IF;
 IF NOT sitov_access_private.staff() THEN RETURN sitov_special_private.error('not_found'); END IF;
 IF p_level IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level) THEN
  RETURN sitov_special_private.error('invalid_input');
 END IF;
 SELECT coalesce(jsonb_agg(t.value ORDER BY t.level_order,t.unit_order,t.node_order,t.node_id),'[]'::jsonb) INTO targets
 FROM (
  SELECT jsonb_build_object('nodeId',n.id,'unitId',u.id,'title',n.title,'level',u.level,
   'sourceSha256',s.source_sha256,'activeDefinitionId',a.definition_id) AS value,
   l.sort_order AS level_order,u.sort_order AS unit_order,n.sort_order AS node_order,n.id AS node_id
  FROM public.path_nodes n
  JOIN public.learning_units u ON u.id=n.unit_id AND u.is_path AND u.trainer='exercises' AND u.owner_auth_user_id IS NULL
  JOIN public.learning_levels l ON l.code=u.level
  JOIN public.path_nodes anchor ON anchor.id=n.anchor_node_id AND anchor.unit_id=u.id AND anchor.kind IN('practice','review')
  JOIN LATERAL (SELECT d.* FROM sitov_special_private.definitions d WHERE d.node_id=n.id
   ORDER BY d.created_at DESC,d.id DESC LIMIT 1) d ON true
  JOIN sitov_special_private.sources s ON s.source_ref=d.source_ref AND s.level=u.level
  LEFT JOIN sitov_special_private.activation a ON a.node_id=n.id
  WHERE n.kind='special' AND (p_level IS NULL OR u.level=p_level)
   AND length(btrim(n.title)) BETWEEN 1 AND 500
   AND path_private.german_task_allowed(jsonb_build_object('question',n.title))
   AND NOT EXISTS(SELECT 1 FROM unnest(n.goals) goal WHERE NOT EXISTS(
    SELECT 1 FROM public.path_objectives o WHERE o.unit_id=u.id AND o.id=goal))
   -- Equal-time definitions with different sources are ambiguous; never choose a foreign source by UUID.
   AND NOT EXISTS(SELECT 1 FROM sitov_special_private.definitions other
    WHERE other.node_id=n.id AND other.created_at=d.created_at AND other.source_ref<>d.source_ref)
   AND (a.definition_id IS NULL OR EXISTS(SELECT 1 FROM sitov_special_private.definitions active
    WHERE active.node_id=n.id AND active.id=a.definition_id))
  ORDER BY l.sort_order,u.sort_order,n.sort_order,n.id LIMIT 1000
 ) t;
 RETURN jsonb_build_object('ok',true,'data',targets);
END $$;
REVOKE ALL ON FUNCTION public.sitov_get_special_staff_targets(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sitov_get_special_staff_targets(text) TO authenticated;
