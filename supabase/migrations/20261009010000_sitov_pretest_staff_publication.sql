-- Sitov Academy: publish only existing independently reviewed, imported proofs.
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.publication_receipts(
 actor_id uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,payload jsonb NOT NULL,
 PRIMARY KEY(actor_id,request_id));
ALTER TABLE sitov_pronunciation_private.publication_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sitov_pronunciation_private.publication_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.staff_publication_proven(d sitov_pronunciation_private.pretest_definitions)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT sitov_pronunciation_private.draft_shape(d.definition)
 AND sitov_pronunciation_private.publication_ready(d.id,d.text_id,d.text_version,d.test_version,d.definition)
 AND EXISTS(SELECT 1 FROM sitov_pronunciation_private.pretest_approvals a JOIN public.learning_reading_texts r ON r.id=d.text_id
 WHERE a.definition_id=d.id AND a.text_version=d.text_version AND a.test_version=d.test_version
 AND a.review_status='independent_approved' AND a.reviewed_at<=clock_timestamp() AND a.reference_kind='prepared_qwen'
 AND sitov_pronunciation_private.reference_valid(r.sentence_de,r.audio_url,a)) $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.staff_publication_proven(sitov_pronunciation_private.pretest_definitions) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.staff_publication(p_publish boolean,p_text uuid,p_definition uuid,p_text_version text,p_test_version text,p_base_active uuid,p_request uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE body text;latest uuid;current_active uuid;d sitov_pronunciation_private.pretest_definitions;payload jsonb;saved jsonb;ready boolean;data jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN sitov_pronunciation_private.pretest_error('authentication_required');END IF;
 IF NOT sitov_access_private.staff() THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 IF p_publish IS NULL OR p_text IS NULL OR p_definition IS NULL OR coalesce(p_text_version,'')!~'^[a-f0-9]{64}$' OR coalesce(p_test_version,'')!~'^[a-f0-9]{64}$' OR (p_publish AND p_request IS NULL) THEN RETURN sitov_pronunciation_private.pretest_error('invalid_input');END IF;
 payload:=jsonb_build_object('textId',p_text,'definitionId',p_definition,'textVersion',p_text_version,'testVersion',p_test_version,'baseActiveDefinitionId',p_base_active);
 IF p_publish THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('sitov-pretest-publication:'||auth.uid()::text||':'||p_request::text,0));
  SELECT r.payload INTO saved FROM sitov_pronunciation_private.publication_receipts r WHERE actor_id=auth.uid() AND request_id=p_request;
  IF FOUND AND saved IS DISTINCT FROM payload THEN RETURN sitov_pronunciation_private.pretest_error('request_conflict');END IF;
  SELECT sentence_de INTO body FROM public.learning_reading_texts WHERE id=p_text FOR UPDATE;
 ELSE SELECT sentence_de INTO body FROM public.learning_reading_texts WHERE id=p_text;END IF;
 IF NOT FOUND THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 IF p_publish THEN
  SELECT * INTO d FROM sitov_pronunciation_private.pretest_definitions WHERE id=p_definition AND text_id=p_text FOR UPDATE;
 ELSE SELECT * INTO d FROM sitov_pronunciation_private.pretest_definitions WHERE id=p_definition AND text_id=p_text;END IF;
 IF NOT FOUND THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 IF d.text_version IS DISTINCT FROM p_text_version OR d.test_version IS DISTINCT FROM p_test_version OR p_text_version IS DISTINCT FROM sitov_pronunciation_private.pretest_hash(body) THEN RETURN sitov_pronunciation_private.pretest_error('version_conflict');END IF;
 SELECT id INTO latest FROM sitov_pronunciation_private.pretest_definitions WHERE text_id=p_text ORDER BY created_at DESC,id DESC LIMIT 1;
 IF p_publish THEN SELECT id INTO current_active FROM sitov_pronunciation_private.pretest_definitions WHERE text_id=p_text AND active FOR UPDATE;
 ELSE SELECT id INTO current_active FROM sitov_pronunciation_private.pretest_definitions WHERE text_id=p_text AND active;END IF;
 IF saved IS NOT NULL THEN
  -- Fresh truth on retry: never return an old active acknowledgement after replacement.
  IF current_active IS DISTINCT FROM d.id THEN RETURN sitov_pronunciation_private.pretest_error('version_conflict');END IF;
 ELSE
  IF latest IS DISTINCT FROM d.id OR current_active IS DISTINCT FROM p_base_active OR d.active THEN RETURN sitov_pronunciation_private.pretest_error('version_conflict');END IF;
 END IF;
 ready:=sitov_pronunciation_private.staff_publication_proven(d);
 data:=jsonb_build_object('definitionId',d.id,'textId',d.text_id,'textVersion',d.text_version,'testVersion',d.test_version,'activeDefinitionId',current_active);
 IF NOT p_publish THEN RETURN jsonb_build_object('ok',true,'data',data||jsonb_build_object('ready',ready));END IF;
 IF NOT ready THEN RETURN sitov_pronunciation_private.pretest_error('authoring_not_ready');END IF;
 IF saved IS NULL THEN
  UPDATE sitov_pronunciation_private.pretest_definitions SET active=false WHERE id=current_active;
  UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id=d.id;
  INSERT INTO sitov_pronunciation_private.publication_receipts VALUES(auth.uid(),p_request,payload);
 END IF;
 RETURN jsonb_build_object('ok',true,'data',data||jsonb_build_object('activeDefinitionId',d.id,'active',true));
EXCEPTION WHEN OTHERS THEN RETURN sitov_pronunciation_private.pretest_error('retryable_failure');
END $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.staff_publication(boolean,uuid,uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sitov_pronunciation_private.staff_publication(boolean,uuid,uuid,text,text,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.sitov_get_pronunciation_pretest_publication(p_text_id uuid,p_definition_id uuid,p_text_version text,p_test_version text,p_base_active_definition_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_pronunciation_private.staff_publication(false,p_text_id,p_definition_id,p_text_version,p_test_version,p_base_active_definition_id) $$;
CREATE OR REPLACE FUNCTION public.sitov_publish_pronunciation_pretest(p_text_id uuid,p_definition_id uuid,p_text_version text,p_test_version text,p_base_active_definition_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_pronunciation_private.staff_publication(true,p_text_id,p_definition_id,p_text_version,p_test_version,p_base_active_definition_id,p_request_id) $$;
REVOKE ALL ON FUNCTION public.sitov_get_pronunciation_pretest_publication(uuid,uuid,text,text,uuid),public.sitov_publish_pronunciation_pretest(uuid,uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sitov_get_pronunciation_pretest_publication(uuid,uuid,text,text,uuid),public.sitov_publish_pronunciation_pretest(uuid,uuid,text,text,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
