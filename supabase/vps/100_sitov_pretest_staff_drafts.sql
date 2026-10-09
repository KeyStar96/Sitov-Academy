-- Sitov Academy staff draft save only. No publish, approvals or audio import.
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.draft_receipts(
 actor_id uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,payload jsonb NOT NULL,response jsonb NOT NULL,
 PRIMARY KEY(actor_id,request_id));
ALTER TABLE sitov_pronunciation_private.draft_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sitov_pronunciation_private.draft_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.draft_shape(d jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE c jsonb;q jsonb;o jsonb;v jsonb;BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN('policyId','competencies','tasks','omittedCategories','reviewForms')) THEN RETURN false;END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(d->'competencies') LOOP
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(c) k WHERE k NOT IN('id','category','itemsPerAttempt','necessityDe','languageUnits','sourceSpans','mapping')) OR jsonb_typeof(c->'category') IS DISTINCT FROM 'string' OR EXISTS(SELECT 1 FROM jsonb_object_keys(c->'mapping') k WHERE k NOT IN('topicIds','pendingReasonDe')) THEN RETURN false;END IF;
 END LOOP;
 FOR q IN SELECT value FROM jsonb_array_elements(d->'tasks') LOOP
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(q) k WHERE k NOT IN('id','competencyId','kind','promptDe','fragmentDe','options','correctOptionId','assessmentUnit','equivalenceKey','sourceSpans','rationaleDe')) THEN RETURN false;END IF;
  FOR o IN SELECT value FROM jsonb_array_elements(q->'options') LOOP IF EXISTS(SELECT 1 FROM jsonb_object_keys(o) k WHERE k NOT IN('id','textDe')) THEN RETURN false;END IF;END LOOP;
 END LOOP;
 FOR v IN SELECT value FROM jsonb_array_elements(d->'competencies') UNION ALL SELECT value FROM jsonb_array_elements(d->'tasks') LOOP
  FOR o IN SELECT value FROM jsonb_array_elements(v->'sourceSpans') LOOP IF EXISTS(SELECT 1 FROM jsonb_object_keys(o) k WHERE k NOT IN('start','end','quote')) THEN RETURN false;END IF;END LOOP;
 END LOOP;
 FOR v IN SELECT value FROM jsonb_array_elements(d->'omittedCategories') LOOP IF EXISTS(SELECT 1 FROM jsonb_object_keys(v) k WHERE k NOT IN('category','reasonDe')) THEN RETURN false;END IF;END LOOP;
 FOR v IN SELECT value FROM jsonb_array_elements(d->'reviewForms') LOOP IF EXISTS(SELECT 1 FROM jsonb_object_keys(v) k WHERE k NOT IN('id','questionIds')) THEN RETURN false;END IF;END LOOP;
 RETURN true;EXCEPTION WHEN OTHERS THEN RETURN false;END $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.draft_shape(jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.save_draft(p_text uuid,p_text_version text,p_base uuid,p_definition jsonb,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE body text;latest uuid;payload jsonb;receipt record;d sitov_pronunciation_private.pretest_definitions;response jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN sitov_pronunciation_private.pretest_error('authentication_required');END IF;
 IF NOT sitov_access_private.staff() THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 IF p_text IS NULL OR p_request IS NULL OR coalesce(p_text_version,'')!~'^[a-f0-9]{64}$' OR jsonb_typeof(p_definition) IS DISTINCT FROM 'object' OR octet_length(p_definition::text)>1048576 THEN RETURN sitov_pronunciation_private.pretest_error('invalid_input');END IF;
 payload:=jsonb_build_object('textId',p_text,'textVersion',p_text_version,'baseDefinitionId',p_base,'definition',p_definition);
 PERFORM pg_advisory_xact_lock(hashtextextended('sitov-pretest-draft-request:'||auth.uid()::text||':'||p_request::text,0));
 SELECT * INTO receipt FROM sitov_pronunciation_private.draft_receipts WHERE actor_id=auth.uid() AND request_id=p_request;
 IF FOUND THEN IF receipt.payload IS DISTINCT FROM payload THEN RETURN sitov_pronunciation_private.pretest_error('request_conflict');END IF;RETURN receipt.response;END IF;
 SELECT sentence_de INTO body FROM public.learning_reading_texts WHERE id=p_text FOR UPDATE;
 IF NOT FOUND THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 IF p_text_version IS DISTINCT FROM sitov_pronunciation_private.pretest_hash(body) THEN RETURN sitov_pronunciation_private.pretest_error('version_conflict');END IF;
 SELECT id INTO latest FROM sitov_pronunciation_private.pretest_definitions WHERE text_id=p_text ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF latest IS DISTINCT FROM p_base THEN RETURN sitov_pronunciation_private.pretest_error('version_conflict');END IF;
 IF NOT sitov_pronunciation_private.draft_shape(p_definition) OR NOT sitov_pronunciation_private.valid_authoring(body,p_definition) THEN RETURN sitov_pronunciation_private.pretest_error('invalid_input');END IF;
 INSERT INTO sitov_pronunciation_private.pretest_definitions(text_id,text_version,test_version,definition,active,created_at)
 VALUES(p_text,p_text_version,sitov_pronunciation_private.pretest_hash(p_definition::text),p_definition,false,clock_timestamp())
 ON CONFLICT(text_id,text_version,test_version) DO NOTHING RETURNING * INTO d;
 IF d.id IS NULL THEN RETURN sitov_pronunciation_private.pretest_error('version_conflict');END IF;
 response:=jsonb_build_object('ok',true,'data',to_jsonb(d));
 INSERT INTO sitov_pronunciation_private.draft_receipts VALUES(auth.uid(),p_request,payload,response);
 RETURN response;
END $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.save_draft(uuid,text,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sitov_pronunciation_private.save_draft(uuid,text,uuid,jsonb,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.sitov_save_pronunciation_pretest_draft(p_text_id uuid,p_text_version text,p_base_definition_id uuid,p_definition jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT sitov_pronunciation_private.save_draft(p_text_id,p_text_version,p_base_definition_id,p_definition,p_request_id) $$;
REVOKE ALL ON FUNCTION public.sitov_save_pronunciation_pretest_draft(uuid,text,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sitov_save_pronunciation_pretest_draft(uuid,text,uuid,jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
