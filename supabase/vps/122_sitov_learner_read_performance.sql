-- Sitov Academy: evaluate learner read rules once per statement on home, level and trainer pages.
-- Every dashboard render asks for the last active level, the pretest catalogue and the learning
-- path; the verb trainer reads its catalogue through row security. All of them called the complete
-- access rule (item_allowed, node_available) once per verb, reading text or station, which cost
-- 1-4 s per page for an active learner. The rules are unchanged: each set below is the same
-- predicate without its single-item filter, and callers with trial rules keep the per-item check.

-- item_allowed(p_student,'verb',id) for the whole catalogue: the verb's unit decides, staff
-- additionally need a published verb unit of the same level (migration 113).
CREATE OR REPLACE FUNCTION sitov_access_private.sitov_verb_scope_ids(p_student uuid) RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH me AS (
 SELECT p.id,p.role FROM public.profiles p WHERE p.id=p_student AND sitov_access_private.actor_allowed(p_student)
 ), vip AS (
 SELECT EXISTS(SELECT 1 FROM sitov_access_private.students s JOIN me ON s.student_id=me.id WHERE s.vip_enabled) AS enabled
 ), bought AS (
 SELECT DISTINCT o.level FROM sitov_access_private.purchases g JOIN sitov_access_private.orders o ON o.id=g.order_id
 JOIN me ON o.student_id=me.id WHERE g.active AND o.status='paid' AND o.provider_confirmation_verified
 ), trial AS (
 SELECT EXISTS(SELECT 1 FROM sitov_access_private.students s JOIN me ON s.student_id=me.id WHERE s.trial->'rules' IS DISTINCT FROM '[]'::jsonb) AS present
 )
 SELECT v.id FROM me JOIN public.sitov_verb_catalog v ON true JOIN public.learning_units u ON u.id=v.unit_id
 LEFT JOIN public.learning_trainer_grants g ON g.auth_user_id=me.id AND g.level=u.level AND g.trainer::text=u.trainer::text
 WHERE (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=me.id) AND (
 (me.role IN('teacher','admin') AND u.is_active AND u.trainer::text='verbs'
  AND u.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2') AND v.level=u.level)
 OR (me.role='student' AND (u.is_active OR u.owner_auth_user_id=me.id)
  AND u.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
  AND NOT(u.trainer::text='verbs' AND u.level IN('C1.1','C1.2')) AND (
  (SELECT enabled FROM vip)
  OR u.level IN(SELECT level FROM bought)
  OR (EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.auth_user_id=me.id AND l.level=u.level)
   AND coalesce(g.enabled,true) AND (u.owner_auth_user_id=me.id OR g.unit_mode IS DISTINCT FROM 'selected'
   OR EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=me.id AND x.level=u.level AND x.trainer::text=u.trainer::text AND x.unit_id=u.id)))
  OR (u.owner_auth_user_id IS NULL AND (SELECT present FROM trial)
   AND sitov_access_private.trial_item_allowed(me.id,'verb',v.id,u.id,u.level,u.trainer::text)))))
$$;
REVOKE ALL ON FUNCTION sitov_access_private.sitov_verb_scope_ids(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION sitov_access_private.sitov_verb_scope_ids(uuid) TO authenticated;

-- Unchanged except for its last alternative, which asked item_allowed() for every verb of the level.
CREATE OR REPLACE FUNCTION sitov_verb_private.level_allowed(p_user uuid,p_level text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT sitov_access_private.actor_allowed(p_user) AND p_level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2')
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_user AND (p.role IN('teacher','admin')
 OR EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=p.id AND s.vip_enabled)
 OR sitov_access_private.purchased(p.id,p_level)
 OR (EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p.id AND a.level=p_level)
 AND coalesce((SELECT g.enabled FROM public.learning_trainer_grants g WHERE g.auth_user_id=p.id AND g.level=p_level AND g.trainer='verbs'),true)
 AND NOT EXISTS(SELECT 1 FROM public.learning_trainer_grants g WHERE g.auth_user_id=p.id AND g.level=p_level AND g.trainer='verbs' AND g.unit_mode='selected'
 AND NOT EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=p.id AND x.level=p_level AND x.trainer='verbs')))
 OR EXISTS(SELECT 1 FROM public.sitov_verb_catalog c WHERE c.level=p_level AND c.id IN(SELECT sitov_access_private.sitov_verb_scope_ids(p_user)))))
$$;
-- level_allowed() for its eight levels in one statement (it is false for every other level):
-- the same alternatives with the level taken from the list and the verb scope read once.
CREATE OR REPLACE FUNCTION sitov_verb_private.sitov_allowed_levels(p_user uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH me AS (
 SELECT p.id,p.role FROM public.profiles p WHERE p.id=p_user AND sitov_access_private.actor_allowed(p_user)
 ), scope AS (
 SELECT DISTINCT c.level FROM public.sitov_verb_catalog c WHERE c.id IN(SELECT sitov_access_private.sitov_verb_scope_ids(p_user))
 )
 SELECT coalesce(array_agg(l.code ORDER BY l.code),ARRAY[]::text[])
 FROM me CROSS JOIN unnest(ARRAY['A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2']) AS l(code)
 WHERE me.role IN('teacher','admin')
 OR EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=me.id AND s.vip_enabled)
 OR sitov_access_private.purchased(me.id,l.code)
 OR (EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=me.id AND a.level=l.code)
 AND coalesce((SELECT g.enabled FROM public.learning_trainer_grants g WHERE g.auth_user_id=me.id AND g.level=l.code AND g.trainer='verbs'),true)
 AND NOT EXISTS(SELECT 1 FROM public.learning_trainer_grants g WHERE g.auth_user_id=me.id AND g.level=l.code AND g.trainer='verbs' AND g.unit_mode='selected'
 AND NOT EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=me.id AND x.level=l.code AND x.trainer='verbs')))
 OR l.code IN(SELECT level FROM scope)
$$;
REVOKE ALL ON FUNCTION sitov_verb_private.sitov_allowed_levels(uuid) FROM PUBLIC,anon,authenticated;

ALTER POLICY sitov_verb_catalog_read ON public.sitov_verb_catalog
 USING(id IN(SELECT sitov_access_private.sitov_verb_scope_ids((SELECT auth.uid()))));

-- Only callers with trial rules can gain a unit through a single card; everyone else skipped
-- the card-by-card trial test with a negative result for every unit outside their levels.
CREATE OR REPLACE FUNCTION sitov_access_private.sitov_vocabulary_visible_unit_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u.id FROM public.learning_units u
 JOIN public.profiles p ON p.id=auth.uid()
 LEFT JOIN public.learning_trainer_grants g
  ON g.auth_user_id=p.id AND g.level=u.level AND g.trainer::text=u.trainer::text
 WHERE sitov_access_private.actor_allowed(auth.uid())
 AND EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
 AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=p.id)
 AND (p.role IN('teacher','admin') OR (p.role='student'
  AND (u.is_active OR u.owner_auth_user_id=p.id)
  AND u.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
  AND NOT(u.trainer='verbs' AND u.level IN('C1.1','C1.2'))
  AND (
   EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=p.id AND s.vip_enabled)
   OR sitov_access_private.purchased(p.id,u.level)
   OR (EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.auth_user_id=p.id AND l.level=u.level)
    AND coalesce(g.enabled,true)
    AND (u.owner_auth_user_id=p.id OR g.unit_mode IS DISTINCT FROM 'selected'
     OR EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=p.id
      AND x.level=u.level AND x.trainer::text=u.trainer::text AND x.unit_id=u.id)))
   OR (u.owner_auth_user_id IS NULL AND (SELECT sitov_access_private.sitov_item_scope_exact()) AND EXISTS(
    SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id
    AND sitov_access_private.trial_item_allowed(p.id,'vocabulary_card',c.id::text,u.id,u.level,u.trainer::text)))
  )))
$$;

-- The catalogue of a level in one statement: the commercial scope as in the row policy of
-- migration 119, current_pretest() as a join and the caller's latest attempt per text.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.pretest_catalog(p_level text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE entries jsonb;BEGIN
 IF auth.uid() IS NULL THEN RETURN sitov_pronunciation_private.pretest_error('authentication_required');END IF;
 WITH texts AS (
  SELECT t.id,t.focus,u.id unit_id,u.label,u.sort_order,sitov_pronunciation_private.pretest_hash(t.sentence_de) text_version
  FROM public.learning_reading_texts t JOIN public.learning_units u ON u.id=t.unit_id
  WHERE u.level=p_level AND (t.unit_id IN(SELECT sitov_access_private.sitov_item_scope_unit_ids())
   OR ((SELECT sitov_access_private.sitov_item_scope_exact()) AND sitov_access_private.item_allowed(auth.uid(),'reading_text',t.id::text)))
 ), catalog AS (
  SELECT x.*,d.id definition_id,d.test_version,a.attempt,
   CASE WHEN d.id IS NULL THEN 'locked' ELSE coalesce((a.attempt).status,'available') END status
  FROM texts x
  LEFT JOIN LATERAL (SELECT c.id,c.test_version FROM sitov_pronunciation_private.pretest_definitions c
   WHERE c.text_id=x.id AND c.active AND c.text_version=x.text_version
   AND (EXISTS(SELECT 1 FROM sitov_pronunciation_private.sitov_publication_marks m WHERE m.definition_id=c.id)
    OR sitov_pronunciation_private.publication_ready(c.id,c.text_id,c.text_version,c.test_version,c.definition)) LIMIT 1) d ON true
  LEFT JOIN LATERAL (SELECT latest AS attempt FROM sitov_pronunciation_private.pretest_attempts latest
   WHERE latest.student_id=auth.uid() AND latest.text_id=x.id AND latest.definition_id=d.id AND latest.status<>'outdated'
   ORDER BY latest.started_at DESC LIMIT 1) a ON true
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('textId',r.id,'unitId',r.unit_id,'level',p_level,'title',r.label,'focus',r.focus,'kind','regular',
  'textVersion',r.text_version,'testVersion',r.test_version,'status',r.status,
  'lockedReason',CASE WHEN r.definition_id IS NOT NULL THEN NULL WHEN EXISTS(SELECT 1 FROM sitov_pronunciation_private.pretest_attempts old
   WHERE old.student_id=auth.uid() AND old.text_id=r.id) THEN 'version_changed' ELSE 'authoring_not_ready' END,
  'attempt',CASE WHEN (r.attempt).id IS NULL THEN NULL ELSE sitov_pronunciation_private.attempt_summary(r.attempt) END,
  'proof',CASE WHEN r.status='passed' THEN (r.attempt).result->'proof' END,
  'target',CASE r.status WHEN 'locked' THEN NULL WHEN 'passed' THEN 'pronunciation' WHEN 'in_progress' THEN 'resume_pretest' ELSE 'pretest' END)
  ORDER BY r.sort_order,r.id),'[]'::jsonb)
 INTO entries FROM catalog r;
 RETURN jsonb_build_object('ok',true,'data',entries);END $$;
CREATE INDEX IF NOT EXISTS sitov_pretest_attempt_latest_idx ON sitov_pronunciation_private.pretest_attempts(student_id,text_id,started_at DESC);

-- node_available() repeated the unit rules for every station of the level. They are read once
-- per unit; the station rule itself (test, special branch, earlier stations) is the same.
CREATE OR REPLACE FUNCTION public.get_learning_path(p_level text,p_locale text DEFAULT 'de') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); paths jsonb; done boolean; next_level text; next_allowed boolean; staff boolean; BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_locale IS NULL OR p_locale NOT IN('de','en','ru','uk','tr') THEN RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF NOT trainer_access_private.allowed(p_level,'exercises') THEN RAISE EXCEPTION 'path_locked' USING ERRCODE='42501'; END IF;
 staff:=business_private.is_staff();
 WITH units AS MATERIALIZED (
  SELECT u.id,u.path_source_id,u.path_title,u.sort_order,path_private.unit_available(u.id) available,
   learning_private.unit_allowed(u.id) allowed,path_private.unit_cleared(u.id) cleared
  FROM public.learning_units u WHERE u.level=p_level AND u.is_path AND u.is_active
 ), completed_nodes AS MATERIALIZED (
  SELECT p.node_id FROM public.path_node_progress p WHERE p.auth_user_id=actor AND p.status='completed' AND p.is_active
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'source_id',u.path_source_id,'title',coalesce(t.title,u.path_title),'sort_order',u.sort_order,
  'available',u.available,'completed',EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id WHERE n.unit_id=u.id AND a.auth_user_id=actor AND a.passed AND a.status='completed' AND a.is_active),
  'nodes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'title',coalesce(nt.title,n.title),'sort_order',n.sort_order,'anchor_node_id',n.anchor_node_id,
    'available',coalesce(CASE WHEN n.kind='test' THEN u.allowed
     ELSE u.available AND (staff OR u.cleared
      OR CASE WHEN n.kind='special' THEN EXISTS(SELECT 1 FROM completed_nodes c WHERE c.node_id=n.anchor_node_id)
      ELSE NOT EXISTS(SELECT 1 FROM public.path_nodes prev WHERE prev.unit_id=n.unit_id AND prev.is_active AND prev.kind IN('practice','review')
       AND prev.sort_order<n.sort_order AND NOT EXISTS(SELECT 1 FROM completed_nodes c WHERE c.node_id=prev.id)) END) END,false),
    'status',p.status,'stars',coalesce(p.best_stars,0),'first_attempt_accuracy',p.first_attempt_accuracy,
    'tests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'percentage',a.percentage,'passed',a.passed,'completed_at',a.completed_at) ORDER BY a.created_at DESC) FROM public.path_test_attempts a WHERE a.node_id=n.id AND a.auth_user_id=actor AND a.is_active),'[]'::jsonb)) ORDER BY n.sort_order)
   FROM public.path_nodes n LEFT JOIN public.path_node_translations nt ON nt.node_id=n.id AND nt.locale=p_locale LEFT JOIN public.path_node_progress p ON p.node_id=n.id AND p.auth_user_id=actor AND p.is_active WHERE n.unit_id=u.id AND n.is_active),'[]'::jsonb)) ORDER BY u.sort_order),'[]'::jsonb)
 INTO paths FROM units u LEFT JOIN public.path_unit_translations t ON t.unit_id=u.id AND t.locale=p_locale;
 done:=jsonb_array_length(paths)>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(paths) x WHERE NOT (x->>'completed')::boolean);
 SELECT n.code INTO next_level FROM public.learning_levels n JOIN public.learning_levels l ON l.code=p_level WHERE n.sort_order>l.sort_order AND n.is_active ORDER BY n.sort_order LIMIT 1;
 next_allowed:=EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=actor AND a.level=next_level);

 RETURN jsonb_build_object('level',p_level,'paths',paths,'completed',done,'next_level',next_level,'next_level_available',next_allowed,
  'resume_node_id',(SELECT checkpoint.node_id FROM (
    SELECT r.node_id,r.updated_at AS at FROM public.path_practice_runs r
    JOIN public.path_nodes n ON n.id=r.node_id JOIN public.learning_units u ON u.id=n.unit_id
    WHERE r.auth_user_id=actor AND r.is_active AND r.status='active' AND u.level=p_level AND path_private.node_available(n.id)
    UNION ALL
    SELECT a.node_id,greatest(a.created_at,coalesce((SELECT max(answered_at) FROM public.path_test_answers ans WHERE ans.attempt_id=a.id),a.created_at))
    FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id
    WHERE a.auth_user_id=actor AND a.is_active AND a.status='active' AND u.level=p_level AND path_private.node_available(n.id)
  ) checkpoint ORDER BY checkpoint.at DESC,checkpoint.node_id LIMIT 1));

EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

-- Home shows a percentage per level from the visible course cards and the cards learned in both
-- directions. It read the whole catalogue and the caller's progress page by page. The statement
-- runs with the caller's own rights, so the row policies decide exactly as for those table reads.
CREATE OR REPLACE FUNCTION public.get_sitov_vocabulary_level_counts() RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(x.level,jsonb_build_object('total',x.total,'learned',x.learned)),'{}'::jsonb) FROM (
  SELECT u.level,count(*) total,count(l.card_id) learned
  FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id
  LEFT JOIN (SELECT p.card_id FROM public.vocabulary_direction_progress p
   WHERE p.auth_user_id=(SELECT auth.uid()) AND p.box_number=7 GROUP BY p.card_id
   HAVING bool_or(p.direction='de_to_native') AND bool_or(p.direction='native_to_de')) l ON l.card_id=c.id
  WHERE u.owner_auth_user_id IS NULL AND u.is_active GROUP BY u.level) x
$$;
REVOKE ALL ON FUNCTION public.get_sitov_vocabulary_level_counts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_sitov_vocabulary_level_counts() TO authenticated,service_role;

-- The latest answered challenge per verb form decides its context level.
CREATE INDEX IF NOT EXISTS sitov_verb_challenge_latest_idx ON public.sitov_verb_challenges(auth_user_id,verb_id,tense,created_at DESC) WHERE result IS NOT NULL;

-- Three reports ask the verb rules per row; they keep their text and read the two sets instead.
DO $sitov$
DECLARE body text; scope text:='IN(SELECT sitov_access_private.sitov_verb_scope_ids(%s))';
BEGIN
 body:=pg_get_functiondef('public.get_last_active_level()'::regprocedure);
 IF position('verb_levels' IN body)=0 THEN
  body:=replace(body,' staff boolean;',' staff boolean;'||chr(10)||' verb_levels text[];');
  body:=replace(body,'staff:=coalesce(staff,false);','staff:=coalesce(staff,false);'||chr(10)||' verb_levels:=sitov_verb_private.sitov_allowed_levels(actor);');
  body:=replace(body,'sitov_verb_private.verb_allowed(actor,p.verb_id)','p.verb_id '||format(scope,'actor'));
  body:=replace(body,'sitov_verb_private.level_allowed(actor,l.code)','l.code=ANY(verb_levels)');
  body:=replace(body,'sitov_verb_private.level_allowed(actor,c.context_level)','c.context_level=ANY(verb_levels)');
  IF body ~ '(verb_allowed|level_allowed)\(' OR (length(body)-length(replace(body,'verb_levels','')))/length('verb_levels')<>6
   OR position('sitov_verb_scope_ids(actor)' IN body)=0 THEN RAISE EXCEPTION 'sitov_last_active_level_contract_changed'; END IF;
  EXECUTE body;
 END IF;

 body:=pg_get_functiondef('public.get_learning_progress(uuid,text,integer)'::regprocedure);
 IF position('sitov_verb_scope_ids' IN body)=0 THEN
  body:=replace(body,'sitov_verb_private.verb_allowed(learner,c.id)','c.id '||format(scope,'learner'));
  body:=replace(body,'sitov_verb_private.level_allowed(learner,l.code)','l.code=ANY((SELECT sitov_verb_private.sitov_allowed_levels(learner))::text[])');
  IF body ~ '(verb_allowed|level_allowed)\(' OR position('sitov_verb_scope_ids(learner)' IN body)=0
   OR position('sitov_allowed_levels(learner)' IN body)=0 THEN RAISE EXCEPTION 'sitov_learning_progress_contract_changed'; END IF;
  EXECUTE body;
 END IF;

 body:=pg_get_functiondef('sitov_pronunciation_private.evidence(uuid)'::regprocedure);
 IF position('sitov_verb_scope_ids' IN body)=0 THEN
  body:=replace(body,'sitov_verb_private.verb_allowed(p_student,c.id)','c.id '||format(scope,'p_student'));
  body:=replace(body,'sitov_verb_private.level_allowed(p_student,context.code)','context.code=ANY((SELECT sitov_verb_private.sitov_allowed_levels(p_student))::text[])');
  IF body ~ '(verb_allowed|level_allowed)\(' OR position('sitov_verb_scope_ids(p_student)' IN body)=0
   OR position('sitov_allowed_levels(p_student)' IN body)=0 THEN RAISE EXCEPTION 'sitov_pronunciation_evidence_contract_changed'; END IF;
  EXECUTE body;
 END IF;
END $sitov$;
NOTIFY pgrst,'reload schema';
