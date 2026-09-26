-- Master 4 / Phase 7, LOCAL ONLY until separately approved for production.
-- Apply via deploy/vps/migrate-local.py with verified backup. Requires 38.
-- Archived attempts, answers and intervention logs survive emergency resets.
CREATE SCHEMA IF NOT EXISTS teacher_dashboard_private;
REVOKE ALL ON SCHEMA teacher_dashboard_private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS teacher_dashboard_private.function_backups(signature text PRIMARY KEY,definition text NOT NULL);
CREATE TABLE IF NOT EXISTS teacher_dashboard_private.progress_archive(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 unit_id uuid,node_id uuid,archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),is_active boolean NOT NULL DEFAULT false,
 node_progress jsonb NOT NULL,exercise_progress jsonb NOT NULL);
ALTER TABLE teacher_dashboard_private.function_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_dashboard_private.progress_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA teacher_dashboard_private FROM PUBLIC,anon,authenticated;
ALTER TABLE public.path_practice_runs ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.path_test_attempts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.path_node_progress ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.path_interventions ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.path_interventions ADD COLUMN IF NOT EXISTS request_id uuid;
-- Historical practice receipts have no answer timestamp; keep it unknown.
ALTER TABLE path_private.answer_receipts ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE path_private.answer_receipts ALTER COLUMN created_at SET DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS teacher_intervention_request_idx ON public.path_interventions(created_by,request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS teacher_receipts_recent_idx ON vocabulary_private.answer_receipts(auth_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS teacher_attempts_recent_idx ON public.path_test_attempts(auth_user_id,completed_at DESC) WHERE is_active AND status='completed';
CREATE INDEX IF NOT EXISTS teacher_progress_active_idx ON public.path_node_progress(auth_user_id,node_id) WHERE is_active;
DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['path_private.unit_available(uuid)','path_private.node_available(uuid)','public.get_learning_path(text,text)','public.start_path_node(uuid,text,boolean)','public.submit_path_answer(uuid,uuid,jsonb,uuid,text)','public.finish_path_test(uuid,text)','path_private.reset_progress(uuid,uuid,uuid)','public.manage_learning_path(uuid,uuid,text,uuid)'] LOOP
 INSERT INTO teacher_dashboard_private.function_backups VALUES(signature,pg_get_functiondef(signature::regprocedure)) ON CONFLICT DO NOTHING;
 END LOOP; END $$;

CREATE OR REPLACE FUNCTION path_private.unit_available(p_unit uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit AND u.is_path AND u.is_active AND learning_private.unit_allowed(u.id)
 AND (business_private.is_staff() OR EXISTS(SELECT 1 FROM public.path_interventions i WHERE i.auth_user_id=(SELECT auth.uid()) AND i.unit_id=u.id AND i.action='unlock' AND i.is_active)
 OR NOT EXISTS(SELECT 1 FROM public.learning_units prev WHERE prev.is_path AND prev.is_active AND prev.level=u.level AND prev.sort_order=(SELECT max(predecessor.sort_order) FROM public.learning_units predecessor WHERE predecessor.is_path AND predecessor.is_active AND predecessor.level=u.level AND predecessor.sort_order<u.sort_order)
   AND NOT EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id
    WHERE a.auth_user_id=(SELECT auth.uid()) AND n.unit_id=prev.id AND a.status='completed' AND a.is_active AND a.passed))));
$$;

CREATE OR REPLACE FUNCTION path_private.node_available(p_node uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.path_nodes n WHERE n.id=p_node AND n.is_active AND path_private.unit_available(n.unit_id)
 AND (business_private.is_staff() OR CASE WHEN n.kind='special' THEN EXISTS(SELECT 1 FROM public.path_node_progress p
   WHERE p.node_id=n.anchor_node_id AND p.auth_user_id=(SELECT auth.uid()) AND p.status='completed' AND p.is_active)
 ELSE NOT EXISTS(SELECT 1 FROM public.path_nodes prev WHERE prev.unit_id=n.unit_id AND prev.is_active AND prev.kind IN('practice','review')
   AND (n.kind='test' OR prev.sort_order<n.sort_order) AND NOT EXISTS(SELECT 1 FROM public.path_node_progress p
    WHERE p.node_id=prev.id AND p.auth_user_id=(SELECT auth.uid()) AND p.status='completed' AND p.is_active)) END));
$$;

CREATE OR REPLACE FUNCTION public.get_learning_path(p_level text,p_locale text DEFAULT 'de') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); paths jsonb; done boolean; next_level text; next_allowed boolean; BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_locale IS NULL OR p_locale NOT IN('de','en','ru','uk','tr') THEN RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF NOT trainer_access_private.allowed(p_level,'exercises') THEN RAISE EXCEPTION 'path_locked' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'source_id',u.path_source_id,'title',coalesce(t.title,u.path_title),'sort_order',u.sort_order,
  'available',path_private.unit_available(u.id),'completed',EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id WHERE n.unit_id=u.id AND a.auth_user_id=actor AND a.passed AND a.status='completed' AND a.is_active),
  'nodes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'title',coalesce(nt.title,n.title),'sort_order',n.sort_order,'anchor_node_id',n.anchor_node_id,
    'available',path_private.node_available(n.id),'status',p.status,'stars',coalesce(p.best_stars,0),'first_attempt_accuracy',p.first_attempt_accuracy,
    'tests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'percentage',a.percentage,'passed',a.passed,'completed_at',a.completed_at) ORDER BY a.created_at DESC) FROM public.path_test_attempts a WHERE a.node_id=n.id AND a.auth_user_id=actor),'[]'::jsonb)) ORDER BY n.sort_order)
   FROM public.path_nodes n LEFT JOIN public.path_node_translations nt ON nt.node_id=n.id AND nt.locale=p_locale LEFT JOIN public.path_node_progress p ON p.node_id=n.id AND p.auth_user_id=actor AND p.is_active WHERE n.unit_id=u.id AND n.is_active),'[]'::jsonb)) ORDER BY u.sort_order),'[]'::jsonb)
 INTO paths FROM public.learning_units u LEFT JOIN public.path_unit_translations t ON t.unit_id=u.id AND t.locale=p_locale
 WHERE u.level=p_level AND u.is_path AND u.is_active;
 done:=jsonb_array_length(paths)>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(paths) x WHERE NOT (x->>'completed')::boolean);
 SELECT n.code INTO next_level FROM public.learning_levels n JOIN public.learning_levels l ON l.code=p_level WHERE n.sort_order>l.sort_order AND n.is_active ORDER BY n.sort_order LIMIT 1;
 next_allowed:=EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=actor AND a.level=next_level);
 RETURN jsonb_build_object('level',p_level,'paths',paths,'completed',done,'next_level',next_level,'next_level_available',next_allowed);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.start_path_node(p_node_id uuid,p_locale text DEFAULT 'de',p_restart boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; n public.path_nodes; r public.path_practice_runs; ids uuid[]; items jsonb; card jsonb; BEGIN
 actor:=path_private.check_actor(p_locale);
 SELECT * INTO n FROM public.path_nodes WHERE id=p_node_id AND kind<>'test' AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'node_unavailable' USING ERRCODE='22023'; END IF;
 IF NOT path_private.node_available(n.id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.path_practice_runs WHERE node_id=n.id AND auth_user_id=actor AND status='active' FOR UPDATE;
 IF r.id IS NOT NULL AND p_restart THEN
  UPDATE public.path_practice_runs SET status='abandoned',updated_at=clock_timestamp() WHERE id=r.id;
  r.id:=NULL;
 END IF;
 IF r.id IS NULL THEN
  SELECT array_agg(e.id ORDER BY e.sort_order,e.id) INTO ids FROM public.learning_exercises e WHERE e.node_id=n.id AND e.content_status='ready' AND e.path_is_active;
  IF coalesce(cardinality(ids),0)=0 THEN RAISE EXCEPTION 'node_unavailable' USING ERRCODE='22023'; END IF;
  INSERT INTO public.path_practice_runs(auth_user_id,node_id,queue,total) VALUES(actor,n.id,ids,cardinality(ids)) RETURNING * INTO r;
  INSERT INTO path_private.practice_items(run_id,exercise_id,snapshot) SELECT r.id,x,path_private.snapshot(x) FROM unnest(ids) x;
  INSERT INTO public.path_node_progress(auth_user_id,node_id) VALUES(actor,n.id) ON CONFLICT(auth_user_id,node_id) DO UPDATE SET is_active=true,status='in_progress',best_stars=0,first_attempt_accuracy=0,completed_at=NULL,updated_at=clock_timestamp() WHERE NOT path_node_progress.is_active;
 END IF;
 SELECT jsonb_agg(path_private.present(i.snapshot,p_locale) ORDER BY q.position) INTO items
 FROM unnest(r.queue) WITH ORDINALITY q(id,position) JOIN path_private.practice_items i ON i.run_id=r.id AND i.exercise_id=q.id;
 card:=n.merkkarte;
 IF card IS NOT NULL THEN card:=card||jsonb_build_object('rule',coalesce((SELECT rule FROM public.path_node_translations WHERE node_id=n.id AND locale=p_locale),card->>'rule')); END IF;
 RETURN jsonb_build_object('run_id',r.id,'node_id',n.id,'queue',to_jsonb(r.queue),'total',r.total,'exercises',coalesce(items,'[]'::jsonb),'merkkarte',card);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.submit_path_answer(p_run_id uuid,p_exercise_id uuid,p_answer jsonb,p_request_id uuid,p_locale text DEFAULT 'de') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; r public.path_practice_runs; item path_private.practice_items; receipt path_private.answer_receipts; grade jsonb; response jsonb; correct boolean; stars integer; accuracy numeric; BEGIN
 actor:=path_private.check_actor(p_locale);
 IF p_request_id IS NULL OR p_answer IS NULL OR octet_length(p_answer::text)>4194304 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.path_practice_runs WHERE id=p_run_id AND auth_user_id=actor FOR UPDATE;
 IF r.id IS NULL OR NOT r.is_active THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='42501'; END IF;
 IF NOT path_private.node_available(r.node_id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 SELECT * INTO receipt FROM path_private.answer_receipts WHERE run_id=r.id AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.exercise_id<>p_exercise_id OR receipt.answer<>p_answer THEN RAISE EXCEPTION 'request_conflict' USING ERRCODE='22023'; END IF;
  RETURN receipt.response;
 END IF;
 IF r.status<>'active' THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='22023'; END IF;
 IF r.queue[1] IS DISTINCT FROM p_exercise_id THEN RAISE EXCEPTION 'answer_out_of_order' USING ERRCODE='22023'; END IF;
 SELECT * INTO item FROM path_private.practice_items WHERE run_id=r.id AND exercise_id=p_exercise_id FOR UPDATE;
 grade:=path_private.grade((item.snapshot->>'type')::public.exercise_type,item.snapshot->'content',p_answer);
 IF grade ? 'error' THEN RETURN grade; END IF;
 correct:=(grade->>'status') IN('EXACT','SOFT_ERROR');
 UPDATE path_private.practice_items SET attempts=attempts+1,solved=solved OR correct,first_correct=coalesce(first_correct,correct) WHERE run_id=r.id AND exercise_id=p_exercise_id;
 r.queue:=r.queue[2:cardinality(r.queue)];
 IF NOT correct THEN r.queue:=array_append(r.queue,p_exercise_id); END IF;
 IF item.attempts=0 AND correct THEN r.first_correct:=r.first_correct+1; END IF;
 accuracy:=100.0*r.first_correct/r.total;
 stars:=CASE WHEN accuracy>=90 THEN 3 WHEN accuracy>=70 THEN 2 ELSE 1 END;
 UPDATE public.path_practice_runs SET queue=r.queue,first_correct=r.first_correct,updated_at=clock_timestamp(),status=CASE WHEN cardinality(r.queue)=0 THEN 'completed'::public.path_run_status ELSE status END,
  completed_at=CASE WHEN cardinality(r.queue)=0 THEN clock_timestamp() ELSE NULL END WHERE id=r.id;
 UPDATE public.path_node_progress SET updated_at=clock_timestamp(),status=CASE WHEN cardinality(r.queue)=0 THEN 'completed'::public.path_progress_status ELSE status END,
  best_stars=CASE WHEN cardinality(r.queue)=0 THEN greatest(best_stars,stars) ELSE best_stars END,
  first_attempt_accuracy=CASE WHEN cardinality(r.queue)=0 THEN greatest(first_attempt_accuracy,accuracy) ELSE first_attempt_accuracy END,
  completed_at=CASE WHEN cardinality(r.queue)=0 THEN coalesce(completed_at,clock_timestamp()) ELSE completed_at END WHERE auth_user_id=actor AND node_id=r.node_id;
 response:=jsonb_build_object('grade',grade,'solution',path_private.solution(item.snapshot,p_locale),'completed',cardinality(r.queue)=0,'stars',CASE WHEN cardinality(r.queue)=0 THEN stars ELSE NULL END,'first_attempt_accuracy',accuracy,'queue',to_jsonb(r.queue));
 INSERT INTO path_private.answer_receipts(run_id,request_id,exercise_id,answer,response) VALUES(r.id,p_request_id,p_exercise_id,p_answer,response);
 RETURN response;
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.finish_path_test(p_attempt_id uuid,p_locale text DEFAULT 'de') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; a public.path_test_attempts; score integer; item record; grade jsonb; unit uuid; BEGIN
 actor:=path_private.check_actor(p_locale);
 SELECT * INTO a FROM public.path_test_attempts WHERE id=p_attempt_id AND auth_user_id=actor FOR UPDATE;
 IF a.id IS NULL OR NOT a.is_active THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='42501'; END IF;
 IF NOT path_private.node_available(a.node_id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 IF a.status NOT IN('active','completed') THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='22023'; END IF;
 SELECT unit_id INTO unit FROM public.path_nodes WHERE id=a.node_id;
 IF a.status='active' THEN
  IF (SELECT count(*) FROM public.path_test_answers WHERE attempt_id=a.id)<>cardinality(a.selected_exercise_ids) THEN RAISE EXCEPTION 'answers_incomplete' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT i.*,ans.answer FROM path_private.test_items i JOIN public.path_test_answers ans USING(attempt_id,exercise_id) WHERE i.attempt_id=a.id LOOP
   grade:=path_private.grade((item.snapshot->>'type')::public.exercise_type,item.snapshot->'content',item.answer);
   IF grade ? 'error' THEN grade:=jsonb_build_object('status','INCORRECT','correct',false); END IF;
   UPDATE public.path_test_answers SET result=grade WHERE attempt_id=a.id AND exercise_id=item.exercise_id;
  END LOOP;
  SELECT count(*) INTO score FROM public.path_test_answers WHERE attempt_id=a.id AND result->>'status' IN('EXACT','SOFT_ERROR');
  a.percentage:=100.0*score/cardinality(a.selected_exercise_ids);
  a.passed:=score*100>=cardinality(a.selected_exercise_ids)*80;
  UPDATE public.path_test_attempts SET status='completed',completed_at=clock_timestamp(),percentage=a.percentage,passed=a.passed WHERE id=a.id;
  IF a.passed THEN
   INSERT INTO public.path_node_progress(auth_user_id,node_id,status,completed_at) VALUES(actor,a.node_id,'completed',clock_timestamp())
   ON CONFLICT(auth_user_id,node_id) DO UPDATE SET is_active=true,status='completed',completed_at=coalesce(path_node_progress.completed_at,excluded.completed_at),updated_at=clock_timestamp();
  END IF;
 END IF;
 RETURN jsonb_build_object('attempt_id',a.id,'percentage',a.percentage,'passed',a.passed,
  'answers',(SELECT jsonb_agg(path_private.present(i.snapshot,p_locale)||jsonb_build_object('answer',ans.answer,'result',ans.result,'solution',path_private.solution(i.snapshot,p_locale)) ORDER BY i.position)
   FROM path_private.test_items i JOIN public.path_test_answers ans USING(attempt_id,exercise_id) WHERE i.attempt_id=a.id),
  'recommended_nodes',coalesce((SELECT jsonb_agg(n.id ORDER BY n.sort_order) FROM public.path_nodes n WHERE n.unit_id=unit AND n.is_active AND n.kind IN('practice','review')
   AND EXISTS(SELECT 1 FROM path_private.test_items i JOIN public.path_test_answers ans USING(attempt_id,exercise_id)
    WHERE i.attempt_id=a.id AND ans.result->>'status'='INCORRECT' AND i.snapshot->>'goal_id'=ANY(n.goals))),'[]'::jsonb));
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION path_private.reset_progress(p_student uuid,p_unit uuid DEFAULT NULL,p_node uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('path:'||p_student::text,0));
 INSERT INTO teacher_dashboard_private.progress_archive(auth_user_id,unit_id,node_id,node_progress,exercise_progress)
 SELECT p_student,p_unit,p_node,
  coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.path_node_progress p JOIN public.path_nodes n ON n.id=p.node_id WHERE p.auth_user_id=p_student AND p.is_active AND (p_unit IS NULL OR n.unit_id=p_unit) AND (p_node IS NULL OR n.id=p_node)),'[]'),
  coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.user_exercise_progress p JOIN public.learning_exercises e ON e.id=p.exercise_id WHERE p.auth_user_id=p_student AND e.node_id IS NOT NULL AND (p_unit IS NULL OR e.unit_id=p_unit) AND (p_node IS NULL OR e.node_id=p_node)),'[]');
 UPDATE public.path_practice_runs r SET is_active=false,status=CASE WHEN r.status='active' THEN 'abandoned'::public.path_run_status ELSE r.status END
 FROM public.path_nodes n WHERE r.auth_user_id=p_student AND r.node_id=n.id AND r.is_active AND (p_unit IS NULL OR n.unit_id=p_unit) AND (p_node IS NULL OR n.id=p_node);
 UPDATE public.path_test_attempts a SET is_active=false,status=CASE WHEN a.status='active' THEN 'abandoned'::public.path_run_status ELSE a.status END
 FROM public.path_nodes n WHERE a.auth_user_id=p_student AND a.node_id=n.id AND a.is_active AND (p_unit IS NULL OR n.unit_id=p_unit) AND (p_node IS NULL OR n.id=p_node);
 UPDATE public.path_node_progress p SET is_active=false FROM public.path_nodes n
 WHERE p.auth_user_id=p_student AND p.node_id=n.id AND p.is_active AND (p_unit IS NULL OR n.unit_id=p_unit) AND (p_node IS NULL OR n.id=p_node);
 UPDATE public.path_interventions SET is_active=false WHERE auth_user_id=p_student AND action='unlock' AND (p_unit IS NULL OR unit_id=p_unit) AND p_node IS NULL;
 UPDATE public.user_exercise_progress p SET attempts=0,completed=false,score=NULL,hint_shown=false FROM public.learning_exercises e
 WHERE p.auth_user_id=p_student AND p.exercise_id=e.id AND e.node_id IS NOT NULL AND (p_unit IS NULL OR e.unit_id=p_unit) AND (p_node IS NULL OR e.node_id=p_node);
END $$;

CREATE OR REPLACE FUNCTION public.manage_learning_path(p_student_id uuid,p_unit_id uuid,p_action text,p_node_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); previous public.path_interventions; intervention uuid; BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF NOT business_private.is_staff() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student')
 OR NOT EXISTS(SELECT 1 FROM public.learning_units WHERE id=p_unit_id AND is_path AND is_active)
 OR p_action IS NULL OR p_action NOT IN('unlock','reset_path','reset_test') THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 IF p_action='unlock' AND NOT teacher_dashboard_private.unit_allowed(p_student_id,p_unit_id) THEN RAISE EXCEPTION 'path_locked' USING ERRCODE='42501'; END IF;
 -- Same ordering as learner writes and global reset: reset guard, then path lock.
 PERFORM learning_reset_private.assert_writable(p_student_id);
 PERFORM pg_advisory_xact_lock(hashtextextended('path:'||p_student_id::text,0));
 SELECT * INTO previous FROM public.path_interventions WHERE created_by=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF previous.auth_user_id<>p_student_id OR previous.unit_id<>p_unit_id OR previous.action::text<>p_action OR previous.node_id IS DISTINCT FROM p_node_id THEN
   RAISE EXCEPTION 'request_conflict' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('success',true,'interventionId',previous.id);
 END IF;
 IF p_action='reset_test' THEN
  IF NOT EXISTS(SELECT 1 FROM public.path_nodes WHERE id=p_node_id AND unit_id=p_unit_id AND kind='test' AND is_active) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  PERFORM path_private.reset_progress(p_student_id,p_unit_id,p_node_id);
 ELSE
  IF p_node_id IS NOT NULL THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  IF p_action='reset_path' THEN PERFORM path_private.reset_progress(p_student_id,p_unit_id); END IF;
 END IF;
 INSERT INTO public.path_interventions(auth_user_id,unit_id,node_id,action,created_by,request_id)
 VALUES(p_student_id,p_unit_id,p_node_id,p_action::public.path_intervention_action,actor,p_request_id) RETURNING id INTO intervention;
 RETURN jsonb_build_object('success',true,'interventionId',intervention);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;
CREATE OR REPLACE FUNCTION public.manage_learning_path(p_student_id uuid,p_unit_id uuid,p_action text,p_node_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.manage_learning_path(p_student_id,p_unit_id,p_action,p_node_id,gen_random_uuid());
$$;

CREATE OR REPLACE FUNCTION teacher_dashboard_private.unit_allowed(p_student uuid,p_unit uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u JOIN public.profiles p ON p.id=p_student
 JOIN public.student_level_access a ON a.auth_user_id=p_student AND a.level=u.level
 LEFT JOIN public.learning_trainer_grants g ON g.auth_user_id=p_student AND g.level=u.level AND g.trainer=u.trainer
 WHERE u.id=p_unit AND u.is_active AND p.ui_language<>'de' AND coalesce(g.enabled,true)
 AND (u.owner_auth_user_id=p_student OR (u.owner_auth_user_id IS NULL AND (g.unit_mode IS DISTINCT FROM 'selected' OR EXISTS(
 SELECT 1 FROM public.learning_unit_grants ug WHERE ug.auth_user_id=p_student AND ug.unit_id=u.id AND ug.level=u.level AND ug.trainer=u.trainer)))));
$$;
CREATE OR REPLACE FUNCTION teacher_dashboard_private.phases(p_counts jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('1',coalesce(p_counts->'1','0'),'2',coalesce(p_counts->'2','0'),'3',coalesce(p_counts->'3','0'),
 '4',coalesce(p_counts->'4','0'),'5',coalesce(p_counts->'5','0'),'6',coalesce(p_counts->'6','0'),'learned',coalesce(p_counts->'7','0'));
$$;

-- Aggregation is set based: never call the detail RPC once per person.
CREATE OR REPLACE FUNCTION teacher_dashboard_private.students(p_student uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 WITH students AS MATERIALIZED (SELECT p.* FROM public.profiles p WHERE p_student IS NULL OR p.id=p_student),
 activity_time AS (SELECT d.auth_user_id,max(coalesce(d.last_activity_at,d.day::timestamp AT TIME ZONE 'Europe/Berlin')) last_active,
 sum(d.study_seconds) FILTER(WHERE d.day>=(now() AT TIME ZONE 'Europe/Berlin')::date-6) seconds7,
 sum(d.study_seconds) FILTER(WHERE d.day>=(now() AT TIME ZONE 'Europe/Berlin')::date-29) seconds30
 FROM public.learning_activity_days d JOIN students s ON s.id=d.auth_user_id GROUP BY d.auth_user_id),
 historical_activity AS (SELECT events.auth_user_id,max(events.happened) last_active FROM (
 SELECT r.auth_user_id,r.updated_at happened FROM public.path_practice_runs r JOIN students s ON s.id=r.auth_user_id WHERE r.updated_at>r.created_at OR r.status='completed'
 UNION ALL SELECT a.auth_user_id,coalesce(a.completed_at,a.created_at) FROM public.path_test_attempts a JOIN students s ON s.id=a.auth_user_id
 UNION ALL SELECT sub.auth_user_id,sub.created_at FROM public.submissions sub JOIN students s ON s.id=sub.auth_user_id
 UNION ALL SELECT sub.auth_user_id,m.created_at FROM public.pronunciation_messages m JOIN public.submissions sub ON sub.id=m.submission_id JOIN students s ON s.id=sub.auth_user_id WHERE m.sender_id=sub.auth_user_id
 ) events GROUP BY events.auth_user_id),
 activity AS (SELECT s.id auth_user_id,greatest(a.last_active,h.last_active) last_active,a.seconds7,a.seconds30 FROM students s LEFT JOIN activity_time a ON a.auth_user_id=s.id LEFT JOIN historical_activity h ON h.auth_user_id=s.id),
 streak_rows AS (SELECT d.auth_user_id,d.day,row_number() OVER(PARTITION BY d.auth_user_id ORDER BY d.day DESC) rn,
 max(d.day) OVER(PARTITION BY d.auth_user_id) latest FROM public.learning_activity_days d JOIN students s ON s.id=d.auth_user_id),
 streaks AS (SELECT auth_user_id,count(*) days FROM streak_rows WHERE latest>=(now() AT TIME ZONE 'Europe/Berlin')::date-1 AND day=latest-(rn::int-1) GROUP BY auth_user_id),
 cards AS MATERIALIZED (SELECT p.auth_user_id,c.id,u.id unit_id,u.level,
 CASE WHEN count(*)=2 AND bool_and(p.box_number=7) THEN 7 ELSE least(6,min(p.box_number)) END phase,
 bool_or(p.box_number<7 AND p.next_review_date<=now()) due
 FROM public.vocabulary_direction_progress p JOIN students s ON s.id=p.auth_user_id JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
 JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active AND u.owner_auth_user_id IS NULL GROUP BY p.auth_user_id,c.id,u.id,u.level),
 buckets AS (SELECT auth_user_id,phase,count(*) n FROM cards GROUP BY auth_user_id,phase),
 distribution AS (SELECT auth_user_id,teacher_dashboard_private.phases(jsonb_object_agg(phase,n)) phases FROM buckets GROUP BY auth_user_id),
 eligible_units AS MATERIALIZED (SELECT cu.auth_user_id,cu.unit_id FROM (SELECT DISTINCT auth_user_id,unit_id,level FROM cards) cu
 WHERE NOT EXISTS(SELECT 1 FROM public.vocabulary_lesson_pauses p WHERE p.auth_user_id=cu.auth_user_id AND p.unit_id=cu.unit_id)
 AND (teacher_dashboard_private.unit_allowed(cu.auth_user_id,cu.unit_id) OR EXISTS(SELECT 1 FROM public.vocabulary_carryover_preferences pref
 JOIN public.learning_levels target ON target.code=pref.target_level JOIN public.learning_levels source ON source.code=cu.level
 JOIN public.student_level_access a ON a.auth_user_id=cu.auth_user_id AND a.level=target.code
 JOIN students student ON student.id=cu.auth_user_id AND student.ui_language<>'de'
 LEFT JOIN public.learning_trainer_grants grant_ ON grant_.auth_user_id=cu.auth_user_id AND grant_.level=target.code AND grant_.trainer='vocabulary'
 WHERE pref.auth_user_id=cu.auth_user_id AND pref.enabled AND pref.is_active AND target.is_active AND source.sort_order<target.sort_order AND coalesce(grant_.enabled,true)))),
 due AS (SELECT c.auth_user_id,count(*) n FROM cards c JOIN eligible_units eligible USING(auth_user_id,unit_id) WHERE c.due GROUP BY c.auth_user_id),
 answer_events AS (SELECT r.auth_user_id,r.response->>'isCorrect'='true' correct
 FROM vocabulary_private.answer_receipts r JOIN students s ON s.id=r.auth_user_id
 JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=r.auth_user_id
 JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id AND u.owner_auth_user_id IS NULL
 WHERE r.created_at>=now()-interval '7 days'
 UNION ALL SELECT r.auth_user_id,receipt.response->'grade'->>'status' IN('EXACT','SOFT_ERROR')
 FROM path_private.answer_receipts receipt JOIN public.path_practice_runs r ON r.id=receipt.run_id JOIN students s ON s.id=r.auth_user_id
 WHERE receipt.created_at>=now()-interval '7 days' AND receipt.response->'grade'->>'status' IN('EXACT','SOFT_ERROR','INCORRECT')
 UNION ALL SELECT a.auth_user_id,answer.result->>'status' IN('EXACT','SOFT_ERROR') FROM public.path_test_answers answer
 JOIN public.path_test_attempts a ON a.id=answer.attempt_id JOIN students s ON s.id=a.auth_user_id
 WHERE a.completed_at>=now()-interval '7 days' AND answer.result->>'status' IN('EXACT','SOFT_ERROR','INCORRECT')),
 accuracy AS (SELECT auth_user_id,count(*) total,count(*) FILTER(WHERE correct) correct FROM answer_events GROUP BY auth_user_id),
 last_tests AS (SELECT DISTINCT ON(a.auth_user_id) a.auth_user_id,a.percentage,a.passed,a.completed_at FROM public.path_test_attempts a JOIN students s ON s.id=a.auth_user_id
 WHERE a.is_active AND a.status='completed' ORDER BY a.auth_user_id,a.completed_at DESC,a.id DESC),
 test_order AS (SELECT a.auth_user_id,a.node_id,a.passed,row_number() OVER(PARTITION BY a.auth_user_id,a.node_id ORDER BY a.completed_at DESC,a.id DESC) rn
 FROM public.path_test_attempts a JOIN students s ON s.id=a.auth_user_id WHERE a.is_active AND a.status='completed'),
 failed AS (SELECT DISTINCT auth_user_id FROM test_order WHERE rn<=2 GROUP BY auth_user_id,node_id HAVING count(*)=2 AND bool_and(NOT passed)),
 completed_units AS MATERIALIZED (SELECT DISTINCT a.auth_user_id,n.unit_id FROM public.path_test_attempts a JOIN students s ON s.id=a.auth_user_id JOIN public.path_nodes n ON n.id=a.node_id WHERE a.is_active AND a.status='completed' AND a.passed),
 progress_events AS (SELECT p.auth_user_id,n.unit_id,p.status='completed' completed,p.updated_at last_active
 FROM public.path_node_progress p JOIN students s ON s.id=p.auth_user_id JOIN public.path_nodes n ON n.id=p.node_id AND n.is_active WHERE p.is_active
 UNION ALL SELECT a.auth_user_id,n.unit_id,false,coalesce(a.completed_at,a.created_at) FROM public.path_test_attempts a JOIN students s ON s.id=a.auth_user_id JOIN public.path_nodes n ON n.id=a.node_id AND n.is_active WHERE a.is_active),
 progress AS (SELECT auth_user_id,unit_id,count(*) FILTER(WHERE completed) completed,max(last_active) last_active FROM progress_events GROUP BY auth_user_id,unit_id),
 position AS (SELECT DISTINCT ON(p.auth_user_id) p.auth_user_id,u.id,u.path_title,p.completed,(SELECT count(*) FROM public.path_nodes n WHERE n.unit_id=u.id AND n.is_active) total
 FROM progress p JOIN public.learning_units u ON u.id=p.unit_id AND u.is_active ORDER BY p.auth_user_id,p.last_active DESC,u.sort_order),
 completed_levels AS (SELECT s.id auth_user_id,u.level,count(*) FILTER(WHERE cu.unit_id IS NOT NULL) completed,count(*) total
 FROM students s CROSS JOIN public.learning_units u LEFT JOIN completed_units cu ON cu.auth_user_id=s.id AND cu.unit_id=u.id
 WHERE u.is_path AND u.is_active GROUP BY s.id,u.level),
 level_summaries AS (SELECT auth_user_id,jsonb_agg(jsonb_build_object('level',level,'completed',completed,'total',total) ORDER BY level) value FROM completed_levels GROUP BY auth_user_id),
 levels AS (SELECT a.auth_user_id,jsonb_agg(a.level ORDER BY l.sort_order) value FROM public.student_level_access a JOIN students s ON s.id=a.auth_user_id JOIN public.learning_levels l ON l.code=a.level GROUP BY a.auth_user_id),
 grants AS (SELECT g.auth_user_id,jsonb_agg(jsonb_build_object('level',g.level,'trainer',g.trainer,'enabled',g.enabled,'unit_ids',CASE WHEN g.unit_mode='all' THEN NULL ELSE coalesce((SELECT jsonb_agg(ug.unit_id) FROM public.learning_unit_grants ug WHERE ug.auth_user_id=g.auth_user_id AND ug.level=g.level AND ug.trainer=g.trainer),'[]') END)) value FROM public.learning_trainer_grants g JOIN students s ON s.id=g.auth_user_id GROUP BY g.auth_user_id),
 level_events AS (
 SELECT ls.auth_user_id,ls.level,ls.ended_at happened FROM public.learning_sessions ls JOIN students s ON s.id=ls.auth_user_id WHERE ls.is_active
 UNION ALL SELECT p.auth_user_id,u.level,p.last_answered_at FROM public.vocabulary_direction_progress p JOIN students s ON s.id=p.auth_user_id JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id WHERE p.last_answered_at IS NOT NULL AND u.owner_auth_user_id IS NULL
 UNION ALL SELECT r.auth_user_id,coalesce(r.target_level,u.level),r.created_at FROM vocabulary_private.answer_receipts r JOIN students s ON s.id=r.auth_user_id JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id WHERE u.owner_auth_user_id IS NULL
 UNION ALL SELECT pe.auth_user_id,u.level,pe.last_active FROM progress_events pe JOIN public.learning_units u ON u.id=pe.unit_id
 UNION ALL SELECT sub.auth_user_id,sub.level,sub.created_at FROM public.submissions sub JOIN students s ON s.id=sub.auth_user_id),
 last_level AS (SELECT DISTINCT ON(e.auth_user_id) e.auth_user_id,e.level FROM level_events e WHERE e.happened IS NOT NULL ORDER BY e.auth_user_id,e.happened DESC,e.level)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'role',s.role,'created_at',s.created_at,
 'person',CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('display_name',p.display_name,'email',p.email,'phone',p.phone,'street',p.street,'postal_code',p.postal_code,'city',p.city) END,
 'allowed_levels',coalesce(l.value,'[]'),'trainer_grants',coalesce(g.value,'[]'),
 'lastActiveAt',a.last_active,'learningSeconds7d',coalesce(a.seconds7,0),'learningSeconds30d',coalesce(a.seconds30,0),'streakDays',coalesce(st.days,0),
 'currentLevel',coalesce(ll.level,l.value->>0),'pathPosition',CASE WHEN pos.id IS NULL THEN NULL ELSE jsonb_build_object('unitId',pos.id,'title',pos.path_title,'completedNodes',pos.completed,'totalNodes',pos.total) END,
 'lastTest',CASE WHEN lt.auth_user_id IS NULL THEN NULL ELSE jsonb_build_object('percentage',lt.percentage,'passed',lt.passed,'completedAt',lt.completed_at) END,
 'dueCards',coalesce(d.n,0),'phases',coalesce(dist.phases,teacher_dashboard_private.phases('{}')),
 'attentionReasons',to_jsonb(array_remove(ARRAY[
 CASE WHEN coalesce(a.last_active,s.created_at)<=now()-interval '7 days' THEN 'inactive_7_days' END,
 CASE WHEN f.auth_user_id IS NOT NULL THEN 'failed_test_twice' END,
 CASE WHEN d.n>150 THEN 'over_150_due_cards' END,
 CASE WHEN ac.total>0 AND ac.correct*2<ac.total THEN 'accuracy_below_50' END],NULL)),
 'completedPathsByLevel',coalesce(ls.value,'[]')) ORDER BY lower(coalesce(p.display_name,'')),s.id),'[]')
 FROM students s LEFT JOIN public.people p ON p.auth_user_id=s.id LEFT JOIN activity a ON a.auth_user_id=s.id LEFT JOIN streaks st ON st.auth_user_id=s.id
 LEFT JOIN levels l ON l.auth_user_id=s.id LEFT JOIN grants g ON g.auth_user_id=s.id LEFT JOIN due d ON d.auth_user_id=s.id LEFT JOIN distribution dist ON dist.auth_user_id=s.id
 LEFT JOIN accuracy ac ON ac.auth_user_id=s.id LEFT JOIN failed f ON f.auth_user_id=s.id LEFT JOIN last_tests lt ON lt.auth_user_id=s.id
 LEFT JOIN position pos ON pos.auth_user_id=s.id LEFT JOIN level_summaries ls ON ls.auth_user_id=s.id LEFT JOIN last_level ll ON ll.auth_user_id=s.id;
$$;
CREATE OR REPLACE FUNCTION public.get_teacher_dashboard_students() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT business_private.is_staff() THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 RETURN jsonb_build_object('success',true,'students',teacher_dashboard_private.students());
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','sqlstate',SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION teacher_dashboard_private.path_available(p_student uuid,p_unit uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT teacher_dashboard_private.unit_allowed(p_student,p_unit) AND (
 EXISTS(SELECT 1 FROM public.path_interventions i WHERE i.auth_user_id=p_student AND i.unit_id=p_unit AND i.action='unlock' AND i.is_active)
 OR NOT EXISTS(SELECT 1 FROM public.learning_units prev JOIN public.learning_units u ON u.id=p_unit
 WHERE prev.is_path AND prev.is_active AND prev.level=u.level AND prev.sort_order=(SELECT max(x.sort_order) FROM public.learning_units x WHERE x.is_path AND x.is_active AND x.level=u.level AND x.sort_order<u.sort_order)
 AND NOT EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id WHERE a.auth_user_id=p_student AND n.unit_id=prev.id AND a.is_active AND a.status='completed' AND a.passed)));
$$;
CREATE OR REPLACE FUNCTION teacher_dashboard_private.node_available(p_student uuid,p_node uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.path_nodes n WHERE n.id=p_node AND n.is_active AND teacher_dashboard_private.path_available(p_student,n.unit_id)
 AND CASE WHEN n.kind='special' THEN EXISTS(SELECT 1 FROM public.path_node_progress p WHERE p.node_id=n.anchor_node_id AND p.auth_user_id=p_student AND p.is_active AND p.status='completed')
 ELSE NOT EXISTS(SELECT 1 FROM public.path_nodes prev WHERE prev.unit_id=n.unit_id AND prev.is_active AND prev.kind IN('practice','review')
 AND (n.kind='test' OR prev.sort_order<n.sort_order) AND NOT EXISTS(SELECT 1 FROM public.path_node_progress p WHERE p.node_id=prev.id AND p.auth_user_id=p_student AND p.is_active AND p.status='completed')) END);
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_student_detail(p_student_id uuid,p_tab text DEFAULT 'overview',p_locale text DEFAULT 'de')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb; today date:=(now() AT TIME ZONE 'Europe/Berlin')::date; BEGIN
 IF auth.uid() IS NULL OR NOT business_private.is_staff() THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 IF p_tab IS NULL OR p_tab NOT IN('overview','vocabulary','path','pronunciation','activity','notes') OR p_locale IS NULL OR p_locale NOT IN('de','en','ru','uk','tr') THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id) THEN RETURN jsonb_build_object('error','not_found'); END IF;
 IF p_tab='overview' THEN
  data:=teacher_dashboard_private.students(p_student_id)->0;
 ELSIF p_tab='vocabulary' THEN
  WITH cards AS MATERIALIZED (SELECT c.id,c.word_de,u.id unit_id,u.level,u.label title,
   CASE WHEN count(p.id)=0 THEN NULL WHEN count(p.id)=2 AND bool_and(p.box_number=7) THEN 7 ELSE least(6,min(p.box_number)) END phase,
   coalesce(jsonb_agg(p.box_number ORDER BY p.direction) FILTER(WHERE p.id IS NOT NULL),'[]') boxes,
   coalesce(sum(p.lapses),0) lapses,min(p.box_number)<>max(p.box_number) AND count(p.id)=2 half,
   EXISTS(SELECT 1 FROM public.vocabulary_lesson_pauses paused WHERE paused.auth_user_id=p_student_id AND paused.unit_id=u.id) paused
   FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active AND u.owner_auth_user_id IS NULL
   LEFT JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=p_student_id
   WHERE EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p_student_id AND a.level=u.level) OR p.id IS NOT NULL
   GROUP BY c.id,c.word_de,u.id,u.level,u.label),
  level_buckets AS (SELECT level,phase,count(*) n FROM cards WHERE phase IS NOT NULL GROUP BY level,phase),
  level_totals AS (SELECT level,count(*) total,count(phase) in_box FROM cards GROUP BY level),
  lesson_buckets AS (SELECT unit_id,phase,count(*) n FROM cards WHERE phase IS NOT NULL GROUP BY unit_id,phase),
  lesson_totals AS (SELECT unit_id,level,title,paused,count(*) total,count(phase) in_box FROM cards GROUP BY unit_id,level,title,paused),
  recent AS (SELECT r.request_id,c.word_de,u.level,r.typed_answer,r.response->>'isCorrect'='true' correct,r.created_at
   FROM vocabulary_private.answer_receipts r JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=p_student_id
   JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id AND u.owner_auth_user_id IS NULL
   WHERE r.auth_user_id=p_student_id ORDER BY r.created_at DESC,r.request_id DESC LIMIT 50),
  carry AS (SELECT pref.target_level,pref.enabled,(SELECT count(*) FROM cards c JOIN public.learning_levels source ON source.code=c.level JOIN public.learning_levels target ON target.code=pref.target_level
   WHERE c.phase IS NOT NULL AND c.phase<7 AND NOT c.paused AND source.sort_order<target.sort_order)
   +(SELECT count(*) FROM (SELECT c.id FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id AND u.owner_auth_user_id=p_student_id AND u.is_active
    JOIN public.learning_levels source ON source.code=u.level JOIN public.learning_levels target ON target.code=pref.target_level
    JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=p_student_id
    WHERE source.sort_order<target.sort_order AND NOT EXISTS(SELECT 1 FROM public.vocabulary_lesson_pauses paused WHERE paused.auth_user_id=p_student_id AND paused.unit_id=u.id)
    GROUP BY c.id HAVING count(*) FILTER(WHERE p.box_number=7)<2) private_candidates) count
   FROM public.vocabulary_carryover_preferences pref WHERE pref.auth_user_id=p_student_id AND pref.is_active)
  SELECT jsonb_build_object(
   'byLevel',coalesce((SELECT jsonb_agg(jsonb_build_object('level',t.level,'phases',teacher_dashboard_private.phases((SELECT jsonb_object_agg(b.phase,b.n) FROM level_buckets b WHERE b.level=t.level)),'totalCards',t.total,'totalInBox',t.in_box) ORDER BY t.level) FROM level_totals t),'[]'),
   'byLesson',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.unit_id,'level',t.level,'title',t.title,'paused',t.paused,'phases',teacher_dashboard_private.phases((SELECT jsonb_object_agg(b.phase,b.n) FROM lesson_buckets b WHERE b.unit_id=t.unit_id)),'totalCards',t.total,'totalInBox',t.in_box) ORDER BY t.level,t.title,t.unit_id) FROM lesson_totals t),'[]'),
   'halfKnown',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'word',word_de,'level',level,'boxes',boxes) ORDER BY level,word_de,id) FROM cards WHERE half),'[]'),
   'hardest',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'word',word_de,'level',level,'regressions',lapses) ORDER BY lapses DESC,id) FROM (SELECT * FROM cards WHERE lapses>0 ORDER BY lapses DESC,id LIMIT 20) hardest),'[]'),
   'recentAnswers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',request_id,'word',word_de,'level',level,'typedAnswer',typed_answer,'correct',coalesce(correct,false),'createdAt',created_at) ORDER BY created_at DESC,request_id DESC) FROM recent),'[]'),
   'pausedLessons',coalesce((SELECT jsonb_agg(jsonb_build_object('id',unit_id,'level',level,'title',title) ORDER BY level,title,unit_id) FROM lesson_totals WHERE paused),'[]'),
   'carryover',coalesce((SELECT jsonb_agg(jsonb_build_object('level',target_level,'enabled',enabled,'count',count) ORDER BY target_level) FROM carry),'[]'),
   'ownWordCount',(SELECT count(*) FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id WHERE u.owner_auth_user_id=p_student_id AND u.is_active)) INTO data;
 ELSIF p_tab='path' THEN
  SELECT jsonb_build_object('paths',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'level',u.level,'title',coalesce(t.title,u.path_title),
   'available',teacher_dashboard_private.path_available(p_student_id,u.id),
   'completed',EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id WHERE a.auth_user_id=p_student_id AND n.unit_id=u.id AND a.is_active AND a.status='completed' AND a.passed),
   'nodes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'title',coalesce(nt.title,n.title),'sort_order',n.sort_order,
    'available',teacher_dashboard_private.node_available(p_student_id,n.id),'status',p.status,'stars',coalesce(p.best_stars,0)) ORDER BY n.sort_order)
   FROM public.path_nodes n LEFT JOIN public.path_node_translations nt ON nt.node_id=n.id AND nt.locale=p_locale
   LEFT JOIN public.path_node_progress p ON p.node_id=n.id AND p.auth_user_id=p_student_id AND p.is_active WHERE n.unit_id=u.id AND n.is_active),'[]')) ORDER BY l.sort_order,u.sort_order)
   FROM public.learning_units u JOIN public.learning_levels l ON l.code=u.level LEFT JOIN public.path_unit_translations t ON t.unit_id=u.id AND t.locale=p_locale WHERE u.is_path AND u.is_active),'[]'),
   'attempts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'nodeId',a.node_id,'unitId',n.unit_id,'title',coalesce(nt.title,n.title),'status',a.status,'isActive',a.is_active,
    'percentage',a.percentage,'passed',a.passed,'createdAt',a.created_at,'completedAt',a.completed_at,
    'answers',coalesce((SELECT jsonb_agg(jsonb_build_object('exerciseId',i.exercise_id,'position',i.position,'prompt',path_private.present(i.snapshot,p_locale),'answer',ans.answer,'result',ans.result,'solution',path_private.solution(i.snapshot,p_locale)) ORDER BY i.position)
    FROM path_private.test_items i LEFT JOIN public.path_test_answers ans USING(attempt_id,exercise_id) WHERE i.attempt_id=a.id),'[]')) ORDER BY a.created_at DESC,a.id DESC)
    FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id LEFT JOIN public.path_node_translations nt ON nt.node_id=n.id AND nt.locale=p_locale WHERE a.auth_user_id=p_student_id),'[]'),
   'interventions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'unitId',i.unit_id,'nodeId',i.node_id,'action',i.action,'createdAt',i.created_at,'createdBy',coalesce(p.display_name,i.created_by::text)) ORDER BY i.created_at DESC,i.id DESC)
   FROM public.path_interventions i LEFT JOIN public.people p ON p.auth_user_id=i.created_by WHERE i.auth_user_id=p_student_id),'[]')) INTO data;
 ELSIF p_tab='pronunciation' THEN
  WITH conversations AS (SELECT s.id,s.created_at,s.status,count(m.id) message_count,max(m.created_at) last_message,
    (SELECT count(*) FROM public.pronunciation_messages unanswered WHERE unanswered.submission_id=s.id AND unanswered.sender_role='student' AND unanswered.audio_path IS NOT NULL
     AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages reply WHERE reply.submission_id=s.id AND reply.sender_role IN('teacher','admin') AND reply.created_at>unanswered.created_at))
    +CASE WHEN s.content_url IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages reply WHERE reply.submission_id=s.id AND reply.sender_role IN('teacher','admin')) THEN 1 ELSE 0 END unanswered
   FROM public.submissions s LEFT JOIN public.pronunciation_messages m ON m.submission_id=s.id WHERE s.auth_user_id=p_student_id AND s.type='audio' GROUP BY s.id)
  SELECT jsonb_build_object('conversations',coalesce(jsonb_agg(jsonb_build_object('id',id,'createdAt',created_at,'status',status,'messageCount',message_count,'unansweredCount',unanswered,'lastMessageAt',coalesce(last_message,created_at)) ORDER BY coalesce(last_message,created_at) DESC,id),'[]')) INTO data FROM conversations;
 ELSIF p_tab='activity' THEN
  SELECT jsonb_build_object('days',(SELECT jsonb_agg(jsonb_build_object('date',dates.day,'seconds',coalesce(d.study_seconds,0),'answers',coalesce(d.answer_count,0),'active',d.day IS NOT NULL) ORDER BY dates.day)
   FROM (SELECT today-29+n AS day FROM generate_series(0,29) n) dates LEFT JOIN public.learning_activity_days d ON d.auth_user_id=p_student_id AND d.day=dates.day),
   'byMode',coalesce((SELECT jsonb_agg(jsonb_build_object('mode',mode,'seconds',seconds) ORDER BY mode) FROM
    (SELECT e.key mode,sum(e.value::integer) seconds FROM public.learning_activity_days d CROSS JOIN LATERAL jsonb_each_text(d.mode_seconds) e WHERE d.auth_user_id=p_student_id AND d.day>=today-29 GROUP BY e.key) modes),'[]'),
   'totalSeconds',coalesce((SELECT sum(study_seconds) FROM public.learning_activity_days WHERE auth_user_id=p_student_id AND day>=today-29),0)) INTO data;
 ELSE
  SELECT jsonb_build_object('notes',coalesce(jsonb_agg(jsonb_build_object('id',id,'note_text',note_text,'created_at',created_at,'updated_at',updated_at,'teacher_id',teacher_id) ORDER BY updated_at DESC),'[]')) INTO data FROM public.teacher_student_notes WHERE student_id=p_student_id;
 END IF;
 RETURN jsonb_build_object('success',true,'data',data);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','sqlstate',SQLSTATE); END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA teacher_dashboard_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_teacher_dashboard_students(),public.get_teacher_student_detail(uuid,text,text),public.manage_learning_path(uuid,uuid,text,uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_teacher_dashboard_students(),public.get_teacher_student_detail(uuid,text,text),public.manage_learning_path(uuid,uuid,text,uuid,uuid) TO authenticated;
