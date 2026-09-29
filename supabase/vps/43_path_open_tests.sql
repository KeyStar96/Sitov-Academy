-- Learning path: section tests are never locked.
-- Requires 39. Apply via deploy/vps/migrate-local.py with a verified backup.
--
-- New rules (learner and teacher view alike):
--  * A test node is open as soon as the learner may use its level and trainer,
--    even inside a path that is still locked. Learners can always test what
--    they already know.
--  * A passed test (>= 80 %, graded by finish_path_test) clears its own path
--    and every earlier path of the same level: all lessons there are unlocked.
--    The next path opens as before, because its predecessor is now cleared.
--  * A failed test changes nothing; the lessons stay in their step-by-step order.
-- "completed" in the map still means "this path's own test is passed".
-- No data is written or deleted. Rollback restores the previous definitions.

CREATE TABLE IF NOT EXISTS path_private.open_test_function_backups(signature text PRIMARY KEY,definition text NOT NULL);
ALTER TABLE path_private.open_test_function_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON path_private.open_test_function_backups FROM PUBLIC,anon,authenticated;
DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['path_private.unit_available(uuid)','path_private.node_available(uuid)',
  'teacher_dashboard_private.path_available(uuid,uuid)','teacher_dashboard_private.node_available(uuid,uuid)'] LOOP
  INSERT INTO path_private.open_test_function_backups VALUES(signature,pg_get_functiondef(signature::regprocedure)) ON CONFLICT DO NOTHING;
 END LOOP;
END $$;

-- The learner's own passed test in this path or in any later path of the same level.
CREATE OR REPLACE FUNCTION path_private.unit_cleared(p_unit uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u
  JOIN public.learning_units later ON later.level=u.level AND later.is_path AND later.is_active AND later.sort_order>=u.sort_order
  JOIN public.path_nodes n ON n.unit_id=later.id
  JOIN public.path_test_attempts a ON a.node_id=n.id
  WHERE u.id=p_unit AND a.auth_user_id=(SELECT auth.uid()) AND a.status='completed' AND a.is_active AND a.passed);
$$;
REVOKE ALL ON FUNCTION path_private.unit_cleared(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION path_private.unit_cleared(uuid) TO authenticated,service_role;

-- A cleared predecessor opens the path. The predecessor is also cleared when
-- this path (or a later one) was passed, so a passed test always opens its path.
CREATE OR REPLACE FUNCTION path_private.unit_available(p_unit uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit AND u.is_path AND u.is_active AND learning_private.unit_allowed(u.id)
 AND (business_private.is_staff() OR EXISTS(SELECT 1 FROM public.path_interventions i WHERE i.auth_user_id=(SELECT auth.uid()) AND i.unit_id=u.id AND i.action='unlock' AND i.is_active)
 OR NOT EXISTS(SELECT 1 FROM public.learning_units prev WHERE prev.is_path AND prev.is_active AND prev.level=u.level AND prev.sort_order=(SELECT max(predecessor.sort_order) FROM public.learning_units predecessor WHERE predecessor.is_path AND predecessor.is_active AND predecessor.level=u.level AND predecessor.sort_order<u.sort_order)
   AND NOT path_private.unit_cleared(prev.id))));
$$;

-- Tests only need level/trainer access. Lessons keep their order unless the path is cleared.
CREATE OR REPLACE FUNCTION path_private.node_available(p_node uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.path_nodes n JOIN public.learning_units u ON u.id=n.unit_id WHERE n.id=p_node AND n.is_active
 AND CASE WHEN n.kind='test' THEN u.is_path AND u.is_active AND learning_private.unit_allowed(u.id)
 ELSE path_private.unit_available(n.unit_id) AND (business_private.is_staff() OR path_private.unit_cleared(n.unit_id)
  OR CASE WHEN n.kind='special' THEN EXISTS(SELECT 1 FROM public.path_node_progress p
    WHERE p.node_id=n.anchor_node_id AND p.auth_user_id=(SELECT auth.uid()) AND p.status='completed' AND p.is_active)
  ELSE NOT EXISTS(SELECT 1 FROM public.path_nodes prev WHERE prev.unit_id=n.unit_id AND prev.is_active AND prev.kind IN('practice','review')
    AND prev.sort_order<n.sort_order AND NOT EXISTS(SELECT 1 FROM public.path_node_progress p
     WHERE p.node_id=prev.id AND p.auth_user_id=(SELECT auth.uid()) AND p.status='completed' AND p.is_active)) END) END);
$$;

-- Teacher view mirrors the learner rules for a given student.
CREATE OR REPLACE FUNCTION teacher_dashboard_private.path_cleared(p_student uuid,p_unit uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u
  JOIN public.learning_units later ON later.level=u.level AND later.is_path AND later.is_active AND later.sort_order>=u.sort_order
  JOIN public.path_nodes n ON n.unit_id=later.id
  JOIN public.path_test_attempts a ON a.node_id=n.id
  WHERE u.id=p_unit AND a.auth_user_id=p_student AND a.status='completed' AND a.is_active AND a.passed);
$$;
CREATE OR REPLACE FUNCTION teacher_dashboard_private.path_available(p_student uuid,p_unit uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT teacher_dashboard_private.unit_allowed(p_student,p_unit) AND (
 EXISTS(SELECT 1 FROM public.path_interventions i WHERE i.auth_user_id=p_student AND i.unit_id=p_unit AND i.action='unlock' AND i.is_active)
 OR NOT EXISTS(SELECT 1 FROM public.learning_units prev JOIN public.learning_units u ON u.id=p_unit
 WHERE prev.is_path AND prev.is_active AND prev.level=u.level AND prev.sort_order=(SELECT max(x.sort_order) FROM public.learning_units x WHERE x.is_path AND x.is_active AND x.level=u.level AND x.sort_order<u.sort_order)
 AND NOT teacher_dashboard_private.path_cleared(p_student,prev.id)));
$$;
CREATE OR REPLACE FUNCTION teacher_dashboard_private.node_available(p_student uuid,p_node uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.path_nodes n WHERE n.id=p_node AND n.is_active
 AND CASE WHEN n.kind='test' THEN teacher_dashboard_private.unit_allowed(p_student,n.unit_id)
 ELSE teacher_dashboard_private.path_available(p_student,n.unit_id) AND (teacher_dashboard_private.path_cleared(p_student,n.unit_id)
  OR CASE WHEN n.kind='special' THEN EXISTS(SELECT 1 FROM public.path_node_progress p WHERE p.node_id=n.anchor_node_id AND p.auth_user_id=p_student AND p.is_active AND p.status='completed')
  ELSE NOT EXISTS(SELECT 1 FROM public.path_nodes prev WHERE prev.unit_id=n.unit_id AND prev.is_active AND prev.kind IN('practice','review')
   AND prev.sort_order<n.sort_order AND NOT EXISTS(SELECT 1 FROM public.path_node_progress p WHERE p.node_id=prev.id AND p.auth_user_id=p_student AND p.is_active AND p.status='completed')) END) END);
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA teacher_dashboard_private FROM PUBLIC,anon,authenticated;
