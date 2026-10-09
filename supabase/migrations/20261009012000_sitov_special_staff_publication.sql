-- Sitov Academy: existing independently reviewed/imported Special publication, no proof-authoring endpoint.
CREATE TABLE IF NOT EXISTS sitov_special_private.publication_receipts(
 actor_id uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,payload jsonb NOT NULL,
 PRIMARY KEY(actor_id,request_id));
ALTER TABLE sitov_special_private.publication_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sitov_special_private.publication_receipts FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_special_publication_receipt_immutable ON sitov_special_private.publication_receipts;
CREATE TRIGGER sitov_special_publication_receipt_immutable BEFORE UPDATE OR DELETE ON sitov_special_private.publication_receipts
 FOR EACH ROW EXECUTE FUNCTION sitov_special_private.immutable_definition();
CREATE OR REPLACE FUNCTION sitov_special_private.author_audio_texts(d sitov_special_private.definitions)
RETURNS TABLE(spoken text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH author AS(SELECT payload FROM sitov_special_private.authored_drafts WHERE definition_id=d.id),items AS(
 SELECT value i FROM author,jsonb_array_elements(payload->'items')),texts AS(
 SELECT t.spoken t FROM sitov_special_private.audible_texts(d.pool) t
 UNION ALL SELECT payload->>'title' FROM author
 UNION ALL SELECT i#>>'{sourceEvidence,rationale,noun}' FROM items
 UNION ALL SELECT i#>>'{snapshot,translations,de,explanation}' FROM items
 UNION ALL SELECT i#>>'{snapshot,content,text_before}' FROM items
 UNION ALL SELECT i#>>'{snapshot,content,text_after}' FROM items
 UNION ALL SELECT jsonb_array_elements_text(i#>'{snapshot,content,target_form}') FROM items
 UNION ALL SELECT concat_ws(' ',i#>>'{snapshot,content,correct_answer}',i#>>'{sourceEvidence,rationale,noun}') FROM items WHERE i#>>'{snapshot,type}'='multiple_choice')
 SELECT DISTINCT vocabulary_private.sitov_normalize_audio_text(t) FROM texts WHERE nullif(vocabulary_private.sitov_normalize_audio_text(t),'') IS NOT NULL $$;
CREATE OR REPLACE FUNCTION sitov_special_private.author_audio_complete(d sitov_special_private.definitions)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM sitov_special_private.authored_drafts WHERE definition_id=d.id) THEN RETURN true;END IF;
 FOR r IN SELECT spoken FROM sitov_special_private.author_audio_texts(d) LOOP
  IF vocabulary_private.sitov_prepared_german_audio_url(r.spoken) IS NULL THEN RETURN false;END IF;
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;END $$;
-- Exact95 fingerprint/snapshots/28proof validation preserved; real Storage accessed through99's readonly/write-aware helper.
DO $sitov$
DECLARE body text;
BEGIN
 body:=pg_get_functiondef('sitov_special_private.definition_ready(sitov_special_private.definitions)'::regprocedure);
 IF position('sitov_special_private.author_audio_complete(d)' IN body)=0 THEN
  IF position('SELECT user_metadata INTO authored FROM storage.objects o WHERE bucket_id=' IN body)=0 THEN RAISE EXCEPTION 'sitov_special_storage_contract_changed';END IF;
  body:=replace(body,$old$SELECT user_metadata INTO authored FROM storage.objects o WHERE bucket_id='audio_cache' AND name=expected_object AND sitov_storage_private.sitov_object_is_current(to_jsonb(o));$old$,
  $new$SELECT m.user_metadata INTO authored FROM sitov_storage_private.sitov_audio_metadata('audio_cache',expected_object) m;$new$);
  IF position('sitov_storage_private.sitov_audio_metadata(' IN body)=0 THEN RAISE EXCEPTION 'sitov_special_storage_contract_changed';END IF;
  body:=replace(body,'reviewer.role IN(''teacher'',''admin'')','reviewer.role IN(''teacher'',''admin'') AND a.reviewed_by IS DISTINCT FROM d.created_by AND a.reviewed_at<=clock_timestamp()');
  body:=replace(body,'SELECT count(*) INTO asset_count FROM sitov_special_private.audible_texts(d.pool);',
  $guard$IF NOT path_private.only_keys(d.audio_import_proof,ARRAY['definitionVersion','assets']) OR (SELECT count(*) FROM jsonb_object_keys(d.audio_import_proof))<>2
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(d.audio_import_proof->'assets') a WHERE NOT path_private.only_keys(a,ARRAY['textSha256','audioSha256','path']) OR (SELECT count(*) FROM jsonb_object_keys(a))<>3
  OR coalesce(a->>'textSha256','')!~'^[a-f0-9]{64}$' OR coalesce(a->>'audioSha256','')!~'^[a-f0-9]{64}$') THEN RETURN false;END IF;
  SELECT count(*) INTO asset_count FROM sitov_special_private.audible_texts(d.pool);$guard$);
  body:=replace(body,'RETURN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.pool)', 'RETURN sitov_special_private.author_audio_complete(d) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.pool)');
  EXECUTE body;
 END IF;
END $sitov$;
CREATE OR REPLACE FUNCTION sitov_special_private.guard_definition_publication_metadata() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate sitov_special_private.definitions;
BEGIN
 IF TG_OP<>'UPDATE' OR OLD.published OR
 (to_jsonb(NEW)-ARRAY['published','editorial_proof','audio_import_proof']) IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['published','editorial_proof','audio_import_proof']) OR NOT sitov_access_private.staff()
 THEN RAISE EXCEPTION 'special_definition_immutable' USING ERRCODE='23514';END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM auth.mfa_factors WHERE user_id=auth.uid() FOR SHARE;
 PERFORM 1 FROM sitov_special_private.sources WHERE source_ref=NEW.source_ref FOR SHARE;
 PERFORM 1 FROM sitov_special_private.approvals WHERE node_id=NEW.node_id AND version=NEW.version FOR SHARE;
 PERFORM 1 FROM public.profiles WHERE id IN(SELECT reviewed_by FROM sitov_special_private.approvals WHERE node_id=NEW.node_id AND version=NEW.version) FOR SHARE;
 PERFORM 1 FROM public.learning_exercises WHERE node_id=NEW.node_id FOR SHARE;
 PERFORM 1 FROM public.grammar_translations WHERE exercise_id IN(SELECT id FROM public.learning_exercises WHERE node_id=NEW.node_id) FOR SHARE;
 IF NOT sitov_access_private.staff() THEN RAISE EXCEPTION 'special_publication_proof_required' USING ERRCODE='23514';END IF;
 candidate:=NEW;candidate.published:=true;
 IF NOT sitov_special_private.definition_ready(candidate) THEN RAISE EXCEPTION 'special_publication_proof_required' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
-- Change only definitions' trigger.101 author audit/receipt guards retain original unconditional immutable_definition().
DROP TRIGGER IF EXISTS sitov_special_immutable ON sitov_special_private.definitions;
CREATE TRIGGER sitov_special_immutable BEFORE UPDATE OR DELETE ON sitov_special_private.definitions
 FOR EACH ROW EXECUTE FUNCTION sitov_special_private.guard_definition_publication_metadata();
DROP TRIGGER IF EXISTS sitov_special_validate ON sitov_special_private.definitions;
CREATE TRIGGER sitov_special_validate BEFORE INSERT OR UPDATE ON sitov_special_private.definitions
 FOR EACH ROW EXECUTE FUNCTION sitov_special_private.validate_definition();
CREATE OR REPLACE FUNCTION sitov_special_private.staff_publication(p_publish boolean,p_node uuid,p_definition uuid,p_version text,p_source_sha text,p_base_active uuid,p_request uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE d sitov_special_private.definitions;n public.path_nodes;current_active uuid;latest uuid;payload jsonb;saved jsonb;ready boolean;data jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN sitov_special_private.error('authentication_required');END IF;
 IF NOT sitov_access_private.staff() THEN RETURN sitov_special_private.error('not_found');END IF;
 IF p_publish IS NULL OR p_node IS NULL OR p_definition IS NULL OR coalesce(p_version,'')!~'^[a-f0-9]{64}$' OR coalesce(p_source_sha,'')!~'^[a-f0-9]{64}$' OR (p_publish AND p_request IS NULL) THEN RETURN sitov_special_private.error('invalid_input');END IF;
 payload:=jsonb_build_object('nodeId',p_node,'definitionId',p_definition,'definitionVersion',p_version,'sourceSha256',p_source_sha,'baseActiveDefinitionId',p_base_active);
 IF p_publish THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('sitov-special-publication:'||auth.uid()::text||':'||p_request::text,0));
  SELECT r.payload INTO saved FROM sitov_special_private.publication_receipts r WHERE r.actor_id=auth.uid() AND r.request_id=p_request;
  IF FOUND AND saved IS DISTINCT FROM payload THEN RETURN sitov_special_private.error('request_conflict');END IF;
  SELECT * INTO n FROM public.path_nodes WHERE id=p_node FOR UPDATE;
 ELSE SELECT * INTO n FROM public.path_nodes WHERE id=p_node;END IF;
 IF n.id IS NULL OR n.kind<>'special' THEN RETURN sitov_special_private.error('not_found');END IF;
 IF p_publish THEN
  PERFORM 1 FROM public.learning_units WHERE id=n.unit_id FOR SHARE;
  PERFORM 1 FROM public.path_nodes WHERE id=n.anchor_node_id FOR SHARE;
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
  PERFORM 1 FROM auth.mfa_factors WHERE user_id=auth.uid() FOR SHARE;
  IF NOT sitov_access_private.staff() THEN RETURN sitov_special_private.error('not_found');END IF;
  SELECT * INTO d FROM sitov_special_private.definitions WHERE id=p_definition AND node_id=p_node FOR UPDATE;
 ELSE SELECT * INTO d FROM sitov_special_private.definitions WHERE id=p_definition AND node_id=p_node;END IF;
 IF d.id IS NULL THEN RETURN sitov_special_private.error('not_found');END IF;
 IF p_publish THEN
  PERFORM 1 FROM sitov_special_private.sources WHERE source_ref=d.source_ref FOR SHARE;
  PERFORM 1 FROM sitov_special_private.approvals WHERE node_id=p_node AND version=p_version FOR SHARE;
  PERFORM 1 FROM public.profiles WHERE id IN(SELECT reviewed_by FROM sitov_special_private.approvals WHERE node_id=p_node AND version=p_version) FOR SHARE;
  PERFORM 1 FROM public.learning_exercises WHERE node_id=p_node FOR SHARE;
  PERFORM 1 FROM public.grammar_translations WHERE exercise_id IN(SELECT id FROM public.learning_exercises WHERE node_id=p_node) FOR SHARE;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_units u JOIN public.path_nodes anchor ON anchor.id=n.anchor_node_id AND anchor.unit_id=u.id WHERE u.id=n.unit_id AND u.is_active AND u.is_path AND anchor.is_active)
 OR d.version IS DISTINCT FROM p_version OR d.version IS DISTINCT FROM sitov_special_private.definition_fingerprint(d.node_id,d.source_ref,d.blueprint,d.pool)
 OR NOT EXISTS(SELECT 1 FROM sitov_special_private.sources s WHERE s.source_ref=d.source_ref AND s.source_sha256=p_source_sha AND s.active AND s.level=(SELECT level FROM public.learning_units WHERE id=n.unit_id)) THEN RETURN sitov_special_private.error('version_conflict');END IF;
 SELECT definition_id INTO current_active FROM sitov_special_private.activation WHERE node_id=p_node;
 SELECT id INTO latest FROM sitov_special_private.definitions WHERE node_id=p_node ORDER BY created_at DESC,id DESC LIMIT 1;
 IF saved IS NOT NULL THEN
  IF current_active IS DISTINCT FROM d.id OR NOT d.published OR NOT n.is_active THEN RETURN sitov_special_private.error('version_conflict');END IF;
 ELSE
  IF latest IS DISTINCT FROM d.id OR current_active IS DISTINCT FROM p_base_active OR (p_publish AND d.published) THEN RETURN sitov_special_private.error('version_conflict');END IF;
 END IF;
 d.published:=true;
 ready:=EXISTS(SELECT 1 FROM sitov_special_private.authored_drafts WHERE definition_id=d.id) AND sitov_special_private.definition_ready(d);
 data:=jsonb_build_object('nodeId',p_node,'definitionId',d.id,'definitionVersion',d.version,'sourceSha256',p_source_sha,'activeDefinitionId',current_active);
 IF NOT p_publish THEN RETURN jsonb_build_object('ok',true,'data',data||jsonb_build_object('ready',ready));END IF;
 IF NOT ready THEN RETURN sitov_special_private.error('authoring_not_ready');END IF;
 IF saved IS NULL THEN
  UPDATE sitov_special_private.definitions SET published=true WHERE id=d.id;
  INSERT INTO sitov_special_private.activation(node_id,definition_id) VALUES(p_node,d.id) ON CONFLICT(node_id) DO UPDATE SET definition_id=EXCLUDED.definition_id;
  UPDATE public.path_nodes SET is_active=true WHERE id=p_node;
  INSERT INTO sitov_special_private.publication_receipts VALUES(auth.uid(),p_request,payload);
 END IF;
 RETURN jsonb_build_object('ok',true,'data',data||jsonb_build_object('activeDefinitionId',d.id,'active',true,'published',true));
EXCEPTION WHEN OTHERS THEN RETURN sitov_special_private.error('retryable_failure');
END $$;
REVOKE ALL ON FUNCTION sitov_special_private.author_audio_texts(sitov_special_private.definitions),sitov_special_private.author_audio_complete(sitov_special_private.definitions),sitov_special_private.guard_definition_publication_metadata() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION sitov_special_private.staff_publication(boolean,uuid,uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sitov_special_private.staff_publication(boolean,uuid,uuid,text,text,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.sitov_get_special_publication(p_node_id uuid,p_definition_id uuid,p_definition_version text,p_source_sha256 text,p_base_active_definition_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_special_private.staff_publication(false,p_node_id,p_definition_id,p_definition_version,p_source_sha256,p_base_active_definition_id) $$;
CREATE OR REPLACE FUNCTION public.sitov_publish_special(p_node_id uuid,p_definition_id uuid,p_definition_version text,p_source_sha256 text,p_base_active_definition_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_special_private.staff_publication(true,p_node_id,p_definition_id,p_definition_version,p_source_sha256,p_base_active_definition_id,p_request_id) $$;
REVOKE ALL ON FUNCTION public.sitov_get_special_publication(uuid,uuid,text,text,uuid),public.sitov_publish_special(uuid,uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sitov_get_special_publication(uuid,uuid,text,text,uuid),public.sitov_publish_special(uuid,uuid,text,text,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
