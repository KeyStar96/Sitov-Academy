-- Sitov Academy: return the learner read rules to their per-item form (migrations 86, 93, 94, 113, 119).
ALTER POLICY sitov_verb_catalog_read ON public.sitov_verb_catalog
 USING(sitov_verb_private.verb_allowed((SELECT auth.uid()),id));
CREATE OR REPLACE FUNCTION public.get_learning_path(p_level text, p_locale text DEFAULT 'de'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $function$;
CREATE OR REPLACE FUNCTION sitov_verb_private.level_allowed(p_user uuid, p_level text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT sitov_access_private.actor_allowed(p_user) AND p_level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2')
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_user AND (p.role IN('teacher','admin')
 OR EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=p.id AND s.vip_enabled)
 OR sitov_access_private.purchased(p.id,p_level)
 OR (EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p.id AND a.level=p_level)
 AND coalesce((SELECT g.enabled FROM public.learning_trainer_grants g WHERE g.auth_user_id=p.id AND g.level=p_level AND g.trainer='verbs'),true)
 AND NOT EXISTS(SELECT 1 FROM public.learning_trainer_grants g WHERE g.auth_user_id=p.id AND g.level=p_level AND g.trainer='verbs' AND g.unit_mode='selected'
 AND NOT EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=p.id AND x.level=p_level AND x.trainer='verbs')))
 OR EXISTS(SELECT 1 FROM public.sitov_verb_catalog c WHERE c.level=p_level AND sitov_access_private.item_allowed(p.id,'verb',c.id))))
$function$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.pretest_catalog(p_level text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r record;d sitov_pronunciation_private.pretest_definitions;a sitov_pronunciation_private.pretest_attempts;entries jsonb:='[]';status text;proof jsonb;reason text;BEGIN
 IF auth.uid() IS NULL THEN RETURN sitov_pronunciation_private.pretest_error('authentication_required');END IF;
 FOR r IN SELECT t.id,t.sentence_de,t.focus,u.id unit_id,u.label FROM public.learning_reading_texts t JOIN public.learning_units u ON u.id=t.unit_id WHERE u.level=p_level AND sitov_access_private.item_allowed(auth.uid(),'reading_text',t.id::text) ORDER BY u.sort_order,t.id LOOP
 d:=sitov_pronunciation_private.current_pretest(r.id);a:=NULL;proof:=NULL;reason:=NULL;
 IF d.id IS NULL THEN status:='locked';reason:=CASE WHEN EXISTS(SELECT 1 FROM sitov_pronunciation_private.pretest_attempts old WHERE old.student_id=auth.uid() AND old.text_id=r.id) THEN 'version_changed' ELSE 'authoring_not_ready' END;ELSE SELECT latest.* INTO a FROM sitov_pronunciation_private.pretest_attempts latest WHERE latest.student_id=auth.uid() AND latest.text_id=r.id AND latest.definition_id=d.id AND latest.status<>'outdated' ORDER BY latest.started_at DESC LIMIT 1;status:=coalesce(a.status,'available');IF status='passed' THEN proof:=a.result->'proof';END IF;END IF;
 entries:=entries||jsonb_build_array(jsonb_build_object('textId',r.id,'unitId',r.unit_id,'level',p_level,'title',r.label,'focus',r.focus,'kind','regular','textVersion',sitov_pronunciation_private.pretest_hash(r.sentence_de),'testVersion',d.test_version,'status',status,'lockedReason',reason,'attempt',CASE WHEN a.id IS NULL THEN NULL ELSE sitov_pronunciation_private.attempt_summary(a) END,'proof',proof,'target',CASE status WHEN 'locked' THEN NULL WHEN 'passed' THEN 'pronunciation' WHEN 'in_progress' THEN 'resume_pretest' ELSE 'pretest' END));END LOOP;
 RETURN jsonb_build_object('ok',true,'data',entries);END $function$;
CREATE OR REPLACE FUNCTION sitov_access_private.sitov_vocabulary_visible_unit_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   OR (u.owner_auth_user_id IS NULL AND EXISTS(
    SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id
    AND sitov_access_private.trial_item_allowed(p.id,'vocabulary_card',c.id::text,u.id,u.level,u.trainer::text)))
  )))
$function$;
DO $sitov$
DECLARE body text; scope text:='IN(SELECT sitov_access_private.sitov_verb_scope_ids(%s))';
BEGIN
 body:=pg_get_functiondef('public.get_last_active_level()'::regprocedure);
 body:=replace(body,' staff boolean;'||chr(10)||' verb_levels text[];',' staff boolean;');
 body:=replace(body,'staff:=coalesce(staff,false);'||chr(10)||' verb_levels:=sitov_verb_private.sitov_allowed_levels(actor);','staff:=coalesce(staff,false);');
 body:=replace(body,'p.verb_id '||format(scope,'actor'),'sitov_verb_private.verb_allowed(actor,p.verb_id)');
 body:=replace(body,'l.code=ANY(verb_levels)','sitov_verb_private.level_allowed(actor,l.code)');
 body:=replace(body,'c.context_level=ANY(verb_levels)','sitov_verb_private.level_allowed(actor,c.context_level)');
 IF position('verb_levels' IN body)>0 OR position('sitov_verb_scope_ids' IN body)>0 THEN RAISE EXCEPTION 'sitov_last_active_level_contract_changed'; END IF;
 EXECUTE body;
 body:=pg_get_functiondef('public.get_learning_progress(uuid,text,integer)'::regprocedure);
 body:=replace(body,'c.id '||format(scope,'learner'),'sitov_verb_private.verb_allowed(learner,c.id)');
 body:=replace(body,'l.code=ANY((SELECT sitov_verb_private.sitov_allowed_levels(learner))::text[])','sitov_verb_private.level_allowed(learner,l.code)');
 IF position('sitov_allowed_levels' IN body)>0 OR position('sitov_verb_scope_ids' IN body)>0 THEN RAISE EXCEPTION 'sitov_learning_progress_contract_changed'; END IF;
 EXECUTE body;
 body:=pg_get_functiondef('sitov_pronunciation_private.evidence(uuid)'::regprocedure);
 body:=replace(body,'c.id '||format(scope,'p_student'),'sitov_verb_private.verb_allowed(p_student,c.id)');
 body:=replace(body,'context.code=ANY((SELECT sitov_verb_private.sitov_allowed_levels(p_student))::text[])','sitov_verb_private.level_allowed(p_student,context.code)');
 IF position('sitov_allowed_levels' IN body)>0 OR position('sitov_verb_scope_ids' IN body)>0 THEN RAISE EXCEPTION 'sitov_pronunciation_evidence_contract_changed'; END IF;
 EXECUTE body;
END $sitov$;
DROP FUNCTION IF EXISTS public.get_sitov_vocabulary_level_counts();
DROP FUNCTION IF EXISTS sitov_verb_private.sitov_allowed_levels(uuid);
DROP FUNCTION IF EXISTS sitov_access_private.sitov_verb_scope_ids(uuid);
DROP INDEX IF EXISTS public.sitov_verb_challenge_latest_idx;
DROP INDEX IF EXISTS sitov_pronunciation_private.sitov_pretest_attempt_latest_idx;
NOTIFY pgrst,'reload schema';
