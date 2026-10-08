-- Sitov Academy optional Special engine. Empty private authoring base; no active content seeded.
CREATE SCHEMA IF NOT EXISTS sitov_special_private;
REVOKE ALL ON SCHEMA sitov_special_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA sitov_special_private TO authenticated;
CREATE TABLE IF NOT EXISTS sitov_special_private.definitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),node_id uuid NOT NULL REFERENCES public.path_nodes(id),
 version text NOT NULL CHECK(version ~ '^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 500),
 blueprint jsonb NOT NULL,pool jsonb NOT NULL CHECK(jsonb_typeof(pool)='array'),
 published boolean NOT NULL DEFAULT false,editorial_proof jsonb,audio_import_proof jsonb,
 created_by uuid REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(node_id,version),UNIQUE(node_id,id),CHECK(NOT published OR (editorial_proof IS NOT NULL AND audio_import_proof IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS sitov_special_private.activation (
 node_id uuid PRIMARY KEY REFERENCES public.path_nodes(id),definition_id uuid NOT NULL,FOREIGN KEY(node_id,definition_id) REFERENCES sitov_special_private.definitions(node_id,id)
);
ALTER TABLE sitov_special_private.activation ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS sitov_special_private.sources (
 source_ref text PRIMARY KEY,source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
 level text NOT NULL REFERENCES public.learning_levels(code),evidence_uri text NOT NULL CHECK(evidence_uri ~ '^(obsidian|catalog):.+'),active boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS sitov_special_private.approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),node_id uuid NOT NULL REFERENCES public.path_nodes(id),version text NOT NULL,
 source_ref text NOT NULL REFERENCES sitov_special_private.sources(source_ref),source_sha256 text NOT NULL,
 reviewed_by uuid NOT NULL REFERENCES public.profiles(id),reviewed_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,
 UNIQUE(node_id,version)
);
ALTER TABLE sitov_special_private.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitov_special_private.approvals ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION sitov_special_private.definition_fingerprint(p_node uuid,p_source text,p_blueprint jsonb,p_pool jsonb) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('policy','sitov-special-definition-v1','node',jsonb_build_object('id',n.id,'unitId',n.unit_id,'sourceId',n.source_id,'anchorId',n.anchor_node_id,'title',n.title,'topic',n.topic,'goals',n.goals),'sourceRef',p_source,'sourceSha256',s.source_sha256,'blueprint',p_blueprint,'pool',p_pool)::text,'UTF8')),'hex')
 FROM public.path_nodes n LEFT JOIN sitov_special_private.sources s ON s.source_ref=p_source WHERE n.id=p_node $$;
CREATE OR REPLACE FUNCTION sitov_special_private.audible_texts(p_pool jsonb) RETURNS TABLE(spoken text) LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 WITH q AS(SELECT value->'snapshot'->'content' c FROM jsonb_array_elements(p_pool)),texts AS(
 SELECT c->>'question' t FROM q UNION ALL SELECT c->>'instruction' FROM q UNION ALL SELECT c->>'correct_answer' FROM q
 UNION ALL SELECT concat_ws(' ',c->>'text_before',c->>'correct_answer',c->>'text_after') FROM q WHERE c ? 'text_before'
 UNION ALL SELECT jsonb_array_elements_text(c->'options') FROM q WHERE jsonb_typeof(c->'options')='array'
 UNION ALL SELECT jsonb_array_elements_text(c->'parts') FROM q WHERE jsonb_typeof(c->'parts')='array')
 SELECT DISTINCT vocabulary_private.sitov_normalize_audio_text(t) FROM texts WHERE nullif(vocabulary_private.sitov_normalize_audio_text(t),'') IS NOT NULL $$;
CREATE OR REPLACE FUNCTION sitov_special_private.guard_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT sitov_access_private.staff() OR NEW.reviewed_by IS DISTINCT FROM auth.uid() OR NEW.revoked_at IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM sitov_special_private.sources s JOIN public.path_nodes n ON n.id=NEW.node_id JOIN public.learning_units u ON u.id=n.unit_id WHERE s.source_ref=NEW.source_ref AND s.source_sha256=NEW.source_sha256 AND s.active AND s.level=u.level)
 THEN RAISE EXCEPTION 'special_review_required';END IF;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS sitov_special_review_guard ON sitov_special_private.approvals;
CREATE TRIGGER sitov_special_review_guard BEFORE INSERT ON sitov_special_private.approvals FOR EACH ROW EXECUTE FUNCTION sitov_special_private.guard_approval();
CREATE OR REPLACE FUNCTION sitov_special_private.definition_ready(d sitov_special_private.definitions) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE text_row record;asset jsonb;expected_path text;expected_object text;authored jsonb;asset_count integer;
BEGIN
 IF NOT d.published OR d.version IS DISTINCT FROM sitov_special_private.definition_fingerprint(d.node_id,d.source_ref,d.blueprint,d.pool)
 OR NOT EXISTS(SELECT 1 FROM sitov_special_private.approvals a JOIN sitov_special_private.sources s ON s.source_ref=a.source_ref JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id JOIN public.profiles reviewer ON reviewer.id=a.reviewed_by
 WHERE a.node_id=d.node_id AND a.version=d.version AND a.source_ref=d.source_ref AND a.source_sha256=s.source_sha256 AND s.active AND s.level=u.level AND a.revoked_at IS NULL AND reviewer.role IN('teacher','admin')
 AND d.editorial_proof=jsonb_build_object('reviewId',a.id,'definitionVersion',a.version,'sourceSha256',a.source_sha256))
 OR d.audio_import_proof->>'definitionVersion' IS DISTINCT FROM d.version OR jsonb_typeof(d.audio_import_proof->'assets') IS DISTINCT FROM 'array'
 THEN RETURN false;END IF;
 SELECT count(*) INTO asset_count FROM sitov_special_private.audible_texts(d.pool);
 IF asset_count=0 OR jsonb_array_length(d.audio_import_proof->'assets')<>asset_count THEN RETURN false;END IF;
 FOR text_row IN SELECT spoken FROM sitov_special_private.audible_texts(d.pool) LOOP
  expected_path:=vocabulary_private.sitov_prepared_german_audio_url(text_row.spoken);
  SELECT value INTO asset FROM jsonb_array_elements(d.audio_import_proof->'assets') WHERE value->>'textSha256'=encode(sha256(convert_to(text_row.spoken,'UTF8')),'hex');
  -- The trusted helper validates the asset; normalize only its two exact references.
  -- Published legacy proof remains immutable when 96 makes the bucket private.
  expected_object:=CASE
   WHEN expected_path ~ '^storage://audio_cache/sitov-qwen-v1/de/[a-f0-9]{64}\.mp3$' THEN substr(expected_path,length('storage://audio_cache/')+1)
   WHEN expected_path ~ '^/supabase/storage/v1/object/public/audio_cache/sitov-qwen-v1/de/[a-f0-9]{64}\.mp3$' THEN substr(expected_path,length('/supabase/storage/v1/object/public/audio_cache/')+1)
   ELSE NULL END;
  IF expected_object IS NULL OR asset IS NULL OR NOT coalesce(asset->>'path' IN('storage://audio_cache/'||expected_object,'/supabase/storage/v1/object/public/audio_cache/'||expected_object),false) OR (SELECT count(*) FROM jsonb_array_elements(d.audio_import_proof->'assets') WHERE value->>'textSha256'=asset->>'textSha256')<>1 THEN RETURN false;END IF;
  SELECT user_metadata INTO authored FROM storage.objects WHERE bucket_id='audio_cache' AND name=expected_object AND archived_at IS NULL AND coalesce(is_delete_marker,false)=false;
  IF authored IS NULL OR asset->>'audioSha256' IS DISTINCT FROM authored->>'audioSha256' THEN RETURN false;END IF;
 END LOOP;
 RETURN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.pool) item WHERE item->'snapshot' IS DISTINCT FROM path_private.snapshot((item->>'id')::uuid) OR item->'snapshot'->>'type' NOT IN('multiple_choice','fill_in_blank','sentence_building'));
EXCEPTION WHEN OTHERS THEN RETURN false;END $$;
CREATE OR REPLACE FUNCTION sitov_special_private.guard_activation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d sitov_special_private.definitions;
BEGIN SELECT * INTO d FROM sitov_special_private.definitions WHERE id=NEW.definition_id AND node_id=NEW.node_id;
 IF d.id IS NULL OR NOT sitov_special_private.definition_ready(d) THEN RAISE EXCEPTION 'special_publication_proof_required';END IF;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS sitov_special_activation_guard ON sitov_special_private.activation;
CREATE TRIGGER sitov_special_activation_guard BEFORE INSERT OR UPDATE ON sitov_special_private.activation FOR EACH ROW EXECUTE FUNCTION sitov_special_private.guard_activation();
CREATE OR REPLACE FUNCTION sitov_special_private.validate_definition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item jsonb;part record;total integer:=0;fingerprint text;
BEGIN
 fingerprint:=sitov_special_private.definition_fingerprint(NEW.node_id,NEW.source_ref,NEW.blueprint,NEW.pool);
 IF NEW.version IS NOT NULL AND NEW.version<>fingerprint THEN RAISE EXCEPTION 'special_version_mismatch';END IF;NEW.version:=fingerprint;
 IF NOT EXISTS(SELECT 1 FROM public.path_nodes WHERE id=NEW.node_id AND kind='special') OR jsonb_typeof(NEW.blueprint)<>'object'
 OR jsonb_array_length(NEW.pool)<>(SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(NEW.pool)) THEN RAISE EXCEPTION 'invalid_special_definition';END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.pool) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.id=(v_item->>'id')::uuid AND e.node_id=NEW.node_id AND e.path_is_active AND e.content_status='ready')
   OR v_item->'snapshot' IS DISTINCT FROM path_private.snapshot((v_item->>'id')::uuid) OR NOT NEW.blueprint ? (v_item->>'stratum') THEN RAISE EXCEPTION 'invalid_special_snapshot';END IF;
 END LOOP;
 FOR part IN SELECT key,value FROM jsonb_each_text(NEW.blueprint) LOOP
  IF part.value !~ '^[1-9][0-9]?$' THEN RAISE EXCEPTION 'invalid_special_blueprint';END IF;total:=total+part.value::integer;
  IF NEW.published AND (SELECT count(*) FROM jsonb_array_elements(NEW.pool) q WHERE q->>'stratum'=part.key)<2*part.value::integer THEN RAISE EXCEPTION 'insufficient_special_stratum';END IF;
 END LOOP;
 IF NEW.published AND EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.pool) item WHERE item->'snapshot'->>'type' NOT IN('multiple_choice','fill_in_blank','sentence_building')) THEN RAISE EXCEPTION 'unsupported_special_format';END IF;
 IF NEW.published AND (total<>10 OR jsonb_array_length(NEW.pool)<20) THEN RAISE EXCEPTION 'invalid_special_pool';END IF;
 IF NEW.published AND NOT sitov_special_private.definition_ready(NEW) THEN RAISE EXCEPTION 'special_publication_proof_required';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sitov_special_validate ON sitov_special_private.definitions;
CREATE TRIGGER sitov_special_validate BEFORE INSERT ON sitov_special_private.definitions FOR EACH ROW EXECUTE FUNCTION sitov_special_private.validate_definition();
CREATE TABLE IF NOT EXISTS sitov_special_private.runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES public.profiles(id),
 definition_id uuid NOT NULL REFERENCES sitov_special_private.definitions(id),mode text NOT NULL CHECK(mode IN('learning','test')),
 status text NOT NULL DEFAULT 'in_progress' CHECK(status IN('in_progress','completed')),
 selected uuid[] NOT NULL,queue uuid[] NOT NULL,revealed boolean NOT NULL DEFAULT false,
 answers jsonb NOT NULL DEFAULT '{}',result jsonb,revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 started_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS sitov_special_open_run ON sitov_special_private.runs(student_id,definition_id,mode) WHERE status='in_progress';
CREATE TABLE IF NOT EXISTS sitov_special_private.receipts (
 student_id uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,payload jsonb NOT NULL,response jsonb NOT NULL,
 PRIMARY KEY(student_id,request_id)
);
ALTER TABLE sitov_special_private.definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitov_special_private.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitov_special_private.receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sitov_special_private FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION sitov_special_private.immutable_definition() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'special_definition_immutable' USING ERRCODE='23514';END $$;
DROP TRIGGER IF EXISTS sitov_special_immutable ON sitov_special_private.definitions;
CREATE TRIGGER sitov_special_immutable BEFORE UPDATE OR DELETE ON sitov_special_private.definitions FOR EACH ROW EXECUTE FUNCTION sitov_special_private.immutable_definition();
CREATE OR REPLACE FUNCTION sitov_special_private.error(e text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('ok',false,'error',e,'retryable',e='retryable_failure') $$;
CREATE OR REPLACE FUNCTION sitov_special_private.available(p_node uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND sitov_access_private.item_allowed(auth.uid(),'path_special',p_node::text)
 AND EXISTS(SELECT 1 FROM public.path_nodes n JOIN public.path_nodes anchor ON anchor.id=n.anchor_node_id AND anchor.unit_id=n.unit_id
 JOIN public.learning_units u ON u.id=n.unit_id
 JOIN public.path_node_progress p ON p.node_id=anchor.id AND p.auth_user_id=auth.uid() AND p.status='completed'
 WHERE n.id=p_node AND n.kind='special' AND n.is_active AND anchor.is_active AND u.is_active AND u.is_path) $$;
CREATE OR REPLACE FUNCTION sitov_special_private.response(r sitov_special_private.runs,p_locale text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('runId',r.id,'nodeId',d.node_id,'definitionVersion',d.version,'mode',r.mode,'status',r.status,
 'revision',r.revision,'selected',to_jsonb(r.selected),'queue',to_jsonb(r.queue),'revealed',r.revealed,'answers',r.answers,'result',r.result,
 'tasks',coalesce((SELECT jsonb_agg(path_private.present(q->'snapshot',p_locale) ORDER BY array_position(r.selected,(q->>'id')::uuid))
 FROM jsonb_array_elements(d.pool) q WHERE (q->>'id')::uuid=ANY(r.selected)),'[]'::jsonb),
 'learningSolution',CASE WHEN r.mode='learning' AND r.revealed AND cardinality(r.queue)>0 THEN
 (SELECT jsonb_build_object('content',q->'snapshot'->'content','explanation',q->'snapshot'->'translations'->p_locale->'explanation')
 FROM jsonb_array_elements(d.pool) q WHERE q->>'id'=r.queue[1]::text) ELSE NULL END)
 FROM sitov_special_private.definitions d WHERE d.id=r.definition_id $$;
-- Read/transition payload bound to session, immutable definition, selected private snapshot and CAS revision.
CREATE OR REPLACE FUNCTION sitov_special_private.operation(op text,p_node uuid,p_run uuid,p_mode text,p_revision integer,p_request uuid,p_answers jsonb,p_locale text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();d sitov_special_private.definitions;r sitov_special_private.runs;saved sitov_special_private.receipts;
 payload jsonb;response jsonb;eligible uuid[];chosen uuid[];previous uuid[];part record;quota integer;score integer;feedback jsonb;head uuid;
BEGIN
 IF actor IS NULL THEN RETURN sitov_special_private.error('authentication_required');END IF;
 IF p_locale IS NULL OR p_locale NOT IN('de','en','ru','uk','tr') OR op IS NULL OR op NOT IN('start','get','reveal','right','wrong','save','submit') THEN RETURN sitov_special_private.error('invalid_input');END IF;
 PERFORM learning_reset_private.assert_writable(actor);
 PERFORM pg_advisory_xact_lock(hashtextextended('sitov-special:'||actor::text,0));
 IF op<>'start' THEN SELECT * INTO r FROM sitov_special_private.runs WHERE id=p_run AND student_id=actor FOR UPDATE;
  IF r.id IS NULL THEN RETURN sitov_special_private.error('not_found');END IF;
  SELECT * INTO d FROM sitov_special_private.definitions WHERE id=r.definition_id;p_node:=d.node_id;
 ELSE IF p_mode IS NULL OR p_mode NOT IN('learning','test') THEN RETURN sitov_special_private.error('invalid_input');END IF;
  SELECT def.* INTO d FROM sitov_special_private.definitions def JOIN sitov_special_private.activation active ON active.definition_id=def.id AND active.node_id=def.node_id WHERE def.node_id=p_node AND def.published;
 END IF;
 IF NOT sitov_special_private.available(p_node) THEN RETURN sitov_special_private.error('not_found');END IF;
 IF d.id IS NULL THEN RETURN sitov_special_private.error('authoring_not_ready');END IF;
 IF NOT sitov_special_private.definition_ready(d) THEN RETURN sitov_special_private.error('version_conflict');END IF;
 IF NOT d.published OR NOT EXISTS(SELECT 1 FROM sitov_special_private.activation WHERE definition_id=d.id AND node_id=p_node) THEN RETURN sitov_special_private.error('version_conflict');END IF;
 SELECT coalesce(array_agg((q->>'id')::uuid),'{}') INTO eligible FROM jsonb_array_elements(d.pool) q
 WHERE sitov_access_private.item_allowed(actor,'path_special_item',q->>'id');
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(d.pool) item WHERE item->'snapshot' IS DISTINCT FROM path_private.snapshot((item->>'id')::uuid)) THEN RETURN sitov_special_private.error('version_conflict');END IF;
 IF r.id IS NOT NULL AND NOT r.selected<@eligible THEN RETURN sitov_special_private.error('not_found');END IF;
 IF op='get' THEN RETURN jsonb_build_object('ok',true,'data',sitov_special_private.response(r,p_locale));END IF;
 IF p_request IS NULL THEN RETURN sitov_special_private.error('invalid_input');END IF;
 payload:=jsonb_build_object('op',op,'node',p_node,'run',p_run,'mode',p_mode,'revision',p_revision,'answers',p_answers,'locale',p_locale);
 SELECT * INTO saved FROM sitov_special_private.receipts WHERE student_id=actor AND request_id=p_request;
 IF saved.request_id IS NOT NULL THEN IF saved.payload<>payload THEN RETURN sitov_special_private.error('request_conflict');END IF;RETURN saved.response;END IF;
 IF op='start' THEN
  SELECT * INTO r FROM sitov_special_private.runs WHERE student_id=actor AND definition_id=d.id AND mode=p_mode AND status='in_progress' FOR UPDATE;
  IF r.id IS NULL THEN
   chosen:=eligible;
   IF p_mode='test' THEN
    IF cardinality(eligible)<20 THEN RETURN sitov_special_private.error('scope_insufficient_for_test');END IF;
    SELECT selected INTO previous FROM sitov_special_private.runs WHERE student_id=actor AND definition_id=d.id AND mode='test' AND status='completed' ORDER BY completed_at DESC,id DESC LIMIT 1;
    chosen:='{}';quota:=0;
    IF jsonb_typeof(d.blueprint)<>'object' THEN RETURN sitov_special_private.error('authoring_not_ready');END IF;
    FOR part IN SELECT key,value FROM jsonb_each_text(d.blueprint) ORDER BY key LOOP
     IF part.value !~ '^[1-9][0-9]?$' THEN RETURN sitov_special_private.error('authoring_not_ready');END IF;
     quota:=quota+part.value::integer;
     SELECT coalesce(array_agg(id),'{}') INTO previous FROM (SELECT (q->>'id')::uuid id FROM jsonb_array_elements(d.pool) q
      WHERE q->>'stratum'=part.key AND (q->>'id')::uuid=ANY(eligible)
      AND NOT (q->>'id')::uuid=ANY(coalesce((SELECT selected FROM sitov_special_private.runs WHERE student_id=actor AND definition_id=d.id AND mode='test' AND status='completed' ORDER BY completed_at DESC,id DESC LIMIT 1),'{}'))
      ORDER BY md5(p_request::text||(q->>'id')) LIMIT part.value::integer) s;
     IF cardinality(previous)<>part.value::integer THEN RETURN sitov_special_private.error('scope_insufficient_for_test');END IF;
     chosen:=chosen||previous;
    END LOOP;
    IF quota<>10 OR cardinality(chosen)<>10 THEN RETURN sitov_special_private.error('authoring_not_ready');END IF;
   END IF;
   IF cardinality(chosen)=0 THEN RETURN sitov_special_private.error('not_found');END IF;
   INSERT INTO sitov_special_private.runs(student_id,definition_id,mode,selected,queue) VALUES(actor,d.id,p_mode,chosen,chosen) RETURNING * INTO r;
  END IF;
 ELSE
  IF r.status<>'in_progress' THEN RETURN sitov_special_private.error('attempt_completed');END IF;
  IF p_revision IS NULL OR p_revision<>r.revision THEN RETURN sitov_special_private.error('revision_conflict');END IF;
  IF op IN('reveal','right','wrong') THEN
   IF r.mode<>'learning' OR cardinality(r.queue)=0 THEN RETURN sitov_special_private.error('invalid_input');END IF;
   IF op='reveal' THEN r.revealed:=true;
   ELSE IF NOT r.revealed THEN RETURN sitov_special_private.error('reveal_required');END IF;
    head:=r.queue[1];r.queue:=r.queue[2:cardinality(r.queue)];
    IF op='wrong' THEN r.queue:=r.queue||head;END IF;r.revealed:=false;
    IF cardinality(r.queue)=0 THEN r.status:='completed';r.completed_at:=clock_timestamp();END IF;
   END IF;
  ELSE
   IF r.mode<>'test' OR jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN RETURN sitov_special_private.error('invalid_answer');END IF;
   IF EXISTS(SELECT 1 FROM jsonb_each(p_answers) a WHERE NOT a.key=ANY(r.selected::text[]) OR jsonb_typeof(a.value)<>'object'
     OR NOT path_private.only_keys(a.value,ARRAY['text','index','indices']) OR EXISTS(SELECT 1 FROM jsonb_array_elements(d.pool) q WHERE q->>'id'=a.key AND path_private.grade((q->'snapshot'->>'type')::public.exercise_type,q->'snapshot'->'content',a.value) ? 'error')) THEN RETURN sitov_special_private.error('invalid_answer');END IF;
   r.answers:=r.answers||p_answers;
   IF op='submit' THEN
    IF (SELECT count(*) FROM jsonb_object_keys(r.answers))<>10 THEN RETURN sitov_special_private.error('incomplete_attempt');END IF;
    SELECT count(*) FILTER(WHERE (path_private.grade((q->'snapshot'->>'type')::public.exercise_type,q->'snapshot'->'content',r.answers->(q->>'id'))->>'correct')::boolean),
     jsonb_agg(jsonb_build_object('itemId',q->>'id','correct',(path_private.grade((q->'snapshot'->>'type')::public.exercise_type,q->'snapshot'->'content',r.answers->(q->>'id'))->>'correct')::boolean,
      'solution',q->'snapshot'->'content','explanation',q->'snapshot'->'translations'->p_locale->'explanation'))
     INTO score,feedback FROM jsonb_array_elements(d.pool) q WHERE (q->>'id')::uuid=ANY(r.selected);
    r.status:='completed';r.completed_at:=clock_timestamp();r.result:=jsonb_build_object('correct',score,'total',10,'passed',score>=8,'feedback',feedback);
   END IF;
  END IF;
  UPDATE sitov_special_private.runs SET queue=r.queue,revealed=r.revealed,answers=r.answers,result=r.result,status=r.status,completed_at=r.completed_at,revision=revision+1,updated_at=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
 END IF;
 response:=jsonb_build_object('ok',true,'data',sitov_special_private.response(r,p_locale));
 INSERT INTO sitov_special_private.receipts VALUES(actor,p_request,payload,response);RETURN response;
EXCEPTION WHEN OTHERS THEN RETURN sitov_special_private.error('retryable_failure');END $$;
CREATE OR REPLACE FUNCTION public.sitov_special_operation(p_operation text,p_node_id uuid DEFAULT NULL,p_run_id uuid DEFAULT NULL,p_mode text DEFAULT NULL,p_revision integer DEFAULT NULL,p_request_id uuid DEFAULT NULL,p_answers jsonb DEFAULT NULL,p_locale text DEFAULT 'de')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_special_private.operation(p_operation,p_node_id,p_run_id,p_mode,p_revision,p_request_id,p_answers,p_locale) $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitov_special_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sitov_special_private.operation(text,uuid,uuid,text,integer,uuid,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION public.sitov_special_operation(text,uuid,uuid,text,integer,uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_special_operation(text,uuid,uuid,text,integer,uuid,jsonb,text) TO authenticated;
-- No definition creation/publication RPC in v1: audited authoring and measured audio import adapter pending.
CREATE OR REPLACE FUNCTION public.sitov_special_staff_catalog(p_node_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT sitov_access_private.staff() THEN RETURN sitov_special_private.error('not_found');END IF;
 RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('definitions',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.created_at),'[]') FROM sitov_special_private.definitions d WHERE d.node_id=p_node_id),'runs',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'studentId',r.student_id,'mode',r.mode,'status',r.status,'revision',r.revision,'result',r.result)),'[]') FROM sitov_special_private.runs r JOIN sitov_special_private.definitions d ON d.id=r.definition_id WHERE d.node_id=p_node_id)));
END $$;
REVOKE ALL ON FUNCTION public.sitov_special_staff_catalog(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_special_staff_catalog(uuid) TO authenticated;
