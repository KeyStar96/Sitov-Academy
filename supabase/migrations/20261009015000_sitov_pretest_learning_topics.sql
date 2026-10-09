-- Sitov Academy: optional read-only remediation from the owned frozen result.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.learning_topics(p_attempt uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a sitov_pronunciation_private.pretest_attempts;d sitov_pronunciation_private.pretest_definitions;failed jsonb;topics jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN sitov_pronunciation_private.pretest_error('authentication_required');END IF;
 SELECT * INTO a FROM sitov_pronunciation_private.pretest_attempts WHERE id=p_attempt AND student_id=auth.uid() AND status='failed';
 IF NOT FOUND OR NOT sitov_access_private.item_allowed(auth.uid(),'reading_text',a.text_id::text) THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 SELECT * INTO d FROM sitov_pronunciation_private.pretest_definitions WHERE id=a.definition_id AND text_id=a.text_id;
 IF NOT FOUND OR a.result->>'attemptId' IS DISTINCT FROM a.id::text OR a.result->>'textId' IS DISTINCT FROM d.text_id::text OR a.result->>'textVersion' IS DISTINCT FROM d.text_version OR a.result->>'testVersion' IS DISTINCT FROM d.test_version OR a.result->'passed' IS DISTINCT FROM 'false'::jsonb THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 failed:=a.result->'failedCompetencyIds';
 IF jsonb_typeof(failed) IS DISTINCT FROM 'array' THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 SELECT coalesce(jsonb_agg(topic ORDER BY topic),'[]'::jsonb) INTO topics FROM (
  SELECT DISTINCT t #>> '{}' AS topic FROM jsonb_array_elements(d.definition->'competencies') c
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c->'mapping'->'topicIds')='array' THEN c->'mapping'->'topicIds' ELSE '[]'::jsonb END) t
  WHERE failed ? (c->>'id') AND jsonb_typeof(t)='string' AND length(t #>> '{}') BETWEEN 1 AND 160
 ) selected;
 RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('attemptId',a.id,'textId',d.text_id,'textVersion',d.text_version,'testVersion',d.test_version,'failedCompetencyIds',failed,'topicIds',topics));
EXCEPTION WHEN OTHERS THEN RETURN sitov_pronunciation_private.pretest_error('retryable_failure');
END $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.learning_topics(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sitov_pronunciation_private.learning_topics(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.sitov_get_pronunciation_pretest_learning_topics(p_attempt_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT sitov_pronunciation_private.learning_topics(p_attempt_id) $$;
REVOKE ALL ON FUNCTION public.sitov_get_pronunciation_pretest_learning_topics(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sitov_get_pronunciation_pretest_learning_topics(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
