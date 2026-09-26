-- Master 4 / Phase 4. Run through migrate-local.py after a verified backup.
-- 31 is occupied by vocabulary target forms. 36 extends the Phase 3 importer.
-- One service-role RPC imports an entire validated seed atomically. The existing
-- staff RPC shares its catalog implementation without inventing a staff identity.
-- No completion is inferred from lesson numbers: legacy records remain intact.
CREATE TABLE IF NOT EXISTS path_private.phase4_function_backups (
 signature text PRIMARY KEY,definition text NOT NULL
);
INSERT INTO path_private.phase4_function_backups
 VALUES('public.import_learning_path(jsonb)',pg_get_functiondef('public.import_learning_path(jsonb)'::regprocedure))
 ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS path_private.phase4_imported_units (
 unit_id uuid PRIMARY KEY REFERENCES public.learning_units(id) ON DELETE CASCADE,
 was_active boolean,rollback_active boolean
);
CREATE TABLE IF NOT EXISTS public.path_legacy_progress_notes (
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 level text NOT NULL REFERENCES public.learning_levels(code),
 legacy_exercise_count integer NOT NULL,legacy_completed_count integer NOT NULL,
 legacy_attempt_count bigint NOT NULL,initial_path_progress integer NOT NULL DEFAULT 0,
 existing_path_progress_preserved boolean NOT NULL,note jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(auth_user_id,level)
);
COMMENT ON COLUMN public.path_legacy_progress_notes.initial_path_progress IS
 'Legacy progress contributes zero completions to the new path; any existing new path progress is retained, never reset by import.';
ALTER TABLE path_private.phase4_function_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_private.phase4_imported_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_legacy_progress_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON path_private.phase4_function_backups,path_private.phase4_imported_units FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.path_legacy_progress_notes FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.path_legacy_progress_notes TO authenticated;
DROP POLICY IF EXISTS path_legacy_notes_staff_read ON public.path_legacy_progress_notes;
CREATE POLICY path_legacy_notes_staff_read ON public.path_legacy_progress_notes FOR SELECT TO authenticated
 USING((SELECT business_private.is_staff()));

-- Same content checks/upserts as Phase 3. Only the caller chooses created_by;
-- service imports use NULL, staff imports use their verified auth.uid().
CREATE OR REPLACE FUNCTION path_private.import_path_catalog(p_path jsonb,p_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid; unit uuid; node uuid; anchor uuid; node_data jsonb; exercise jsonb; objective jsonb; lang text;
 task_id uuid; exercise_count integer:=0; node_count integer:=0; kind public.path_node_kind; tests integer; reviews integer; practices integer;
BEGIN
 actor:=p_actor;
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
END $$;

REVOKE ALL ON FUNCTION path_private.import_path_catalog(jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.import_learning_path(p_path jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;
BEGIN
 actor:=path_private.check_actor();
 IF NOT business_private.is_staff() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 RETURN path_private.import_path_catalog(p_path,actor);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;
REVOKE ALL ON FUNCTION public.import_learning_path(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.import_learning_path(jsonb) TO authenticated;

-- Whole legacy grammar catalog is archived, exactly as in 4.4 / Phase 3.
-- Notes cover every affected learner/level, including levels not in this seed;
-- no target mapping or copied completion is claimed for those records.
CREATE OR REPLACE FUNCTION path_private.migrate_legacy_grammar() RETURNS jsonb
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE archived integer; notes integer;
BEGIN
 INSERT INTO path_private.archived_units(unit_id,is_active)
 SELECT id,is_active FROM public.learning_units WHERE trainer='exercises' AND NOT is_path
 ON CONFLICT DO NOTHING;
 UPDATE public.learning_units SET is_active=false WHERE trainer='exercises' AND NOT is_path AND is_active;
 GET DIAGNOSTICS archived=ROW_COUNT;
 INSERT INTO public.path_legacy_progress_notes(
  auth_user_id,level,legacy_exercise_count,legacy_completed_count,legacy_attempt_count,
  initial_path_progress,existing_path_progress_preserved,note)
 SELECT p.auth_user_id,u.level,count(*)::integer,count(*) FILTER(WHERE p.completed)::integer,
  coalesce(sum(p.attempts),0),0,
  EXISTS(SELECT 1 FROM public.path_node_progress np JOIN public.path_nodes n ON n.id=np.node_id
   JOIN public.learning_units nu ON nu.id=n.unit_id WHERE np.auth_user_id=p.auth_user_id AND nu.level=u.level),
  jsonb_build_object(
   'de','Alte Grammatikdaten bleiben erhalten. Eine verlässliche Zuordnung zum Lernpfad fehlt; aus dem Altbestand werden 0 Abschlüsse übernommen. Ohne bisherigen Lernpfadfortschritt beginnt der Pfad bei 0. Bereits vorhandener Lernpfadfortschritt bleibt unverändert.',
   'en','Earlier grammar records are preserved. No reliable mapping to the learning path exists, so 0 completions are transferred. Learners without prior path progress start at 0. Existing path progress is unchanged.',
   'ru','Прежние результаты по грамматике сохранены. Надёжного соответствия заданиям учебного маршрута нет, поэтому перенесено 0 завершений. Без прежнего прогресса в маршруте обучение начинается с 0. Уже имеющийся прогресс маршрута не изменён.',
   'uk','Попередні результати з граматики збережено. Надійної відповідності завданням навчального маршруту немає, тому перенесено 0 завершень. Без попереднього прогресу в маршруті навчання починається з 0. Наявний прогрес маршруту не змінено.',
   'tr','Önceki dil bilgisi kayıtları korunur. Öğrenme yoluyla güvenilir bir eşleştirme yapılamadığı için aktarılan tamamlanma sayısı 0 olur. Öğrenme yolunda önceki ilerlemesi olmayanlar 0’dan başlar. Mevcut öğrenme yolu ilerlemesi değişmez.')
 FROM public.user_exercise_progress p JOIN public.learning_exercises e ON e.id=p.exercise_id
 JOIN public.learning_units u ON u.id=e.unit_id WHERE u.trainer='exercises' AND NOT u.is_path
 GROUP BY p.auth_user_id,u.level
 ON CONFLICT(auth_user_id,level) DO NOTHING;
 GET DIAGNOSTICS notes=ROW_COUNT;
 RETURN jsonb_build_object('archived_units',archived,'notes_created',notes);
END $$;
REVOKE ALL ON FUNCTION path_private.migrate_legacy_grammar() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.import_learning_path_seed(p_paths jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE path jsonb; imported jsonb; paths jsonb:='[]'::jsonb; migration jsonb; level_code text;
 units integer:=0; nodes integer:=0; exercises integer:=0; objectives integer:=0;
BEGIN
 -- Check the actual invoking DB role, not an editable JWT claim or auth.uid().
 -- EXECUTE is separately granted only to service_role below.
 IF NOT(coalesce(current_setting('role',true),'none')='service_role'
  OR (coalesce(current_setting('role',true),'none')='none' AND session_user='service_role')) THEN
  RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p_paths) IS DISTINCT FROM 'array' OR jsonb_array_length(p_paths)=0 THEN
  RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023';
 END IF;
 -- Validate the entire batch before any catalog mutation; reject identities
 -- duplicated across paths as well as the per-path Phase 3 shape violations.
 FOR path IN SELECT value FROM jsonb_array_elements(p_paths) LOOP
  IF NOT path_private.valid_seed_shape(path) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_paths) p GROUP BY p->>'level',p->>'id' HAVING count(*)>1)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_paths) p GROUP BY p->>'level',p->>'path' HAVING count(*)>1)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_paths) p GROUP BY p->>'level',p->>'slug' HAVING count(*)>1)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_paths) p CROSS JOIN LATERAL jsonb_array_elements(p->'nodes') n
   CROSS JOIN LATERAL jsonb_array_elements(n->'exercises') e GROUP BY e->>'id' HAVING count(*)>1) THEN
  RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('path-seed-legacy-migration',0));
 -- Deterministic lock order prevents deadlocks between batches spanning levels.
 FOR level_code IN SELECT DISTINCT p->>'level' FROM jsonb_array_elements(p_paths) p ORDER BY 1 LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('path-catalog:'||level_code,0));
 END LOOP;
 FOR path IN SELECT value FROM jsonb_array_elements(p_paths) LOOP
  INSERT INTO path_private.phase4_imported_units(unit_id,was_active)
   SELECT id,is_active FROM public.learning_units WHERE is_path AND level=path->>'level' AND path_source_id=path->>'id'
   ON CONFLICT DO NOTHING;
  imported:=path_private.import_path_catalog(path,NULL);
  INSERT INTO path_private.phase4_imported_units(unit_id,was_active) VALUES((imported->>'unit_id')::uuid,NULL)
   ON CONFLICT DO NOTHING;
  imported:=imported||jsonb_build_object('source_id',path->>'id','objective_count',jsonb_array_length(path->'objectives'));
  paths:=paths||jsonb_build_array(imported);
  units:=units+1; nodes:=nodes+(imported->>'node_count')::integer;
  exercises:=exercises+(imported->>'exercise_count')::integer;
  objectives:=objectives+(imported->>'objective_count')::integer;
 END LOOP;
 -- Any catalog/constraint failure above rolls back every path in this call.
 -- Archive and note creation only happen after every supplied path succeeds.
 migration:=path_private.migrate_legacy_grammar();
 RETURN jsonb_build_object('paths',paths,'path_count',units,'node_count',nodes,
  'exercise_count',exercises,'objective_count',objectives,'migration',migration);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;
REVOKE ALL ON FUNCTION public.import_learning_path_seed(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.import_learning_path_seed(jsonb) TO service_role;

-- Reapplying after rollback restores the last imported flags; neither rollback
-- nor reapply deletes catalog content, attempts, progress, or teacher notes.
UPDATE public.learning_units u SET is_active=f.rollback_active
 FROM path_private.phase4_imported_units f WHERE u.id=f.unit_id AND f.rollback_active IS NOT NULL;
UPDATE path_private.phase4_imported_units SET rollback_active=NULL WHERE rollback_active IS NOT NULL;
-- A Phase 3 staff import may already exist. Backfill notes then; a fresh schema
-- without imported content only installs the machinery and awaits the seed RPC.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_units WHERE is_path AND is_active) THEN
  PERFORM path_private.migrate_legacy_grammar();
 END IF;
END $$;
