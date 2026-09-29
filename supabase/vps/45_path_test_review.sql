-- Learning path: test evaluation (Phase-8 prompt, item 3).
-- Requires 44. Apply via deploy/vps/migrate-local.py with a verified backup.
--
--  * get_path_test_review(node, locale): the learner's own latest completed
--    attempt of a test with every answer, its result and the solution, so the
--    map can offer "view evaluation" next to "start again".
--  * get_learning_path no longer lists attempts a teacher has reset (archived,
--    is_active=false); the map and the evaluation only see current attempts.
-- No data is written. Rollback restores get_learning_path and drops the RPC.

CREATE TABLE IF NOT EXISTS path_private.test_review_function_backups(signature text PRIMARY KEY,definition text NOT NULL);
ALTER TABLE path_private.test_review_function_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON path_private.test_review_function_backups FROM PUBLIC,anon,authenticated;
INSERT INTO path_private.test_review_function_backups
 VALUES('public.get_learning_path(text,text)',pg_get_functiondef('public.get_learning_path(text,text)'::regprocedure)) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_learning_path(p_level text,p_locale text DEFAULT 'de') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); paths jsonb; done boolean; next_level text; next_allowed boolean; BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_locale IS NULL OR p_locale NOT IN('de','en','ru','uk','tr') THEN RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF NOT trainer_access_private.allowed(p_level,'exercises') THEN RAISE EXCEPTION 'path_locked' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'source_id',u.path_source_id,'title',coalesce(t.title,u.path_title),'sort_order',u.sort_order,
  'available',path_private.unit_available(u.id),'completed',EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id WHERE n.unit_id=u.id AND a.auth_user_id=actor AND a.passed AND a.status='completed' AND a.is_active),
  'nodes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'title',coalesce(nt.title,n.title),'sort_order',n.sort_order,'anchor_node_id',n.anchor_node_id,
    'available',path_private.node_available(n.id),'status',p.status,'stars',coalesce(p.best_stars,0),'first_attempt_accuracy',p.first_attempt_accuracy,
    'tests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'percentage',a.percentage,'passed',a.passed,'completed_at',a.completed_at) ORDER BY a.created_at DESC) FROM public.path_test_attempts a WHERE a.node_id=n.id AND a.auth_user_id=actor AND a.is_active),'[]'::jsonb)) ORDER BY n.sort_order)
   FROM public.path_nodes n LEFT JOIN public.path_node_translations nt ON nt.node_id=n.id AND nt.locale=p_locale LEFT JOIN public.path_node_progress p ON p.node_id=n.id AND p.auth_user_id=actor AND p.is_active WHERE n.unit_id=u.id AND n.is_active),'[]'::jsonb)) ORDER BY u.sort_order),'[]'::jsonb)
 INTO paths FROM public.learning_units u LEFT JOIN public.path_unit_translations t ON t.unit_id=u.id AND t.locale=p_locale
 WHERE u.level=p_level AND u.is_path AND u.is_active;
 done:=jsonb_array_length(paths)>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(paths) x WHERE NOT (x->>'completed')::boolean);
 SELECT n.code INTO next_level FROM public.learning_levels n JOIN public.learning_levels l ON l.code=p_level WHERE n.sort_order>l.sort_order AND n.is_active ORDER BY n.sort_order LIMIT 1;
 next_allowed:=EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=actor AND a.level=next_level);
 RETURN jsonb_build_object('level',p_level,'paths',paths,'completed',done,'next_level',next_level,'next_level_available',next_allowed);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.get_path_test_review(p_node_id uuid,p_locale text DEFAULT 'de') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
-- Evaluation of the learner's latest completed (not reset) attempt of a test:
-- the same answers/results/solutions finish_path_test returned at the end,
-- plus the completion time. Read-only; finish_path_test is idempotent for a
-- completed attempt and repeats ownership and availability checks.
DECLARE actor uuid; attempt public.path_test_attempts; review jsonb; BEGIN
 actor:=path_private.check_actor(p_locale);
 SELECT a.* INTO attempt FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id AND n.kind='test'
  WHERE a.node_id=p_node_id AND a.auth_user_id=actor AND a.is_active AND a.status='completed'
  ORDER BY a.completed_at DESC NULLS LAST,a.created_at DESC,a.id DESC LIMIT 1;
 IF attempt.id IS NULL THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='22023'; END IF;
 review:=public.finish_path_test(attempt.id,p_locale);
 IF review ? 'error' THEN RETURN review; END IF;
 RETURN review||jsonb_build_object('completed_at',attempt.completed_at);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

REVOKE ALL ON FUNCTION public.get_learning_path(text,text),public.get_path_test_review(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_learning_path(text,text),public.get_path_test_review(uuid,text) TO authenticated;
