-- Sitov Academy: leaving today's journey is navigation, not abandonment.
-- Restore current-day assignments made unavailable by the previous skip action.
-- Historical assignments and earned streaks remain intact; verified steps survive.
UPDATE public.daily_quest_assignments
SET status='active', skipped_at=NULL
WHERE status='skipped' AND quest_date>=daily_quest_private.today();

CREATE OR REPLACE FUNCTION daily_quest_private.handle(p_action text,p_assignment_id uuid DEFAULT NULL,p_step_id text DEFAULT NULL,p_answer jsonb DEFAULT NULL,p_enabled boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); profile public.profiles%ROWTYPE; assignment public.daily_quest_assignments%ROWTYPE;
 assigned uuid; today date:=daily_quest_private.today(); changed integer; keys jsonb; step jsonb; step_index integer; correct boolean:=false;
 ids jsonb; feedback text; claim boolean:=false;
BEGIN
 IF actor IS NULL THEN RETURN daily_quest_private.error('not_authenticated'); END IF;
 IF p_action IS NULL OR p_action NOT IN('claim','get','status','preference','submit','skip','complete') THEN RETURN daily_quest_private.error('invalid_input'); END IF;
 SELECT p.* INTO profile FROM public.profiles p WHERE p.id=actor FOR UPDATE;
 IF profile.id IS NULL OR profile.role::text IS DISTINCT FROM 'student' THEN RETURN daily_quest_private.error('not_authorized'); END IF;
 IF p_action='preference' THEN
  IF p_enabled IS NULL THEN RETURN daily_quest_private.error('invalid_input'); END IF;
  UPDATE public.profiles SET daily_quests_enabled=p_enabled WHERE id=actor; profile.daily_quests_enabled:=p_enabled;
 END IF;
 IF p_action IN('status','preference') THEN
  SELECT a.* INTO assignment FROM public.daily_quest_assignments a WHERE a.auth_user_id=actor AND a.quest_date=today;
  RETURN jsonb_build_object('success',true,'enabled',profile.daily_quests_enabled,'streak',daily_quest_private.streak(actor),
   'today',CASE WHEN assignment.id IS NULL THEN NULL ELSE jsonb_build_object('assignmentId',assignment.id,'status',assignment.status) END);
 END IF;
 IF p_action IN('get','claim') THEN
  IF profile.daily_quests_enabled THEN assigned:=daily_quest_private.ensure_assignment(actor); END IF;
  IF p_action='get' THEN RETURN jsonb_build_object('success',true,'enabled',profile.daily_quests_enabled,
   'quest',daily_quest_private.quest(assigned),'streak',daily_quest_private.streak(actor)); END IF;
  IF assigned IS NOT NULL THEN
   INSERT INTO daily_quest_private.login_claims(auth_user_id,quest_date) VALUES(actor,today) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS changed=ROW_COUNT;
   SELECT a.status='active' INTO claim FROM public.daily_quest_assignments a WHERE a.id=assigned;
   claim:=changed=1 AND claim;
  END IF;
  RETURN jsonb_build_object('success',true,'enabled',profile.daily_quests_enabled,'shouldRedirect',claim,'assignmentId',assigned,'date',today);
 END IF;
 IF NOT profile.daily_quests_enabled THEN RETURN daily_quest_private.error('disabled'); END IF;
 SELECT a.* INTO assignment FROM public.daily_quest_assignments a WHERE a.id=p_assignment_id AND a.auth_user_id=actor FOR UPDATE;
 IF assignment.id IS NULL THEN RETURN daily_quest_private.error('not_found'); END IF;
 IF assignment.quest_date<>today THEN RETURN daily_quest_private.error('expired'); END IF;
 IF p_action='complete' AND assignment.status='completed' THEN
  RETURN jsonb_build_object('success',true,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
 END IF;
 -- Compatibility for older clients: leaving does not change progress or status.
 IF p_action='skip' THEN
  RETURN jsonb_build_object('success',true,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
 END IF;
 IF assignment.status<>'active' THEN RETURN daily_quest_private.error('not_active'); END IF;
 PERFORM learning_reset_private.assert_writable(actor);
 IF p_action='complete' THEN
  IF assignment.completed_step_ids<>ARRAY(SELECT e.value->>'id' FROM jsonb_array_elements(assignment.snapshot->'steps') WITH ORDINALITY e(value,ordinality) ORDER BY e.ordinality) THEN RETURN daily_quest_private.error('steps_incomplete'); END IF;
  UPDATE public.daily_quest_assignments SET status='completed',completed_at=now() WHERE id=assignment.id;
  -- Only one increase per server day, even if an operational retry is replayed.
  IF profile.daily_quest_last_completed_date IS DISTINCT FROM today THEN
   changed:=CASE WHEN profile.daily_quest_last_completed_date=today-1 THEN profile.daily_quest_streak+1 ELSE 1 END;
   UPDATE public.profiles SET daily_quest_streak=changed,daily_quest_longest_streak=greatest(daily_quest_longest_streak,changed),daily_quest_last_completed_date=today WHERE id=actor;
  END IF;
 ELSIF p_action='submit' THEN
  IF p_step_id IS NULL OR jsonb_typeof(p_answer) IS DISTINCT FROM 'object' OR octet_length(p_answer::text)>8000 THEN RETURN daily_quest_private.error('invalid_input'); END IF;
  SELECT e.value,(e.ordinality-1)::integer INTO step,step_index FROM jsonb_array_elements(assignment.snapshot->'steps') WITH ORDINALITY e(value,ordinality) WHERE e.value->>'id'=p_step_id;
  IF step IS NULL THEN RETURN daily_quest_private.error('invalid_input'); END IF;
  IF NOT p_step_id=ANY(assignment.completed_step_ids) AND step_index<>cardinality(assignment.completed_step_ids) THEN RETURN daily_quest_private.error('step_out_of_order'); END IF;
  SELECT k.answer_key INTO keys FROM daily_quest_private.assignment_keys k WHERE k.assignment_id=assignment.id;
  CASE step->>'kind'
   WHEN 'discover' THEN
    ids:=p_answer->'wordIds';
    IF jsonb_typeof(ids) IS DISTINCT FROM 'array' THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    IF jsonb_array_length(ids)<>jsonb_array_length(step->'words') OR (p_answer-'wordIds')<>'{}'::jsonb THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    SELECT coalesce(jsonb_agg(e.value ORDER BY e.value),'[]')=(SELECT jsonb_agg(w.value->'id' ORDER BY w.value->'id') FROM jsonb_array_elements(step->'words') w(value)) INTO correct FROM jsonb_array_elements(ids) e(value);
   WHEN 'sentence_build' THEN
    ids:=p_answer->'pieceIds';
    IF jsonb_typeof(ids) IS DISTINCT FROM 'array' THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    IF jsonb_array_length(ids)>30 OR (p_answer-'pieceIds')<>'{}'::jsonb THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(keys->'steps'->p_step_id->'accepted') accepted WHERE accepted=ids) INTO correct;
   WHEN 'dialogue_choice' THEN
    IF jsonb_typeof(p_answer->'optionId') IS DISTINCT FROM 'string' OR (p_answer-'optionId')<>'{}'::jsonb THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    correct:=coalesce(p_answer->>'optionId'=keys->'steps'->p_step_id->>'optionId',false);
   ELSE RETURN daily_quest_private.error('invalid_input');
  END CASE;
  IF correct AND NOT p_step_id=ANY(assignment.completed_step_ids) THEN
   UPDATE public.daily_quest_assignments SET completed_step_ids=array_append(completed_step_ids,p_step_id) WHERE id=assignment.id;
  END IF;
  feedback:=CASE WHEN correct THEN coalesce(keys->'feedback'->p_step_id->>'correct','Gut gemacht!') ELSE coalesce(keys->'feedback'->p_step_id->>'wrong','Versuche es noch einmal.') END;
  RETURN jsonb_build_object('success',true,'correct',correct,'feedback',feedback,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
 END IF;
 RETURN jsonb_build_object('success',true,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
END $$;


NOTIFY pgrst,'reload schema';
