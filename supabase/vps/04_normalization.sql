-- Phase 2.6. Apply only after 02_identity_alignment, 01_critical_fixes and 03 registration.
-- The deployment runner owns the transaction. Backup and SHA256 are mandatory.
-- Preflight failures abort the transaction; no guessed identity, course or learning level.

CREATE TABLE IF NOT EXISTS public.course_audiences (
 code text PRIMARY KEY,
 CONSTRAINT course_audiences_code_length CHECK (length(btrim(code)) BETWEEN 1 AND 30)
);
ALTER TABLE public.course_audiences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_audiences FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_audiences TO anon, authenticated;
GRANT ALL ON public.course_audiences TO service_role;
DROP POLICY IF EXISTS catalog_read ON public.course_audiences;
CREATE POLICY catalog_read ON public.course_audiences FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS audience_code text;
-- Preserve marketing ranges independently of authorization levels. NULL means no exact level.
INSERT INTO public.course_audiences(code)
 SELECT DISTINCT level FROM public.courses WHERE nullif(btrim(level),'') IS NOT NULL
 ON CONFLICT DO NOTHING;
INSERT INTO public.course_audiences(code) SELECT code FROM public.learning_levels ON CONFLICT DO NOTHING;
UPDATE public.courses SET audience_code=level WHERE audience_code IS NULL AND nullif(btrim(level),'') IS NOT NULL;
ALTER TABLE public.courses ALTER COLUMN level DROP NOT NULL, ALTER COLUMN level DROP DEFAULT;
UPDATE public.courses c SET level=NULL WHERE level IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.learning_levels l WHERE l.code=c.level);

ALTER TABLE public.cancellation_requests ADD COLUMN IF NOT EXISTS course_id uuid;
DO $migration$
DECLARE unresolved integer;
BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cancellation_requests' AND column_name='course_name') THEN
  UPDATE public.cancellation_requests r SET course_id=match.course_id
  FROM (SELECT r0.id,(array_agg(DISTINCT c.id))[1] course_id
   FROM public.cancellation_requests r0 JOIN public.courses c
   ON lower(btrim(r0.course_name)) IN (lower(c.title),lower(c.slug))
    OR EXISTS (SELECT 1 FROM public.course_translations t WHERE t.course_id=c.id AND lower(btrim(t.title))=lower(btrim(r0.course_name)))
   WHERE r0.course_id IS NULL AND nullif(btrim(r0.course_name),'') IS NOT NULL
   GROUP BY r0.id HAVING count(DISTINCT c.id)=1) match WHERE r.id=match.id;
  SELECT count(*) INTO unresolved FROM public.cancellation_requests
   WHERE course_id IS NULL AND nullif(btrim(course_name),'') IS NOT NULL;
  IF unresolved>0 THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='normalization_unresolved_cancellation',
   DETAIL=jsonb_build_object('error','unresolved_course','message','Cancellation course names require an unambiguous existing course.','count',unresolved)::text; END IF;
  ALTER TABLE public.cancellation_requests DROP COLUMN course_name;
 END IF;
END $migration$;
ALTER TABLE public.submissions DROP COLUMN IF EXISTS prompt_title;

-- Capture only the trainer/CEFR FKs that must temporarily release their typed columns.
CREATE TEMP TABLE phase2_enum_fks ON COMMIT DROP AS
 SELECT conrelid::regclass relation, conname, pg_get_constraintdef(oid) definition
 FROM pg_constraint WHERE contype='f' AND conname IN (
 'learning_grants_trainer_fk','learning_units_trainer_fk','learning_levels_cefr_fk',
 'learning_unit_grants_unit_id_level_trainer_fkey','learning_unit_grants_user_id_level_trainer_fkey',
 'learning_unit_grants_auth_user_id_level_trainer_fkey');
DO $migration$ DECLARE item record; BEGIN
 FOR item IN SELECT * FROM phase2_enum_fks LOOP
  EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',item.relation,item.conname);
 END LOOP;
END $migration$;

DROP INDEX IF EXISTS public.bookings_person_month;
DROP INDEX IF EXISTS public.learning_units_named_lesson_idx;
DROP INDEX IF EXISTS private.mail_outbox_due_idx;
DROP INDEX IF EXISTS private.mail_outbox_lease_idx;
ALTER TABLE public.invoice_cases DROP CONSTRAINT IF EXISTS invoice_cases_check;
ALTER TABLE private.mail_outbox DROP CONSTRAINT IF EXISTS mail_outbox_check;

-- Closed business domains use enums; locale and authorization levels stay reference codes.
CREATE TEMP TABLE phase2_enum_columns (
 relation regclass, column_name text, enum_name text, labels text[], default_value text
) ON COMMIT DROP;
INSERT INTO phase2_enum_columns VALUES
 ('public.bookings'::regclass,'kind','booking_kind',ARRAY['registration','monthly','trial'],'registration'),
 ('public.bookings'::regclass,'status','booking_status',ARRAY['pending','confirmed','cancelled','rejected'],'pending'),
 ('public.learning_trainers'::regclass,'code','trainer_code',ARRAY['vocabulary','exercises','pronunciation','videos'],NULL),
 ('public.learning_units'::regclass,'trainer','trainer_code',ARRAY['vocabulary','exercises','pronunciation','videos'],NULL),
 ('public.learning_trainer_grants'::regclass,'trainer','trainer_code',ARRAY['vocabulary','exercises','pronunciation','videos'],NULL),
 ('public.learning_unit_grants'::regclass,'trainer','trainer_code',ARRAY['vocabulary','exercises','pronunciation','videos'],NULL),
 ('public.profiles'::regclass,'role','profile_role',ARRAY['student','teacher','admin'],'student'),
 ('public.pronunciation_messages'::regclass,'sender_role','profile_role',ARRAY['student','teacher','admin'],'student'),
 ('public.submissions'::regclass,'type','submission_type',ARRAY['audio','text'],NULL),
 ('public.submissions'::regclass,'status','submission_status',ARRAY['pending','reviewed'],'pending'),
 ('public.courses'::regclass,'category','course_category',ARRAY['german','speaking','online','private'],NULL),
 ('public.courses'::regclass,'type','course_type',ARRAY['presence','online'],NULL),
 ('public.invoice_cases'::regclass,'status','invoice_status',ARRAY['outstanding','created'],'outstanding'),
 ('public.cancellation_requests'::regclass,'termination_type','cancellation_type',ARRAY['asap','specific_date'],NULL),
 ('public.learning_exercises'::regclass,'type','exercise_type',ARRAY['fill_in_blank','multiple_choice','sentence_building'],NULL),
 ('public.learning_trainer_grants'::regclass,'unit_mode','unit_access_mode',ARRAY['all','selected'],'all'),
 ('public.learning_vocabulary_cards'::regclass,'article','grammatical_article',ARRAY['der','die','das','none'],NULL),
 ('public.vocabulary_direction_progress'::regclass,'direction','vocabulary_direction',ARRAY['de_to_native','native_to_de'],NULL),
 ('public.vocabulary_onboarding'::regclass,'status','onboarding_status',ARRAY['skipped','completed'],NULL),
 ('private.mail_outbox'::regclass,'kind','mail_kind',ARRAY['registration_received','registration_confirmed','booking_cancelled','cancellation_requested','trial_confirmed','trial_cancelled','new_enrollment','feedback_available','raw'],NULL),
 ('private.mail_outbox'::regclass,'status','mail_status',ARRAY['pending','processing','sent','failed'],'pending'),
 ('public.cefr_levels'::regclass,'code','cefr_code',ARRAY['A1','A2','B1','B2','C1','C2'],NULL),
 ('public.learning_levels'::regclass,'cefr_level','cefr_code',ARRAY['A1','A2','B1','B2','C1','C2'],NULL);
DO $migration$
DECLARE item record; existing text[]; constraint_row record;
BEGIN
 FOR item IN SELECT DISTINCT enum_name,labels FROM phase2_enum_columns LOOP
  IF to_regtype('public.'||item.enum_name) IS NULL THEN
   EXECUTE format('CREATE TYPE public.%I AS ENUM (%s)',item.enum_name,
    (SELECT string_agg(quote_literal(label),',') FROM unnest(item.labels) label));
  ELSE
   SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) INTO existing FROM pg_enum e
    WHERE e.enumtypid=to_regtype('public.'||item.enum_name);
   -- Phase 6 appends one explicitly versioned mail event. Preserve strict
   -- catalog checks for every other enum and any unknown/reordered labels.
   IF existing IS DISTINCT FROM item.labels AND NOT (item.enum_name='mail_kind'
    AND existing=item.labels||ARRAY['course_exception_added']::text[]) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='normalization_enum_definition_mismatch', DETAIL=item.enum_name;
   END IF;
  END IF;
 END LOOP;
 FOR item IN SELECT * FROM phase2_enum_columns LOOP
  IF (SELECT atttypid FROM pg_attribute WHERE attrelid=item.relation AND attname=item.column_name)
    <> to_regtype('public.'||item.enum_name) THEN
   FOR constraint_row IN SELECT c.conname FROM pg_constraint c JOIN pg_attribute a
    ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
    WHERE c.conrelid=item.relation AND c.contype='c' AND a.attname=item.column_name LOOP
     EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',item.relation,constraint_row.conname);
   END LOOP;
   EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP DEFAULT',item.relation,item.column_name);
   EXECUTE format('ALTER TABLE %s ALTER COLUMN %I TYPE public.%I USING %I::text::public.%I',
    item.relation,item.column_name,item.enum_name,item.column_name,item.enum_name);
   IF item.default_value IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I SET DEFAULT %L::public.%I',item.relation,item.column_name,item.default_value,item.enum_name);
   END IF;
  END IF;
 END LOOP;
 FOR item IN SELECT * FROM phase2_enum_fks LOOP
  EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s',item.relation,item.conname,item.definition);
 END LOOP;
END $migration$;

CREATE UNIQUE INDEX bookings_person_month ON public.bookings(person_id,target_month) WHERE kind<>'trial';
CREATE UNIQUE INDEX learning_units_named_lesson_idx ON public.learning_units(level,trainer,label) WHERE trainer IN('vocabulary','exercises');
CREATE INDEX mail_outbox_due_idx ON private.mail_outbox(available_at,created_at) WHERE status='pending';
CREATE INDEX mail_outbox_lease_idx ON private.mail_outbox(lease_until) WHERE status='processing';
ALTER TABLE public.invoice_cases ADD CONSTRAINT invoice_cases_check CHECK ((status='created')=(invoice_created_at IS NOT NULL));
ALTER TABLE private.mail_outbox ADD CONSTRAINT mail_outbox_check CHECK ((status='processing')=((lease_token IS NOT NULL) AND (lease_until IS NOT NULL)));

-- Reference tables already constrain these domains; remove the redundant locale checks.
ALTER TABLE public.vocabulary_translations DROP CONSTRAINT IF EXISTS vocabulary_translations_locale_check;
ALTER TABLE public.grammar_translations DROP CONSTRAINT IF EXISTS grammar_translations_locale_check;
ALTER TABLE public.course_translations DROP CONSTRAINT IF EXISTS course_translations_non_source_locale;
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_level_check;
ALTER TABLE public.vocabulary_onboarding DROP CONSTRAINT IF EXISTS vocabulary_onboarding_level_check;
ALTER TABLE private.mail_outbox DROP CONSTRAINT IF EXISTS mail_outbox_locale_check;
ALTER TABLE vocabulary_private.answer_receipts DROP CONSTRAINT IF EXISTS answer_receipts_ui_language_check;
-- The reset bucket receives a real storage FK. Keep its single-bucket safety check:
-- a learning reset must never expand to deleting course assets.

DO $migration$
DECLARE item record;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('public.courses','courses_level_fkey','FOREIGN KEY(level) REFERENCES public.learning_levels(code)'),
  ('public.courses','courses_audience_code_fkey','FOREIGN KEY(audience_code) REFERENCES public.course_audiences(code)'),
  ('public.learning_unit_grants','learning_unit_grants_level_fkey','FOREIGN KEY(level) REFERENCES public.learning_levels(code)'),
  ('public.cancellation_requests','cancellation_requests_course_id_fkey','FOREIGN KEY(course_id) REFERENCES public.courses(id)'),
  ('vocabulary_private.answer_receipts','answer_receipts_ui_language_fkey','FOREIGN KEY(ui_language) REFERENCES public.locales(code)'),
  ('learning_reset_private.audio_objects','audio_objects_bucket_id_fkey','FOREIGN KEY(bucket_id) REFERENCES storage.buckets(id)')
 ) AS constraints(relation,name,definition) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=item.relation::regclass AND conname=item.name) THEN
   EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s',item.relation,item.name,item.definition);
  END IF;
 END LOOP;
END $migration$;
CREATE INDEX IF NOT EXISTS courses_level_idx ON public.courses(level);
CREATE INDEX IF NOT EXISTS courses_audience_code_idx ON public.courses(audience_code);
CREATE INDEX IF NOT EXISTS learning_unit_grants_level_idx ON public.learning_unit_grants(level);
CREATE INDEX IF NOT EXISTS cancellation_requests_course_id_idx ON public.cancellation_requests(course_id);
CREATE INDEX IF NOT EXISTS answer_receipts_ui_language_idx ON vocabulary_private.answer_receipts(ui_language);
CREATE INDEX IF NOT EXISTS audio_objects_bucket_id_idx ON learning_reset_private.audio_objects(bucket_id);

CREATE OR REPLACE FUNCTION platform_private.touch_updated_at() RETURNS trigger
 LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
 NEW.updated_at := now();
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION platform_private.touch_updated_at() FROM PUBLIC,anon,authenticated;
DO $migration$ DECLARE item record; BEGIN
 FOR item IN SELECT table_schema,table_name FROM information_schema.columns
  WHERE column_name='updated_at' AND table_schema IN ('public','business_private','learning_private','vocabulary_private','learning_reset_private','private','platform_private','identity_private','grammar_private','pronunciation_private','trainer_access_private')
  AND EXISTS(SELECT 1 FROM information_schema.tables t WHERE t.table_schema=columns.table_schema AND t.table_name=columns.table_name AND t.table_type='BASE TABLE') LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I.%I',item.table_schema,item.table_name);
  EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at()',item.table_schema,item.table_name);
 END LOOP;
END $migration$;

-- Minimal grammar contract prerequisite. Preserve legacy keys until Phase 3.1.
-- All exercises expose accepted_answers; only gradable types require a nonempty list.
CREATE OR REPLACE FUNCTION grammar_private.valid_accepted_answers(p_content jsonb,p_type public.exercise_type) RETURNS boolean
 LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE answers jsonb:=p_content->'accepted_answers';
BEGIN
 IF jsonb_typeof(p_content) IS DISTINCT FROM 'object' OR jsonb_typeof(answers) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(answers)>21 OR EXISTS(SELECT 1 FROM jsonb_array_elements(answers) a WHERE jsonb_typeof(a) IS DISTINCT FROM 'string' OR length(btrim(a#>>'{}')) NOT BETWEEN 1 AND 1000) THEN RETURN false; END IF;
 IF p_type='multiple_choice' AND jsonb_array_length(answers)<>1 THEN RETURN false; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements_text(answers))<>(SELECT count(DISTINCT lower(regexp_replace(btrim(a),'\s+',' ','g'))) FROM jsonb_array_elements_text(answers) a) THEN RETURN false; END IF;
 RETURN p_type='sentence_building' OR (nullif(btrim(p_content->>'correct_answer'),'') IS NOT NULL AND EXISTS(
  SELECT 1 FROM jsonb_array_elements_text(answers) a WHERE lower(regexp_replace(btrim(a),'\s+',' ','g'))=
   lower(regexp_replace(btrim(p_content->>'correct_answer'),'\s+',' ','g'))));
END $function$;
REVOKE ALL ON FUNCTION grammar_private.valid_accepted_answers(jsonb,public.exercise_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grammar_private.valid_accepted_answers(jsonb,public.exercise_type) TO authenticated,service_role;
DO $migration$ BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_exercises e CROSS JOIN LATERAL
   (VALUES(e.content->'accepted_answers'),(e.content->'alternative_answers')) arrays(value)
   WHERE arrays.value IS NOT NULL AND (jsonb_typeof(arrays.value) IS DISTINCT FROM 'array'
    OR jsonb_path_exists(arrays.value,'$[*] ? (@.type() != "string")'))) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='normalization_invalid_answer_array',
   DETAIL='Existing answer arrays contain malformed data and require review before normalization.';
 END IF;
END $migration$;
UPDATE public.learning_exercises SET content=jsonb_set(content,'{accepted_answers}',
 coalesce((SELECT jsonb_agg(answer ORDER BY position) FROM (
  SELECT DISTINCT ON (lower(regexp_replace(btrim(answer),'\s+',' ','g'))) answer,position
  FROM jsonb_array_elements_text(jsonb_build_array(content->>'correct_answer') ||
    CASE WHEN jsonb_typeof(content->'accepted_answers')='array' THEN content->'accepted_answers'
     WHEN jsonb_typeof(content->'alternative_answers')='array' THEN content->'alternative_answers' ELSE '[]'::jsonb END)
    WITH ORDINALITY entry(answer,position)
  WHERE nullif(btrim(answer),'') IS NOT NULL
  ORDER BY lower(regexp_replace(btrim(answer),'\s+',' ','g')),position
 ) accepted),'[]'::jsonb))
WHERE NOT grammar_private.valid_accepted_answers(content,type);
ALTER TABLE public.learning_exercises DROP CONSTRAINT IF EXISTS learning_exercises_accepted_answers_check;
ALTER TABLE public.learning_exercises ADD CONSTRAINT learning_exercises_accepted_answers_check
 CHECK (grammar_private.valid_accepted_answers(content,type));

-- Update live function definitions so prior phase changes and ACLs remain intact.
-- Each replacement is exact and checked; unknown function drift aborts the migration.
CREATE TEMP TABLE phase2_function_patches (signature text,before_text text,after_text text) ON COMMIT DROP;
INSERT INTO phase2_function_patches VALUES
 ('learning_private.ensure_unit(uuid,text,text,text,boolean,integer)','trainer=p_trainer','trainer::text=p_trainer'),
 ('trainer_access_private.allowed(text,text)','trainer=p_trainer','trainer::text=p_trainer'),
 ('trainer_access_private.unit_allowed(text,text,text)','trainer=p_trainer','trainer::text=p_trainer'),
 ('public.set_student_trainer_access(uuid,text,text,boolean,uuid[],boolean)','trainer=p_trainer','trainer::text=p_trainer'),
 ('public.save_learning_content(text,jsonb,uuid)','public.learning_trainers WHERE code=p_trainer','public.learning_trainers WHERE code::text=p_trainer'),
 ('learning_private.ensure_unit(uuid,text,text,text,boolean,integer)','VALUES(p_id,p_level,p_trainer,p_label,p_active,p_sort)','VALUES(p_id,p_level,p_trainer::public.trainer_code,p_label,p_active,p_sort)'),
 ('learning_private.ensure_unit(uuid,text,text,text,boolean,integer)','VALUES(p_level,p_trainer,p_label,p_active,p_sort)','VALUES(p_level,p_trainer::public.trainer_code,p_label,p_active,p_sort)'),
 ('learning_private.unit_allowed(uuid)','unit_allowed(u.level,u.trainer,u.id::text)','unit_allowed(u.level,u.trainer::text,u.id::text)'),
 ('trainer_access_private.can_record()','unit_allowed(u.level,u.trainer,u.id::text)','unit_allowed(u.level,u.trainer::text,u.id::text)'),
 ('learning_private.validate_content_unit()','trainer=TG_ARGV[0]','trainer::text=TG_ARGV[0]'),
 ('identity_private.current_profile_role()','SELECT role FROM','SELECT role::text FROM'),
 ('public.save_learning_content(text,jsonb,uuid)','fields->>''article'',fields->>''plural''','(fields->>''article'')::public.grammatical_article,fields->>''plural'''),
 ('public.save_learning_content(text,jsonb,uuid)','fields->>''topic'',fields->>''type'',fields->''content''','fields->>''topic'',(fields->>''type'')::public.exercise_type,fields->''content'''),
 ('public.set_student_trainer_access(uuid,text,text,boolean,uuid[],boolean)','VALUES(p_user_id,p_level,p_trainer,p_enabled,CASE WHEN p_replace_units AND p_unit_ids IS NOT NULL THEN ''selected'' ELSE ''all'' END)','VALUES(p_user_id,p_level,p_trainer::public.trainer_code,p_enabled,(CASE WHEN p_replace_units AND p_unit_ids IS NOT NULL THEN ''selected'' ELSE ''all'' END)::public.unit_access_mode)'),
 ('public.set_student_trainer_access(uuid,text,text,boolean,uuid[],boolean)','SELECT DISTINCT p_user_id,p_level,p_trainer,item','SELECT DISTINCT p_user_id,p_level,p_trainer::public.trainer_code,item'),
 ('vocabulary_private.initialize_cards(jsonb)','SELECT actor, target, d, CASE','SELECT actor, target, d::public.vocabulary_direction, CASE'),
 ('business_private.mark_invoice(uuid,date,boolean,text)','status=case when p_created then ''created'' else ''outstanding'' end,','status=(case when p_created then ''created'' else ''outstanding'' end)::public.invoice_status,'),
 ('business_private.save_month(date,jsonb,boolean,uuid,integer)','case when p_paused then ''cancelled'' else ''pending'' end,','(case when p_paused then ''cancelled'' else ''pending'' end)::public.booking_status,'),
 ('public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean)','case when p_trial then ''trial'' else ''registration'' end,','(case when p_trial then ''trial'' else ''registration'' end)::public.booking_kind,'),
 ('public.fail_mail_job(uuid,uuid,text,boolean)','status=CASE WHEN p_permanent OR attempts>=8 THEN ''failed'' ELSE ''pending'' END,','status=(CASE WHEN p_permanent OR attempts>=8 THEN ''failed'' ELSE ''pending'' END)::public.mail_status,'),
 ('public.queue_transactional_email(text,text,text,text,jsonb)','VALUES(p_dedupe_key,p_kind,','VALUES(p_dedupe_key,p_kind::public.mail_kind,'),
 ('pronunciation_private.update_conversation_status()','status = CASE WHEN NEW.sender_role IN (''teacher'',''admin'') THEN ''reviewed'' ELSE ''pending'' END WHERE','status = (CASE WHEN NEW.sender_role IN (''teacher'',''admin'') THEN ''reviewed'' ELSE ''pending'' END)::public.submission_status WHERE'),
 ('pronunciation_private.create_submission(uuid,text)','status,level,prompt_id,prompt_title)','status,level,prompt_id)'),
 ('pronunciation_private.create_submission(uuid,text)','unit.level,prompt.id,unit.label)','unit.level,prompt.id)'),
 ('grammar_private.record_attempt(uuid,text,boolean)','target.content->''alternative_answers''','coalesce(target.content->''accepted_answers'',target.content->''alternative_answers'')'),
 ('business_private.save_course(jsonb)','type,category,level,unit_price','type,category,level,audience_code,unit_price'),
 ('business_private.save_course(jsonb)','p_data->>''type'',p_data->>''category'',coalesce(p_data->>''level'',''''),','(p_data->>''type'')::public.course_type,(p_data->>''category'')::public.course_category,(SELECT code FROM public.learning_levels WHERE code=nullif(p_data->>''level'','''')),nullif(p_data->>''level'',''''),'),
 ('business_private.save_course(jsonb)','category=excluded.category,level=excluded.level,','category=excluded.category,level=excluded.level,audience_code=excluded.audience_code,'),
 ('business_private.save_course(jsonb)',' v_id:=coalesce(nullif(p_data->>''id'','''')::uuid,gen_random_uuid());',' IF nullif(p_data->>''level'','''') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.course_audiences WHERE code=p_data->>''level'') THEN RAISE EXCEPTION USING ERRCODE=''23514'',MESSAGE=''unknown_course_audience''; END IF;
 v_id:=coalesce(nullif(p_data->>''id'','''')::uuid,gen_random_uuid());');
DO $migration$
DECLARE item record; definition text;
BEGIN
 FOR item IN SELECT * FROM phase2_function_patches LOOP
  IF to_regprocedure(item.signature) IS NULL THEN RAISE EXCEPTION USING ERRCODE='42883',MESSAGE='normalization_function_missing',DETAIL=item.signature; END IF;
  definition:=pg_get_functiondef(item.signature::regprocedure);
  IF strpos(definition,item.after_text)>0 THEN CONTINUE; END IF;
  -- Live VPS already uses the canonical key; keep its reviewed grading logic.
  IF item.signature='grammar_private.record_attempt(uuid,text,boolean)'
    AND strpos(definition,'target.content->''alternative_answers''')=0
    AND strpos(definition,'target.content->''accepted_answers''')>0 THEN CONTINUE; END IF;
  IF strpos(definition,item.before_text)=0 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='normalization_function_drift',DETAIL=item.signature||': '||item.before_text; END IF;
  EXECUTE replace(definition,item.before_text,item.after_text);
 END LOOP;
END $migration$;

-- The cancellation form submits a selected course ID; NULL preserves "all courses".
DROP FUNCTION IF EXISTS public.submit_business_cancellation(text,text,text,text,date,text);
CREATE OR REPLACE FUNCTION business_private.submit_cancellation(p_name text,p_email text,p_course_id uuid DEFAULT NULL,p_type text DEFAULT 'asap',p_date date DEFAULT NULL,p_locale text DEFAULT 'de') RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE request_id uuid; course_title text;
BEGIN
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 160 OR p_email IS NULL
  OR length(btrim(p_email)) NOT BETWEEN 3 AND 254 OR p_email !~ '^[^[:space:]<>@,;]+@[^[:space:]<>@,;]+\.[^[:space:]<>@,;]+$'
  OR p_type IS NULL OR p_type NOT IN ('asap','specific_date') OR (p_type='specific_date' AND p_date IS NULL)
  OR NOT EXISTS(SELECT 1 FROM public.locales WHERE code=p_locale) THEN
  RETURN jsonb_build_object('error','invalid_input','message','Invalid cancellation request.');
 END IF;
 IF p_course_id IS NOT NULL THEN
  SELECT title INTO course_title FROM public.courses WHERE id=p_course_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','course_not_found','message','The selected course does not exist.'); END IF;
 END IF;
 INSERT INTO public.cancellation_requests(full_name,email,course_id,termination_type,termination_date)
 VALUES(btrim(p_name),lower(btrim(p_email)),p_course_id,p_type::public.cancellation_type,CASE WHEN p_type='specific_date' THEN p_date END) RETURNING id INTO request_id;
 PERFORM public.queue_transactional_email('cancellation:'||request_id,'cancellation_requested',lower(btrim(p_email)),p_locale,
  jsonb_build_object('name',btrim(p_name),'endDate',p_date,'message',coalesce(course_title,'')));
 RETURN jsonb_build_object('id',request_id);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error',SQLSTATE,'message','The cancellation request could not be saved.');
END $function$;
REVOKE ALL ON FUNCTION business_private.submit_cancellation(text,text,uuid,text,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.submit_cancellation(text,text,uuid,text,date,text) TO service_role;
CREATE OR REPLACE FUNCTION public.submit_business_cancellation(p_name text,p_email text,p_course_id uuid DEFAULT NULL,p_type text DEFAULT 'asap',p_date date DEFAULT NULL,p_locale text DEFAULT 'de') RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path TO '' AS $function$
 SELECT business_private.submit_cancellation(p_name,p_email,p_course_id,p_type,p_date,p_locale);
$function$;
REVOKE ALL ON FUNCTION public.submit_business_cancellation(text,text,uuid,text,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_business_cancellation(text,text,uuid,text,date,text) TO service_role;

DROP TABLE phase2_function_patches;
DROP TABLE phase2_enum_columns;
DROP TABLE phase2_enum_fks;
NOTIFY pgrst, 'reload schema';

-- R9 rollback: restore the SHA256-verified pre-Phase-2 backup in maintenance mode,
-- then deploy the matching pre-Phase-2 application revision. This restores all
-- original text column types, checks, function bodies, defaults, indexes and ACLs.
-- No partial enum rollback: trainer PK/FK types form one dependency graph.
-- Historical titles/course-name values are recovered ONLY from that backup.
-- For forward recovery without old titles, courses.level can be reconstructed by:
-- UPDATE public.courses SET level=audience_code; (after dropping courses_level_fkey)
-- Explicit schema inverse for the two removals (restore data from backup afterward):
-- ALTER TABLE public.submissions ADD COLUMN prompt_title text;
-- ALTER TABLE public.cancellation_requests ADD COLUMN course_name text;
-- UPDATE public.cancellation_requests r SET course_name=c.title FROM public.courses c WHERE c.id=r.course_id;
