-- Migration to update grammar exercises JSON content for soft validation and gap_hint support.

-- Update existing fill_in_blank exercises to migrate 'alternative_answers' to 'accepted_answers'.
-- And ensure 'correct_answer' is always in the 'accepted_answers' array to simplify checking.
UPDATE public.learning_exercises
SET content = jsonb_set(
    content - 'alternative_answers',
    '{accepted_answers}',
    (
        SELECT jsonb_agg(DISTINCT elem)
        FROM jsonb_array_elements_text(
            jsonb_build_array(content->>'correct_answer') || 
            COALESCE(content->'alternative_answers', '[]'::jsonb)
        ) AS elem
    )
)
WHERE type = 'fill_in_blank';

-- Update the grammar_private.record_attempt function to correctly check accepted_answers using soft validation.
-- Instead of just strict exact match or checking 'correct_answer', we will check against the 'accepted_answers' array.
CREATE OR REPLACE FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  actor uuid := auth.uid(); target public.learning_exercises; answer_normalized text;
  correct boolean := false; answer text; diff jsonb; old_level public.learning_mastery_level;
  old_score integer; new_score integer; progress_id uuid; attempts integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO target FROM public.learning_exercises WHERE id = p_exercise_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'exercise_not_found' USING ERRCODE = 'PT409'; END IF;
  IF NOT learning_private.unit_allowed(target.unit_id) THEN
    RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE = '42501';
  END IF;
  
  -- Soft validation normalization logic: Lowercase, remove whitespace and punctuation.
  answer_normalized := lower(regexp_replace(btrim(p_answer), '[.,?!;:()''"\s]+', '', 'g'));
  
  IF target.type = 'fill_in_blank' THEN
    -- Check against the new accepted_answers array if it exists.
    IF target.content ? 'accepted_answers' THEN
      SELECT bool_or(lower(regexp_replace(btrim(ans), '[.,?!;:()''"\s]+', '', 'g')) = answer_normalized)
      INTO correct
      FROM jsonb_array_elements_text(target.content->'accepted_answers') ans;
    ELSE
      -- Fallback if migration hasn't reached it or if legacy
      correct := lower(regexp_replace(btrim(target.content->>'correct_answer'), '[.,?!;:()''"\s]+', '', 'g')) = answer_normalized;
    END IF;
  ELSE
    -- Multiple choice just matches exactly.
    correct := lower(regexp_replace(btrim(target.content->>'correct_answer'), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(p_answer), '\s+', ' ', 'g'));
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('grammar_progress:' || actor::text, 0));
  SELECT id, mastery_level, score, attempts_count INTO progress_id, old_level, old_score, attempts
  FROM public.user_exercise_progress WHERE user_id = actor AND exercise_id = p_exercise_id FOR UPDATE;
  
  IF progress_id IS NULL THEN
    old_level := 'unseen'; old_score := 0; attempts := 0;
    INSERT INTO public.user_exercise_progress (user_id, exercise_id, unit_id, topic, mastery_level, score, attempts_count, next_review_at)
    VALUES (actor, p_exercise_id, target.unit_id, target.topic, 'struggling', 0, 0, now())
    RETURNING id INTO progress_id;
  END IF;

  diff := grammar_private.calculate_score(old_level, old_score, correct, p_hint_shown);
  new_score := (diff->>'score')::integer;
  
  UPDATE public.user_exercise_progress SET
    mastery_level = (diff->>'level')::public.learning_mastery_level,
    score = new_score,
    attempts_count = attempts + 1,
    last_attempt_at = now(),
    next_review_at = grammar_private.next_interval(
      (diff->>'level')::public.learning_mastery_level,
      old_level = (diff->>'level')::public.learning_mastery_level,
      attempts
    )
  WHERE id = progress_id;
  
  INSERT INTO grammar_private.attempt_receipts (progress_id, user_id, exercise_id, answer_given, is_correct, hint_used, previous_level, new_level)
  VALUES (progress_id, actor, p_exercise_id, p_answer, correct, p_hint_shown, old_level, (diff->>'level')::public.learning_mastery_level);
  
  RETURN jsonb_build_object(
    'is_correct', correct,
    'new_level', diff->>'level',
    'score_change', new_score - old_score,
    'current_score', new_score
  );
END;
$$;

-- Seed Data: Insert new fill_in_blank grammar exercise with gap_hint and extensive accepted_answers
DO $$
DECLARE
  v_unit_id uuid;
BEGIN
  -- Get an existing unit_id from A1.1 grammar (assuming course structure)
  SELECT id INTO v_unit_id FROM public.learning_units WHERE topic = 'Grammatik' LIMIT 1;

  IF v_unit_id IS NOT NULL THEN
    INSERT INTO public.learning_exercises (id, unit_id, topic, type, content, content_version)
    VALUES (
      gen_random_uuid(),
      v_unit_id,
      'Satzbau Übung',
      'fill_in_blank',
      '{
        "text_before": "Sie sagt, dass ",
        "text_after": ".",
        "correct_answer": "sie morgen arbeiten muss",
        "accepted_answers": ["sie morgen arbeiten muss", "sie morgen arbeiten gehen muss", "Sie morgen arbeiten muss"],
        "gap_hint": "(morgen / arbeiten / müssen)",
        "instruction": "Bilde den korrekten Nebensatz."
      }'::jsonb,
      1
    );

    INSERT INTO public.learning_exercises (id, unit_id, topic, type, content, content_version)
    VALUES (
      gen_random_uuid(),
      v_unit_id,
      'Formelle Anrede',
      'fill_in_blank',
      '{
        "text_before": "Entschuldigung, ",
        "text_after": "?",
        "correct_answer": "Wie heißen Sie",
        "accepted_answers": ["Wie heißen Sie", "Wie ist Ihr Name", "wie heißen Sie", "wie heissen Sie", "Wie heissen Sie", "Wie heissen sie", "wie heißen sie"],
        "gap_hint": "(Wie / heißen / Sie)",
        "instruction": "Frage nach dem Namen der Person."
      }'::jsonb,
      1
    );
  END IF;
END $$;
