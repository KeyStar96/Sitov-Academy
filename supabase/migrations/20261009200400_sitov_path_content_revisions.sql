-- Sitov Academy: source revisions only. No learner records are rewritten.
-- Reserved by M; native PostgreSQL verification is required before application.
CREATE TABLE IF NOT EXISTS path_private.sitov_content_revisions (
 revision_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL, exercise_id uuid NOT NULL,
 before_hash text NOT NULL CHECK(before_hash ~ '^[a-f0-9]{64}$'), after_hash text NOT NULL CHECK(after_hash ~ '^[a-f0-9]{64}$'),
 before_projection jsonb NOT NULL, after_projection jsonb NOT NULL,
 before_full jsonb NOT NULL, after_full jsonb NOT NULL,
 review_evidence jsonb NOT NULL, audio_evidence jsonb NOT NULL,
 actor_role text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(request_id,exercise_id)
);
CREATE INDEX IF NOT EXISTS sitov_content_revisions_exercise ON path_private.sitov_content_revisions(exercise_id,revision_id);
CREATE TABLE IF NOT EXISTS path_private.sitov_content_revision_receipts (
 request_id uuid PRIMARY KEY, payload jsonb NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS path_private.sitov_revision_function_backups (
 signature text PRIMARY KEY, definition text NOT NULL
);
ALTER TABLE path_private.sitov_content_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_private.sitov_content_revision_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_private.sitov_revision_function_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON path_private.sitov_content_revisions,path_private.sitov_content_revision_receipts,path_private.sitov_revision_function_backups FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE path_private.sitov_content_revisions_revision_id_seq FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION path_private.sitov_revision_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 RAISE EXCEPTION 'sitov_revision_immutable' USING ERRCODE='23514';
END $$;
DROP TRIGGER IF EXISTS sitov_revision_immutable ON path_private.sitov_content_revisions;
CREATE TRIGGER sitov_revision_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON path_private.sitov_content_revisions
 FOR EACH STATEMENT EXECUTE FUNCTION path_private.sitov_revision_immutable();
DROP TRIGGER IF EXISTS sitov_receipt_immutable ON path_private.sitov_content_revision_receipts;
CREATE TRIGGER sitov_receipt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON path_private.sitov_content_revision_receipts
 FOR EACH STATEMENT EXECUTE FUNCTION path_private.sitov_revision_immutable();

CREATE OR REPLACE FUNCTION path_private.sitov_revision_hash(p_value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT encode(sha256(convert_to(p_value::text,'UTF8')),'hex');
$$;
CREATE OR REPLACE FUNCTION path_private.sitov_revision_projection(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT path_private.snapshot(e.id)||jsonb_build_object('unit_id',e.unit_id,'node_id',e.node_id,
  'source_ref',e.source_ref,'sort_order',e.sort_order,'topic',e.topic,'explanation_card',e.explanation_card,
  'parent',jsonb_build_object('level',u.level,'unit_source_id',u.path_source_id,'unit_active',u.is_active,
  'node_source_id',n.source_id,'node_unit_id',n.unit_id,'node_active',n.is_active,'node_kind',n.kind,
  'node_goals',to_jsonb(n.goals),'node_order',n.sort_order,'node_title',n.title,'node_topic',n.topic,
  'node_card',n.merkkarte,'node_anchor',n.anchor_node_id,'node_test_size',n.test_size,
  'unit_trainer',u.trainer,'unit_is_path',u.is_path,'unit_label',u.label,'unit_slug',u.path_slug,'unit_title',u.path_title,'unit_order',u.sort_order))
 FROM public.learning_exercises e JOIN public.learning_units u ON u.id=e.unit_id
 JOIN public.path_nodes n ON n.id=e.node_id WHERE e.id=p_id AND e.node_id IS NOT NULL;
$$;
CREATE OR REPLACE FUNCTION path_private.sitov_revision_full(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('exercise',to_jsonb(e),'translations',coalesce((
 SELECT jsonb_agg(to_jsonb(t) ORDER BY t.locale) FROM public.grammar_translations t WHERE t.exercise_id=e.id),'[]'::jsonb))
 FROM public.learning_exercises e WHERE e.id=p_id;
$$;
-- Same played utterances as sitovExerciseAudioTexts and SQL71. No raw
-- prefixes/suffixes, distractors or parts are added as a second audio contract.
CREATE OR REPLACE FUNCTION path_private.sitov_revision_audio_texts(p_type public.exercise_type,p_content jsonb) RETURNS SETOF text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT unnest(learning_private.sitov_learning_audio_texts('exercises',jsonb_build_object('type',p_type,'content',p_content),'[]'::jsonb));
$$;
CREATE OR REPLACE FUNCTION path_private.sitov_revision_strict_audio(p_text text) RETURNS text
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE reference text; authored jsonb; token text; timing jsonb; idx bigint;
BEGIN
 reference:=vocabulary_private.sitov_prepared_german_audio_url(p_text);
 SELECT m.user_metadata INTO authored FROM sitov_storage_private.sitov_audio_metadata('audio_cache',replace(reference,'storage://audio_cache/','')) m;
 FOR token,idx IN SELECT v,n FROM unnest(string_to_array(vocabulary_private.sitov_normalize_audio_text(p_text),' ')) WITH ORDINALITY a(v,n) LOOP
  timing:=authored->'wordTimings'->(idx::integer-1);
  IF token ~ '[[:alnum:]]' AND (timing IS NULL OR (timing->>'end')::numeric <= (timing->>'start')::numeric) THEN
   RAISE EXCEPTION 'prepared_audio_lexical_duration_required' USING ERRCODE='22023';
  END IF;
 END LOOP;
 RETURN reference;
END $$;
CREATE OR REPLACE FUNCTION path_private.sitov_revision_protected(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM path_private.sitov_content_revisions WHERE exercise_id=p_id);
$$;

-- Check the complete seed before its first catalog mutation. No bypass flag or
-- editable GUC capability: the checked writer below never calls this importer.
CREATE OR REPLACE FUNCTION path_private.sitov_revision_check_import(p_path jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r record; n jsonb; x jsonb; expected jsonb; actual jsonb; lang text; tr jsonb;
BEGIN
 FOR r IN SELECT e.* FROM public.learning_exercises e JOIN public.learning_units u ON u.id=e.unit_id
  WHERE u.level=p_path->>'level' AND u.path_source_id=p_path->>'id'
   AND path_private.sitov_revision_protected(e.id) ORDER BY e.id LOOP
  SELECT nn,ee INTO n,x FROM jsonb_array_elements(p_path->'nodes') nn
   CROSS JOIN LATERAL jsonb_array_elements(nn->'exercises') ee WHERE ee->>'id'=r.id::text;
  IF x IS NULL OR n->>'id' IS DISTINCT FROM (SELECT source_id FROM public.path_nodes WHERE id=r.node_id)
   OR NOT coalesce((n->>'is_active')::boolean,true) OR NOT coalesce((p_path->>'is_active')::boolean,true)
   OR n->>'topic' IS DISTINCT FROM r.topic OR x->>'goal' IS DISTINCT FROM r.goal_id
   OR x->>'ref' IS DISTINCT FROM r.source_ref OR x->>'exercise_type' IS DISTINCT FROM r.type::text
   OR x->'content' IS DISTINCT FROM r.content OR x->>'explanation_card' IS DISTINCT FROM r.explanation_card
   OR (SELECT ord FROM jsonb_array_elements(n->'exercises') WITH ORDINALITY z(v,ord) WHERE v->>'id'=r.id::text) IS DISTINCT FROM r.sort_order::bigint
  THEN RAISE EXCEPTION 'sitov_revision_import_conflict' USING ERRCODE='40001'; END IF;
  actual:=path_private.sitov_revision_projection(r.id)->'translations'; expected:='{}'::jsonb;
  FOREACH lang IN ARRAY ARRAY['de','en','ru','uk','tr'] LOOP
   tr:=jsonb_build_object('hint',CASE WHEN lang='de' THEN x->>'hint' ELSE x->'translations'->lang->>'hint' END,
    'explanation',CASE WHEN lang='de' THEN x->>'explanation' ELSE x->'translations'->lang->>'explanation' END,
    'instruction',CASE WHEN lang='de' THEN x->'content'->>'instruction' ELSE x->'translations'->lang->>'instruction' END,
    'prompt',x->'translations'->lang->>'prompt',
    'task',CASE WHEN lang='de' THEN NULL ELSE nullif(btrim(x->'translations'->lang->>'task'),'') END,
    'gap_hint',CASE WHEN lang='de' THEN NULL ELSE nullif(btrim(x->'translations'->lang->>'gap_hint'),'') END);
   expected:=expected||jsonb_build_object(lang,tr);
  END LOOP;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'sitov_revision_import_conflict' USING ERRCODE='40001'; END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.sitov_revise_path_content(p_request_id uuid,p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE role_name text:=coalesce(nullif(current_setting('role',true),'none'),session_user);
 item jsonb; e public.learning_exercises; old jsonb; candidate jsonb; before_full jsonb;
 before_hash text; after_hash text; existing path_private.sitov_content_revision_receipts;
 lang text; t jsonb; spoken text; audio jsonb; result jsonb:='[]'::jsonb; level_code text; card_count integer; card_node public.path_nodes; parent_node public.path_nodes;
BEGIN
 IF role_name<>'service_role' THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 OR octet_length(p_items::text)>2000000
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) v GROUP BY v->>'id' HAVING count(*)>1)
 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sitov-path-revision-request:'||p_request_id::text,0));
 SELECT * INTO existing FROM path_private.sitov_content_revision_receipts WHERE request_id=p_request_id;
 IF FOUND THEN
  IF existing.payload IS DISTINCT FROM p_items THEN RAISE EXCEPTION 'request_conflict' USING ERRCODE='40001'; END IF;
  RETURN existing.result;
 END IF;
 -- Same level locks as the importer, sorted before any unit/exercise lock.
 FOR level_code IN SELECT DISTINCT u.level FROM jsonb_array_elements(p_items) v
  JOIN public.learning_exercises ex ON ex.id=(v->>'id')::uuid JOIN public.learning_units u ON u.id=ex.unit_id ORDER BY u.level LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('path-catalog:'||level_code,0));
 END LOOP;
 PERFORM u.id FROM public.learning_units u WHERE u.id IN(SELECT ex.unit_id FROM public.learning_exercises ex
  JOIN jsonb_array_elements(p_items) v ON ex.id=(v->>'id')::uuid) ORDER BY u.id FOR UPDATE;
 PERFORM ex.id FROM public.learning_exercises ex JOIN jsonb_array_elements(p_items) v ON ex.id=(v->>'id')::uuid ORDER BY ex.id FOR UPDATE OF ex;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'id' LOOP
  SELECT * INTO e FROM public.learning_exercises WHERE id=(item->>'id')::uuid;
  IF NOT FOUND OR e.node_id IS NULL OR NOT e.path_is_active THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  PERFORM gt.exercise_id FROM public.grammar_translations gt WHERE gt.exercise_id=e.id ORDER BY gt.locale FOR UPDATE;
  -- Stabilize the same parent before checking its authoritative topic mirror.
  SELECT * INTO parent_node FROM public.path_nodes WHERE id=e.node_id FOR SHARE;
  old:=path_private.sitov_revision_projection(e.id); candidate:=item->'after';
  IF old#>>'{parent,unit_active}' IS DISTINCT FROM 'true' OR old#>>'{parent,node_active}' IS DISTINCT FROM 'true'
   OR old#>>'{parent,node_unit_id}' IS DISTINCT FROM e.unit_id::text THEN RAISE EXCEPTION 'sitov_revision_parent_conflict' USING ERRCODE='40001'; END IF;
  before_hash:=path_private.sitov_revision_hash(old); after_hash:=path_private.sitov_revision_hash(candidate);
  IF item->>'expected_hash' IS DISTINCT FROM before_hash
   OR (candidate-ARRAY['content','translations','explanation_card','topic']) IS DISTINCT FROM (old-ARRAY['content','translations','explanation_card','topic'])
  THEN RAISE EXCEPTION 'sitov_revision_version_conflict' USING ERRCODE='40001'; END IF;
  -- A renamed parent label may be mirrored only from this exact locked
  -- active parent. Topic changes are archived with content, never pre-patched.
  IF candidate->'topic' IS DISTINCT FROM old->'topic' THEN
   IF jsonb_typeof(candidate->'topic') IS DISTINCT FROM 'string'
    OR NOT path_private.valid_text(candidate->'topic')
    OR candidate->>'topic' IS DISTINCT FROM parent_node.topic
   THEN RAISE EXCEPTION 'sitov_revision_topic_binding_invalid' USING ERRCODE='23514'; END IF;
  END IF;
  -- Reviewed pointer correction is an archived source delta, never a
  -- pre-archive patch. Lock and count every active exact same-unit binding.
  IF candidate->'explanation_card' IS DISTINCT FROM old->'explanation_card' THEN
   IF jsonb_typeof(candidate->'explanation_card') IS DISTINCT FROM 'string'
    OR NOT path_private.valid_text(candidate->'explanation_card',100)
   THEN RAISE EXCEPTION 'sitov_revision_card_binding_invalid' USING ERRCODE='23514'; END IF;
   card_count:=0;
   FOR card_node IN SELECT n.* FROM public.path_nodes n WHERE n.unit_id=e.unit_id
    AND n.kind='practice' AND n.is_active AND n.merkkarte->>'card'=candidate->>'explanation_card'
    ORDER BY n.id FOR SHARE LOOP
    card_count:=card_count+1;
    IF jsonb_typeof(card_node.merkkarte) IS DISTINCT FROM 'object'
     OR NOT path_private.valid_text(card_node.merkkarte->'rule')
     OR NOT path_private.valid_strings(card_node.merkkarte->'examples',1,false)
    THEN RAISE EXCEPTION 'sitov_revision_card_binding_invalid' USING ERRCODE='23514'; END IF;
   END LOOP;
   IF card_count<>1 THEN RAISE EXCEPTION 'sitov_revision_card_binding_invalid' USING ERRCODE='23514'; END IF;
  END IF;
  IF after_hash IS NULL OR before_hash=after_hash OR NOT path_private.valid_content(e.type,candidate->'content')
   OR jsonb_typeof(candidate->'translations') IS DISTINCT FROM 'object'
   OR NOT path_private.only_keys(candidate->'translations',ARRAY['de','en','ru','uk','tr'])
   OR item#>>'{review,approved}' IS DISTINCT FROM 'true'
   OR item#>>'{review,before_hash}' IS DISTINCT FROM before_hash
   OR item#>>'{review,after_hash}' IS DISTINCT FROM after_hash
   OR nullif(btrim(item#>>'{review,reviewer}'),'') IS NULL
   OR nullif(btrim(item#>>'{review,evidence_uri}'),'') IS NULL
  THEN RAISE EXCEPTION 'sitov_revision_review_required' USING ERRCODE='23514'; END IF;
  FOREACH lang IN ARRAY ARRAY['de','en','ru','uk','tr'] LOOP
   t:=candidate->'translations'->lang;
   IF jsonb_typeof(t) IS DISTINCT FROM 'object' OR NOT path_private.only_keys(t,ARRAY['instruction','hint','explanation','prompt','task','gap_hint'])
    OR NOT path_private.valid_text(t->'hint') OR NOT path_private.valid_text(t->'explanation')
    OR (lang<>'de' AND NOT path_private.valid_text(t->'instruction'))
    OR (lang='de' AND (t->>'instruction' IS DISTINCT FROM candidate->'content'->>'instruction' OR t->>'task' IS NOT NULL OR t->>'gap_hint' IS NOT NULL))
   THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  END LOOP;
  -- Old Special resume/history is unresolved: fail closed for every stored
  -- definition dependency, including inactive definitions with old attempts.
  IF EXISTS(SELECT 1 FROM sitov_special_private.definitions d CROSS JOIN LATERAL jsonb_array_elements(d.pool) q WHERE q->>'id'=e.id::text) THEN
   RAISE EXCEPTION 'sitov_revision_special_dependency' USING ERRCODE='23514';
  END IF;
  before_full:=path_private.sitov_revision_full(e.id);
  UPDATE public.learning_exercises SET content=candidate->'content',explanation_card=candidate->>'explanation_card',topic=candidate->>'topic' WHERE id=e.id;
  FOREACH lang IN ARRAY ARRAY['de','en','ru','uk','tr'] LOOP
   t:=candidate->'translations'->lang;
   INSERT INTO public.grammar_translations(exercise_id,locale,instruction,hint,explanation,prompt,task,gap_hint)
    VALUES(e.id,lang,t->>'instruction',t->>'hint',t->>'explanation',t->>'prompt',t->>'task',t->>'gap_hint')
   ON CONFLICT(exercise_id,locale) DO UPDATE SET instruction=excluded.instruction,hint=excluded.hint,
    explanation=excluded.explanation,prompt=excluded.prompt,task=excluded.task,gap_hint=excluded.gap_hint;
  END LOOP;
  -- Retain 71/72's authoritative saved-row validation and positive lexical
  -- timings for precisely its played utterances; no unplayed options.
  PERFORM learning_private.sitov_require_prepared_learning_audio('exercises',jsonb_build_object('id',e.id),'[]'::jsonb,e.unit_id);
  audio:='[]'::jsonb;
  FOR spoken IN SELECT v FROM path_private.sitov_revision_audio_texts(e.type,candidate->'content') v ORDER BY v LOOP
   audio:=audio||jsonb_build_array(jsonb_build_object('text',spoken,'prepared_url',path_private.sitov_revision_strict_audio(spoken)));
  END LOOP;
  IF path_private.sitov_revision_projection(e.id) IS DISTINCT FROM candidate THEN RAISE EXCEPTION 'sitov_revision_projection_conflict' USING ERRCODE='40001'; END IF;
  INSERT INTO path_private.sitov_content_revisions(request_id,exercise_id,before_hash,after_hash,before_projection,after_projection,before_full,after_full,review_evidence,audio_evidence,actor_role)
   VALUES(p_request_id,e.id,before_hash,after_hash,old,candidate,before_full,path_private.sitov_revision_full(e.id),item->'review',audio,role_name);
  result:=result||jsonb_build_array(jsonb_build_object('id',e.id,'before_hash',before_hash,'after_hash',after_hash));
 END LOOP;
 -- No exception handler: any failure rolls back the entire batch and receipt.
 INSERT INTO path_private.sitov_content_revision_receipts(request_id,payload,result) VALUES(p_request_id,p_items,result);
 RETURN result;
END $$;

-- Deferred constraint checks allow the checked transaction to replace row and
-- translations before appending the complete new revision. At commit every
-- protected source must equal the newest archived after-image, including writes
-- through other existing authoring routes. No caller-controlled bypass exists.
CREATE OR REPLACE FUNCTION path_private.sitov_revision_guard_current() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; targets uuid[]; expected jsonb;
BEGIN
 IF TG_TABLE_NAME='learning_exercises' THEN
  targets:=ARRAY[CASE WHEN TG_OP<>'INSERT' THEN OLD.id END,CASE WHEN TG_OP<>'DELETE' THEN NEW.id END];
 ELSIF TG_TABLE_NAME='path_nodes' THEN
  SELECT array_agg(e.id) INTO targets FROM public.learning_exercises e WHERE e.node_id IN(CASE WHEN TG_OP<>'INSERT' THEN OLD.id END,CASE WHEN TG_OP<>'DELETE' THEN NEW.id END);
 ELSIF TG_TABLE_NAME='learning_units' THEN
  SELECT array_agg(e.id) INTO targets FROM public.learning_exercises e WHERE e.unit_id IN(CASE WHEN TG_OP<>'INSERT' THEN OLD.id END,CASE WHEN TG_OP<>'DELETE' THEN NEW.id END);
 ELSE targets:=ARRAY[CASE WHEN TG_OP<>'INSERT' THEN OLD.exercise_id END,CASE WHEN TG_OP<>'DELETE' THEN NEW.exercise_id END];
 END IF;
 FOREACH target IN ARRAY coalesce(targets,ARRAY[]::uuid[]) LOOP
 IF target IS NULL THEN CONTINUE; END IF;
 SELECT after_projection INTO expected FROM path_private.sitov_content_revisions
  WHERE exercise_id=target ORDER BY revision_id DESC LIMIT 1;
 IF FOUND AND path_private.sitov_revision_projection(target) IS DISTINCT FROM expected THEN
  RAISE EXCEPTION 'sitov_revision_unreviewed_write' USING ERRCODE='40001';
 END IF;
 END LOOP;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS sitov_revision_current_guard ON public.learning_exercises;
CREATE CONSTRAINT TRIGGER sitov_revision_current_guard AFTER INSERT OR UPDATE OR DELETE ON public.learning_exercises
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION path_private.sitov_revision_guard_current();
DROP TRIGGER IF EXISTS sitov_revision_translation_guard ON public.grammar_translations;
CREATE CONSTRAINT TRIGGER sitov_revision_translation_guard AFTER INSERT OR UPDATE OR DELETE ON public.grammar_translations
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION path_private.sitov_revision_guard_current();
DROP TRIGGER IF EXISTS sitov_revision_node_guard ON public.path_nodes;
CREATE CONSTRAINT TRIGGER sitov_revision_node_guard AFTER INSERT OR UPDATE OR DELETE ON public.path_nodes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION path_private.sitov_revision_guard_current();
DROP TRIGGER IF EXISTS sitov_revision_unit_guard ON public.learning_units;
CREATE CONSTRAINT TRIGGER sitov_revision_unit_guard AFTER INSERT OR UPDATE OR DELETE ON public.learning_units DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION path_private.sitov_revision_guard_current();
REVOKE ALL ON FUNCTION path_private.sitov_revision_guard_current() FROM PUBLIC,anon,authenticated,service_role;

DO $patch$
DECLARE definition text; anchor text; replacement text;
BEGIN
 INSERT INTO path_private.sitov_revision_function_backups(signature,definition)
 SELECT s,pg_get_functiondef(s::regprocedure) FROM unnest(ARRAY['path_private.import_path_catalog(jsonb,uuid)','path_private.present(jsonb,text)']) s ON CONFLICT DO NOTHING;
 definition:=pg_get_functiondef('path_private.import_path_catalog(jsonb,uuid)'::regprocedure);
 IF strpos(definition,'-- sitov-path-revision-import-v1')=0 THEN
  IF strpos(definition,'-- sitov-prepared-path-publication-v1')=0 THEN RAISE EXCEPTION 'sitov_revision_requires_72' USING ERRCODE='23514'; END IF;
  anchor:=$a$ PERFORM pg_advisory_xact_lock(hashtextextended('path-catalog:'||(p_path->>'level'),0));$a$;
  replacement:=anchor||E'\n -- sitov-path-revision-import-v1\n PERFORM path_private.sitov_revision_check_import(p_path);';
  IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'sitov_revision_import_source_drift' USING ERRCODE='23514'; END IF;
  EXECUTE replace(definition,anchor,replacement);
 END IF;
 definition:=pg_get_functiondef('path_private.present(jsonb,text)'::regprocedure);
 IF strpos(definition,'-- sitov-path-revision-help-v1')=0 THEN
  anchor:=$a$WHERE e.id=(p_snapshot->>'id')::uuid AND p_snapshot->>'type'='fill_in_blank'$a$;
  IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'sitov_revision_help_source_drift' USING ERRCODE='23514'; END IF;
  definition:=replace(definition,anchor,anchor||' AND NOT path_private.sitov_revision_protected(e.id)');
  anchor:=$a$WHERE t.exercise_id=(p_snapshot->>'id')::uuid AND t.locale=p_locale AND p_locale<>'de'$a$;
  IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'sitov_revision_help_translation_source_drift' USING ERRCODE='23514'; END IF;
  definition:=replace(definition,anchor,anchor||' AND NOT path_private.sitov_revision_protected(t.exercise_id)');
  definition:=replace(definition,'WITH live AS (','-- sitov-path-revision-help-v1'||E'\n WITH live AS (');
  EXECUTE definition;
 END IF;
END $patch$;
REVOKE ALL ON FUNCTION path_private.sitov_revision_immutable(),path_private.sitov_revision_hash(jsonb),path_private.sitov_revision_projection(uuid),path_private.sitov_revision_full(uuid),path_private.sitov_revision_audio_texts(public.exercise_type,jsonb),path_private.sitov_revision_strict_audio(text),path_private.sitov_revision_protected(uuid),path_private.sitov_revision_check_import(jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sitov_revise_path_content(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sitov_revise_path_content(uuid,jsonb) TO service_role;

-- Existing importer and presentation run as postgres; new helpers are owned by
-- the actual migration actor supabase_admin. Grant only this internal chain.
GRANT EXECUTE ON FUNCTION path_private.sitov_revision_check_import(jsonb),path_private.sitov_revision_projection(uuid),path_private.sitov_revision_protected(uuid) TO postgres;
DO $internal$ BEGIN
 IF NOT has_function_privilege('postgres','path_private.sitov_revision_check_import(jsonb)','EXECUTE')
 OR NOT has_function_privilege('postgres','path_private.sitov_revision_projection(uuid)','EXECUTE')
 OR NOT has_function_privilege('postgres','path_private.sitov_revision_protected(uuid)','EXECUTE') THEN
 RAISE EXCEPTION 'sitov_revision_internal_execution_not_granted' USING ERRCODE='42501'; END IF;
END $internal$;
