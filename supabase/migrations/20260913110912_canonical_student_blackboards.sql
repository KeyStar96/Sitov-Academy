-- Add one stable central board per student without deleting the previous notes.
-- Apply before deploying the note-only save action. Existing staff RLS/CRUD stays intact.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.teacher_student_notes
  ADD COLUMN is_blackboard boolean NOT NULL DEFAULT false;

-- Keep exactly the note selected by the previous min-id reader visible today.
WITH canonical AS (
  SELECT DISTINCT ON (student_id) id
  FROM public.teacher_student_notes
  ORDER BY student_id, id
)
UPDATE public.teacher_student_notes note
SET is_blackboard = true
FROM canonical
WHERE note.id = canonical.id;

CREATE UNIQUE INDEX teacher_student_notes_one_blackboard_idx
  ON public.teacher_student_notes(student_id) WHERE is_blackboard;

COMMENT ON COLUMN public.teacher_student_notes.is_blackboard IS
  'Stable central student board. Other rows retain legacy notes and discounts.';

CREATE FUNCTION public.save_student_blackboard(
  p_student_id uuid,
  p_note_text text,
  p_expected_note_id uuid DEFAULT NULL
)
RETURNS SETOF public.teacher_student_notes
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  board public.teacher_student_notes%ROWTYPE;
  prose text;
BEGIN
  IF actor IS NULL OR coalesce(monthly_booking_private.current_profile_role(), '')
    NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_note_text IS NULL OR char_length(p_note_text) > 5000
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_student_id) THEN
    RAISE EXCEPTION 'Invalid student or note' USING ERRCODE = '23514';
  END IF;
  prose := btrim(p_note_text);

  -- This lock also covers the first save, when there is no row to lock yet.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('student-blackboard:' || p_student_id::text, 0)
  );
  SELECT * INTO board FROM public.teacher_student_notes
  WHERE student_id = p_student_id
  ORDER BY is_blackboard DESC, id
  LIMIT 1 FOR UPDATE;

  -- A stale/foreign note ID must never update another student's note or silently
  -- switch the central board. Null IDs from simultaneous first saves are safe.
  IF p_expected_note_id IS NOT NULL AND p_expected_note_id IS DISTINCT FROM board.id THEN
    RAISE EXCEPTION 'The central note changed; reload and retry' USING ERRCODE = '40001';
  END IF;
  IF board.id IS NULL THEN
    IF prose = '' THEN RETURN; END IF;
    RETURN QUERY INSERT INTO public.teacher_student_notes
      (student_id, teacher_id, note_text, is_blackboard)
      VALUES (p_student_id, actor, prose, true)
      RETURNING *;
  ELSE
    -- Clearing retains the canonical identity, so an older note cannot reappear.
    -- Discount metadata and the original author are never changed by this RPC.
    RETURN QUERY UPDATE public.teacher_student_notes
      SET note_text = CASE WHEN prose = '' THEN U&'\2060' ELSE prose END,
          is_blackboard = true
      WHERE id = board.id AND student_id = p_student_id
      RETURNING *;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.save_student_blackboard(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_student_blackboard(uuid, text, uuid) TO authenticated;
COMMIT;
