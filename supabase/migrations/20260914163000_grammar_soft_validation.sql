-- Update existing fill_in_blank exercises to migrate 'alternative_answers' to 'accepted_answers'.
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
CREATE OR REPLACE FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  actor uuid := auth.uid();
  target public.learning_exercises;
  correct boolean;
  answer_normalized text;
  attempt_count integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_answer IS NULL OR length(btrim(p_answer)) = 0 OR length(p_answer) > 1000 THEN
    RAISE EXCEPTION 'invalid_answer' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.learning_exercises WHERE id = p_exercise_id;
  IF NOT FOUND OR target.type NOT IN ('fill_in_blank', 'multiple_choice') THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  IF NOT learning_private.unit_allowed(target.unit_id) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
  IF coalesce(target.content->>'correct_answer', '') = '' THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;

  answer_normalized := lower(regexp_replace(btrim(p_answer), '[.,?!;:()''"\s]+', '', 'g'));
  correct := answer_normalized = lower(regexp_replace(btrim(target.content->>'correct_answer'), '[.,?!;:()''"\s]+', '', 'g'));

  IF NOT correct AND target.type='fill_in_blank' AND jsonb_typeof(target.content->'accepted_answers')='array' THEN
    correct := EXISTS(SELECT 1 FROM jsonb_array_elements_text(target.content->'accepted_answers') alt
      WHERE answer_normalized=lower(regexp_replace(btrim(alt), '[.,?!;:()''"\s]+', '', 'g')));
  END IF;

  INSERT INTO public.user_exercise_progress AS progress
    (user_id, exercise_id, attempts, completed, score, hint_shown, updated_at)
  VALUES (actor, p_exercise_id, 1, correct, CASE WHEN correct THEN 100 ELSE 0 END, coalesce(p_hint_shown,false), now())
  ON CONFLICT (user_id, exercise_id) DO UPDATE SET
    attempts = progress.attempts + 1,
    completed = coalesce(progress.completed, false) OR correct,
    score = GREATEST(progress.score, CASE WHEN correct THEN 100 ELSE 0 END),
    hint_shown = progress.hint_shown OR coalesce(p_hint_shown,false),
    updated_at = now()
  RETURNING attempts INTO attempt_count;

  RETURN jsonb_build_object('success', true, 'correct', correct);
END;
$$;

-- Seed Data
DO $$
DECLARE
  v_unit_id uuid;
BEGIN
  SELECT id INTO v_unit_id FROM public.learning_units WHERE label = 'Grammatik' LIMIT 1;

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
