-- Master 4 / Phase 3 infrastructure. Run via migrate-local.py after verified backup.
-- 33 must have committed separately; 34 supplies the per-type content contract.
-- No authored curriculum or seed import. Rollback preserves all new path data.
CREATE SCHEMA IF NOT EXISTS path_private;
REVOKE ALL ON SCHEMA path_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA path_private TO authenticated,service_role;
DO $$ BEGIN
 IF to_regtype('public.path_node_kind') IS NULL THEN CREATE TYPE public.path_node_kind AS ENUM ('practice','review','test','special'); END IF;
 IF to_regtype('public.path_progress_status') IS NULL THEN CREATE TYPE public.path_progress_status AS ENUM ('in_progress','completed'); END IF;
 IF to_regtype('public.path_run_status') IS NULL THEN CREATE TYPE public.path_run_status AS ENUM ('active','completed','abandoned'); END IF;
 IF to_regtype('public.path_intervention_action') IS NULL THEN CREATE TYPE public.path_intervention_action AS ENUM ('unlock','reset_path','reset_test'); END IF;
 IF to_regtype('public.path_objective_area') IS NULL THEN CREATE TYPE public.path_objective_area AS ENUM ('grammar','communication','can_do','vocabulary'); END IF;
END $$;
ALTER TABLE public.learning_units ADD COLUMN IF NOT EXISTS is_path boolean NOT NULL DEFAULT false;
ALTER TABLE public.learning_units ADD COLUMN IF NOT EXISTS path_source_id text;
ALTER TABLE public.learning_units ADD COLUMN IF NOT EXISTS path_slug text;
ALTER TABLE public.learning_units ADD COLUMN IF NOT EXISTS path_title text;
CREATE UNIQUE INDEX IF NOT EXISTS path_unit_source_idx ON public.learning_units(level,path_source_id) WHERE is_path;
CREATE UNIQUE INDEX IF NOT EXISTS path_unit_order_idx ON public.learning_units(level,sort_order) WHERE is_path;
CREATE TABLE IF NOT EXISTS public.path_unit_translations (
 unit_id uuid NOT NULL REFERENCES public.learning_units(id) ON DELETE CASCADE,
 locale text NOT NULL REFERENCES public.locales(code),title text NOT NULL,
 PRIMARY KEY(unit_id,locale)
);
CREATE TABLE IF NOT EXISTS public.path_objectives (
 unit_id uuid NOT NULL REFERENCES public.learning_units(id) ON DELETE CASCADE,
 id text NOT NULL,area public.path_objective_area NOT NULL,description text NOT NULL,
 PRIMARY KEY(unit_id,id)
);
CREATE TABLE IF NOT EXISTS public.path_nodes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),unit_id uuid NOT NULL REFERENCES public.learning_units(id) ON DELETE CASCADE,
 source_id text NOT NULL,kind public.path_node_kind NOT NULL,sort_order integer NOT NULL CHECK(sort_order>0),
 title text NOT NULL,topic text NOT NULL,merkkarte jsonb,goals text[] NOT NULL DEFAULT '{}',
 anchor_node_id uuid,test_size integer,is_active boolean NOT NULL DEFAULT true,
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(unit_id,source_id),UNIQUE(id,unit_id),
 FOREIGN KEY(anchor_node_id,unit_id) REFERENCES public.path_nodes(id,unit_id),
 CHECK((kind='special')=(anchor_node_id IS NOT NULL)),CHECK(anchor_node_id IS DISTINCT FROM id),
 CHECK((kind='test' AND test_size IS NOT NULL AND test_size>0) OR (kind<>'test' AND test_size IS NULL))
);
ALTER TABLE public.path_nodes DROP CONSTRAINT IF EXISTS path_nodes_unit_id_sort_order_key;
CREATE UNIQUE INDEX IF NOT EXISTS path_active_node_order_idx ON public.path_nodes(unit_id,sort_order) WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS path_one_test_idx ON public.path_nodes(unit_id) WHERE kind='test' AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS path_one_review_idx ON public.path_nodes(unit_id) WHERE kind='review' AND is_active;
CREATE INDEX IF NOT EXISTS path_nodes_anchor_idx ON public.path_nodes(anchor_node_id);
CREATE INDEX IF NOT EXISTS path_nodes_creator_idx ON public.path_nodes(created_by);
CREATE TABLE IF NOT EXISTS public.path_node_translations (
 node_id uuid NOT NULL REFERENCES public.path_nodes(id) ON DELETE CASCADE,locale text NOT NULL REFERENCES public.locales(code),
 title text NOT NULL,rule text,PRIMARY KEY(node_id,locale)
);
ALTER TABLE public.learning_exercises ADD COLUMN IF NOT EXISTS node_id uuid;
ALTER TABLE public.learning_exercises ADD COLUMN IF NOT EXISTS goal_id text;
ALTER TABLE public.learning_exercises ADD COLUMN IF NOT EXISTS source_ref text;
ALTER TABLE public.learning_exercises ADD COLUMN IF NOT EXISTS path_is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.learning_exercises ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.learning_exercises'::regclass AND conname='path_exercise_node_fk') THEN
  ALTER TABLE public.learning_exercises ADD CONSTRAINT path_exercise_node_fk FOREIGN KEY(node_id,unit_id) REFERENCES public.path_nodes(id,unit_id);
  ALTER TABLE public.learning_exercises ADD CONSTRAINT path_exercise_goal_fk FOREIGN KEY(unit_id,goal_id) REFERENCES public.path_objectives(unit_id,id);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS path_exercises_node_idx ON public.learning_exercises(node_id,sort_order,id);
CREATE INDEX IF NOT EXISTS path_exercises_goal_idx ON public.learning_exercises(unit_id,goal_id);
CREATE UNIQUE INDEX IF NOT EXISTS path_exercises_ref_idx ON public.learning_exercises(unit_id,source_ref) WHERE node_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.path_node_progress (
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,node_id uuid NOT NULL REFERENCES public.path_nodes(id) ON DELETE CASCADE,
 status public.path_progress_status NOT NULL DEFAULT 'in_progress',best_stars smallint NOT NULL DEFAULT 0 CHECK(best_stars BETWEEN 0 AND 3),
 first_attempt_accuracy numeric NOT NULL DEFAULT 0 CHECK(first_attempt_accuracy BETWEEN 0 AND 100),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 PRIMARY KEY(auth_user_id,node_id)
);
CREATE INDEX IF NOT EXISTS path_progress_node_idx ON public.path_node_progress(node_id);
CREATE TABLE IF NOT EXISTS public.path_practice_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 node_id uuid NOT NULL REFERENCES public.path_nodes(id) ON DELETE CASCADE,status public.path_run_status NOT NULL DEFAULT 'active',
 queue uuid[] NOT NULL,total integer NOT NULL CHECK(total>0),first_correct integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS path_active_practice_idx ON public.path_practice_runs(auth_user_id,node_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS path_runs_node_idx ON public.path_practice_runs(node_id);
CREATE TABLE IF NOT EXISTS path_private.practice_items (
 run_id uuid NOT NULL REFERENCES public.path_practice_runs(id) ON DELETE CASCADE,
 exercise_id uuid NOT NULL REFERENCES public.learning_exercises(id),snapshot jsonb NOT NULL,
 attempts integer NOT NULL DEFAULT 0,solved boolean NOT NULL DEFAULT false,first_correct boolean,
 PRIMARY KEY(run_id,exercise_id)
);
CREATE INDEX IF NOT EXISTS path_practice_exercise_idx ON path_private.practice_items(exercise_id);
CREATE TABLE IF NOT EXISTS path_private.answer_receipts (
 run_id uuid NOT NULL REFERENCES public.path_practice_runs(id) ON DELETE CASCADE,request_id uuid NOT NULL,
 exercise_id uuid NOT NULL,answer jsonb NOT NULL,response jsonb NOT NULL,PRIMARY KEY(run_id,request_id)
);
CREATE TABLE IF NOT EXISTS public.path_test_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 node_id uuid NOT NULL REFERENCES public.path_nodes(id) ON DELETE CASCADE,status public.path_run_status NOT NULL DEFAULT 'active',
 selected_exercise_ids uuid[] NOT NULL,percentage numeric CHECK(percentage BETWEEN 0 AND 100),passed boolean,
 created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS path_active_test_idx ON public.path_test_attempts(auth_user_id,node_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS path_attempts_node_idx ON public.path_test_attempts(node_id);
CREATE INDEX IF NOT EXISTS path_attempts_user_idx ON public.path_test_attempts(auth_user_id,node_id,created_at DESC);
CREATE TABLE IF NOT EXISTS path_private.test_items (
 attempt_id uuid NOT NULL REFERENCES public.path_test_attempts(id) ON DELETE CASCADE,
 exercise_id uuid NOT NULL REFERENCES public.learning_exercises(id),snapshot jsonb NOT NULL,position integer NOT NULL,
 PRIMARY KEY(attempt_id,exercise_id),UNIQUE(attempt_id,position)
);
CREATE INDEX IF NOT EXISTS path_test_items_exercise_idx ON path_private.test_items(exercise_id);
CREATE TABLE IF NOT EXISTS public.path_test_answers (
 attempt_id uuid NOT NULL,exercise_id uuid NOT NULL,answer jsonb NOT NULL,result jsonb,
 answered_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(attempt_id,exercise_id),
 FOREIGN KEY(attempt_id,exercise_id) REFERENCES path_private.test_items(attempt_id,exercise_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.path_interventions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 unit_id uuid NOT NULL REFERENCES public.learning_units(id) ON DELETE CASCADE,node_id uuid REFERENCES public.path_nodes(id) ON DELETE CASCADE,
 action public.path_intervention_action NOT NULL,created_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS path_interventions_user_unit_idx ON public.path_interventions(auth_user_id,unit_id,created_at);
CREATE INDEX IF NOT EXISTS path_interventions_unit_idx ON public.path_interventions(unit_id);
CREATE INDEX IF NOT EXISTS path_interventions_node_idx ON public.path_interventions(node_id);
CREATE INDEX IF NOT EXISTS path_interventions_creator_idx ON public.path_interventions(created_by);
-- Exact pre-change definitions and unit flags are captured only once, for a data-preserving rollback.
CREATE TABLE IF NOT EXISTS path_private.function_backups(signature text PRIMARY KEY,definition text NOT NULL);
CREATE TABLE IF NOT EXISTS path_private.rollback_unit_flags(unit_id uuid PRIMARY KEY REFERENCES public.learning_units(id) ON DELETE CASCADE,is_active boolean NOT NULL);
CREATE TABLE IF NOT EXISTS path_private.archived_units(unit_id uuid PRIMARY KEY REFERENCES public.learning_units(id) ON DELETE CASCADE,is_active boolean NOT NULL);
INSERT INTO path_private.archived_units SELECT id,is_active FROM public.learning_units WHERE trainer='exercises' AND NOT is_path ON CONFLICT DO NOTHING;
UPDATE public.learning_units SET is_active=false WHERE id IN(SELECT unit_id FROM path_private.archived_units);

CREATE OR REPLACE FUNCTION path_private.guard_catalog() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE u public.learning_units; anchor public.path_nodes;
BEGIN
 IF TG_TABLE_NAME='learning_units' THEN
  IF NEW.is_path AND (NEW.trainer<>'exercises' OR NEW.sort_order<1 OR nullif(btrim(NEW.path_source_id),'') IS NULL
    OR nullif(btrim(NEW.path_title),'') IS NULL OR nullif(btrim(NEW.path_slug),'') IS NULL
    OR NOT learning_private.german_text_allowed(NEW.path_title||NEW.label)) THEN RAISE EXCEPTION 'invalid_path' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO u FROM public.learning_units WHERE id=NEW.unit_id;
 IF TG_TABLE_NAME='learning_exercises' THEN
  IF NEW.node_id IS NULL THEN
   IF u.is_path THEN RAISE EXCEPTION 'path_node_required' USING ERRCODE='23514'; END IF;
   RETURN NEW;
  END IF;
 END IF;
 IF NOT u.is_path OR u.trainer<>'exercises' THEN RAISE EXCEPTION 'path_unit_required' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='learning_exercises' THEN
  IF NEW.goal_id IS NULL OR NOT path_private.valid_content(NEW.type,NEW.content)
   OR NOT EXISTS(SELECT 1 FROM public.path_nodes n WHERE n.id=NEW.node_id AND NEW.goal_id=ANY(n.goals)) THEN
   RAISE EXCEPTION 'invalid_path_exercise' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='path_nodes' THEN
  IF cardinality(NEW.goals)=0 OR EXISTS(SELECT 1 FROM unnest(NEW.goals) g WHERE NOT EXISTS(SELECT 1 FROM public.path_objectives o WHERE o.unit_id=NEW.unit_id AND o.id=g))
   OR NOT learning_private.german_text_allowed(NEW.title||NEW.topic||coalesce(NEW.merkkarte::text,''))
   OR (NEW.kind='practice' AND (jsonb_typeof(NEW.merkkarte) IS DISTINCT FROM 'object' OR nullif(btrim(NEW.merkkarte->>'rule'),'') IS NULL
     OR jsonb_typeof(NEW.merkkarte->'examples') IS DISTINCT FROM 'array')) THEN RAISE EXCEPTION 'invalid_path_node' USING ERRCODE='23514'; END IF;
  IF NEW.kind='test' AND NEW.merkkarte IS NOT NULL THEN RAISE EXCEPTION 'invalid_path_node' USING ERRCODE='23514'; END IF;
  IF NEW.merkkarte IS NOT NULL AND (NOT path_private.valid_strings(NEW.merkkarte->'examples',1,false) OR NOT path_private.only_keys(NEW.merkkarte,ARRAY['card','rule','examples','highlight'])) THEN RAISE EXCEPTION 'invalid_path_node' USING ERRCODE='23514'; END IF;
  IF NEW.kind='special' THEN
   SELECT * INTO anchor FROM public.path_nodes WHERE id=NEW.anchor_node_id;
   IF anchor.kind NOT IN('practice','review') OR anchor.unit_id<>NEW.unit_id THEN RAISE EXCEPTION 'invalid_anchor' USING ERRCODE='23514'; END IF;
  END IF;
  NEW.updated_at:=clock_timestamp();
 ELSIF TG_TABLE_NAME='path_objectives' AND NOT learning_private.german_text_allowed(NEW.description) THEN
  RAISE EXCEPTION 'invalid_path_objective' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS path_catalog_guard ON public.learning_units;
CREATE TRIGGER path_catalog_guard BEFORE INSERT OR UPDATE ON public.learning_units FOR EACH ROW EXECUTE FUNCTION path_private.guard_catalog();
DROP TRIGGER IF EXISTS path_catalog_guard ON public.path_nodes;
CREATE TRIGGER path_catalog_guard BEFORE INSERT OR UPDATE ON public.path_nodes FOR EACH ROW EXECUTE FUNCTION path_private.guard_catalog();
DROP TRIGGER IF EXISTS path_catalog_guard ON public.path_objectives;
CREATE TRIGGER path_catalog_guard BEFORE INSERT OR UPDATE ON public.path_objectives FOR EACH ROW EXECUTE FUNCTION path_private.guard_catalog();
DROP TRIGGER IF EXISTS path_catalog_guard ON public.learning_exercises;
CREATE TRIGGER path_catalog_guard BEFORE INSERT OR UPDATE ON public.learning_exercises FOR EACH ROW EXECUTE FUNCTION path_private.guard_catalog();

CREATE OR REPLACE FUNCTION path_private.unit_available(p_unit uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit AND u.is_path AND u.is_active AND learning_private.unit_allowed(u.id)
 AND (business_private.is_staff() OR EXISTS(SELECT 1 FROM public.path_interventions i WHERE i.auth_user_id=(SELECT auth.uid()) AND i.unit_id=u.id AND i.action='unlock')
 OR NOT EXISTS(SELECT 1 FROM public.learning_units prev WHERE prev.is_path AND prev.is_active AND prev.level=u.level AND prev.sort_order=(SELECT max(predecessor.sort_order) FROM public.learning_units predecessor WHERE predecessor.is_path AND predecessor.is_active AND predecessor.level=u.level AND predecessor.sort_order<u.sort_order)
   AND NOT EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id
    WHERE a.auth_user_id=(SELECT auth.uid()) AND n.unit_id=prev.id AND a.status='completed' AND a.passed))));
$$;
CREATE OR REPLACE FUNCTION path_private.node_available(p_node uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.path_nodes n WHERE n.id=p_node AND n.is_active AND path_private.unit_available(n.unit_id)
 AND (business_private.is_staff() OR CASE WHEN n.kind='special' THEN EXISTS(SELECT 1 FROM public.path_node_progress p
   WHERE p.node_id=n.anchor_node_id AND p.auth_user_id=(SELECT auth.uid()) AND p.status='completed')
 ELSE NOT EXISTS(SELECT 1 FROM public.path_nodes prev WHERE prev.unit_id=n.unit_id AND prev.is_active AND prev.kind IN('practice','review')
   AND (n.kind='test' OR prev.sort_order<n.sort_order) AND NOT EXISTS(SELECT 1 FROM public.path_node_progress p
    WHERE p.node_id=prev.id AND p.auth_user_id=(SELECT auth.uid()) AND p.status='completed')) END));
$$;
CREATE OR REPLACE FUNCTION path_private.check_actor(p_locale text DEFAULT 'de') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_locale IS NULL OR p_locale NOT IN('de','en','ru','uk','tr') THEN RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 PERFORM learning_reset_private.assert_writable(actor);
 PERFORM pg_advisory_xact_lock(hashtextextended('path:'||actor::text,0));
 RETURN actor;
END $$;
CREATE OR REPLACE FUNCTION path_private.error(p_message text,p_state text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('error',CASE WHEN p_message=ANY(ARRAY['authentication_required','invalid_language','path_locked','node_locked','node_unavailable','invalid_input','test_pool_invalid','attempt_unavailable','answer_out_of_order','request_conflict','answers_incomplete','not_authorized','learning_reset_in_progress','invalid_answer']) THEN p_message
 WHEN p_state IN('23514','23502','23503','22P02','22023') THEN 'invalid_input' WHEN p_state='23505' THEN 'request_conflict' ELSE 'request_failed' END,'sqlstate',p_state);
$$;
ALTER TABLE public.grammar_translations ADD COLUMN IF NOT EXISTS instruction text;
CREATE OR REPLACE FUNCTION path_private.snapshot(p_exercise uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',e.id,'type',e.type,'content',e.content,'goal_id',e.goal_id,
 'translations',coalesce((SELECT jsonb_object_agg(t.locale,jsonb_build_object('instruction',t.instruction,'hint',t.hint,'explanation',t.explanation,'prompt',t.prompt)) FROM public.grammar_translations t WHERE t.exercise_id=e.id),'{}'::jsonb))
 FROM public.learning_exercises e WHERE e.id=p_exercise;
$$;
CREATE OR REPLACE FUNCTION path_private.present(p_snapshot jsonb,p_locale text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',p_snapshot->'id','type',p_snapshot->'type','content',
  path_private.present_content((p_snapshot->>'type')::public.exercise_type,p_snapshot->'content') ||
  CASE WHEN nullif(p_snapshot->'translations'->p_locale->>'instruction','') IS NOT NULL THEN jsonb_build_object('instruction',p_snapshot->'translations'->p_locale->>'instruction') ELSE '{}'::jsonb END ||
  CASE WHEN nullif(p_snapshot->'translations'->p_locale->>'prompt','') IS NOT NULL THEN jsonb_build_object('prompt',p_snapshot->'translations'->p_locale->>'prompt') ELSE '{}'::jsonb END);
$$;
CREATE OR REPLACE FUNCTION path_private.solution(p_snapshot jsonb,p_locale text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('content',p_snapshot->'content','explanation',coalesce(p_snapshot->'translations'->p_locale->>'explanation',p_snapshot->'translations'->'de'->>'explanation'));
$$;
CREATE OR REPLACE FUNCTION public.get_learning_path(p_level text,p_locale text DEFAULT 'de') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); paths jsonb; done boolean; next_level text; next_allowed boolean; BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_locale IS NULL OR p_locale NOT IN('de','en','ru','uk','tr') THEN RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF NOT trainer_access_private.allowed(p_level,'exercises') THEN RAISE EXCEPTION 'path_locked' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'source_id',u.path_source_id,'title',coalesce(t.title,u.path_title),'sort_order',u.sort_order,
  'available',path_private.unit_available(u.id),'completed',EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id WHERE n.unit_id=u.id AND a.auth_user_id=actor AND a.passed AND a.status='completed'),
  'nodes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'title',coalesce(nt.title,n.title),'sort_order',n.sort_order,'anchor_node_id',n.anchor_node_id,
    'available',path_private.node_available(n.id),'status',p.status,'stars',coalesce(p.best_stars,0),'first_attempt_accuracy',p.first_attempt_accuracy,
    'tests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'percentage',a.percentage,'passed',a.passed,'completed_at',a.completed_at) ORDER BY a.created_at DESC) FROM public.path_test_attempts a WHERE a.node_id=n.id AND a.auth_user_id=actor),'[]'::jsonb)) ORDER BY n.sort_order)
   FROM public.path_nodes n LEFT JOIN public.path_node_translations nt ON nt.node_id=n.id AND nt.locale=p_locale LEFT JOIN public.path_node_progress p ON p.node_id=n.id AND p.auth_user_id=actor WHERE n.unit_id=u.id AND n.is_active),'[]'::jsonb)) ORDER BY u.sort_order),'[]'::jsonb)
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
  INSERT INTO public.path_node_progress(auth_user_id,node_id) VALUES(actor,n.id) ON CONFLICT DO NOTHING;
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
 IF r.id IS NULL THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='42501'; END IF;
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
 INSERT INTO path_private.answer_receipts VALUES(r.id,p_request_id,p_exercise_id,p_answer,response);
 RETURN response;
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.start_path_test(p_node_id uuid,p_locale text DEFAULT 'de') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; n public.path_nodes; a public.path_test_attempts; chosen uuid[]; previous uuid[]; replacement uuid; replaced uuid; goal text; pool integer; goals integer; BEGIN
 actor:=path_private.check_actor(p_locale);
 SELECT * INTO n FROM public.path_nodes WHERE id=p_node_id AND kind='test' AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'node_unavailable' USING ERRCODE='22023'; END IF;
 IF NOT path_private.node_available(n.id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.path_test_attempts WHERE auth_user_id=actor AND node_id=n.id AND status='active' FOR UPDATE;
 IF a.id IS NULL THEN
  SELECT count(*) INTO pool FROM public.learning_exercises WHERE node_id=n.id AND content_status='ready' AND path_is_active;
  SELECT count(*) INTO goals FROM public.path_objectives WHERE unit_id=n.unit_id;
  IF pool<2*n.test_size OR goals>n.test_size OR goals=0 OR EXISTS(SELECT 1 FROM public.path_objectives o WHERE o.unit_id=n.unit_id
   AND NOT EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.node_id=n.id AND e.goal_id=o.id AND e.content_status='ready' AND e.path_is_active)) THEN RAISE EXCEPTION 'test_pool_invalid' USING ERRCODE='23514'; END IF;
  -- One random task per objective, then fill remaining positions from the pool.
  SELECT array_agg(id) INTO chosen FROM (SELECT DISTINCT ON(e.goal_id) e.id,e.goal_id FROM public.learning_exercises e WHERE e.node_id=n.id AND e.content_status='ready' AND e.path_is_active ORDER BY e.goal_id,random()) required;
  SELECT chosen||coalesce(array_agg(id),'{}'::uuid[]) INTO chosen FROM (SELECT id FROM public.learning_exercises WHERE node_id=n.id AND content_status='ready' AND path_is_active AND NOT(id=ANY(chosen)) ORDER BY random() LIMIT n.test_size-cardinality(chosen)) extra;
  SELECT selected_exercise_ids INTO previous FROM public.path_test_attempts WHERE auth_user_id=actor AND node_id=n.id ORDER BY created_at DESC,id DESC LIMIT 1;
  IF previous IS NOT NULL AND chosen @> previous AND previous @> chosen THEN
   -- Deterministic fallback guarantees a different set, not just a shuffled order.
   SELECT e.id,e.goal_id INTO replacement,goal FROM public.learning_exercises e WHERE e.node_id=n.id AND e.content_status='ready' AND e.path_is_active AND NOT(e.id=ANY(chosen)) ORDER BY random() LIMIT 1;
   SELECT e.id INTO replaced FROM public.learning_exercises e WHERE e.id=ANY(chosen) AND e.goal_id=goal LIMIT 1;
   chosen:=array_replace(chosen,replaced,replacement);
  END IF;
  SELECT array_agg(x ORDER BY random()) INTO chosen FROM unnest(chosen) x;
  INSERT INTO public.path_test_attempts(auth_user_id,node_id,selected_exercise_ids) VALUES(actor,n.id,chosen) RETURNING * INTO a;
  INSERT INTO path_private.test_items(attempt_id,exercise_id,snapshot,position) SELECT a.id,q.id,path_private.snapshot(q.id),q.position FROM unnest(chosen) WITH ORDINALITY q(id,position);
 END IF;
 RETURN jsonb_build_object('attempt_id',a.id,'node_id',n.id,'total',cardinality(a.selected_exercise_ids),
  'exercises',(SELECT jsonb_agg(path_private.present(i.snapshot,p_locale)||jsonb_build_object('answer',ans.answer) ORDER BY i.position)
   FROM path_private.test_items i LEFT JOIN public.path_test_answers ans ON ans.attempt_id=i.attempt_id AND ans.exercise_id=i.exercise_id WHERE i.attempt_id=a.id));
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.submit_path_test_answer(p_attempt_id uuid,p_exercise_id uuid,p_answer jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; a public.path_test_attempts; BEGIN
 actor:=path_private.check_actor();
 IF p_answer IS NULL OR p_answer='null'::jsonb OR octet_length(p_answer::text)>4194304 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM public.path_test_attempts WHERE id=p_attempt_id AND auth_user_id=actor AND status='active' FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='42501'; END IF;
 IF NOT path_private.node_available(a.node_id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM path_private.test_items WHERE attempt_id=a.id AND exercise_id=p_exercise_id) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 -- Intentionally no grading, including no result-dependent validation channel.
 INSERT INTO public.path_test_answers(attempt_id,exercise_id,answer) VALUES(a.id,p_exercise_id,p_answer)
 ON CONFLICT(attempt_id,exercise_id) DO UPDATE SET answer=excluded.answer,answered_at=clock_timestamp();
 RETURN jsonb_build_object('saved',true);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION public.finish_path_test(p_attempt_id uuid,p_locale text DEFAULT 'de') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; a public.path_test_attempts; score integer; item record; grade jsonb; unit uuid; BEGIN
 actor:=path_private.check_actor(p_locale);
 SELECT * INTO a FROM public.path_test_attempts WHERE id=p_attempt_id AND auth_user_id=actor FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='42501'; END IF;
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
   ON CONFLICT(auth_user_id,node_id) DO UPDATE SET status='completed',completed_at=coalesce(path_node_progress.completed_at,excluded.completed_at),updated_at=clock_timestamp();
  END IF;
 END IF;
 RETURN jsonb_build_object('attempt_id',a.id,'percentage',a.percentage,'passed',a.passed,
  'answers',(SELECT jsonb_agg(path_private.present(i.snapshot,p_locale)||jsonb_build_object('answer',ans.answer,'result',ans.result,'solution',path_private.solution(i.snapshot,p_locale)) ORDER BY i.position)
   FROM path_private.test_items i JOIN public.path_test_answers ans USING(attempt_id,exercise_id) WHERE i.attempt_id=a.id),
  'recommended_nodes',coalesce((SELECT jsonb_agg(n.id ORDER BY n.sort_order) FROM public.path_nodes n WHERE n.unit_id=unit AND n.is_active AND n.kind IN('practice','review')
   AND EXISTS(SELECT 1 FROM path_private.test_items i JOIN public.path_test_answers ans USING(attempt_id,exercise_id)
    WHERE i.attempt_id=a.id AND ans.result->>'status'='INCORRECT' AND i.snapshot->>'goal_id'=ANY(n.goals))),'[]'::jsonb));
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION path_private.reset_progress(p_student uuid,p_unit uuid DEFAULT NULL,p_node uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('path:'||p_student::text,0));
 DELETE FROM public.path_practice_runs r USING public.path_nodes n WHERE r.auth_user_id=p_student AND r.node_id=n.id AND (p_unit IS NULL OR n.unit_id=p_unit) AND (p_node IS NULL OR n.id=p_node);
 DELETE FROM public.path_test_attempts a USING public.path_nodes n WHERE a.auth_user_id=p_student AND a.node_id=n.id AND (p_unit IS NULL OR n.unit_id=p_unit) AND (p_node IS NULL OR n.id=p_node);
 DELETE FROM public.path_node_progress p USING public.path_nodes n WHERE p.auth_user_id=p_student AND p.node_id=n.id AND (p_unit IS NULL OR n.unit_id=p_unit) AND (p_node IS NULL OR n.id=p_node);
 DELETE FROM public.path_interventions WHERE auth_user_id=p_student AND (p_unit IS NULL OR unit_id=p_unit) AND (p_node IS NULL OR node_id=p_node);
 -- Also clear compatible historical per-exercise rows for these path tasks.
 DELETE FROM public.user_exercise_progress p USING public.learning_exercises e WHERE p.auth_user_id=p_student AND p.exercise_id=e.id AND e.node_id IS NOT NULL AND (p_unit IS NULL OR e.unit_id=p_unit) AND (p_node IS NULL OR e.node_id=p_node);
END $$;
CREATE OR REPLACE FUNCTION public.manage_learning_path(p_student_id uuid,p_unit_id uuid,p_action text,p_node_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; BEGIN
 actor:=path_private.check_actor();
 IF NOT business_private.is_staff() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student') OR NOT EXISTS(SELECT 1 FROM public.learning_units WHERE id=p_unit_id AND is_path)
  OR p_action IS NULL OR p_action NOT IN('unlock','reset_path','reset_test') THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 PERFORM learning_reset_private.assert_writable(p_student_id);
 PERFORM pg_advisory_xact_lock(hashtextextended('path:'||p_student_id::text,0));
 IF p_action='reset_test' THEN
  IF NOT EXISTS(SELECT 1 FROM public.path_nodes WHERE id=p_node_id AND unit_id=p_unit_id AND kind='test') THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  PERFORM path_private.reset_progress(p_student_id,p_unit_id,p_node_id);
 ELSE
  IF p_node_id IS NOT NULL THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  IF p_action='reset_path' THEN PERFORM path_private.reset_progress(p_student_id,p_unit_id); END IF;
 END IF;
 INSERT INTO public.path_interventions(auth_user_id,unit_id,node_id,action,created_by) VALUES(p_student_id,p_unit_id,p_node_id,p_action::public.path_intervention_action,actor);
 RETURN jsonb_build_object('success',true);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

-- Learners never read raw task rows. The historic view is security_invoker and
-- inherits this table policy; the legacy grading RPC is guarded below too.
DROP POLICY IF EXISTS released_content_read ON public.learning_exercises;
CREATE POLICY released_content_read ON public.learning_exercises FOR SELECT TO authenticated
 USING(node_id IS NULL AND content_status='ready' AND path_is_active AND learning_private.unit_allowed(unit_id));
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['path_unit_translations','path_objectives','path_nodes','path_node_translations','path_node_progress','path_practice_runs','path_test_attempts','path_test_answers','path_interventions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',tab);
  EXECUTE format('DROP POLICY IF EXISTS path_staff_read ON public.%I',tab);
  EXECUTE format('CREATE POLICY path_staff_read ON public.%I FOR SELECT TO authenticated USING((SELECT business_private.is_staff()))',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['path_node_progress','path_practice_runs','path_test_attempts','path_interventions'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS path_own_read ON public.%I',tab);
  EXECUTE format('CREATE POLICY path_own_read ON public.%I FOR SELECT TO authenticated USING(auth_user_id=(SELECT auth.uid()))',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['practice_items','test_items','answer_receipts','function_backups','archived_units','rollback_unit_flags'] LOOP
  EXECUTE format('ALTER TABLE path_private.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON path_private.%I FROM PUBLIC,anon,authenticated',tab);
 END LOOP;
END $$;
DROP POLICY IF EXISTS path_finished_answers ON public.path_test_answers;
CREATE POLICY path_finished_answers ON public.path_test_answers FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.path_test_attempts a WHERE a.id=attempt_id AND a.auth_user_id=(SELECT auth.uid()) AND a.status='completed'));

-- Reset integration keeps the prior implementation exactly, injecting one
-- narrow extension. Capturing the original only once makes replay/rollback safe.
DO $$ DECLARE saved_signature text; body text; marker text; replacement text; BEGIN
 FOREACH saved_signature IN ARRAY ARRAY['grammar_private.record_attempt(uuid,text,boolean)','learning_private.reset_student_level(uuid,text)','learning_reset_private.finish_reset(uuid)','public.get_last_active_level()','public.reset_student_level_progress(uuid,text)'] LOOP
  INSERT INTO path_private.function_backups VALUES(saved_signature,pg_get_functiondef(saved_signature::regprocedure)) ON CONFLICT DO NOTHING;
 END LOOP;
 SELECT definition INTO body FROM path_private.function_backups WHERE signature='grammar_private.record_attempt(uuid,text,boolean)';
 marker:='IF NOT FOUND OR target.type NOT IN';
 IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'legacy_grammar_guard_drift'; END IF;
 EXECUTE replace(body,marker,'IF target.node_id IS NOT NULL THEN RAISE EXCEPTION ''exercise_unavailable'' USING ERRCODE=''22023''; END IF; '||marker);
 SELECT definition INTO body FROM path_private.function_backups WHERE signature='learning_private.reset_student_level(uuid,text)';
 marker:='DELETE FROM public.user_exercise_progress';
 IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'level_reset_drift'; END IF;
 replacement:='PERFORM path_private.reset_progress(p_student_id,u.id) FROM public.learning_units u WHERE u.level=p_level AND u.is_path; '||marker;
 EXECUTE replace(body,marker,replacement);
 SELECT definition INTO body FROM path_private.function_backups WHERE signature='learning_reset_private.finish_reset(uuid)';
 IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'user_reset_drift'; END IF;
 EXECUTE replace(body,marker,'PERFORM path_private.reset_progress(actor); '||marker);
 -- Preserve R10 wrapper, explicitly meet the Phase-3 definer contract.
 ALTER FUNCTION public.reset_student_level_progress(uuid,text) SECURITY DEFINER;
 SELECT definition INTO body FROM path_private.function_backups WHERE signature='public.get_last_active_level()';
 marker:='), latest AS (';
 IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'last_active_level_drift'; END IF;
 replacement:=$fragment$
  UNION ALL
  SELECT u.level,'exercises',r.updated_at,u.label,n.title FROM public.path_practice_runs r
   JOIN public.path_nodes n ON n.id=r.node_id JOIN public.learning_units u ON u.id=n.unit_id
   WHERE r.auth_user_id=actor AND EXISTS(SELECT 1 FROM path_private.practice_items i WHERE i.run_id=r.id AND i.attempts>0)
  UNION ALL
  SELECT u.level,'exercises',coalesce(a.completed_at,ans.answered_at),u.label,n.title FROM public.path_test_attempts a
   JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id
   JOIN public.path_test_answers ans ON ans.attempt_id=a.id WHERE a.auth_user_id=actor
 ), latest AS ($fragment$;
 EXECUTE replace(body,marker,replacement);
END $$;

-- Infrastructure for the later CMS/import command. This migration never calls it.
ALTER TABLE public.learning_exercises ADD COLUMN IF NOT EXISTS explanation_card text;
CREATE OR REPLACE FUNCTION path_private.valid_seed_shape(p_path jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE n jsonb; e jsonb; o jsonb; card jsonb; lang text; translated jsonb;
 node_ids text[]:='{}'; objective_ids text[]:='{}'; exercise_ids text[]:='{}'; refs text[]:='{}'; node_orders integer[]:='{}';
BEGIN
 IF NOT path_private.only_keys(p_path,ARRAY['id','level','path','slug','title','translations','unit','objectives','nodes','is_active'])
  OR NOT path_private.valid_text(p_path->'id',100) OR NOT path_private.valid_text(p_path->'title')
  OR NOT path_private.valid_text(p_path->'slug',160) OR (p_path->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  OR coalesce(p_path->>'level' NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2'),true)
  OR jsonb_typeof(p_path->'path') IS DISTINCT FROM 'number' OR (p_path->>'path') !~ '^[1-9][0-9]*$'
  OR (p_path ? 'is_active' AND jsonb_typeof(p_path->'is_active')<>'boolean')
  OR NOT path_private.only_keys(p_path->'unit',ARRAY['level','trainer','label','sort_order'])
  OR NOT path_private.valid_text(p_path->'unit'->'label') OR p_path->'unit'->'sort_order' IS DISTINCT FROM p_path->'path'
  OR (p_path->'unit'->>'trainer') IS DISTINCT FROM 'exercises' OR p_path->'unit'->'level' IS DISTINCT FROM p_path->'level'
  OR NOT path_private.only_keys(p_path->'translations',ARRAY['en','ru','uk','tr'])
  OR jsonb_typeof(p_path->'objectives') IS DISTINCT FROM 'array' OR jsonb_typeof(p_path->'nodes') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(p_path->'objectives') NOT BETWEEN 1 AND 128 OR jsonb_array_length(p_path->'nodes')<3 THEN RETURN false; END IF;
 FOR lang IN SELECT unnest(ARRAY['en','ru','uk','tr']) LOOP
  IF NOT path_private.only_keys(p_path->'translations'->lang,ARRAY['title'])
   OR NOT path_private.valid_text(p_path->'translations'->lang->'title') THEN RETURN false; END IF;
 END LOOP;
 FOR o IN SELECT value FROM jsonb_array_elements(p_path->'objectives') LOOP
  IF NOT path_private.only_keys(o,ARRAY['id','area','description']) OR NOT path_private.valid_text(o->'id',100)
   OR NOT path_private.valid_text(o->'description') OR coalesce(o->>'area' NOT IN('grammar','communication','can_do','vocabulary'),true)
   OR o->>'id'=ANY(objective_ids) THEN RETURN false; END IF;
  objective_ids:=array_append(objective_ids,o->>'id');
 END LOOP;
 FOR n IN SELECT value FROM jsonb_array_elements(p_path->'nodes') LOOP
  IF NOT path_private.only_keys(n,ARRAY['id','kind','sort_order','is_active','topic','title','translations','goals','merkkarte','test_size','anchor_node_id','exercises'])
   OR NOT path_private.valid_text(n->'id',100) OR NOT path_private.valid_text(n->'title') OR NOT path_private.valid_text(n->'topic')
   OR coalesce(n->>'kind' NOT IN('practice','review','test','special'),true)
   OR jsonb_typeof(n->'sort_order') IS DISTINCT FROM 'number' OR (n->>'sort_order') !~ '^[1-9][0-9]*$'
   OR n->>'id'=ANY(node_ids) OR (n->>'sort_order')::integer=ANY(node_orders)
   OR (n ? 'is_active' AND jsonb_typeof(n->'is_active')<>'boolean')
   OR NOT path_private.valid_strings(n->'goals') OR NOT path_private.only_keys(n->'translations',ARRAY['en','ru','uk','tr'])
   OR jsonb_typeof(n->'exercises') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(n->'exercises')<1 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(n->'goals') g WHERE length(g)>100 OR NOT g=ANY(objective_ids))
   OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements_text(n->'goals')) THEN RETURN false; END IF;
  IF (n->>'kind'='test') IS DISTINCT FROM (n ? 'test_size') OR (n->>'kind'='special') IS DISTINCT FROM (n ? 'anchor_node_id')
   OR (n ? 'anchor_node_id' AND NOT path_private.valid_text(n->'anchor_node_id',100))
   OR (n ? 'test_size' AND (jsonb_typeof(n->'test_size')<>'number' OR (n->>'test_size') !~ '^[1-9][0-9]*$' OR (n->>'test_size')::integer>128))
   OR (n->>'kind'='test' AND n ? 'merkkarte') OR (n->>'kind'='practice' AND NOT n ? 'merkkarte') THEN RETURN false; END IF;
  node_ids:=array_append(node_ids,n->>'id'); node_orders:=array_append(node_orders,(n->>'sort_order')::integer);
  card:=n->'merkkarte';
  IF n ? 'merkkarte' THEN
   IF NOT path_private.only_keys(card,ARRAY['card','rule','examples','highlight','translations'])
    OR NOT path_private.valid_text(card->'card',100) OR NOT path_private.valid_text(card->'rule')
    OR NOT path_private.valid_strings(card->'examples') OR NOT card ? 'highlight'
    OR (card->'highlight'<>'null'::jsonb AND coalesce(card->>'highlight' NOT IN('article','verb'),true))
    OR NOT path_private.only_keys(card->'translations',ARRAY['en','ru','uk','tr']) THEN RETURN false; END IF;
  END IF;
  FOR lang IN SELECT unnest(ARRAY['en','ru','uk','tr']) LOOP
   IF NOT path_private.only_keys(n->'translations'->lang,ARRAY['title']) OR NOT path_private.valid_text(n->'translations'->lang->'title') THEN RETURN false; END IF;
   IF card IS NOT NULL AND (NOT path_private.only_keys(card->'translations'->lang,ARRAY['rule']) OR NOT path_private.valid_text(card->'translations'->lang->'rule')) THEN RETURN false; END IF;
  END LOOP;
  FOR e IN SELECT value FROM jsonb_array_elements(n->'exercises') LOOP
   IF NOT path_private.only_keys(e,ARRAY['id','ref','goal','exercise_type','content','accepted_answers','hint','explanation','explanation_card','translations'])
    OR NOT path_private.valid_text(e->'id') OR (e->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR e->>'id'=ANY(exercise_ids) OR NOT path_private.valid_text(e->'ref',100) OR e->>'ref'=ANY(refs)
    OR NOT path_private.valid_text(e->'goal',100) OR NOT (n->'goals') ? (e->>'goal')
    OR NOT path_private.valid_text(e->'hint') OR NOT path_private.valid_text(e->'explanation') OR NOT path_private.valid_text(e->'explanation_card',100)
    OR NOT learning_private.german_text_allowed((e->>'hint')||(e->>'explanation'))
    OR NOT path_private.only_keys(e->'translations',ARRAY['en','ru','uk','tr'])
    OR NOT path_private.valid_content((e->>'exercise_type')::public.exercise_type,e->'content')
    OR (e ? 'accepted_answers' AND e->'accepted_answers' IS DISTINCT FROM e->'content'->'accepted_answers') THEN RETURN false; END IF;
   exercise_ids:=array_append(exercise_ids,e->>'id'); refs:=array_append(refs,e->>'ref');
   FOR lang IN SELECT unnest(ARRAY['en','ru','uk','tr']) LOOP
    translated:=e->'translations'->lang;
    IF NOT path_private.only_keys(translated,ARRAY['instruction','hint','explanation','prompt'])
     OR NOT path_private.valid_text(translated->'instruction') OR NOT path_private.valid_text(translated->'hint') OR NOT path_private.valid_text(translated->'explanation')
     OR (translated ? 'prompt' AND NOT path_private.valid_text(translated->'prompt')) THEN RETURN false; END IF;
   END LOOP;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(n->'goals') g WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(n->'exercises') ex WHERE ex->>'goal'=g)) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;
CREATE OR REPLACE FUNCTION public.import_learning_path(p_path jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; unit uuid; node uuid; anchor uuid; node_data jsonb; exercise jsonb; objective jsonb; lang text;
 task_id uuid; exercise_count integer:=0; node_count integer:=0; kind public.path_node_kind; tests integer; reviews integer; practices integer;
BEGIN
 actor:=path_private.check_actor();
 IF NOT business_private.is_staff() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 IF NOT path_private.valid_seed_shape(p_path) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_path) IS DISTINCT FROM 'object' OR jsonb_typeof(p_path->'nodes') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_path->'objectives') IS DISTINCT FROM 'array' OR nullif(p_path->>'id','') IS NULL
  OR (p_path->'unit'->>'trainer') IS DISTINCT FROM 'exercises' OR (p_path->'unit'->>'level') IS DISTINCT FROM (p_path->>'level')
  OR (p_path->'unit'->>'sort_order')::integer IS DISTINCT FROM (p_path->>'path')::integer THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('path-catalog:'||(p_path->>'level'),0));
 SELECT id INTO unit FROM public.learning_units WHERE is_path AND level=p_path->>'level' AND path_source_id=p_path->>'id' FOR UPDATE;
 IF unit IS NULL THEN
  INSERT INTO public.learning_units(level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title,is_active)
   VALUES(p_path->>'level','exercises',p_path->'unit'->>'label',(p_path->>'path')::integer,true,p_path->>'id',p_path->>'slug',p_path->>'title',coalesce((p_path->>'is_active')::boolean,true)) RETURNING id INTO unit;
 ELSE
  UPDATE public.learning_units SET label=p_path->'unit'->>'label',sort_order=(p_path->>'path')::integer,path_slug=p_path->>'slug',path_title=p_path->>'title',is_active=coalesce((p_path->>'is_active')::boolean,true) WHERE id=unit;
 END IF;
 FOR lang IN SELECT unnest(ARRAY['de','en','ru','uk','tr']) LOOP
  INSERT INTO public.path_unit_translations(unit_id,locale,title) VALUES(unit,lang,CASE WHEN lang='de' THEN p_path->>'title' ELSE nullif(p_path->'translations'->lang->>'title','') END)
  ON CONFLICT(unit_id,locale) DO UPDATE SET title=excluded.title;
 END LOOP;
 FOR objective IN SELECT value FROM jsonb_array_elements(p_path->'objectives') LOOP
  INSERT INTO public.path_objectives(unit_id,id,area,description) VALUES(unit,objective->>'id',(objective->>'area')::public.path_objective_area,objective->>'description')
  ON CONFLICT(unit_id,id) DO UPDATE SET area=excluded.area,description=excluded.description;
 END LOOP;
 -- Preserve catalog records referenced by old attempts. Omitted records become inactive.
 UPDATE public.path_nodes SET is_active=false WHERE unit_id=unit;
 UPDATE public.learning_exercises SET path_is_active=false WHERE unit_id=unit AND node_id IS NOT NULL;
 -- Anchors are always regular nodes; import them before special branches.
 FOR node_data IN SELECT value FROM jsonb_array_elements(p_path->'nodes') ORDER BY (value->>'kind'='special'),(value->>'sort_order')::integer LOOP
  kind:=(node_data->>'kind')::public.path_node_kind;
  anchor:=NULL;
  IF kind='special' THEN
   SELECT id INTO anchor FROM public.path_nodes WHERE unit_id=unit AND source_id=node_data->>'anchor_node_id' AND is_active;
   IF anchor IS NULL THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  END IF;
  INSERT INTO public.path_nodes(unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals,anchor_node_id,test_size,is_active,created_by)
   VALUES(unit,node_data->>'id',kind,(node_data->>'sort_order')::integer,node_data->>'title',node_data->>'topic',nullif(node_data->'merkkarte','null'::jsonb)-'translations',
    ARRAY(SELECT jsonb_array_elements_text(node_data->'goals')),anchor,(node_data->>'test_size')::integer,coalesce((node_data->>'is_active')::boolean,true),actor)
  ON CONFLICT(unit_id,source_id) DO UPDATE SET kind=excluded.kind,sort_order=excluded.sort_order,title=excluded.title,topic=excluded.topic,
   merkkarte=excluded.merkkarte,goals=excluded.goals,anchor_node_id=excluded.anchor_node_id,test_size=excluded.test_size,is_active=excluded.is_active RETURNING id INTO node;
  node_count:=node_count+1;
  FOR lang IN SELECT unnest(ARRAY['de','en','ru','uk','tr']) LOOP
   INSERT INTO public.path_node_translations(node_id,locale,title,rule) VALUES(node,lang,
    CASE WHEN lang='de' THEN node_data->>'title' ELSE nullif(node_data->'translations'->lang->>'title','') END,
    CASE WHEN lang='de' THEN node_data->'merkkarte'->>'rule' ELSE node_data->'merkkarte'->'translations'->lang->>'rule' END)
   ON CONFLICT(node_id,locale) DO UPDATE SET title=excluded.title,rule=excluded.rule;
   IF kind='practice' AND NOT EXISTS(SELECT 1 FROM public.path_node_translations WHERE node_id=node AND locale=lang AND nullif(btrim(rule),'') IS NOT NULL) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  END LOOP;
  FOR exercise IN SELECT value||jsonb_build_object('_position',ordinality) FROM jsonb_array_elements(node_data->'exercises') WITH ORDINALITY LOOP
   task_id:=(exercise->>'id')::uuid;
   IF EXISTS(SELECT 1 FROM public.learning_exercises WHERE id=task_id AND (unit_id<>unit OR node_id IS NULL)) THEN RAISE EXCEPTION 'request_conflict' USING ERRCODE='22023'; END IF;
   IF exercise ? 'accepted_answers' AND exercise->'accepted_answers' IS DISTINCT FROM exercise->'content'->'accepted_answers' THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
   INSERT INTO public.learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content,path_is_active,explanation_card)
    VALUES(task_id,unit,node,exercise->>'goal',exercise->>'ref',(exercise->>'_position')::integer,node_data->>'topic',(exercise->>'exercise_type')::public.exercise_type,exercise->'content',true,exercise->>'explanation_card')
   ON CONFLICT(id) DO UPDATE SET node_id=excluded.node_id,goal_id=excluded.goal_id,source_ref=excluded.source_ref,sort_order=excluded.sort_order,topic=excluded.topic,type=excluded.type,content=excluded.content,path_is_active=true,explanation_card=excluded.explanation_card;
   FOR lang IN SELECT unnest(ARRAY['de','en','ru','uk','tr']) LOOP
    INSERT INTO public.grammar_translations(exercise_id,locale,hint,explanation,instruction,prompt) VALUES(task_id,lang,
     CASE WHEN lang='de' THEN exercise->>'hint' ELSE exercise->'translations'->lang->>'hint' END,
     CASE WHEN lang='de' THEN exercise->>'explanation' ELSE exercise->'translations'->lang->>'explanation' END,
     CASE WHEN lang='de' THEN exercise->'content'->>'instruction' ELSE exercise->'translations'->lang->>'instruction' END,
     exercise->'translations'->lang->>'prompt')
    ON CONFLICT(exercise_id,locale) DO UPDATE SET hint=excluded.hint,explanation=excluded.explanation,instruction=excluded.instruction,prompt=excluded.prompt;
   END LOOP;
   exercise_count:=exercise_count+1;
  END LOOP;
 END LOOP;
 SELECT count(*) FILTER(WHERE n.kind='test'),count(*) FILTER(WHERE n.kind='review'),count(*) FILTER(WHERE n.kind='practice') INTO tests,reviews,practices FROM public.path_nodes n WHERE n.unit_id=unit AND n.is_active;
 IF tests<>1 OR reviews<>1 OR practices<1 OR EXISTS(SELECT 1 FROM public.path_nodes n WHERE n.unit_id=unit AND n.is_active AND NOT EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.node_id=n.id AND e.path_is_active))
  OR EXISTS(SELECT 1 FROM public.path_nodes t JOIN public.path_nodes n ON n.unit_id=t.unit_id WHERE t.unit_id=unit AND t.is_active AND n.is_active AND ((t.kind='test' AND n.kind IN('practice','review')) OR (t.kind='review' AND n.kind='practice')) AND n.sort_order>t.sort_order)
  OR EXISTS(SELECT 1 FROM public.path_nodes t WHERE t.unit_id=unit AND t.kind='test' AND t.is_active AND (
    t.test_size>(SELECT count(*)/2 FROM public.learning_exercises e WHERE e.node_id=t.id AND e.path_is_active)
    OR t.test_size<(SELECT count(*) FROM public.path_objectives o WHERE o.unit_id=unit)
    OR EXISTS(SELECT 1 FROM public.path_objectives o WHERE o.unit_id=unit AND NOT EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.node_id=t.id AND e.path_is_active AND e.goal_id=o.id)))) THEN RAISE EXCEPTION 'test_pool_invalid' USING ERRCODE='23514'; END IF;
 RETURN jsonb_build_object('unit_id',unit,'node_count',node_count,'exercise_count',exercise_count);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

CREATE OR REPLACE FUNCTION path_private.without_null_fields(p_value jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(p_value) WHERE value<>'null'::jsonb;
$$;
CREATE OR REPLACE FUNCTION public.export_learning_path(p_unit_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u public.learning_units; payload jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF NOT business_private.is_staff() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO u FROM public.learning_units WHERE id=p_unit_id AND is_path;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT jsonb_build_object('id',u.path_source_id,'level',u.level,'path',u.sort_order,'slug',u.path_slug,'title',u.path_title,'is_active',u.is_active,
  'unit',jsonb_build_object('level',u.level,'trainer','exercises','label',u.label,'sort_order',u.sort_order),
  'translations',coalesce((SELECT jsonb_object_agg(locale,jsonb_build_object('title',title)) FROM public.path_unit_translations WHERE unit_id=u.id AND locale<>'de'),'{}'::jsonb),
  'objectives',(SELECT jsonb_agg(jsonb_build_object('id',id,'area',area,'description',description) ORDER BY id) FROM public.path_objectives WHERE unit_id=u.id),
  'nodes',(SELECT jsonb_agg(path_private.without_null_fields(jsonb_build_object('id',n.source_id,'kind',n.kind,'sort_order',n.sort_order,'topic',n.topic,'title',n.title,'goals',to_jsonb(n.goals),
   'test_size',n.test_size,'anchor_node_id',(SELECT source_id FROM public.path_nodes WHERE id=n.anchor_node_id),
   'translations',(SELECT jsonb_object_agg(locale,jsonb_build_object('title',title)) FROM public.path_node_translations WHERE node_id=n.id AND locale<>'de'),
   'merkkarte',CASE WHEN n.merkkarte IS NULL THEN NULL ELSE n.merkkarte||jsonb_build_object('translations',(SELECT jsonb_object_agg(locale,jsonb_build_object('rule',rule)) FROM public.path_node_translations WHERE node_id=n.id AND locale<>'de')) END,
   'exercises',(SELECT jsonb_agg(path_private.without_null_fields(jsonb_build_object('id',e.id,'ref',e.source_ref,'goal',e.goal_id,'exercise_type',e.type,'content',e.content,
    'accepted_answers',e.content->'accepted_answers','hint',de.hint,'explanation',de.explanation,'explanation_card',e.explanation_card,
    'translations',(SELECT jsonb_object_agg(t.locale,path_private.without_null_fields(jsonb_build_object('instruction',t.instruction,'hint',t.hint,'explanation',t.explanation,'prompt',t.prompt))) FROM public.grammar_translations t WHERE t.exercise_id=e.id AND t.locale<>'de'))) ORDER BY e.sort_order,e.id)
    FROM public.learning_exercises e LEFT JOIN public.grammar_translations de ON de.exercise_id=e.id AND de.locale='de' WHERE e.node_id=n.id AND e.path_is_active))) ORDER BY n.sort_order) FROM public.path_nodes n WHERE n.unit_id=u.id AND n.is_active)) INTO payload;
 RETURN payload;
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

-- Explicit grants: helper graders/snapshots/reset are not public endpoints.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='path_private' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
 -- Invoker quality triggers call only these side-effect-free validators.
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA path_private TO service_role;
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='path_private' AND (p.proname LIKE 'valid_%' OR p.proname IN('text_key','only_keys','german_task_allowed','unit_available','node_available','guard_catalog')) LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.get_learning_path(text,text),public.start_path_node(uuid,text,boolean),public.submit_path_answer(uuid,uuid,jsonb,uuid,text),
 public.start_path_test(uuid,text),public.submit_path_test_answer(uuid,uuid,jsonb),public.finish_path_test(uuid,text),public.manage_learning_path(uuid,uuid,text,uuid),public.import_learning_path(jsonb),public.export_learning_path(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_learning_path(text,text),public.start_path_node(uuid,text,boolean),public.submit_path_answer(uuid,uuid,jsonb,uuid,text),
 public.start_path_test(uuid,text),public.submit_path_test_answer(uuid,uuid,jsonb),public.finish_path_test(uuid,text),public.manage_learning_path(uuid,uuid,text,uuid),public.import_learning_path(jsonb),public.export_learning_path(uuid) TO authenticated;

-- Restore availability saved by a prior data-preserving rollback.
UPDATE public.learning_units u SET is_active=f.is_active FROM path_private.rollback_unit_flags f WHERE u.id=f.unit_id AND u.is_path;
DELETE FROM path_private.rollback_unit_flags;

-- Offline-generated Piper audio; no generation takes place in a learner RPC.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('path-audio','path-audio',false,2097152,ARRAY['audio/mpeg'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
CREATE OR REPLACE FUNCTION path_private.audio_allowed(p_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (business_private.is_staff()
 OR EXISTS(SELECT 1 FROM path_private.practice_items i JOIN public.path_practice_runs r ON r.id=i.run_id
   WHERE r.auth_user_id=auth.uid() AND path_private.node_available(r.node_id) AND i.snapshot->>'type'='listening'
    AND '/storage/v1/object/authenticated/path-audio/'||p_name IN(i.snapshot->'content'->'audio'->>'normal',i.snapshot->'content'->'audio'->>'slow'))
 OR EXISTS(SELECT 1 FROM path_private.test_items i JOIN public.path_test_attempts a ON a.id=i.attempt_id
   WHERE a.auth_user_id=auth.uid() AND path_private.node_available(a.node_id) AND i.snapshot->>'type'='listening'
    AND '/storage/v1/object/authenticated/path-audio/'||p_name IN(i.snapshot->'content'->'audio'->>'normal',i.snapshot->'content'->'audio'->>'slow')));

$$;
REVOKE ALL ON FUNCTION path_private.audio_allowed(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION path_private.audio_allowed(text) TO authenticated,service_role;
DROP POLICY IF EXISTS path_audio_read ON storage.objects;
CREATE POLICY path_audio_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='path-audio' AND path_private.audio_allowed(name));
DROP POLICY IF EXISTS path_audio_insert ON storage.objects;
CREATE POLICY path_audio_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='path-audio' AND (SELECT business_private.is_staff()));
DROP POLICY IF EXISTS path_audio_update ON storage.objects;
CREATE POLICY path_audio_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='path-audio' AND (SELECT business_private.is_staff())) WITH CHECK(bucket_id='path-audio' AND (SELECT business_private.is_staff()));

-- Storage metadata lookup for the explicitly authenticated staff upload command.
DROP POLICY IF EXISTS path_audio_bucket_staff ON storage.buckets;
CREATE POLICY path_audio_bucket_staff ON storage.buckets FOR SELECT TO authenticated USING(id='path-audio' AND (SELECT business_private.is_staff()));
