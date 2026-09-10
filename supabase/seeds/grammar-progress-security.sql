-- Apply through the bound project migration workflow, alongside the application.
-- No existing exercises or progress rows are removed.
CREATE SCHEMA IF NOT EXISTS grammar_private;
REVOKE ALL ON SCHEMA grammar_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA grammar_private TO authenticated;

-- Direct client writes could otherwise bypass answer checks and grant scores.
REVOKE INSERT, UPDATE, DELETE ON public.user_exercise_progress FROM anon, authenticated;
GRANT SELECT ON public.user_exercise_progress TO authenticated;

CREATE POLICY exercises_level_guard ON public.exercises AS RESTRICTIVE
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    AND (p.role IN ('teacher', 'admin') OR exercises.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[]))))
);

CREATE FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  target public.exercises;
  correct boolean;
  answer_normalized text;
  attempt_count integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_answer IS NULL OR length(btrim(p_answer)) = 0 OR length(p_answer) > 1000 THEN
    RAISE EXCEPTION 'invalid_answer' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.exercises WHERE id = p_exercise_id;
  IF NOT FOUND OR target.type NOT IN ('fill_in_blank', 'multiple_choice') THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = actor
    AND (p.role IN ('teacher','admin') OR target.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF coalesce(target.content->>'correct_answer', '') = '' THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  answer_normalized := lower(regexp_replace(btrim(p_answer), '\s+', ' ', 'g'));
  correct := answer_normalized = lower(regexp_replace(btrim(target.content->>'correct_answer'), '\s+', ' ', 'g'));

  INSERT INTO public.user_exercise_progress AS progress
    (user_id, exercise_id, attempts, completed, score, hint_shown, updated_at)
  VALUES (actor, p_exercise_id, 1, correct, CASE WHEN correct THEN 100 ELSE 0 END, coalesce(p_hint_shown,false), now())
  ON CONFLICT (user_id, exercise_id) DO UPDATE SET
    attempts = progress.attempts + 1,
    completed = coalesce(progress.completed, false) OR correct,
    hint_shown = progress.hint_shown OR coalesce(p_hint_shown, false),
    score = greatest(coalesce(progress.score, 0), CASE WHEN correct THEN
      CASE WHEN progress.attempts + 1 <= 1 THEN 100 WHEN progress.attempts + 1 = 2 THEN 80
        WHEN progress.attempts + 1 = 3 THEN 60 ELSE 40 END ELSE 0 END),
    updated_at = now()
  RETURNING attempts INTO attempt_count;
  RETURN jsonb_build_object('success', true, 'attempts', attempt_count, 'isCorrect', correct);
END;
$$;
REVOKE ALL ON FUNCTION grammar_private.record_attempt(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION grammar_private.record_attempt(uuid,text,boolean) TO authenticated;

CREATE FUNCTION public.record_grammar_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT grammar_private.record_attempt(p_exercise_id, p_answer, p_hint_shown);
$$;
REVOKE ALL ON FUNCTION public.record_grammar_attempt(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_grammar_attempt(uuid,text,boolean) TO authenticated;
