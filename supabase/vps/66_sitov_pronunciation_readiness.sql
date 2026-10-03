-- Sitov Academy: evidence-based pronunciation access. No learner IDs, answers,
-- recordings, message history, progress or streaks are rewritten.
CREATE SCHEMA IF NOT EXISTS sitov_pronunciation_private;
REVOKE ALL ON SCHEMA sitov_pronunciation_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA sitov_pronunciation_private TO authenticated,service_role;
CREATE TABLE IF NOT EXISTS public.sitov_pronunciation_access (
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 level text NOT NULL REFERENCES public.learning_levels(code),
 mode text NOT NULL DEFAULT 'logical' CHECK(mode IN('logical','hard')),
 updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(auth_user_id,level)
);
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.access_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 level text NOT NULL, old_mode text NOT NULL, new_mode text NOT NULL,
 changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL, changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.sitov_pronunciation_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitov_pronunciation_private.access_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sitov_pronunciation_access,sitov_pronunciation_private.access_log FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.sitov_pronunciation_access TO authenticated;
GRANT ALL ON public.sitov_pronunciation_access,sitov_pronunciation_private.access_log TO service_role;
CREATE INDEX IF NOT EXISTS sitov_pronunciation_recall_receipts_idx ON vocabulary_private.answer_receipts(auth_user_id,progress_id)
 WHERE nullif(btrim(typed_answer),'') IS NOT NULL AND response->>'isCorrect'='true' AND response ? 'correctAnswer';
DROP POLICY IF EXISTS sitov_pronunciation_access_read ON public.sitov_pronunciation_access;
CREATE POLICY sitov_pronunciation_access_read ON public.sitov_pronunciation_access FOR SELECT TO authenticated
 USING(auth_user_id=(SELECT auth.uid()) OR (SELECT identity_private.current_profile_role()) IN('teacher','admin'));

-- A small German inflection key covers e/en/er/es and present-tense endings.
-- This is only a conservative readiness estimate, never an answer grader.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.word_key(p_word text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN w IN('geht','ging','gegangen') THEN 'geh' WHEN w IN('sieht','sah','gesehen') THEN 'seh'
 WHEN w IN('liest','las','gelesen') THEN 'les' WHEN w IN('isst','ass','gegessen') THEN 'ess'
 WHEN w IN('nimmt','nahm','genommen') THEN 'nehm' WHEN w IN('spricht','sprach','gesprochen') THEN 'sprech'
 WHEN w IN('hilft','half','geholfen') THEN 'helf' WHEN w IN('gibt','gab','gegeben') THEN 'geb'
 WHEN w IN('trifft','traf','getroffen') THEN 'treff'
 WHEN length(w)>4 THEN regexp_replace(w,'(ern|en|er|es|em|et|e|n|s|t)$','') WHEN length(w)=4 AND w~'(ht|st)$' THEN left(w,3) ELSE w END
 FROM (SELECT lower(translate(normalize(coalesce(p_word,''),NFC),'äöüß','aous')) w) s;
$$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.content_keys(p_text text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(array_agg(DISTINCT sitov_pronunciation_private.word_key(w)),'{}'::text[])
 FROM regexp_split_to_table(lower(normalize(coalesce(p_text,''),NFC)),'[^[:alpha:]]+') w
 WHERE length(w)>1 AND w<>ALL(ARRAY['der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines',
 'ich','du','er','sie','es','wir','ihr','ihnen','mein','meine','meinen','dein','deine','sein','seine','unser','unsere',
 'und','oder','aber','auch','mit','in','im','am','an','auf','aus','bei','bis','für','von','vor','nach','zu','zum','zur',
 'ist','sind','bin','bist','seid','war','waren','hat','haben','habe','hast','hattet','wird','werden','werde','kann','können',
 'muss','müssen','will','wollen','nicht','noch','nur','so','da','dort','hier','dann','als','wenn','weil','dass','was','wie','wer','wo','um']::text[]);
$$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.requirements() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT '[
 {"tier":1,"knownWords":30,"grammarNodes":2,"passedTests":0,"legacyGrammarExercises":8,"legacyGrammarTopics":2,"confidentVerbForms":3},
 {"tier":2,"knownWords":80,"grammarNodes":5,"passedTests":1,"legacyGrammarExercises":20,"legacyGrammarTopics":3,"confidentVerbForms":8},
 {"tier":3,"knownWords":160,"grammarNodes":10,"passedTests":2,"legacyGrammarExercises":40,"legacyGrammarTopics":5,"confidentVerbForms":15}
 ]'::jsonb $$;

-- SECURITY DEFINER is needed to inspect persisted, server-graded evidence and
-- teacher settings without depending on current content-read RLS. The actor is
-- checked before every lookup; this non-exposed schema has no public privileges.
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
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.tier(p_evidence jsonb) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(max((r->>'tier')::integer),0) FROM jsonb_array_elements(sitov_pronunciation_private.requirements()) r
 WHERE (p_evidence->>'knownWords')::integer >= (r->>'knownWords')::integer
 AND (((p_evidence->>'grammarNodes')::integer >= (r->>'grammarNodes')::integer
   AND (p_evidence->>'passedTests')::integer >= (r->>'passedTests')::integer)
  OR ((p_evidence->>'legacyGrammarExercises')::integer >= (r->>'legacyGrammarExercises')::integer
   AND (p_evidence->>'legacyGrammarTopics')::integer >= (r->>'legacyGrammarTopics')::integer))
 AND (NOT (p_evidence->>'verbEvidenceRequired')::boolean OR (p_evidence->>'confidentVerbForms')::integer >= least((r->>'confidentVerbForms')::integer,(p_evidence->>'availableVerbForms')::integer));
$$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.unit_allowed(p_student uuid,p_unit uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (auth.uid()=p_student OR identity_private.current_profile_role() IN('teacher','admin'))
 AND EXISTS(SELECT 1 FROM public.learning_units u JOIN public.profiles p ON p.id=p_student
 WHERE u.id=p_unit AND u.trainer='pronunciation' AND u.is_active AND
 (p.role IN('teacher','admin') OR (p.ui_language<>'de'
 AND EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p_student AND a.level=u.level)
 AND coalesce((SELECT g.enabled FROM public.learning_trainer_grants g WHERE g.auth_user_id=p_student AND g.level=u.level AND g.trainer='pronunciation'),true)
 AND NOT EXISTS(SELECT 1 FROM public.learning_trainer_grants g WHERE g.auth_user_id=p_student AND g.level=u.level AND g.trainer='pronunciation'
  AND g.unit_mode='selected' AND NOT EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=p_student AND x.level=u.level AND x.trainer='pronunciation' AND x.unit_id=u.id)))));
$$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.assess(p_student uuid,p_prompt uuid,p_evidence jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE row record; words integer; required integer; coverage integer; keys text[]; hard boolean; BEGIN
 IF auth.uid() IS NULL OR (auth.uid()<>p_student AND coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin'))
 THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 SELECT r.sentence_de,r.focus,u.id unit_id,u.level,u.label INTO row FROM public.learning_reading_texts r JOIN public.learning_units u ON u.id=r.unit_id WHERE r.id=p_prompt;
 IF NOT FOUND THEN RETURN NULL; END IF;
 words:=cardinality(regexp_split_to_array(btrim(row.sentence_de),'[[:space:]]+'));
 required:=CASE WHEN words<=50 THEN 1 WHEN words<=90 THEN 2 ELSE 3 END;
 keys:=sitov_pronunciation_private.content_keys(row.sentence_de);
 SELECT CASE WHEN cardinality(keys)=0 THEN 100 ELSE floor(100.0*count(*)/cardinality(keys))::integer END INTO coverage
 FROM unnest(keys) key WHERE p_evidence->'knownKeys' ? key;
 hard:=EXISTS(SELECT 1 FROM public.sitov_pronunciation_access a WHERE a.auth_user_id=p_student AND a.level=row.level AND a.mode='hard')
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_student AND p.role IN('teacher','admin'));
 RETURN jsonb_build_object('id',p_prompt,'title',row.label,'tier',required,'wordCount',words,'coveragePercent',coverage,'requiredCoveragePercent',60,
  'ready',sitov_pronunciation_private.unit_allowed(p_student,row.unit_id) AND learning_private.german_text_allowed(row.sentence_de) AND learning_private.german_text_allowed(row.focus)
   AND (hard OR sitov_pronunciation_private.tier(p_evidence)>=required AND coverage>=60));
END $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.text_allowed(p_prompt uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN auth.uid() IS NULL THEN false ELSE coalesce((sitov_pronunciation_private.assess(auth.uid(),p_prompt,sitov_pronunciation_private.evidence(auth.uid()))->>'ready')::boolean,false) END;
$$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.readiness(p_level text,p_student uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE ev jsonb; texts jsonb; mode text; requirements jsonb; BEGIN
 IF p_level IS NULL OR p_level NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2') THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 ev:=sitov_pronunciation_private.evidence(p_student);
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student) THEN RETURN jsonb_build_object('error','not_found'); END IF;
 mode:=coalesce((SELECT a.mode FROM public.sitov_pronunciation_access a WHERE a.auth_user_id=p_student AND a.level=p_level),'logical');
 SELECT coalesce(jsonb_agg(sitov_pronunciation_private.assess(p_student,r.id,ev) ORDER BY u.sort_order,r.id),'[]'::jsonb) INTO texts
 FROM public.learning_reading_texts r JOIN public.learning_units u ON u.id=r.unit_id WHERE u.level=p_level AND sitov_pronunciation_private.unit_allowed(p_student,u.id);
 SELECT jsonb_agg(jsonb_set(r,'{confidentVerbForms}',to_jsonb(least((r->>'confidentVerbForms')::integer,(ev->>'availableVerbForms')::integer)))) INTO requirements
 FROM jsonb_array_elements(sitov_pronunciation_private.requirements()) r;
 RETURN jsonb_build_object('level',p_level,'mode',mode,'tier',CASE WHEN mode='hard' THEN 3 ELSE sitov_pronunciation_private.tier(ev) END,
 'stats',ev-'knownKeys','requirements',requirements,'texts',texts);
END $$;
CREATE OR REPLACE FUNCTION public.sitov_get_pronunciation_readiness(p_level text,p_student_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT sitov_pronunciation_private.readiness(p_level,coalesce(p_student_id,auth.uid()));
$$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.set_access(p_student uuid,p_level text,p_mode text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_mode text; BEGIN
 IF auth.uid() IS NULL OR coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 IF p_mode IS NULL OR p_mode NOT IN('logical','hard') OR p_level IS NULL OR p_level NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2')
 THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student AND role='student') THEN RETURN jsonb_build_object('error','not_found'); END IF;
 -- Hard unlock bypasses learning milestones, never staff's level/trainer/text selection.
 IF p_mode='hard' AND NOT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.level=p_level AND sitov_pronunciation_private.unit_allowed(p_student,u.id))
 THEN RETURN jsonb_build_object('error','trainer_access_denied'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sitov-pronunciation-access:'||p_student::text||':'||p_level,0));
 old_mode:=coalesce((SELECT a.mode FROM public.sitov_pronunciation_access a WHERE a.auth_user_id=p_student AND a.level=p_level),'logical');
 INSERT INTO public.sitov_pronunciation_access(auth_user_id,level,mode,updated_by) VALUES(p_student,p_level,p_mode,auth.uid())
 ON CONFLICT(auth_user_id,level) DO UPDATE SET mode=excluded.mode,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 IF old_mode<>p_mode THEN INSERT INTO sitov_pronunciation_private.access_log(auth_user_id,level,old_mode,new_mode,changed_by) VALUES(p_student,p_level,old_mode,p_mode,auth.uid()); END IF;
 RETURN jsonb_build_object('success',true);
END $$;
CREATE OR REPLACE FUNCTION public.sitov_set_pronunciation_access(p_student_id uuid,p_level text,p_mode text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_pronunciation_private.set_access(p_student_id,p_level,p_mode) $$;
-- A locked current text must not erase the title of a learner's past recording.
-- This endpoint exposes only titles attached to accessible own conversations.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.conversation_titles() RETURNS TABLE(submission_id uuid,title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT s.id,u.label FROM public.submissions s JOIN public.learning_reading_texts r ON r.id=s.prompt_id JOIN public.learning_units u ON u.id=r.unit_id
 WHERE auth.uid() IS NOT NULL AND s.auth_user_id=auth.uid() AND pronunciation_private.can_access_submission(s.id);
$$;
CREATE OR REPLACE FUNCTION public.sitov_pronunciation_conversation_titles() RETURNS TABLE(submission_id uuid,title text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM sitov_pronunciation_private.conversation_titles() $$;

-- A restrictive read policy protects text bodies / authored audio references
-- even if a future unrelated permissive content policy is added.
DROP POLICY IF EXISTS sitov_pronunciation_readiness_bounds ON public.learning_reading_texts;
CREATE POLICY sitov_pronunciation_readiness_bounds ON public.learning_reading_texts AS RESTRICTIVE FOR SELECT TO authenticated
 USING((SELECT identity_private.current_profile_role()) IN('teacher','admin') OR sitov_pronunciation_private.text_allowed(id));
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.guard_submission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NOT NULL AND coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') AND NEW.type='audio'
 AND NEW.prompt_id IS NOT NULL AND (NEW.auth_user_id<>auth.uid() OR NOT sitov_pronunciation_private.text_allowed(NEW.prompt_id))
 THEN RAISE EXCEPTION 'pronunciation_not_ready' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sitov_pronunciation_ready_submission ON public.submissions;
CREATE TRIGGER sitov_pronunciation_ready_submission BEFORE INSERT OR UPDATE OF prompt_id,content_url ON public.submissions
 FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.guard_submission();

-- Existing conversations keep their playback and audio-reply workflow. New
-- uploads require at least one eligible text. A second check on submission binds
-- the recording to the exact eligible text, regardless of the upload UI.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.can_record() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE ev jsonb; BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 IF identity_private.current_profile_role() IN('teacher','admin') THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM public.submissions s WHERE s.auth_user_id=auth.uid() AND pronunciation_private.can_access_submission(s.id)) THEN RETURN true; END IF;
 ev:=sitov_pronunciation_private.evidence(auth.uid());
 RETURN EXISTS(SELECT 1 FROM public.learning_reading_texts r WHERE (sitov_pronunciation_private.assess(auth.uid(),r.id,ev)->>'ready')::boolean);
END $$;
DROP POLICY IF EXISTS sitov_pronunciation_ready_upload ON storage.objects;
CREATE POLICY sitov_pronunciation_ready_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id NOT IN('pronunciation_audio','audio_submissions') OR bucket_id='pronunciation_audio' AND sitov_pronunciation_private.can_record()
  AND name ~ ('^'||(SELECT auth.uid())::text||'/[0-9a-f-]{36}\.(webm|mp4|ogg|wav|mp3)$'));
DROP POLICY IF EXISTS sitov_pronunciation_owned_upload ON storage.objects;
CREATE POLICY sitov_pronunciation_owned_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='pronunciation_audio' AND sitov_pronunciation_private.can_record()
  AND name ~ ('^'||(SELECT auth.uid())::text||'/[0-9a-f-]{36}\.(webm|mp4|ogg|wav|mp3)$'));
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.audio_readable(p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (identity_private.current_profile_role() IN('teacher','admin')
 OR EXISTS(SELECT 1 FROM public.submissions s WHERE s.content_url='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(s.id))
 OR EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.audio_path='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(m.submission_id))
 OR (split_part(p_name,'/',1)=auth.uid()::text AND sitov_pronunciation_private.can_record()
  AND NOT EXISTS(SELECT 1 FROM public.submissions s WHERE s.content_url='storage://pronunciation_audio/'||p_name)
  AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.audio_path='storage://pronunciation_audio/'||p_name)));
$$;
DROP POLICY IF EXISTS sitov_pronunciation_participant_read ON storage.objects;
CREATE POLICY sitov_pronunciation_participant_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='pronunciation_audio' AND sitov_pronunciation_private.audio_readable(name));
DROP POLICY IF EXISTS sitov_pronunciation_recording_read_bounds ON storage.objects;
CREATE POLICY sitov_pronunciation_recording_read_bounds ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id NOT IN('pronunciation_audio','audio_submissions') OR bucket_id='pronunciation_audio' AND
  (sitov_pronunciation_private.audio_readable(name) OR learning_reset_private.can_remove_audio(id)));

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitov_pronunciation_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sitov_pronunciation_private.readiness(text,uuid),sitov_pronunciation_private.set_access(uuid,text,text),
 sitov_pronunciation_private.text_allowed(uuid),sitov_pronunciation_private.can_record(),sitov_pronunciation_private.audio_readable(text),
 sitov_pronunciation_private.conversation_titles() TO authenticated;
REVOKE ALL ON FUNCTION public.sitov_get_pronunciation_readiness(text,uuid),public.sitov_set_pronunciation_access(uuid,text,text),public.sitov_pronunciation_conversation_titles() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_get_pronunciation_readiness(text,uuid),public.sitov_set_pronunciation_access(uuid,text,text),public.sitov_pronunciation_conversation_titles() TO authenticated;


-- BEGIN SITOV MALE PRONUNCIATION READINGS
-- Only untouched authored originals are revised. IDs, submissions, messages,
-- student audio objects, progress, checkpoints and streaks stay intact. Existing
-- submissions already contain the actual text read in text_content.
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.legacy_reference_audio(
 prompt_id uuid NOT NULL, sentence_de text NOT NULL, audio_url text NOT NULL,
 archived_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(prompt_id,sentence_de)
);
REVOKE ALL ON sitov_pronunciation_private.legacy_reference_audio FROM PUBLIC,anon,authenticated;
DO $sitov_reading_revision$
DECLARE edit record;
BEGIN
 FOR edit IN SELECT * FROM (VALUES
 ('6d2f8e95-6f87-510b-b244-0631733f8ff9', 'Guten Tag, das bin ich', 'Guten Tag, das bin ich', 'Guten Tag, ich heiße Anna. Ich komme aus Polen und wohne jetzt in Hannover. Ich bin dreißig Jahre alt. Meine Familie ist klein. Mein Mann heißt Paul. Wir lernen zusammen Deutsch. Am Abend trinken wir Tee und lesen ein Buch.', 'Guten Tag, ich heiße Leon. Ich komme aus Polen und wohne jetzt in Hannover. Ich bin dreißig Jahre alt. Meine Familie ist klein. Mein Mann heißt Paul. Wir lernen zusammen Deutsch. Am Abend trinken wir Tee und lesen ein Buch.'),
 ('25bdcac1-9272-5294-893f-c2063b4838b9', 'Unser Kursraum', 'Unser Kursraum', 'Das ist unser Kursraum. Er ist hell und groß. Hier stehen zwölf Stühle und sechs Tische. An der Wand ist eine Tafel. Mein Heft liegt auf dem Tisch. Die Lehrerin kommt und sagt guten Morgen. Jetzt beginnt unser Deutschkurs.', 'Das ist unser Kursraum. Er ist hell und groß. Hier stehen zwölf Stühle und sechs Tische. An der Wand ist eine Tafel. Mein Heft liegt auf dem Tisch. Der Lehrer kommt und sagt guten Morgen. Jetzt beginnt unser Deutschkurs.'),
 ('b73f6228-c6c7-591b-ac83-2bae82a3b163', 'Eine neue Nachbarin', 'Ein neuer Nachbar', 'Ich wohne in der Gartenstraße. Meine Nachbarin heißt Leyla. Sie ist neu hier. Heute treffen wir uns vor dem Haus. Ich sage Hallo und frage: Wie geht es Ihnen? Leyla lächelt. Es geht ihr gut. Wir trinken später zusammen Kaffee.', 'Ich wohne in der Gartenstraße. Mein Nachbar heißt Leon. Er ist neu hier. Heute treffen wir uns vor dem Haus. Ich sage Hallo und frage: Wie geht es Ihnen? Leon lächelt. Es geht ihm gut. Wir trinken später zusammen Kaffee.'),
 ('15c29bec-e14e-5f27-8f12-ea9e45145e97', 'Im kleinen Laden', 'Im kleinen Laden', 'Ich bin im Laden. Ich brauche Milch, Brot und drei Äpfel. Die Verkäuferin ist freundlich. Sie zeigt mir das Brot. Es kostet zwei Euro. Ich nehme auch Wasser. Dann bezahle ich und sage danke. Meine Tasche ist jetzt voll.', 'Ich bin im Laden. Ich brauche Milch, Brot und drei Äpfel. Der Verkäufer ist freundlich. Er zeigt mir das Brot. Es kostet zwei Euro. Ich nehme auch Wasser. Dann bezahle ich und sage danke. Meine Tasche ist jetzt voll.'),
 ('610e3f81-2a6f-5794-bb78-ef06cb7ece17', 'Meine Familie', 'Meine Familie', 'Das ist ein Foto von meiner Familie. Meine Mutter heißt Maria. Sie kocht gern. Mein Vater heißt Oleg. Er hört gern Musik. Meine Schwester ist zwanzig Jahre alt. Sie lernt Deutsch wie ich. Wir telefonieren oft und lachen viel.', 'Das ist ein Foto von meiner Familie. Mein Onkel heißt Mark. Er kocht gern. Mein Vater heißt Oleg. Er hört gern Musik. Mein Bruder ist zwanzig Jahre alt. Er lernt Deutsch wie ich. Wir telefonieren oft und lachen viel.'),
 ('1b5c02d4-7217-56e0-8abb-906c20784e30', 'Ein Termin beim Arzt', 'Ein Termin beim Arzt', 'Seit gestern tut mein Hals weh. Ich rufe in der Praxis an und möchte einen Termin machen. Die Mitarbeiterin fragt nach meinem Namen. Ich buchstabiere ihn langsam. Am Nachmittag ist ein Termin frei. Ich kann um drei Uhr kommen. Meine Versichertenkarte nehme ich mit. Danach bleibe ich zu Hause und trinke warmen Tee.', 'Seit gestern tut mein Hals weh. Ich rufe in der Praxis an und möchte einen Termin machen. Der Mitarbeiter fragt nach meinem Namen. Ich buchstabiere ihn langsam. Am Nachmittag ist ein Termin frei. Ich kann um drei Uhr kommen. Meine Versichertenkarte nehme ich mit. Danach bleibe ich zu Hause und trinke warmen Tee.'),
 ('add5b212-15af-55b5-b224-6282b5c39c13', 'Wir kochen zusammen', 'Wir kochen zusammen', 'Am Freitag kommen zwei Freunde zu mir. Wir möchten zusammen eine Suppe kochen. Zuerst kaufen wir Gemüse auf dem Markt. Dann waschen wir die Karotten und schneiden die Kartoffeln. Meine Freundin kocht Wasser. Ich decke den Tisch. Die Suppe schmeckt gut, und wir essen noch Brot dazu. Später räumen wir die Küche auf.', 'Am Freitag kommen zwei Freunde zu mir. Wir möchten zusammen eine Suppe kochen. Zuerst kaufen wir Gemüse auf dem Markt. Dann waschen wir die Karotten und schneiden die Kartoffeln. Mein Freund kocht Wasser. Ich decke den Tisch. Die Suppe schmeckt gut, und wir essen noch Brot dazu. Später räumen wir die Küche auf.'),
 ('924ee488-8b97-5070-ba23-eea0f03992e6', 'Ein Besuch im Schwimmbad', 'Ein Besuch im Schwimmbad', 'Meine Tochter kann schon gut schwimmen. Am Sonntag gehen wir ins Schwimmbad. Ich packe zwei Handtücher und unsere Badesachen ein. An der Kasse kaufen wir zwei Karten. Das Wasser ist angenehm warm. Meine Tochter schwimmt, und ich übe mit ihr. Nach einer Stunde machen wir eine Pause. Wir haben Hunger und essen eine Banane.', 'Mein Sohn kann schon gut schwimmen. Am Sonntag gehen wir ins Schwimmbad. Ich packe zwei Handtücher und unsere Badesachen ein. An der Kasse kaufen wir zwei Karten. Das Wasser ist angenehm warm. Mein Sohn schwimmt, und ich übe mit ihm. Nach einer Stunde machen wir eine Pause. Wir haben Hunger und essen eine Banane.'),
 ('93e4a1ed-cb70-5f0a-9dd2-cf6b2a9c9699', 'Auf dem Wochenmarkt', 'Auf dem Wochenmarkt', 'Am Mittwoch ist Markt auf dem großen Platz. Ich gehe mit meinem Korb dorthin. An einem Stand gibt es frische Äpfel und Birnen. Ich möchte ein Kilo Äpfel kaufen. Die Verkäuferin lässt mich einen Apfel probieren. Er schmeckt süß. Am nächsten Stand kaufe ich Kartoffeln. Zum Schluss hole ich Blumen für meine Küche.', 'Am Mittwoch ist Markt auf dem großen Platz. Ich gehe mit meinem Korb dorthin. An einem Stand gibt es frische Äpfel und Birnen. Ich möchte ein Kilo Äpfel kaufen. Der Verkäufer lässt mich einen Apfel probieren. Er schmeckt süß. Am nächsten Stand kaufe ich Kartoffeln. Zum Schluss hole ich Blumen für meine Küche.'),
 ('00cedd4e-cf66-50ae-a181-e687d85a8379', 'Ein Ausflug mit dem Zug', 'Ein Ausflug mit dem Zug', 'Morgen besuchen wir meine Schwester in Bremen. Unser Zug fährt um halb zehn. Wir müssen früh aufstehen und die Taschen packen. Am Bahnhof kaufen wir noch ein Brötchen. Auf der Anzeige steht Gleis sieben. Im Zug sitzen wir am Fenster. Meine Schwester wartet am Bahnhof auf uns. Zusammen fahren wir mit der Straßenbahn zu ihr.', 'Morgen besuchen wir meinen Bruder in Bremen. Unser Zug fährt um halb zehn. Wir müssen früh aufstehen und die Taschen packen. Am Bahnhof kaufen wir noch ein Brötchen. Auf der Anzeige steht Gleis sieben. Im Zug sitzen wir am Fenster. Mein Bruder wartet am Bahnhof auf uns. Zusammen fahren wir mit der Straßenbahn zu ihm.'),
 ('0022c931-279a-5050-ac2d-459c1e978cd1', 'In der Bibliothek', 'In der Bibliothek', 'Ich möchte mehr auf Deutsch lesen. Deshalb gehe ich heute in die Bibliothek. Eine Mitarbeiterin erklärt mir die Anmeldung. Ich brauche meinen Ausweis und bekomme eine Karte. Im ersten Stock finde ich leichte Bücher. Ich nehme eine kurze Geschichte mit vielen Bildern. Das Buch darf ich vier Wochen behalten. Nächste Woche möchte ich wiederkommen.', 'Ich möchte mehr auf Deutsch lesen. Deshalb gehe ich heute in die Bibliothek. Ein Mitarbeiter erklärt mir die Anmeldung. Ich brauche meinen Ausweis und bekomme eine Karte. Im ersten Stock finde ich leichte Bücher. Ich nehme eine kurze Geschichte mit vielen Bildern. Das Buch darf ich vier Wochen behalten. Nächste Woche möchte ich wiederkommen.'),
 ('b3fd31c6-efa8-5a64-85d9-7d419b4c42f4', 'Ein verlorener Schlüssel', 'Ein verlorener Schlüssel', 'Ich stehe vor meiner Haustür und suche meinen Schlüssel. Er ist nicht in meiner Jacke. Auch in meiner Tasche finde ich ihn nicht. Ich rufe meinen Mann an. Er ist noch bei der Arbeit. Zum Glück hat unsere Nachbarin einen zweiten Schlüssel. Sie öffnet mir die Tür. Mein Schlüssel liegt auf dem Küchentisch.', 'Ich stehe vor meiner Haustür und suche meinen Schlüssel. Er ist nicht in meiner Jacke. Auch in meiner Tasche finde ich ihn nicht. Ich rufe meinen Mann an. Er ist noch bei der Arbeit. Zum Glück hat unser Nachbar einen zweiten Schlüssel. Er öffnet mir die Tür. Mein Schlüssel liegt auf dem Küchentisch.'),
 ('8cd6b9c9-8eaf-5a08-863b-27e712dbc484', 'Der neue Stundenplan', 'Der neue Stundenplan', 'Unser Deutschkurs hat ab Montag neue Zeiten. Wir lernen jetzt am Vormittag von neun bis zwölf Uhr. Am Dienstag üben wir besonders viel Sprechen. Am Donnerstag lesen wir kurze Texte. Die Lehrerin erklärt den Stundenplan langsam. Ich schreibe die Zeiten in meinen Kalender. Nach dem Kurs kann ich meine Tochter von der Schule abholen. Das passt gut für mich.', 'Unser Deutschkurs hat ab Montag neue Zeiten. Wir lernen jetzt am Vormittag von neun bis zwölf Uhr. Am Dienstag üben wir besonders viel Sprechen. Am Donnerstag lesen wir kurze Texte. Der Lehrer erklärt den Stundenplan langsam. Ich schreibe die Zeiten in meinen Kalender. Nach dem Kurs kann ich meinen Sohn von der Schule abholen. Das passt gut für mich.'),
 ('b2ae5915-20dd-5018-8921-6afe5be0f1fd', 'Mein erster Arbeitstag', 'Mein erster Arbeitstag', 'Gestern hatte ich meinen ersten Arbeitstag in einer Bäckerei. Ich war ein bisschen nervös und bin sehr früh losgefahren. Meine Kollegin hat mir zuerst die Küche gezeigt. Danach haben wir zusammen die Brötchen sortiert. An der Kasse musste ich oft nachfragen, weil die Kunden schnell gesprochen haben. Meine Kollegin war geduldig und hat mir geholfen. Am Abend war ich müde, aber auch stolz. Heute kenne ich schon mehr Wörter für meine Arbeit.', 'Gestern hatte ich meinen ersten Arbeitstag in einer Bäckerei. Ich war ein bisschen nervös und bin sehr früh losgefahren. Mein Kollege hat mir zuerst die Küche gezeigt. Danach haben wir zusammen die Brötchen sortiert. An der Kasse musste ich oft nachfragen, weil die Kunden schnell gesprochen haben. Mein Kollege war geduldig und hat mir geholfen. Am Abend war ich müde, aber auch stolz. Heute kenne ich schon mehr Wörter für meine Arbeit.'),
 ('acb54d47-e197-56ca-9eb7-a890abce63f6', 'Das Fahrrad ist kaputt', 'Das Fahrrad ist kaputt', 'Auf dem Weg zum Kurs ist mein Fahrrad kaputtgegangen. Der hintere Reifen war plötzlich leer. Ich habe das Rad bis zur nächsten Werkstatt geschoben. Der Mechaniker hat ein kleines Loch gefunden. Er konnte den Reifen noch am selben Vormittag reparieren. Deshalb bin ich mit dem Bus zur Schule gefahren. Meiner Lehrerin habe ich eine kurze Nachricht geschickt. Nach dem Kurs habe ich mein Fahrrad abgeholt und bin vorsichtig nach Hause gefahren.', 'Auf dem Weg zum Kurs ist mein Fahrrad kaputtgegangen. Der hintere Reifen war plötzlich leer. Ich habe das Rad bis zur nächsten Werkstatt geschoben. Der Mechaniker hat ein kleines Loch gefunden. Er konnte den Reifen noch am selben Vormittag reparieren. Deshalb bin ich mit dem Bus zur Schule gefahren. Meinem Lehrer habe ich eine kurze Nachricht geschickt. Nach dem Kurs habe ich mein Fahrrad abgeholt und bin vorsichtig nach Hause gefahren.'),
 ('2c6b8ac4-28e2-556d-950e-9937d7da0da9', 'Ein Paket für die Nachbarin', 'Ein Paket für den Nachbarn', 'Als ich gestern nach Hause kam, klingelte der Paketbote. Meine Nachbarin war nicht da, und ich habe ihr Paket angenommen. Am Abend habe ich einen Zettel an ihre Tür gehängt. Darauf stand, dass sie bei mir klingeln kann. Eine Stunde später kam sie vorbei. In dem Paket waren Bücher für ihre Tochter. Wir haben kurz über die Schule gesprochen. Zum Dank hat sie mich am Wochenende zum Kaffee eingeladen.', 'Als ich gestern nach Hause kam, klingelte der Paketbote. Mein Nachbar war nicht da, und ich habe sein Paket angenommen. Am Abend habe ich einen Zettel an seine Tür gehängt. Darauf stand, dass er bei mir klingeln kann. Eine Stunde später kam er vorbei. In dem Paket waren Bücher für seinen Sohn. Wir haben kurz über die Schule gesprochen. Zum Dank hat er mich am Wochenende zum Kaffee eingeladen.'),
 ('5ec73679-e979-5ef6-bbac-8d14af8d2651', 'Ein Rezept von meiner Mutter', 'Ein Rezept von meinem Vater', 'Meine Mutter hat mir am Telefon ein einfaches Rezept erklärt. Ich wollte einen Apfelkuchen backen, hatte aber wenig Erfahrung. Zuerst habe ich die Zutaten aufgeschrieben und alles eingekauft. Dann habe ich den Teig vorbereitet. Während der Kuchen im Ofen war, habe ich die Küche aufgeräumt. Nach vierzig Minuten roch die ganze Wohnung nach Äpfeln. Der Kuchen war etwas dunkel, hat aber gut geschmeckt. Meiner Mutter habe ich ein Foto geschickt.', 'Mein Vater hat mir am Telefon ein einfaches Rezept erklärt. Ich wollte einen Apfelkuchen backen, hatte aber wenig Erfahrung. Zuerst habe ich die Zutaten aufgeschrieben und alles eingekauft. Dann habe ich den Teig vorbereitet. Während der Kuchen im Ofen war, habe ich die Küche aufgeräumt. Nach vierzig Minuten roch die ganze Wohnung nach Äpfeln. Der Kuchen war etwas dunkel, hat aber gut geschmeckt. Meinem Vater habe ich ein Foto geschickt.'),
 ('3dfcf736-84e5-599d-a492-b780ffc491c4', 'Sport nach der Arbeit', 'Sport nach der Arbeit', 'Seit einem Monat besuche ich einen Sportkurs im Stadtteilzentrum. Der Kurs findet immer mittwochs nach meiner Arbeit statt. Am Anfang waren die Übungen ziemlich anstrengend. Jetzt kann ich schon länger mitmachen. Die Trainerin zeigt jede Bewegung langsam und erklärt sie noch einmal. In der Gruppe sind Menschen aus verschiedenen Ländern. Nach dem Training trinken wir manchmal zusammen Wasser und unterhalten uns. Ich bewege mich mehr und lerne dabei neue Leute kennen.', 'Seit einem Monat besuche ich einen Sportkurs im Stadtteilzentrum. Der Kurs findet immer mittwochs nach meiner Arbeit statt. Am Anfang waren die Übungen ziemlich anstrengend. Jetzt kann ich schon länger mitmachen. Der Trainer zeigt jede Bewegung langsam und erklärt sie noch einmal. In der Gruppe sind Menschen aus verschiedenen Ländern. Nach dem Training trinken wir manchmal zusammen Wasser und unterhalten uns. Ich bewege mich mehr und lerne dabei neue Leute kennen.'),
 ('dbe98ecb-4d32-5767-be6c-f54728c93f7d', 'Ein Besuch auf dem Land', 'Ein Besuch auf dem Land', 'Letztes Wochenende haben wir Freunde auf dem Land besucht. Sie wohnen in einem alten Haus mit einem großen Garten. Wir sind morgens mit dem Zug gefahren. Am Bahnhof haben sie uns abgeholt. Nach dem Mittagessen haben wir einen langen Spaziergang gemacht. Die Kinder haben Pferde gesehen und viele Fragen gestellt. Abends haben wir draußen gesessen, bis es kühl wurde. Am Sonntag wollten die Kinder gar nicht wieder nach Hause fahren.', 'Letztes Wochenende haben wir Freunde auf dem Land besucht. Sie wohnen in einem alten Haus mit einem großen Garten. Wir sind morgens mit dem Zug gefahren. Am Bahnhof haben sie uns abgeholt. Nach dem Mittagessen haben wir einen langen Spaziergang gemacht. Die Jungen haben Pferde gesehen und viele Fragen gestellt. Abends haben wir draußen gesessen, bis es kühl wurde. Am Sonntag wollten die Jungen gar nicht wieder nach Hause fahren.'),
 ('bea3e65f-1668-5539-a4c3-ce044fe067e1', 'Eine Reise mit Hindernissen', 'Eine Reise mit Hindernissen', 'Wir wollten am Samstag früh zu meinen Eltern fahren, doch unser Zug hatte Verspätung. Auf dem Bahnsteig war es voll, und die Durchsage war schwer zu verstehen. Eine Mitarbeiterin erklärte uns, dass wir einen anderen Zug nehmen konnten. Weil wir in einer fremden Stadt umsteigen mussten, war ich zunächst unsicher. Zum Glück zeigte uns ein Mitreisender das richtige Gleis. Wir kamen zwei Stunden später an als geplant. Meine Eltern hatten das Essen warm gehalten. Trotz der langen Fahrt wurde es noch ein schöner Abend.', 'Wir wollten am Samstag früh zu meinen Eltern fahren, doch unser Zug hatte Verspätung. Auf dem Bahnsteig war es voll, und die Durchsage war schwer zu verstehen. Ein Mitarbeiter erklärte uns, dass wir einen anderen Zug nehmen konnten. Weil wir in einer fremden Stadt umsteigen mussten, war ich zunächst unsicher. Zum Glück zeigte uns ein Mitreisender das richtige Gleis. Wir kamen zwei Stunden später an als geplant. Meine Eltern hatten das Essen warm gehalten. Trotz der langen Fahrt wurde es noch ein schöner Abend.'),
 ('3243b764-4bfc-5fc6-8c24-1a49962988ff', 'Ein Gespräch über Arbeitszeiten', 'Ein Gespräch über Arbeitszeiten', 'Seit meine Tochter in die Schule geht, passen meine Arbeitszeiten nicht mehr gut zu unserem Alltag. Deshalb habe ich meine Chefin um ein Gespräch gebeten. Ich habe erklärt, dass ich am Nachmittag früher zu Hause sein muss. Dafür könnte ich morgens eine Stunde früher anfangen. Meine Chefin wollte zuerst mit dem Team sprechen. Einige Tage später hat sie meinem Vorschlag zugestimmt. Wir probieren die neue Regelung zunächst für einen Monat aus. Ich bin froh, dass ich offen über mein Problem gesprochen habe.', 'Seit mein Sohn in die Schule geht, passen meine Arbeitszeiten nicht mehr gut zu unserem Alltag. Deshalb habe ich meinen Chef um ein Gespräch gebeten. Ich habe erklärt, dass ich am Nachmittag früher zu Hause sein muss. Dafür könnte ich morgens eine Stunde früher anfangen. Mein Chef wollte zuerst mit dem Team sprechen. Einige Tage später hat er meinem Vorschlag zugestimmt. Wir probieren die neue Regelung zunächst für einen Monat aus. Ich bin froh, dass ich offen über mein Problem gesprochen habe.'),
 ('194df28b-7175-5ffa-9813-2c5967cc2cb9', 'Eine Reklamation im Geschäft', 'Eine Reklamation im Geschäft', 'Vor zwei Wochen habe ich neue Schuhe gekauft. Schon nach wenigen Tagen hat sich an einem Schuh die Sohle gelöst. Deshalb bin ich mit den Schuhen und dem Kassenbon ins Geschäft gegangen. Ich habe der Verkäuferin ruhig erklärt, was passiert ist. Sie hat die Schuhe geprüft und eine Kollegin dazugeholt. Leider war meine Größe nicht mehr da. Wir haben vereinbart, dass das Geschäft mich anruft, sobald ein neues Paar ankommt. Die freundliche Lösung hat mich erleichtert.', 'Vor zwei Wochen habe ich neue Schuhe gekauft. Schon nach wenigen Tagen hat sich an einem Schuh die Sohle gelöst. Deshalb bin ich mit den Schuhen und dem Kassenbon ins Geschäft gegangen. Ich habe dem Verkäufer ruhig erklärt, was passiert ist. Er hat die Schuhe geprüft und einen Kollegen dazugeholt. Leider war meine Größe nicht mehr da. Wir haben vereinbart, dass das Geschäft mich anruft, sobald ein neues Paar ankommt. Die freundliche Lösung hat mich erleichtert.'),
 ('1c914afb-1958-5045-bda2-d609de2bd365', 'Ein freiwilliger Einsatz', 'Ein freiwilliger Einsatz', 'In unserem Stadtteil wurde am Samstag Müll gesammelt. Ich habe durch einen Aushang davon erfahren und mich angemeldet. Am Treffpunkt bekamen wir Handschuhe und große Säcke. Eine Organisatorin erklärte, welche Wege wir sauber machen sollten. Ich war mit einer älteren Frau in einer Gruppe. Während wir arbeiteten, erzählte sie mir viel über den Stadtteil. Nach zwei Stunden waren die Wege deutlich sauberer. Zum Schluss gab es Suppe für alle. Beim nächsten Mal möchte ich wieder mithelfen.', 'In unserem Stadtteil wurde am Samstag Müll gesammelt. Ich habe durch einen Aushang davon erfahren und mich angemeldet. Am Treffpunkt bekamen wir Handschuhe und große Säcke. Ein Organisator erklärte, welche Wege wir sauber machen sollten. Ich war mit einem älteren Mann in einer Gruppe. Während wir arbeiteten, erzählte er mir viel über den Stadtteil. Nach zwei Stunden waren die Wege deutlich sauberer. Zum Schluss gab es Suppe für alle. Beim nächsten Mal möchte ich wieder mithelfen.'),
 ('cff8a034-8b6e-5258-affc-6958091ef60b', 'Ein Missverständnis am Telefon', 'Ein Missverständnis am Telefon', 'Ich hatte telefonisch einen Termin beim Friseur vereinbart. Als ich am Dienstag im Salon ankam, war mein Name nicht im Kalender. Die Mitarbeiterin fragte noch einmal nach meiner Telefonnummer. Dann stellte sich heraus, dass sie Donnerstag statt Dienstag verstanden hatte. Früher hätte ich mich in so einer Situation sehr geärgert. Diesmal blieben wir beide ruhig und suchten eine Lösung. Nach einer kurzen Wartezeit konnte ich doch noch bleiben. In Zukunft wiederhole ich Datum und Uhrzeit am Ende des Gesprächs.', 'Ich hatte telefonisch einen Termin beim Friseur vereinbart. Als ich am Dienstag im Salon ankam, war mein Name nicht im Kalender. Der Mitarbeiter fragte noch einmal nach meiner Telefonnummer. Dann stellte sich heraus, dass er Donnerstag statt Dienstag verstanden hatte. Früher hätte ich mich in so einer Situation sehr geärgert. Diesmal blieben wir beide ruhig und suchten eine Lösung. Nach einer kurzen Wartezeit konnte ich doch noch bleiben. In Zukunft wiederhole ich Datum und Uhrzeit am Ende des Gesprächs.'),
 ('f6fed4f3-e48e-5cc0-91e6-270734c1e369', 'Ein Gespräch mit der Lehrerin', 'Ein Gespräch mit dem Lehrer', 'Die Lehrerin meines Sohnes hat mich zu einem Gespräch eingeladen. Zuerst war ich besorgt, weil ich nicht wusste, worum es ging. Im Gespräch erklärte sie, dass mein Sohn im Unterricht gut mitarbeitet, aber seine Hausaufgaben oft vergisst. Gemeinsam haben wir überlegt, wie wir ihm helfen können. Er bekommt jetzt ein kleines Heft, in das er seine Aufgaben schreibt. Zu Hause schauen wir jeden Nachmittag kurz hinein. Nach zwei Wochen klappt es schon besser. Die gemeinsame Lösung war hilfreicher als Schimpfen.', 'Der Lehrer meines Sohnes hat mich zu einem Gespräch eingeladen. Zuerst war ich besorgt, weil ich nicht wusste, worum es ging. Im Gespräch erklärte er, dass mein Sohn im Unterricht gut mitarbeitet, aber seine Hausaufgaben oft vergisst. Gemeinsam haben wir überlegt, wie wir ihm helfen können. Er bekommt jetzt ein kleines Heft, in das er seine Aufgaben schreibt. Zu Hause schauen wir jeden Nachmittag kurz hinein. Nach zwei Wochen klappt es schon besser. Die gemeinsame Lösung war hilfreicher als Schimpfen.'),
 ('19846618-a6c3-5001-84d5-06b21b99dff5', 'Ein neuer Beruf als Chance', 'Ein neuer Beruf als Chance', 'Nachdem ich viele Jahre im Verkauf gearbeitet hatte, wollte ich beruflich etwas Neues ausprobieren. Besonders die Arbeit mit älteren Menschen interessierte mich. Deshalb habe ich mich über eine Ausbildung im Pflegebereich informiert. Die Beratung war hilfreich, trotzdem hatte ich Zweifel: Würde mein Deutsch für den Unterricht ausreichen? Eine Beraterin empfahl mir ein Praktikum. Dort merkte ich, dass ich vieles verstehen konnte und bei Unklarheiten nachfragen durfte. Jetzt bereite ich meine Bewerbung vor. Der Wechsel wird bestimmt anstrengend, aber ich möchte es versuchen. Für mich bedeutet Lernen auch, neue Möglichkeiten zu entdecken.', 'Nachdem ich viele Jahre im Verkauf gearbeitet hatte, wollte ich beruflich etwas Neues ausprobieren. Besonders die Arbeit mit älteren Menschen interessierte mich. Deshalb habe ich mich über eine Ausbildung im Pflegebereich informiert. Die Beratung war hilfreich, trotzdem hatte ich Zweifel: Würde mein Deutsch für den Unterricht ausreichen? Ein Berater empfahl mir ein Praktikum. Dort merkte ich, dass ich vieles verstehen konnte und bei Unklarheiten nachfragen durfte. Jetzt bereite ich meine Bewerbung vor. Der Wechsel wird bestimmt anstrengend, aber ich möchte es versuchen. Für mich bedeutet Lernen auch, neue Möglichkeiten zu entdecken.'),
 ('f0c48467-2e7b-53ef-acde-b08564514ba9', 'Freundschaften in einer neuen Stadt', 'Freundschaften in einer neuen Stadt', 'Als ich nach Hannover gezogen bin, kannte ich außer meiner Schwester niemanden. Nach der Arbeit blieb ich meistens zu Hause und fühlte mich oft allein. Meine Schwester schlug vor, einen Kurs zu besuchen, der nichts mit meinem Beruf zu tun hatte. Ich entschied mich für einen Fotokurs. Anfangs fiel es mir schwer, die anderen anzusprechen. Doch bei den gemeinsamen Spaziergängen kamen Gespräche fast von selbst zustande. Aus zwei Bekanntschaften sind inzwischen Freundschaften geworden. Ich habe gelernt, dass Kontakte Zeit brauchen. Manchmal reicht ein gemeinsames Interesse, damit aus einem ersten Gespräch mehr entsteht.', 'Als ich nach Hannover gezogen bin, kannte ich außer meinem Bruder niemanden. Nach der Arbeit blieb ich meistens zu Hause und fühlte mich oft allein. Mein Bruder schlug vor, einen Kurs zu besuchen, der nichts mit meinem Beruf zu tun hatte. Ich entschied mich für einen Fotokurs. Anfangs fiel es mir schwer, die anderen anzusprechen. Doch bei den gemeinsamen Spaziergängen kamen Gespräche fast von selbst zustande. Aus zwei Bekanntschaften sind inzwischen Freundschaften geworden. Ich habe gelernt, dass Kontakte Zeit brauchen. Manchmal reicht ein gemeinsames Interesse, damit aus einem ersten Gespräch mehr entsteht.'),
 ('2824e504-aef5-5a89-9290-aa72f1d42342', 'Eine kleine Reise allein', 'Eine kleine Reise allein', 'Zum ersten Mal seit vielen Jahren bin ich allein für ein Wochenende verreist. Ich hatte mir eine kleine Stadt ausgesucht, die gut mit dem Zug erreichbar war. Zuerst fand ich es ungewohnt, alle Entscheidungen selbst zu treffen. Niemand fragte, wann wir essen oder welches Museum wir besuchen wollten. Nach einigen Stunden begann ich, diese Freiheit zu genießen. In einem Café kam ich mit einer anderen Reisenden ins Gespräch. Wir tauschten Tipps aus und gingen dann wieder eigene Wege. Zu Hause freute ich mich auf meine Familie. Trotzdem möchte ich eine solche Reise gern wiederholen.', 'Zum ersten Mal seit vielen Jahren bin ich allein für ein Wochenende verreist. Ich hatte mir eine kleine Stadt ausgesucht, die gut mit dem Zug erreichbar war. Zuerst fand ich es ungewohnt, alle Entscheidungen selbst zu treffen. Niemand fragte, wann wir essen oder welches Museum wir besuchen wollten. Nach einigen Stunden begann ich, diese Freiheit zu genießen. In einem Café kam ich mit einem anderen Reisenden ins Gespräch. Wir tauschten Tipps aus und gingen dann wieder eigene Wege. Zu Hause freute ich mich auf meine Familie. Trotzdem möchte ich eine solche Reise gern wiederholen.'),
 ('92818a0b-1e3d-5f69-b023-f61637d49279', 'Homeoffice im Alltag', 'Homeoffice im Alltag', 'An zwei Tagen in der Woche arbeite ich von zu Hause aus. Dadurch spare ich den Arbeitsweg und kann morgens ruhiger beginnen. Allerdings war es anfangs schwierig, nach Feierabend wirklich aufzuhören. Mein Laptop stand auf dem Küchentisch, und ich beantwortete noch spät Nachrichten. Inzwischen habe ich einen festen Arbeitsplatz und klare Arbeitszeiten. Nach der letzten Aufgabe schalte ich den Computer aus und gehe kurz spazieren. Diese kleine Gewohnheit hilft mir, Arbeit und Freizeit zu trennen. Den Kontakt zu meinen Kolleginnen und Kollegen möchte ich trotzdem nicht verlieren. Deshalb bin ich auch gern regelmäßig im Büro.', 'An zwei Tagen in der Woche arbeite ich von zu Hause aus. Dadurch spare ich den Arbeitsweg und kann morgens ruhiger beginnen. Allerdings war es anfangs schwierig, nach Feierabend wirklich aufzuhören. Mein Laptop stand auf dem Küchentisch, und ich beantwortete noch spät Nachrichten. Inzwischen habe ich einen festen Arbeitsplatz und klare Arbeitszeiten. Nach der letzten Aufgabe schalte ich den Computer aus und gehe kurz spazieren. Diese kleine Gewohnheit hilft mir, Arbeit und Freizeit zu trennen. Den Kontakt zu meinen Kollegen möchte ich trotzdem nicht verlieren. Deshalb bin ich auch gern regelmäßig im Büro.'),
 ('d0e1136a-e6ee-5b28-b3b8-37c744be5528', 'Gemeinsam eine Veranstaltung planen', 'Gemeinsam eine Veranstaltung planen', 'Unser Deutschkurs organisiert einen kleinen Nachmittag für Familien und Freunde. Wir möchten zeigen, was wir in den letzten Monaten gelernt haben. Eine Gruppe bereitet kurze Geschichten vor, eine andere kümmert sich um Spiele für die Kinder. Ich bin für die Einladung zuständig. Zuerst hatte ich Angst, dabei Fehler zu machen. Die Lehrerin erklärte jedoch, dass wir uns gegenseitig helfen sollen. Gemeinsam haben wir den Text gelesen und verbessert. Bei der Planung merken wir, wie viel man mit Deutsch schon erreichen kann. Entscheidend ist, dass wir miteinander sprechen und nicht auf den perfekten Satz warten.', 'Unser Deutschkurs organisiert einen kleinen Nachmittag für Familien und Freunde. Wir möchten zeigen, was wir in den letzten Monaten gelernt haben. Eine Gruppe bereitet kurze Geschichten vor, eine andere kümmert sich um Spiele für die Jungen. Ich bin für die Einladung zuständig. Zuerst hatte ich Angst, dabei Fehler zu machen. Der Lehrer erklärte jedoch, dass wir uns gegenseitig helfen sollen. Gemeinsam haben wir den Text gelesen und verbessert. Bei der Planung merken wir, wie viel man mit Deutsch schon erreichen kann. Entscheidend ist, dass wir miteinander sprechen und nicht auf den perfekten Satz warten.'),
 ('8c963a66-e60b-5f88-bee3-73aa3f3e3df7', 'Mit Fehlern umgehen', 'Mit Fehlern umgehen', 'In meinem ersten Jahr in Deutschland wollte ich möglichst keine Fehler machen. Deshalb habe ich oft geschwiegen, obwohl ich etwas sagen konnte. Das änderte sich bei einem Gespräch mit einer Kollegin. Sie erzählte mir, wie unsicher sie selbst beim Lernen einer anderen Sprache war. Seitdem versuche ich, Fehler als Teil des Lernens zu betrachten. Wenn ich ein Wort falsch benutze, schreibe ich mir später ein Beispiel auf. Natürlich gibt es Situationen, in denen Genauigkeit wichtig ist. Im Alltag hilft es mir aber mehr, freundlich nachzufragen und weiterzusprechen. So werde ich langsam sicherer.', 'In meinem ersten Jahr in Deutschland wollte ich möglichst keine Fehler machen. Deshalb habe ich oft geschwiegen, obwohl ich etwas sagen konnte. Das änderte sich bei einem Gespräch mit einem Kollegen. Er erzählte mir, wie unsicher er selbst beim Lernen einer anderen Sprache war. Seitdem versuche ich, Fehler als Teil des Lernens zu betrachten. Wenn ich ein Wort falsch benutze, schreibe ich mir später ein Beispiel auf. Natürlich gibt es Situationen, in denen Genauigkeit wichtig ist. Im Alltag hilft es mir aber mehr, freundlich nachzufragen und weiterzusprechen. So werde ich langsam sicherer.'),
 ('c5dc1e9e-43fb-5505-ae4a-82cdc74fac41', 'Ein Ort für alle Generationen', 'Ein Ort für alle Generationen', 'In unserem Stadtteil wurde ein leer stehender Laden in einen offenen Treffpunkt umgebaut. Dort kann man lesen, Kaffee trinken oder an kleinen Veranstaltungen teilnehmen. Besonders schön finde ich, dass Menschen verschiedener Generationen zusammenkommen. Eine Rentnerin bietet Hilfe beim Nähen an, während Jugendliche Fragen zum Smartphone beantworten. Niemand muss etwas kaufen, um bleiben zu dürfen. Ich besuche dort einmal im Monat ein Sprachcafé. Dabei üben wir Deutsch und sprechen über unseren Alltag. Der Treffpunkt zeigt, dass gute Begegnungen nicht viel kosten müssen. Wichtig sind ein offener Raum und Menschen, die ihre Zeit miteinander teilen.', 'In unserem Stadtteil wurde ein leer stehender Laden in einen offenen Treffpunkt umgebaut. Dort kann man lesen, Kaffee trinken oder an kleinen Veranstaltungen teilnehmen. Besonders schön finde ich, dass Menschen verschiedener Generationen zusammenkommen. Ein Rentner bietet Hilfe beim Nähen an, während Jugendliche Fragen zum Smartphone beantworten. Niemand muss etwas kaufen, um bleiben zu dürfen. Ich besuche dort einmal im Monat ein Sprachcafé. Dabei üben wir Deutsch und sprechen über unseren Alltag. Der Treffpunkt zeigt, dass gute Begegnungen nicht viel kosten müssen. Wichtig sind ein offener Raum und Menschen, die ihre Zeit miteinander teilen.'),
 ('b080a8ae-7be6-5225-af48-1d7aae6f1f6c', 'Künstliche Intelligenz beim Lernen', 'Künstliche Intelligenz beim Lernen', 'Digitale Programme können beim Sprachenlernen nützlich sein. Sie erklären Wörter, lesen Texte vor und bieten Übungen zu verschiedenen Themen an. Ich nutze solche Hilfen gern, besonders wenn ich zu Hause eine kurze Frage habe. Trotzdem prüfe ich Antworten, die mir ungewöhnlich vorkommen. Ein Programm kennt meine persönliche Situation nicht immer und kann auch Fehler machen. Das Gespräch mit einer Lehrkraft bleibt deshalb wichtig. Sie hört, was ich eigentlich ausdrücken möchte, und kann gezielt nachfragen. Für mich ergänzen sich digitale Übungen und persönlicher Unterricht. Entscheidend ist, dass ich selbst aktiv bleibe, statt jede Aufgabe sofort von einem Programm lösen zu lassen.', 'Digitale Programme können beim Sprachenlernen nützlich sein. Sie erklären Wörter, lesen Texte vor und bieten Übungen zu verschiedenen Themen an. Ich nutze solche Hilfen gern, besonders wenn ich zu Hause eine kurze Frage habe. Trotzdem prüfe ich Antworten, die mir ungewöhnlich vorkommen. Ein Programm kennt meine persönliche Situation nicht immer und kann auch Fehler machen. Das Gespräch mit einem Lehrer bleibt deshalb wichtig. Er hört, was ich eigentlich ausdrücken möchte, und kann gezielt nachfragen. Für mich ergänzen sich digitale Übungen und persönlicher Unterricht. Entscheidend ist, dass ich selbst aktiv bleibe, statt jede Aufgabe sofort von einem Programm lösen zu lassen.'),
 ('8cf76d58-8428-59ef-b449-4301051413ba', 'Die Stadt aus einer anderen Perspektive', 'Die Stadt aus einer anderen Perspektive', 'Vor Kurzem habe ich einen Spaziergang mit einer Bekannten gemacht, die einen Rollstuhl benutzt. Wir wollten gemeinsam ein Café besuchen und danach in die Bibliothek gehen. Schon auf dem Weg fiel mir auf, wie viele kleine Hindernisse ich sonst übersehe: eine hohe Bordsteinkante, Fahrräder auf dem Gehweg und eine schwere Eingangstür. Meine Bekannte erklärte, welche Wege gut funktionieren und wo sie Hilfe braucht. Gleichzeitig wollte sie nicht, dass ich alles ungefragt für sie übernehme. Der Nachmittag hat meinen Blick auf die Stadt verändert. Seitdem achte ich stärker darauf, ob Orte wirklich für alle zugänglich sind. Gute Absichten helfen, aber Zuhören und konkrete Verbesserungen sind ebenso wichtig.', 'Vor Kurzem habe ich einen Spaziergang mit einem Bekannten gemacht, der einen Rollstuhl benutzt. Wir wollten gemeinsam ein Café besuchen und danach in die Bibliothek gehen. Schon auf dem Weg fiel mir auf, wie viele kleine Hindernisse ich sonst übersehe: eine hohe Bordsteinkante, Fahrräder auf dem Gehweg und eine schwere Eingangstür. Mein Bekannter erklärte, welche Wege gut funktionieren und wo er Hilfe braucht. Gleichzeitig wollte er nicht, dass ich alles ungefragt für ihn übernehme. Der Nachmittag hat meinen Blick auf die Stadt verändert. Seitdem achte ich stärker darauf, ob Orte wirklich für alle zugänglich sind. Gute Absichten helfen, aber Zuhören und konkrete Verbesserungen sind ebenso wichtig.'),
 ('6e667abd-3011-597c-9cf9-0c20c2c30e2d', 'Was Erfolg beim Sprachenlernen bedeutet', 'Was Erfolg beim Sprachenlernen bedeutet', 'Vor einem Jahr hätte ich Erfolg beim Deutschlernen vor allem an einer guten Prüfungsnote gemessen. Heute denke ich auch an viele kleine Situationen: ein verständliches Telefonat, ein Gespräch mit der Lehrerin meines Kindes oder eine Frage bei der Arbeit. Solche Erlebnisse zeigen mir, dass ich die Sprache tatsächlich nutzen kann. Natürlich möchte ich meine Grammatik und Aussprache weiter verbessern. Trotzdem versuche ich, meinen Fortschritt nicht ständig mit dem anderer Menschen zu vergleichen. Jeder bringt andere Erfahrungen mit und hat unterschiedlich viel Zeit. Mein nächstes Ziel ist, in einer Besprechung meine Meinung klar zu erklären. Es ist ein kleines Ziel, aber für meinen Alltag ein bedeutender Schritt.', 'Vor einem Jahr hätte ich Erfolg beim Deutschlernen vor allem an einer guten Prüfungsnote gemessen. Heute denke ich auch an viele kleine Situationen: ein verständliches Telefonat, ein Gespräch mit dem Lehrer meines Sohnes oder eine Frage bei der Arbeit. Solche Erlebnisse zeigen mir, dass ich die Sprache tatsächlich nutzen kann. Natürlich möchte ich meine Grammatik und Aussprache weiter verbessern. Trotzdem versuche ich, meinen Fortschritt nicht ständig mit dem anderer Menschen zu vergleichen. Jeder bringt andere Erfahrungen mit und hat unterschiedlich viel Zeit. Mein nächstes Ziel ist, in einer Besprechung meine Meinung klar zu erklären. Es ist ein kleines Ziel, aber für meinen Alltag ein bedeutender Schritt.')
 ) AS revisions(id,old_title,title,old_text,text) LOOP
  IF EXISTS(SELECT 1 FROM public.learning_reading_texts r WHERE r.id=edit.id::uuid AND r.sentence_de=edit.old_text) THEN
   INSERT INTO sitov_pronunciation_private.legacy_reference_audio(prompt_id,sentence_de,audio_url)
    SELECT r.id,r.sentence_de,r.audio_url FROM public.learning_reading_texts r
     WHERE r.id=edit.id::uuid AND r.audio_url IS NOT NULL ON CONFLICT DO NOTHING;
   UPDATE public.learning_reading_texts SET sentence_de=edit.text,audio_url=NULL WHERE id=edit.id::uuid;
   UPDATE public.learning_units u SET label=edit.title
    WHERE u.id=(SELECT r.unit_id FROM public.learning_reading_texts r WHERE r.id=edit.id::uuid)
     AND u.trainer='pronunciation' AND u.label=edit.old_title;
  END IF;
 END LOOP;
END;
$sitov_reading_revision$;
-- END SITOV MALE PRONUNCIATION READINGS
