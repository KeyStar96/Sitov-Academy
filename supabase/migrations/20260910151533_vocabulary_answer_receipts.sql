BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Additive retry protocol: existing progress, RPCs and grading remain unchanged.
-- Receipts outlive lesson resets so a delayed network retry cannot grade anew.
-- They are removed only when their owning profile is deleted.
CREATE TABLE vocabulary_private.answer_receipts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  progress_id uuid NOT NULL,
  is_correct boolean,
  typed_answer text CHECK (length(typed_answer) <= 4000),
  ui_language text NOT NULL CHECK (ui_language IN ('de','en','ru','uk','tr')),
  response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
ALTER TABLE vocabulary_private.answer_receipts ENABLE ROW LEVEL SECURITY;
-- No client table grants or policies: only the owner-checked private RPC can
-- read or insert a receipt. The primary key also indexes profile deletion.
REVOKE ALL ON TABLE vocabulary_private.answer_receipts FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION vocabulary_private.submit_answer_once(
  p_request_id uuid,
  p_progress_id uuid,
  p_is_correct boolean,
  p_typed_answer text,
  p_ui_language text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid();
  receipt vocabulary_private.answer_receipts;
  result jsonb;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_progress_id IS NULL
    OR p_ui_language IS NULL OR p_ui_language NOT IN ('de','en','ru','uk','tr')
    OR length(p_typed_answer) > 4000 THEN
    RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE = '22023';
  END IF;

  -- Use the SAME first lock as submit_answer. PostgreSQL transaction advisory
  -- locks are reentrant, so its nested acquisition cannot deadlock with us.
  -- Serialize lookup + grade + receipt together, including concurrent retries.
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text, 0));
  SELECT * INTO receipt FROM vocabulary_private.answer_receipts
    WHERE user_id = actor AND request_id = p_request_id;
  IF FOUND THEN
    IF receipt.progress_id IS DISTINCT FROM p_progress_id
      OR receipt.is_correct IS DISTINCT FROM p_is_correct
      OR convert_to(receipt.typed_answer, 'UTF8') IS DISTINCT FROM convert_to(p_typed_answer, 'UTF8')
      OR receipt.ui_language IS DISTINCT FROM p_ui_language THEN
      RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE = '22023';
    END IF;
    -- Return before due/spacing checks: the first call already committed this
    -- exact answer, and a later review may have moved the persistent cursor.
    RETURN receipt.response;
  END IF;

  result := vocabulary_private.submit_answer(p_progress_id, p_is_correct, p_typed_answer, p_ui_language);
  INSERT INTO vocabulary_private.answer_receipts(
    user_id, request_id, progress_id, is_correct, typed_answer, ui_language, response
  ) VALUES (actor, p_request_id, p_progress_id, p_is_correct, p_typed_answer, p_ui_language, result);
  -- Both grading and receipt commit with this RPC; any exception rolls back both.
  RETURN result;
END;
$fn$;
REVOKE ALL ON FUNCTION vocabulary_private.submit_answer_once(uuid,uuid,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION vocabulary_private.submit_answer_once(uuid,uuid,boolean,text,text) TO authenticated;

CREATE FUNCTION public.submit_vocabulary_answer_once(
  p_request_id uuid,
  p_progress_id uuid,
  p_is_correct boolean DEFAULT NULL,
  p_typed_answer text DEFAULT NULL,
  p_ui_language text DEFAULT 'de'
)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT vocabulary_private.submit_answer_once(p_request_id, p_progress_id, p_is_correct, p_typed_answer, p_ui_language);
$fn$;
REVOKE ALL ON FUNCTION public.submit_vocabulary_answer_once(uuid,uuid,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_vocabulary_answer_once(uuid,uuid,boolean,text,text) TO authenticated;

COMMIT;
