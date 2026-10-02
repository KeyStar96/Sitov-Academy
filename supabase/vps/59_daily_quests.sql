-- Sitov Academy daily quests. Additive, repeatable migration; no course grants
-- or existing learning progress is changed. Apply after 58 with the VPS runner.
-- There are six authored starter scenes, not a generated curriculum catalogue.
-- Rollback disables RPCs while retaining assignments, preferences and streaks.
CREATE SCHEMA IF NOT EXISTS daily_quest_private;
REVOKE ALL ON SCHEMA daily_quest_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA daily_quest_private TO authenticated,service_role;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_quests_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_quest_streak integer NOT NULL DEFAULT 0 CHECK(daily_quest_streak>=0);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_quest_longest_streak integer NOT NULL DEFAULT 0 CHECK(daily_quest_longest_streak>=daily_quest_streak);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_quest_last_completed_date date;
-- A table-level UPDATE would override column ACLs. Restore the known preferences
-- explicitly; even a direct REST update cannot forge a quest streak or role.
REVOKE UPDATE ON public.profiles FROM anon,authenticated;
REVOKE UPDATE(daily_quests_enabled,daily_quest_streak,daily_quest_longest_streak,daily_quest_last_completed_date) ON public.profiles FROM anon,authenticated;
GRANT UPDATE(native_language,ui_language,notify_pronunciation_feedback,notify_new_content,notify_learning_reminders) ON public.profiles TO authenticated;

CREATE TABLE IF NOT EXISTS public.daily_quests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 template_key text NOT NULL UNIQUE CHECK(length(template_key) BETWEEN 1 AND 120),
 level public.cefr_code NOT NULL REFERENCES public.cefr_levels(code),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 category text NOT NULL CHECK(category ~ '^[a-z0-9_-]{1,80}$'),
 fallback_word_de text NOT NULL DEFAULT 'Brötchen' CHECK(length(fallback_word_de) BETWEEN 1 AND 160),
 fallback_article text NOT NULL DEFAULT 'das' CHECK(fallback_article IN('der','die','das')),
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS daily_quests_active_level_idx ON public.daily_quests(level,template_key) WHERE is_active;
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sitov_daily_quests_read ON public.daily_quests;
CREATE POLICY sitov_daily_quests_read ON public.daily_quests FOR SELECT TO authenticated USING(is_active);
REVOKE ALL ON public.daily_quests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.daily_quests TO authenticated;
GRANT ALL ON public.daily_quests TO service_role;

CREATE TABLE IF NOT EXISTS daily_quest_private.template_keys(
 template_id uuid PRIMARY KEY REFERENCES public.daily_quests(id) ON DELETE CASCADE,
 answer_key jsonb NOT NULL CHECK(jsonb_typeof(answer_key)='object'));
-- Editorially reviewed German forms. Words not in this lexicon use the scene's
-- fallback; raw card labels are never blindly inserted after an article/verb.
CREATE TABLE IF NOT EXISTS daily_quest_private.slot_forms(
 category text NOT NULL,word_de text NOT NULL,article text NOT NULL CHECK(article IN('der','die','das')),
 nominative text NOT NULL,accusative text NOT NULL,
 PRIMARY KEY(category,word_de,article));
CREATE TABLE IF NOT EXISTS public.daily_quest_assignments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 quest_date date NOT NULL,
 template_id uuid REFERENCES public.daily_quests(id) ON DELETE SET NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 status text NOT NULL DEFAULT 'active' CHECK(status IN('active','completed','skipped')),
 completed_step_ids text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,skipped_at timestamptz,
 UNIQUE(auth_user_id,quest_date),
 CHECK((status='completed')=(completed_at IS NOT NULL)),CHECK((status='skipped')=(skipped_at IS NOT NULL)));
ALTER TABLE public.daily_quest_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sitov_daily_quest_assignment_read ON public.daily_quest_assignments;
CREATE POLICY sitov_daily_quest_assignment_read ON public.daily_quest_assignments FOR SELECT TO authenticated USING(auth_user_id=(SELECT auth.uid()));
REVOKE ALL ON public.daily_quest_assignments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.daily_quest_assignments TO authenticated;
GRANT ALL ON public.daily_quest_assignments TO service_role;
CREATE TABLE IF NOT EXISTS daily_quest_private.assignment_keys(
 assignment_id uuid PRIMARY KEY REFERENCES public.daily_quest_assignments(id) ON DELETE CASCADE,
 answer_key jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS daily_quest_private.login_claims(
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 quest_date date NOT NULL,claimed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(auth_user_id,quest_date));
REVOKE ALL ON ALL TABLES IN SCHEMA daily_quest_private FROM PUBLIC,anon,authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA daily_quest_private TO service_role;

CREATE OR REPLACE FUNCTION daily_quest_private.today() RETURNS date LANGUAGE sql STABLE SET search_path TO '' AS $$
 SELECT (now() AT TIME ZONE 'Europe/Berlin')::date
$$;
CREATE OR REPLACE FUNCTION daily_quest_private.error(p_error text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
 SELECT jsonb_build_object('success',false,'error',p_error,'message',CASE p_error
 WHEN 'not_authenticated' THEN 'Bitte melde dich an.' WHEN 'not_authorized' THEN 'Diese Funktion ist für Schüler verfügbar.'
 WHEN 'disabled' THEN 'Die tägliche Deutschreise ist deaktiviert.' WHEN 'not_found' THEN 'Die Deutschreise ist nicht verfügbar.'
 WHEN 'expired' THEN 'Diese Deutschreise gehört zu einem anderen Tag.' WHEN 'steps_incomplete' THEN 'Schließe zuerst die drei Schritte ab.'
 WHEN 'step_out_of_order' THEN 'Schließe zuerst den vorherigen Schritt ab.' WHEN 'not_active' THEN 'Diese Deutschreise wurde bereits beendet.'
 WHEN 'no_template' THEN 'Heute ist keine passende Deutschreise verfügbar.' ELSE 'Die Anfrage ist ungültig.' END)
$$;
CREATE OR REPLACE FUNCTION daily_quest_private.streak(p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path TO '' AS $$
 SELECT jsonb_build_object('current',CASE WHEN p.daily_quest_last_completed_date>=daily_quest_private.today()-1 THEN p.daily_quest_streak ELSE 0 END,
  'longest',p.daily_quest_longest_streak,'lastCompletedDate',p.daily_quest_last_completed_date)
 FROM public.profiles p WHERE p.id=p_user
$$;
CREATE OR REPLACE FUNCTION daily_quest_private.quest(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path TO '' AS $$
 SELECT a.snapshot || jsonb_build_object('id',a.id,'date',a.quest_date,'status',a.status,'completedStepIds',to_jsonb(a.completed_step_ids))
 FROM public.daily_quest_assignments a WHERE a.id=p_id
$$;
CREATE OR REPLACE FUNCTION daily_quest_private.target_level(p_user uuid) RETURNS public.cefr_code
LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE levels constant text[]:=ARRAY['A1','A2','B1','B2','C1','C2']; base integer:=1; mastered integer:=0; chosen text; activity jsonb;
BEGIN
 activity:=public.get_last_active_level();
 SELECT coalesce(array_position(levels,l.cefr_level::text),1) INTO base FROM public.learning_levels l WHERE l.code=activity->>'level';
 base:=coalesce(base,1);
 -- Both real sublevels must have a published test. Empty/incomplete catalogues
 -- never imply mastery, and one good test cannot stand in for every other test.
 SELECT coalesce(max(array_position(levels,c.code::text)),0) INTO mastered FROM public.cefr_levels c
 WHERE NOT EXISTS(SELECT 1 FROM unnest(ARRAY[c.code::text||'.1',c.code::text||'.2']) part(code)
  WHERE NOT EXISTS(SELECT 1 FROM public.learning_levels l JOIN public.learning_units u ON u.level=l.code AND u.is_path AND u.is_active
    JOIN public.path_nodes n ON n.unit_id=u.id AND n.kind='test' AND n.is_active
    WHERE l.code=part.code AND l.cefr_level=c.code AND l.is_active)
   OR NOT EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p_user AND a.level=part.code))
 AND NOT EXISTS(SELECT 1 FROM public.learning_levels l JOIN public.learning_units u ON u.level=l.code AND u.is_path AND u.is_active
  JOIN public.path_nodes n ON n.unit_id=u.id AND n.kind='test' AND n.is_active
  WHERE l.cefr_level=c.code AND l.is_active AND NOT EXISTS(SELECT 1 FROM public.path_test_attempts a
   WHERE a.auth_user_id=p_user AND a.node_id=n.id AND a.status='completed' AND a.is_active AND a.percentage>=80));
 SELECT q.level::text INTO chosen FROM public.daily_quests q JOIN daily_quest_private.template_keys k ON k.template_id=q.id
 WHERE q.is_active AND array_position(levels,q.level::text)<=least(6,greatest(base,mastered+1))
 ORDER BY array_position(levels,q.level::text) DESC,q.template_key LIMIT 1;
 RETURN chosen::public.cefr_code;
END $$;

-- Recursive substitution preserves JSON types and safely escapes German text.
-- Only editorial placeholders are substituted; no SQL/HTML is constructed.
CREATE OR REPLACE FUNCTION daily_quest_private.render(p_value jsonb,p_nominative text,p_accusative text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $$
DECLARE rendered jsonb; entry record; raw text;
BEGIN
 CASE jsonb_typeof(p_value)
 WHEN 'object' THEN SELECT coalesce(jsonb_object_agg(e.key,daily_quest_private.render(e.value,p_nominative,p_accusative)),'{}') INTO rendered FROM jsonb_each(p_value) e;
 WHEN 'array' THEN SELECT coalesce(jsonb_agg(daily_quest_private.render(e.value,p_nominative,p_accusative) ORDER BY e.ordinality),'[]') INTO rendered FROM jsonb_array_elements(p_value) WITH ORDINALITY e(value,ordinality);
 WHEN 'string' THEN raw:=p_value#>>'{}'; rendered:=to_jsonb(replace(replace(raw,'{{nominative}}',p_nominative),'{{accusative}}',p_accusative));
 ELSE rendered:=p_value;
 END CASE;
 RETURN rendered;
END $$;

CREATE OR REPLACE FUNCTION daily_quest_private.ensure_assignment(p_user uuid) RETURNS uuid
LANGUAGE plpgsql VOLATILE SET search_path TO '' AS $$
DECLARE assigned uuid; template public.daily_quests%ROWTYPE; lexeme daily_quest_private.slot_forms%ROWTYPE;
 card uuid; source text:='fallback'; payload jsonb; keys jsonb; target public.cefr_code;
BEGIN
 SELECT a.id INTO assigned FROM public.daily_quest_assignments a WHERE a.auth_user_id=p_user AND a.quest_date=daily_quest_private.today();
 IF assigned IS NOT NULL THEN RETURN assigned; END IF;
 target:=daily_quest_private.target_level(p_user);
 -- Stable day-based rotation over actual published templates; snapshots ensure
 -- later content edits and changed word boxes cannot change an assigned quest.
 SELECT q.* INTO template FROM public.daily_quests q JOIN daily_quest_private.template_keys k ON k.template_id=q.id
 WHERE q.is_active AND q.level=target ORDER BY md5(q.template_key||daily_quest_private.today()::text),q.id LIMIT 1;
 IF template.id IS NULL THEN RETURN NULL; END IF;
 SELECT sf.*,c.id,CASE WHEN bool_or(p.box_number=1) THEN 'box1' ELSE 'recent_wrong' END
 INTO lexeme.category,lexeme.word_de,lexeme.article,lexeme.nominative,lexeme.accusative,card,source
 FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active
 JOIN daily_quest_private.slot_forms sf ON sf.category=template.category AND sf.word_de=c.word_de AND sf.article=c.article::text
 JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=p_user
 LEFT JOIN public.vocabulary_focus_words f ON f.card_id=c.id AND f.auth_user_id=p_user
 WHERE learning_private.unit_allowed(u.id) AND (f.last_error_at>=now()-interval '30 days'
  OR (p.lapses>0 AND p.last_answered_at>=now()-interval '30 days')
  OR EXISTS(SELECT 1 FROM vocabulary_private.answer_receipts r WHERE r.auth_user_id=p_user AND r.progress_id=p.id
   AND r.is_correct=false AND r.created_at>=now()-interval '30 days'))
 GROUP BY sf.category,sf.word_de,sf.article,sf.nominative,sf.accusative,c.id
 ORDER BY bool_or(p.box_number=1) DESC,max(greatest(p.last_answered_at,f.last_error_at)) DESC NULLS LAST,c.id LIMIT 1;
 IF card IS NULL THEN SELECT sf.* INTO lexeme FROM daily_quest_private.slot_forms sf WHERE sf.category=template.category AND sf.word_de=template.fallback_word_de AND sf.article=template.fallback_article; source:='fallback'; END IF;
 IF lexeme.word_de IS NULL THEN RETURN NULL; END IF;
 payload:=daily_quest_private.render(template.content,lexeme.nominative,lexeme.accusative)
  || jsonb_build_object('level',template.level,'templateKey',template.template_key,'personalization',jsonb_build_object('source',source,'cardId',card));
 SELECT k.answer_key INTO keys FROM daily_quest_private.template_keys k WHERE k.template_id=template.id;
 INSERT INTO public.daily_quest_assignments(auth_user_id,quest_date,template_id,snapshot)
 VALUES(p_user,daily_quest_private.today(),template.id,payload) RETURNING id INTO assigned;
 INSERT INTO daily_quest_private.assignment_keys(assignment_id,answer_key) VALUES(assigned,keys);
 RETURN assigned;
END $$;

-- The only client-callable private definer. Profile first, assignment second is
-- the lock order for every mutation, including opt-out, claim and completion.
-- The unique (user, Berlin day) keys also protect against racing browser tabs.
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
 IF p_action='skip' AND assignment.status='skipped' THEN
  RETURN jsonb_build_object('success',true,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
 END IF;
 IF assignment.status<>'active' THEN RETURN daily_quest_private.error('not_active'); END IF;
 PERFORM learning_reset_private.assert_writable(actor);
 IF p_action='skip' THEN
  UPDATE public.daily_quest_assignments SET status='skipped',skipped_at=now() WHERE id=assignment.id;
 ELSIF p_action='complete' THEN
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

CREATE OR REPLACE FUNCTION public.claim_daily_quest_login() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('claim') $$;
CREATE OR REPLACE FUNCTION public.get_daily_quest() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('get') $$;
CREATE OR REPLACE FUNCTION public.get_daily_quest_status() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('status') $$;
CREATE OR REPLACE FUNCTION public.set_daily_quest_enabled(p_enabled boolean) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('preference',p_enabled=>p_enabled) $$;
CREATE OR REPLACE FUNCTION public.submit_daily_quest_step(p_assignment_id uuid,p_step_id text,p_answer jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('submit',p_assignment_id,p_step_id,p_answer) $$;
CREATE OR REPLACE FUNCTION public.skip_daily_quest(p_assignment_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('skip',p_assignment_id) $$;
CREATE OR REPLACE FUNCTION public.complete_daily_quest(p_assignment_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('complete',p_assignment_id) $$;
-- An editorial preview returns answer keys exclusively to a live staff role.
-- It never calls ensure_assignment/handle or writes profile, claim or progress.
CREATE OR REPLACE FUNCTION daily_quest_private.preview(p_level text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); staff_role text; template public.daily_quests%ROWTYPE;
 lexeme daily_quest_private.slot_forms%ROWTYPE; payload jsonb; keys jsonb;
BEGIN
 IF actor IS NULL THEN RETURN daily_quest_private.error('not_authenticated'); END IF;
 SELECT p.role::text INTO staff_role FROM public.profiles p WHERE p.id=actor;
 IF staff_role IS NULL OR staff_role NOT IN('teacher','admin') THEN
  RETURN jsonb_build_object('success',false,'error','not_authorized','message','Diese Vorschau ist für Lehrkräfte verfügbar.');
 END IF;
 IF p_level IS NULL OR p_level NOT IN('A1','A2','B1','B2','C1','C2') THEN RETURN daily_quest_private.error('invalid_input'); END IF;
 SELECT q.* INTO template
 FROM public.daily_quests q JOIN daily_quest_private.template_keys k ON k.template_id=q.id
 WHERE q.is_active AND q.level::text=p_level ORDER BY q.template_key,q.id LIMIT 1;
 IF template.id IS NULL THEN RETURN daily_quest_private.error('no_template'); END IF;
 SELECT k.answer_key INTO keys FROM daily_quest_private.template_keys k WHERE k.template_id=template.id;
 SELECT sf.* INTO lexeme FROM daily_quest_private.slot_forms sf WHERE sf.category=template.category
  AND sf.word_de=template.fallback_word_de AND sf.article=template.fallback_article;
 IF lexeme.word_de IS NULL THEN RETURN daily_quest_private.error('no_template'); END IF;
 payload:=daily_quest_private.render(template.content,lexeme.nominative,lexeme.accusative) || jsonb_build_object(
  'id',template.id,'date',daily_quest_private.today(),'level',template.level,'templateKey',template.template_key,
  'status','active','completedStepIds','[]'::jsonb,'personalization',jsonb_build_object('source','fallback','cardId',NULL));
 RETURN jsonb_build_object('success',true,'quest',payload,'answerKey',jsonb_build_object('steps',keys->'steps'));
END $$;
CREATE OR REPLACE FUNCTION public.get_daily_quest_preview(p_level text DEFAULT 'A1') RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.preview(p_level) $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA daily_quest_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION daily_quest_private.handle(text,uuid,text,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION daily_quest_private.preview(text) TO authenticated;
REVOKE ALL ON FUNCTION public.claim_daily_quest_login(),public.get_daily_quest(),public.get_daily_quest_status(),public.set_daily_quest_enabled(boolean),public.submit_daily_quest_step(uuid,text,jsonb),public.skip_daily_quest(uuid),public.complete_daily_quest(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_quest_login(),public.get_daily_quest(),public.get_daily_quest_status(),public.set_daily_quest_enabled(boolean),public.submit_daily_quest_step(uuid,text,jsonb),public.skip_daily_quest(uuid),public.complete_daily_quest(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_daily_quest_preview(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_quest_preview(text) TO authenticated;

INSERT INTO public.cefr_levels(code) SELECT unnest(enum_range(NULL::public.cefr_code)) ON CONFLICT DO NOTHING;
INSERT INTO daily_quest_private.slot_forms(category,word_de,article,nominative,accusative) VALUES
 ('food','Brötchen','das','das Brötchen','ein Brötchen'),('food','Brot','das','das Brot','ein Brot'),
 ('food','Apfel','der','der Apfel','einen Apfel'),('food','Banane','die','die Banane','eine Banane'),
 ('food','Kuchen','der','der Kuchen','einen Kuchen'),('food','Brezel','die','die Brezel','eine Brezel'),
 ('food','Croissant','das','das Croissant','ein Croissant') ON CONFLICT DO NOTHING;

-- Authored starter scenes progressively introduce polite requests, subordinate
-- clauses, Konjunktiv II, negotiation, contrast and nuanced formal register.
DO $seed$
DECLARE item record; template uuid; words jsonb; pieces jsonb; choices jsonb; content jsonb; answer jsonb; seed_updated boolean; seed_version integer;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('A1','sitov-bakery-breakfast','Beim Bäcker','Hol dir ein kleines Frühstück.','Bäckerei','bakery',
   'Guten Morgen! Was möchten Sie?','Ich möchte {{accusative}}, bitte.',
   '[{"id":"ich","text":"Ich"},{"id":"moechte","text":"möchte"},{"id":"food","text":"{{accusative}}"},{"id":"bitte","text":", bitte."}]',
   '[["ich","moechte","food","bitte"]]','Möchten Sie eine Tüte dazu?','Ja, bitte. Eine Tüte.','Ich heiße Anna.','Das ist mein Bahnhof.'),
  ('A2','sitov-picnic-plan','Ein Picknick planen','Erkläre, was du für unterwegs brauchst.','Bäckerei','bakery',
   'Was brauchen Sie für Ihr Picknick?','Ich nehme {{accusative}}, weil ich später Hunger habe.',
   '[{"id":"ich","text":"Ich"},{"id":"nehme","text":"nehme"},{"id":"food","text":"{{accusative}}"},{"id":"weil","text":", weil"},{"id":"ich2","text":"ich"},{"id":"spaeter","text":"später"},{"id":"hunger","text":"Hunger"},{"id":"habe","text":"habe."}]',
   '[["ich","nehme","food","weil","ich2","spaeter","hunger","habe"]]','Wir haben auch gekühlte Getränke. Möchten Sie eins?','Ja, gern. Ich nehme noch ein Wasser.','Gestern war Montag.','Ich fahre mit dem Fahrrad zur Schule.'),
  ('B1','sitov-order-change','Eine Bestellung ändern','Äußere höflich einen Änderungswunsch.','Bäckerei','bakery',
   'Ihre Bestellung ist noch nicht fertig. Kann ich etwas ändern?','Könnten Sie mir bitte {{accusative}} statt des Sandwichs geben?',
   '[{"id":"koennten","text":"Könnten"},{"id":"sie","text":"Sie"},{"id":"mir","text":"mir"},{"id":"bitte","text":"bitte"},{"id":"food","text":"{{accusative}}"},{"id":"statt","text":"statt des Sandwichs"},{"id":"geben","text":"geben?"}]',
   '[["koennten","sie","mir","bitte","food","statt","geben"],["koennten","sie","mir","food","bitte","statt","geben"],["koennten","sie","mir","food","statt","bitte","geben"]]',
   'Natürlich. Die Änderung kostet einen Euro mehr. Ist das in Ordnung?','Ja, das ist in Ordnung. Vielen Dank für Ihre Hilfe.','Nein, Sie müssen alles kostenlos machen.','Mein Zug fährt um acht Uhr ab.'),
  ('B2','sitov-catering-alternative','Eine Alternative aushandeln','Begründe einen Vorschlag für die Gruppe.','Besprechung in der Bäckerei','bakery',
   'Für das Teamfrühstück haben wir nur ein kleines Budget. Was schlagen Sie vor?',
   'Ich würde {{accusative}} bestellen, sofern das Budget dafür ausreicht.',
   '[{"id":"ich","text":"Ich"},{"id":"wuerde","text":"würde"},{"id":"food","text":"{{accusative}}"},{"id":"bestellen","text":"bestellen"},{"id":"sofern","text":", sofern"},{"id":"budget","text":"das Budget"},{"id":"dafuer","text":"dafür"},{"id":"ausreicht","text":"ausreicht."}]',
   '[["ich","wuerde","food","bestellen","sofern","budget","dafuer","ausreicht"],["ich","wuerde","food","bestellen","sofern","dafuer","budget","ausreicht"]]',
   'Eine kleinere Bestellung wäre günstiger, reicht aber vielleicht nicht für alle.','Dann sollten wir erst die Teilnehmerzahl klären und die Menge entsprechend anpassen.','Bestellen Sie trotzdem alles, unabhängig von den Kosten.','Ich finde das Wetter heute schön.'),
  ('C1','sitov-local-sourcing','Regional einkaufen','Wäge Kosten und Herkunft differenziert ab.','Gespräch in der Bäckerei','bakery',
   'Regionale Zutaten sind teurer. Wie wichtig ist Ihnen die Herkunft?',
   'Ich würde {{accusative}} bevorzugen, wenngleich dafür ein Aufpreis anfällt.',
   '[{"id":"ich","text":"Ich"},{"id":"wuerde","text":"würde"},{"id":"food","text":"{{accusative}}"},{"id":"bevorzugen","text":"bevorzugen"},{"id":"wenngleich","text":", wenngleich"},{"id":"dafuer","text":"dafür"},{"id":"aufpreis","text":"ein Aufpreis"},{"id":"anfaellt","text":"anfällt."}]',
   '[["ich","wuerde","food","bevorzugen","wenngleich","dafuer","aufpreis","anfaellt"],["ich","wuerde","food","bevorzugen","wenngleich","aufpreis","dafuer","anfaellt"]]',
   'Können Sie diesen Aufpreis gegenüber Ihrem Team vertreten?','Ja, sofern wir die Herkunft nachvollziehbar belegen und die Mehrkosten transparent kommunizieren.','Regionale Produkte sind ausnahmslos billiger.','Über Kosten sollte grundsätzlich niemand sprechen.'),
  ('C2','sitov-menu-deliberation','Ein Konzept präzisieren','Formuliere eine Einschränkung diplomatisch.','Frühstücksplanung in der Bäckerei','bakery',
   'Ihr Vorschlag klingt gut. Welche Einschränkung sollten wir noch berücksichtigen?',
   'Ich würde {{accusative}} vorsehen, wobei die endgültige Auswahl unter dem Vorbehalt saisonaler Verfügbarkeit steht.',
   '[{"id":"ich","text":"Ich"},{"id":"wuerde","text":"würde"},{"id":"food","text":"{{accusative}}"},{"id":"vorsehen","text":"vorsehen"},{"id":"wobei","text":", wobei"},{"id":"auswahl","text":"die endgültige Auswahl"},{"id":"vorbehalt","text":"unter dem Vorbehalt"},{"id":"verfuegbarkeit","text":"saisonaler Verfügbarkeit"},{"id":"steht","text":"steht."}]',
   '[["ich","wuerde","food","vorsehen","wobei","auswahl","vorbehalt","verfuegbarkeit","steht"]]',
   'Dann können wir die Auswahl heute also verbindlich zusagen?','Das Grundkonzept können wir zusagen; bei den einzelnen Produkten sollten wir uns jedoch eine gleichwertige Alternative vorbehalten.','Ja, ungeachtet der ausdrücklich genannten Einschränkung.','Eine verbindliche Zusage ist generell bedeutungslos.')
 ) AS v(level,key,title,subtitle,location,background,intro,sentence,pieces,accepted,dialogue,right_answer,wrong1,wrong2)
 LOOP
  words:=jsonb_build_array(jsonb_build_object('id','food','text','{{nominative}}','audioText','{{nominative}}'),
   jsonb_build_object('id','coffee','text','der Kaffee','audioText','der Kaffee'),jsonb_build_object('id','bag','text','die Tüte','audioText','die Tüte'));
  pieces:=item.pieces::jsonb;
  -- Correct position rotates by level; the public list never carries a flag.
  IF item.level IN('A1','B2') THEN choices:=jsonb_build_array(jsonb_build_object('id','b','text',item.wrong1),jsonb_build_object('id','a','text',item.right_answer),jsonb_build_object('id','c','text',item.wrong2));
  ELSIF item.level IN('A2','C1') THEN choices:=jsonb_build_array(jsonb_build_object('id','c','text',item.wrong2),jsonb_build_object('id','b','text',item.wrong1),jsonb_build_object('id','a','text',item.right_answer));
  ELSE choices:=jsonb_build_array(jsonb_build_object('id','a','text',item.right_answer),jsonb_build_object('id','c','text',item.wrong2),jsonb_build_object('id','b','text',item.wrong1)); END IF;
  -- Token bank is different from accepted sentence order, even on a reload.
  SELECT jsonb_agg(e.value ORDER BY md5(item.key||(e.value->>'id'))) INTO pieces FROM jsonb_array_elements(pieces) e(value);
  content:=jsonb_build_object('title',item.title,'subtitle',item.subtitle,'scene',jsonb_build_object('backgroundKey',item.background,'backgroundImage','/Bilder/deutschreise/bakery-scene.png','imageAlt','Eine Verkäuferin hinter der Theke einer Bäckerei.',
   'location',item.location,'audioText',item.intro,'speakerId','host','characters',jsonb_build_array(jsonb_build_object('id','host','name','Mara','voice','female'),jsonb_build_object('id','learner','name','Du','voice','male'))),
   'steps',jsonb_build_array(jsonb_build_object('id','discover','kind','discover','instruction','Entdecke die drei Wörter. Tippe sie an.','words',words),
    jsonb_build_object('id','build','kind','sentence_build','speakerId','learner','prompt',CASE WHEN item.level='A1' THEN 'Bestelle höflich. Setze den Satz zusammen.' ELSE 'Formuliere deine Antwort. Setze den Satz zusammen.' END,'pieces',pieces,'audioText',item.sentence),
    jsonb_build_object('id','dialogue','kind','dialogue_choice','speakerId','host','prompt',item.dialogue,'options',choices,'audioText',item.dialogue)),
   'completion',jsonb_build_object('title','Deutsch im Alltag geschafft!','text','Du hast Wörter entdeckt, einen Satz gebaut und passend geantwortet.'));
  -- Versioned editorial correction. Existing assignments retain their frozen
  -- content AND keys. Equal/newer authored template versions are preserved.
  seed_version:=CASE WHEN item.level IN('A1','B1','B2','C1') THEN 2 ELSE 1 END;
  INSERT INTO public.daily_quests(template_key,level,version,category,content) VALUES(item.key,item.level::public.cefr_code,seed_version,'food',content)
   ON CONFLICT(template_key) DO UPDATE SET version=excluded.version,content=excluded.content,updated_at=now()
    WHERE public.daily_quests.version<excluded.version RETURNING id INTO template;
  seed_updated:=template IS NOT NULL;
  IF template IS NULL THEN SELECT id INTO template FROM public.daily_quests WHERE template_key=item.key; END IF;
  answer:=jsonb_build_object('steps',jsonb_build_object('build',jsonb_build_object('accepted',item.accepted::jsonb),'dialogue',jsonb_build_object('optionId','a')),'feedback',jsonb_build_object(
   'discover',jsonb_build_object('correct','Gut! Die drei Wörter begleiten dich durch die Szene.','wrong','Entdecke zuerst alle drei Wörter.'),
   'build',jsonb_build_object('correct','Der Satz passt. Weiter geht es im Gespräch.','wrong','Prüfe die Reihenfolge. Achte auf die Position des Verbs.'),
   'dialogue',jsonb_build_object('correct','Das passt zur Frage. Deine Deutschreise ist geschafft!','wrong','Lies die Frage noch einmal und wähle eine passende Antwort.')));
  IF seed_updated THEN
   INSERT INTO daily_quest_private.template_keys(template_id,answer_key) VALUES(template,answer)
    ON CONFLICT(template_id) DO UPDATE SET answer_key=excluded.answer_key;
  ELSE
   INSERT INTO daily_quest_private.template_keys(template_id,answer_key) VALUES(template,answer) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
END $seed$;

COMMENT ON TABLE public.daily_quests IS 'Six authored starter scenes, one per CEFR family. Public content has no answer keys; new scenes may be added without frontend changes.';
COMMENT ON TABLE public.daily_quest_assignments IS 'Frozen safe quest snapshot per learner and Berlin day; writable only through actor-checked RPCs. Not a course-level entitlement.';
NOTIFY pgrst,'reload schema';
