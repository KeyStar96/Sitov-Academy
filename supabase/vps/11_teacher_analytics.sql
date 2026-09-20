-- Phase 5.5: additive, staff-only detail overload of the Phase 4 aggregate.
-- The existing no-argument RPC and its percentage response remain unchanged.
-- Back up via migrate-local.py --backup-only before applying on the VPS.
CREATE OR REPLACE FUNCTION public.get_all_students_progress_data(p_student_id uuid, p_course_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
 selected_level text;
 percentages jsonb;
 distribution jsonb;
 history jsonb;
 today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
 IF NOT business_private.is_staff() THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.');
 END IF;
 IF p_student_id IS NULL THEN
  RETURN jsonb_build_object('error','invalid_input','message','A student is required.');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student') THEN
  RETURN jsonb_build_object('error','not_found','message','Student not found.');
 END IF;
 IF p_course_id IS NOT NULL THEN
  SELECT level INTO selected_level FROM public.courses WHERE id=p_course_id;
  IF NOT FOUND THEN
   RETURN jsonb_build_object('error','not_found','message','Course not found.');
  END IF;
 END IF;
 percentages := public.get_all_students_progress_data();
 IF percentages ? 'error' THEN RETURN percentages; END IF;

 -- A word is learned only when both directions reached box 7. Incomplete
 -- direction pairs retain their lowest active phase, as in the student UI.
 WITH cards AS (
  SELECT c.id, CASE WHEN count(p.id)=0 THEN NULL
   WHEN count(p.id)=2 AND bool_and(p.box_number=7) THEN 7
   ELSE least(6,min(p.box_number)) END AS phase
  FROM public.learning_vocabulary_cards c
  JOIN public.learning_units u ON u.id=c.unit_id
  LEFT JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=p_student_id
  WHERE p_course_id IS NULL OR u.level=selected_level
  GROUP BY c.id
 ), buckets AS (
  SELECT phase_number, count(c.id) AS count
  FROM generate_series(1,7) phase_number LEFT JOIN cards c ON c.phase=phase_number
  GROUP BY phase_number
 ) SELECT jsonb_build_object(
  'buckets',(SELECT jsonb_agg(jsonb_build_object('key',CASE WHEN phase_number=7 THEN to_jsonb('learned'::text) ELSE to_jsonb(phase_number) END,'count',count) ORDER BY phase_number) FROM buckets),
  'totalCards',count(*),'totalInBox',count(phase),
  'overallPercent',CASE WHEN count(*)=0 THEN 0 ELSE round(coalesce(sum(phase),0)::numeric/(count(*)*7)*100) END
 ) INTO distribution FROM cards;

 -- Receipts are actual persisted answer events; never infer old phases from
 -- updated_at or generate synthetic progress snapshots. Grade from response,
 -- not the obsolete, client-supplied is_correct receipt field (R5).
 WITH days AS (SELECT today-29+n AS day FROM generate_series(0,29) n),
 events AS (
  SELECT (r.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,
   count(*) AS answers, count(*) FILTER(WHERE r.response->>'isCorrect'='true') AS correct
  FROM vocabulary_private.answer_receipts r
  JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=r.auth_user_id
  JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
  JOIN public.learning_units u ON u.id=c.unit_id
  WHERE r.auth_user_id=p_student_id
   AND r.created_at>=((today-29)::timestamp AT TIME ZONE 'Europe/Berlin')
   AND r.created_at<((today+1)::timestamp AT TIME ZONE 'Europe/Berlin')
   AND (p_course_id IS NULL OR u.level=selected_level)
  GROUP BY (r.created_at AT TIME ZONE 'Europe/Berlin')::date
 ) SELECT jsonb_agg(jsonb_build_object('date',d.day,'answers',coalesce(e.answers,0),'correct',coalesce(e.correct,0)) ORDER BY d.day)
 INTO history FROM days d LEFT JOIN events e USING(day);

 RETURN jsonb_build_object('studentId',p_student_id,'courseId',p_course_id,'level',selected_level,
  'completionByLevel',coalesce(percentages->p_student_id::text,'{}'::jsonb),
  'distribution',distribution,'history',history,'timezone','Europe/Berlin');
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','Learning analytics could not be loaded.','sqlstate',SQLSTATE);
END $$;
REVOKE EXECUTE ON FUNCTION public.get_all_students_progress_data(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_all_students_progress_data(uuid,uuid) TO authenticated;

-- Rollback: deploy the previous application, then execute:
-- DROP FUNCTION IF EXISTS public.get_all_students_progress_data(uuid,uuid);
-- The no-argument Phase 4 aggregate, learner state and receipts remain intact.
