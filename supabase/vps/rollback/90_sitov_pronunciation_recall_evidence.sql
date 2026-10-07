-- Restore the previous read-only readiness estimate without deleting learning or audit history.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.evidence(p_student uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE known integer; nodes integer; tests integer; legacy integer; topics integer; verbs integer; available_verbs integer; keys text[]; BEGIN
 IF auth.uid() IS NULL OR (auth.uid()<>p_student AND coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin'))
 THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 WITH paired AS (
  SELECT c.id,c.word_de,c.plural FROM public.vocabulary_direction_progress p
  JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id
  WHERE p.auth_user_id=p_student AND u.owner_auth_user_id IS NULL AND EXISTS(
   SELECT 1 FROM vocabulary_private.answer_receipts r WHERE r.auth_user_id=p_student AND r.progress_id=p.id
    AND nullif(btrim(r.typed_answer),'') IS NOT NULL AND r.response->>'isCorrect'='true' AND r.response ? 'correctAnswer')
  GROUP BY c.id,c.word_de,c.plural HAVING count(DISTINCT p.direction)=2 AND min(p.box_number)>=3
 ), words AS (SELECT id,unnest(sitov_pronunciation_private.content_keys(word_de||' '||coalesce(plural,''))) key FROM paired)
 SELECT (SELECT count(DISTINCT lower(btrim(word_de)))::integer FROM paired),coalesce(array_agg(DISTINCT key),'{}'::text[]) INTO known,keys FROM words;
 SELECT count(*)::integer INTO nodes FROM public.path_node_progress p JOIN public.path_nodes n ON n.id=p.node_id
 WHERE p.auth_user_id=p_student AND p.is_active AND p.status='completed' AND p.best_stars>=2 AND n.kind IN('practice','review') AND n.is_active;
 SELECT count(DISTINCT a.node_id)::integer INTO tests FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id
 WHERE a.auth_user_id=p_student AND a.is_active AND a.status='completed' AND a.passed AND n.is_active;
 SELECT count(*)::integer,count(DISTINCT coalesce(nullif(e.topic,''),e.unit_id::text))::integer INTO legacy,topics
 FROM public.user_exercise_progress p JOIN public.learning_exercises e ON e.id=p.exercise_id
 WHERE p.auth_user_id=p_student AND p.completed AND p.attempts>0 AND e.node_id IS NULL;
 SELECT count(*)::integer INTO verbs FROM public.sitov_verb_progress p
 WHERE p.auth_user_id=p_student AND p.box>=3 AND p.attempts>=3 AND p.correct::numeric/p.attempts>=0.8;
 SELECT count(*)::integer INTO available_verbs FROM public.sitov_verb_catalog c CROSS JOIN (VALUES('present'),('perfect'),('past')) t(tense)
 JOIN public.learning_levels source ON source.code=c.level
 WHERE sitov_verb_private.verb_allowed(p_student,c.id) AND EXISTS(SELECT 1 FROM public.learning_levels context
  WHERE context.sort_order>=source.sort_order AND sitov_verb_private.level_allowed(p_student,context.code)
   AND sitov_verb_private.tense_allowed(context.code,c.id,t.tense));
 RETURN jsonb_build_object('knownWords',known,'grammarNodes',nodes,'passedTests',tests,'legacyGrammarExercises',legacy,
  'legacyGrammarTopics',topics,'confidentVerbForms',verbs,'knownKeys',to_jsonb(keys),
  'verbEvidenceRequired',available_verbs>0,'availableVerbForms',available_verbs);
END $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.evidence(uuid) FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION sitov_pronunciation_private.evidence(uuid) IS
 'Previous read-only pronunciation evidence estimate; rollback preserves all learning and audit history.';
