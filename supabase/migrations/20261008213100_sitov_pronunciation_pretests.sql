-- Sitov Academy private pretest state core. No production pool seeded.
-- Current exact passage guards new target access; historical participant access is separate.
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.pretest_definitions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), text_id uuid NOT NULL REFERENCES public.learning_reading_texts(id),
 text_version text NOT NULL CHECK(text_version~'^[a-f0-9]{64}$'), test_version text NOT NULL CHECK(test_version~'^[a-f0-9]{64}$'),
 definition jsonb NOT NULL, active boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(text_id,text_version,test_version));
CREATE UNIQUE INDEX IF NOT EXISTS sitov_pretest_active_definition ON sitov_pronunciation_private.pretest_definitions(text_id) WHERE active;
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.pretest_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 text_id uuid NOT NULL REFERENCES public.learning_reading_texts(id), definition_id uuid NOT NULL REFERENCES sitov_pronunciation_private.pretest_definitions(id),
 tasks jsonb NOT NULL, answers jsonb NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'in_progress' CHECK(status IN('in_progress','passed','failed','outdated')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), result jsonb, started_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE UNIQUE INDEX IF NOT EXISTS sitov_pretest_open_attempt ON sitov_pronunciation_private.pretest_attempts(student_id,text_id) WHERE status='in_progress';
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.pretest_passes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 definition_id uuid NOT NULL REFERENCES sitov_pronunciation_private.pretest_definitions(id), attempt_id uuid NOT NULL REFERENCES sitov_pronunciation_private.pretest_attempts(id),
 passed_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(student_id,definition_id));
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.pretest_receipts(
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,request_id uuid NOT NULL,payload jsonb NOT NULL,response jsonb NOT NULL,
 PRIMARY KEY(student_id,request_id));
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.upload_tickets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 text_id uuid NOT NULL REFERENCES public.learning_reading_texts(id),definition_id uuid NOT NULL REFERENCES sitov_pronunciation_private.pretest_definitions(id),
 path text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,consumed_at timestamptz);
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['pretest_definitions','pretest_attempts','pretest_passes','pretest_receipts','upload_tickets'] LOOP
 EXECUTE format('ALTER TABLE sitov_pronunciation_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON sitov_pronunciation_private.%I FROM PUBLIC,anon,authenticated',t);END LOOP;END $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.pretest_hash(p_text text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT encode(sha256(convert_to(p_text,'UTF8')),'hex') $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.valid_pool(d jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE c jsonb;q jsonb;n integer;BEGIN
 IF jsonb_typeof(d)<>'object' OR d->>'policyId' IS DISTINCT FROM 'sitov-pronunciation-language-prerequisites-v1' OR jsonb_typeof(d->'competencies')<>'array' OR jsonb_typeof(d->'tasks')<>'array' THEN RETURN false;END IF;
 IF jsonb_array_length(d->'competencies') NOT BETWEEN 1 AND 40 OR jsonb_array_length(d->'tasks') NOT BETWEEN 6 AND 1000 THEN RETURN false;END IF;
 IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(d->'tasks') x)<>jsonb_array_length(d->'tasks') OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(d->'competencies') x)<>jsonb_array_length(d->'competencies') THEN RETURN false;END IF;
 n:=0;FOR c IN SELECT * FROM jsonb_array_elements(d->'competencies') LOOP
 IF c->>'id' !~ '^sitov[.:-][a-zA-Z0-9._:-]{1,90}$' OR coalesce(c->>'itemsPerAttempt','') !~ '^[0-9]+$' OR (c->>'itemsPerAttempt')::int NOT BETWEEN 3 AND 40 THEN RETURN false;END IF;
 n:=n+(c->>'itemsPerAttempt')::int;
 IF (SELECT count(*) FROM jsonb_array_elements(d->'tasks') x WHERE x->>'competencyId'=c->>'id')<2*(c->>'itemsPerAttempt')::int THEN RETURN false;END IF;END LOOP;
 IF n>120 THEN RETURN false;END IF;
 FOR q IN SELECT * FROM jsonb_array_elements(d->'tasks') LOOP
 IF coalesce(q->>'id','') !~ '^sitov[.:-][a-zA-Z0-9._:-]{1,90}$' OR q->>'kind' IS DISTINCT FROM 'single_choice' OR jsonb_typeof(q->'promptDe') IS DISTINCT FROM 'string' OR (q->'fragmentDe' IS NOT NULL AND q->'fragmentDe'<>'null'::jsonb AND (jsonb_typeof(q->'fragmentDe')<>'string' OR length(q->>'fragmentDe')>300)) OR nullif(btrim(q->>'promptDe'),'') IS NULL OR length(q->>'promptDe')>500 OR jsonb_typeof(q->'options')<>'array' THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'competencies') mapped_core WHERE mapped_core->>'id'=q->>'competencyId') OR jsonb_array_length(q->'options') NOT BETWEEN 3 AND 5 THEN RETURN false;END IF;
 IF (SELECT count(DISTINCT o->>'id') FROM jsonb_array_elements(q->'options') o)<>jsonb_array_length(q->'options') OR (SELECT count(DISTINCT btrim(o->>'textDe')) FROM jsonb_array_elements(q->'options') o)<>jsonb_array_length(q->'options') THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(q->'options') o WHERE coalesce(o->>'id','') !~ '^sitov[.:-][a-zA-Z0-9._:-]{1,90}$' OR jsonb_typeof(o->'textDe') IS DISTINCT FROM 'string' OR nullif(btrim(o->>'textDe'),'') IS NULL OR length(o->>'textDe')>300) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'options') o WHERE o->>'id'=q->>'correctOptionId') THEN RETURN false;END IF;END LOOP;
 RETURN true;EXCEPTION WHEN others THEN RETURN false;END $$;
-- Independent approval is private and outside definition JSON: no circular test hash.
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.pretest_approvals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),definition_id uuid NOT NULL REFERENCES sitov_pronunciation_private.pretest_definitions(id),
 text_version text NOT NULL CHECK(text_version~'^[a-f0-9]{64}$'),test_version text NOT NULL CHECK(test_version~'^[a-f0-9]{64}$'),
 author_identity text NOT NULL CHECK(length(btrim(author_identity)) BETWEEN 3 AND 200),
 reviewer_identity text NOT NULL CHECK(length(btrim(reviewer_identity)) BETWEEN 3 AND 200 AND btrim(reviewer_identity)<>btrim(author_identity)),
 review_status text NOT NULL CHECK(review_status='independent_approved'),reviewed_at timestamptz NOT NULL,
 review_document_ref text NOT NULL CHECK(review_document_ref~'^sitov[.:-]editorial[.:-]review[.:-][a-zA-Z0-9._:-]+$'),
 review_document_sha256 text NOT NULL CHECK(review_document_sha256~'^[a-f0-9]{64}$'),
 reference_kind text NOT NULL CHECK(reference_kind IN('prepared_qwen','human_recording')),
 reference_bucket text NOT NULL,reference_path text NOT NULL,reference_audio_sha256 text NOT NULL CHECK(reference_audio_sha256~'^[a-f0-9]{64}$'));
ALTER TABLE sitov_pronunciation_private.pretest_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sitov_pronunciation_private.pretest_approvals FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.immutable_approval() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'immutable_pretest_approval';END $$;
DROP TRIGGER IF EXISTS sitov_pretest_approval_immutable ON sitov_pronunciation_private.pretest_approvals;
CREATE TRIGGER sitov_pretest_approval_immutable BEFORE UPDATE OR DELETE ON sitov_pronunciation_private.pretest_approvals FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.immutable_approval();
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.valid_spans(p_text text,p_spans jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE span jsonb;BEGIN
 IF jsonb_typeof(p_spans) IS DISTINCT FROM 'array' OR jsonb_array_length(p_spans)=0 THEN RETURN false;END IF;
 FOR span IN SELECT value FROM jsonb_array_elements(p_spans) LOOP
  IF coalesce(span->>'start','')!~'^[0-9]+$' OR coalesce(span->>'end','')!~'^[0-9]+$' OR (span->>'end')::int<=(span->>'start')::int OR nullif(btrim(span->>'quote'),'') IS NULL OR substring(p_text FROM (span->>'start')::int+1 FOR (span->>'end')::int-(span->>'start')::int) IS DISTINCT FROM span->>'quote' THEN RETURN false;END IF;
 END LOOP;RETURN true;EXCEPTION WHEN others THEN RETURN false;END $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.valid_authoring(p_text text,d jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
#variable_conflict use_column
DECLARE c jsonb;q jsonb;f jsonb;category text;BEGIN
 IF NOT sitov_pronunciation_private.valid_pool(d) OR jsonb_typeof(d->'omittedCategories') IS DISTINCT FROM 'array' OR jsonb_typeof(d->'reviewForms') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'reviewForms')<>2 THEN RETURN false;END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(d->'competencies') LOOP
  IF nullif(btrim(c->>'category'),'') IS NULL OR nullif(btrim(c->>'necessityDe'),'') IS NULL OR NOT sitov_pronunciation_private.valid_spans(p_text,c->'sourceSpans') OR jsonb_typeof(c->'languageUnits') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'languageUnits')<3 OR jsonb_typeof(c->'mapping') IS DISTINCT FROM 'object' THEN RETURN false;END IF;
 END LOOP;
 FOREACH category IN ARRAY ARRAY['vocabulary','verb_forms','syntax','nominal_forms'] LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'competencies') x WHERE x->>'category'=category) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'omittedCategories') x WHERE x->>'category'=category AND length(btrim(x->>'reasonDe'))>=20) THEN RETURN false;END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(d->'omittedCategories') x WHERE nullif(btrim(x->>'category'),'') IS NULL OR length(btrim(coalesce(x->>'reasonDe','')))<20) THEN RETURN false;END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(d->'tasks') LOOP
  IF NOT sitov_pronunciation_private.valid_spans(p_text,q->'sourceSpans') OR length(btrim(coalesce(q->>'rationaleDe','')))<35 OR nullif(btrim(q->>'assessmentUnit'),'') IS NULL OR nullif(btrim(q->>'equivalenceKey'),'') IS NULL THEN RETURN false;END IF;
 END LOOP;
 IF (SELECT count(DISTINCT (x->>'competencyId',lower(btrim(x->>'assessmentUnit')))) FROM jsonb_array_elements(d->'tasks') x)<>jsonb_array_length(d->'tasks') OR (SELECT count(DISTINCT (x->>'competencyId',lower(btrim(x->>'equivalenceKey')))) FROM jsonb_array_elements(d->'tasks') x)<>jsonb_array_length(d->'tasks') OR (SELECT count(DISTINCT lower(btrim(x->>'promptDe'))) FROM jsonb_array_elements(d->'tasks') x)<>jsonb_array_length(d->'tasks') THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(d->'reviewForms') x WHERE jsonb_typeof(x->'questionIds') IS DISTINCT FROM 'array') THEN RETURN false;END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(d->'reviewForms') f CROSS JOIN LATERAL jsonb_array_elements_text(f->'questionIds') q)<>(SELECT count(DISTINCT q) FROM jsonb_array_elements(d->'reviewForms') f CROSS JOIN LATERAL jsonb_array_elements_text(f->'questionIds') q) THEN RETURN false;END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(d->'reviewForms') LOOP
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(f->'questionIds') id WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'tasks') q WHERE q->>'id'=id)) THEN RETURN false;END IF;
  FOR c IN SELECT value FROM jsonb_array_elements(d->'competencies') LOOP
   IF (SELECT count(*) FROM jsonb_array_elements_text(f->'questionIds') id JOIN LATERAL jsonb_array_elements(d->'tasks') q ON q->>'id'=id WHERE q->>'competencyId'=c->>'id')<>(c->>'itemsPerAttempt')::int THEN RETURN false;END IF;
  END LOOP;
 END LOOP;RETURN true;EXCEPTION WHEN others THEN RETURN false;END $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.reference_valid(p_text text,p_stored_url text,a sitov_pronunciation_private.pretest_approvals) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE prepared text;metadata jsonb;timings jsonb;t jsonb;spoken text;previous_end numeric:=0;BEGIN
 SELECT user_metadata INTO metadata FROM storage.objects WHERE bucket_id=a.reference_bucket AND name=a.reference_path AND archived_at IS NULL AND NOT coalesce(is_delete_marker,false) FOR SHARE;
 IF NOT FOUND OR metadata->>'audioSha256' IS DISTINCT FROM a.reference_audio_sha256 THEN RETURN false;END IF;
 IF a.reference_kind='prepared_qwen' THEN
  prepared:=vocabulary_private.sitov_prepared_german_audio_url(p_text);
  IF a.reference_bucket<>'audio_cache' OR (prepared IS DISTINCT FROM '/supabase/storage/v1/object/public/audio_cache/'||a.reference_path
   AND prepared IS DISTINCT FROM 'storage://audio_cache/'||a.reference_path) THEN RETURN false;END IF;
 ELSE
  spoken:=vocabulary_private.sitov_normalize_audio_text(p_text);
  IF p_stored_url IS DISTINCT FROM 'storage://'||a.reference_bucket||'/'||a.reference_path OR metadata->>'origin' IS DISTINCT FROM 'human_recording' OR metadata->>'textSha256' IS DISTINCT FROM sitov_pronunciation_private.pretest_hash(spoken) THEN RETURN false;END IF;
 END IF;
 spoken:=vocabulary_private.sitov_normalize_audio_text(p_text);timings:=metadata->'wordTimings';
 IF jsonb_typeof(timings) IS DISTINCT FROM 'array' OR jsonb_array_length(timings)<>cardinality(string_to_array(spoken,' ')) THEN RETURN false;END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(timings) LOOP
  IF jsonb_typeof(t->'start') IS DISTINCT FROM 'number' OR jsonb_typeof(t->'end') IS DISTINCT FROM 'number' OR (t->>'start')::numeric<previous_end OR (t->>'end')::numeric<=(t->>'start')::numeric OR (t->>'end')::numeric>1200 THEN RETURN false;END IF;
  previous_end:=(t->>'end')::numeric;
 END LOOP;RETURN true;EXCEPTION WHEN others THEN RETURN false;END $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.publication_ready(p_id uuid,p_text uuid,p_text_version text,p_test_version text,d jsonb) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE body text;url text;a sitov_pronunciation_private.pretest_approvals;BEGIN
 SELECT sentence_de,audio_url INTO body,url FROM public.learning_reading_texts WHERE id=p_text;
 IF NOT FOUND OR p_text_version IS DISTINCT FROM sitov_pronunciation_private.pretest_hash(body) OR p_test_version IS DISTINCT FROM sitov_pronunciation_private.pretest_hash(d::text) OR NOT sitov_pronunciation_private.valid_authoring(body,d) THEN RETURN false;END IF;
 FOR a IN SELECT * FROM sitov_pronunciation_private.pretest_approvals WHERE definition_id=p_id AND text_version=p_text_version AND test_version=p_test_version AND review_status='independent_approved' AND reviewed_at<=clock_timestamp() LOOP
  IF sitov_pronunciation_private.reference_valid(body,url,a) THEN RETURN true;END IF;
 END LOOP;RETURN false;EXCEPTION WHEN others THEN RETURN false;END $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.immutable_approval(),sitov_pronunciation_private.valid_spans(text,jsonb),sitov_pronunciation_private.valid_authoring(text,jsonb),sitov_pronunciation_private.reference_valid(text,text,sitov_pronunciation_private.pretest_approvals),sitov_pronunciation_private.publication_ready(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.guard_definition() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' AND (NEW.id,NEW.text_id,NEW.text_version,NEW.test_version,NEW.definition) IS DISTINCT FROM (OLD.id,OLD.text_id,OLD.text_version,OLD.test_version,OLD.definition) THEN RAISE EXCEPTION 'immutable_pretest_definition';END IF;
 NEW.test_version:=sitov_pronunciation_private.pretest_hash(NEW.definition::text);
 IF NEW.active AND NOT sitov_pronunciation_private.publication_ready(NEW.id,NEW.text_id,NEW.text_version,NEW.test_version,NEW.definition) THEN RAISE EXCEPTION 'pretest_publication_proof_required';END IF;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS sitov_pretest_definition_guard ON sitov_pronunciation_private.pretest_definitions;
CREATE TRIGGER sitov_pretest_definition_guard BEFORE INSERT OR UPDATE ON sitov_pronunciation_private.pretest_definitions FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.guard_definition();
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.current_pretest(p_text uuid) RETURNS sitov_pronunciation_private.pretest_definitions LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT d FROM sitov_pronunciation_private.pretest_definitions d JOIN public.learning_reading_texts r ON r.id=d.text_id WHERE d.text_id=p_text AND d.active AND d.text_version=sitov_pronunciation_private.pretest_hash(r.sentence_de) AND sitov_pronunciation_private.publication_ready(d.id,d.text_id,d.text_version,d.test_version,d.definition) $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.current_pass(p_text uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND sitov_access_private.item_allowed(auth.uid(),'reading_text',p_text::text) AND EXISTS(SELECT 1 FROM sitov_pronunciation_private.pretest_passes p WHERE p.student_id=auth.uid() AND p.definition_id=(sitov_pronunciation_private.current_pretest(p_text)).id) $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.attempt_summary(a sitov_pronunciation_private.pretest_attempts) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',a.id,'textId',a.text_id,'textVersion',d.text_version,'testVersion',d.test_version,'status',a.status,'revision',a.revision,'startedAt',a.started_at,'updatedAt',a.updated_at,'questionIds',(SELECT jsonb_agg(q->>'id') FROM jsonb_array_elements(a.tasks) q),'answers',a.answers,'answeredCount',(SELECT count(*) FROM jsonb_object_keys(a.answers)),'totalCount',jsonb_array_length(a.tasks)) FROM sitov_pronunciation_private.pretest_definitions d WHERE d.id=a.definition_id $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.attempt_response(a sitov_pronunciation_private.pretest_attempts) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT CASE WHEN a.status='in_progress' THEN jsonb_build_object('attempt',sitov_pronunciation_private.attempt_summary(a),'tasks',(SELECT jsonb_agg(jsonb_build_object('id',q->>'id','competencyId',q->>'competencyId','kind',q->>'kind','promptDe',q->>'promptDe','fragmentDe',q->'fragmentDe','options',(SELECT jsonb_agg(jsonb_build_object('id',o->>'id','textDe',o->>'textDe')) FROM jsonb_array_elements(q->'options') o))) FROM jsonb_array_elements(a.tasks) q)) ELSE jsonb_build_object('attempt',sitov_pronunciation_private.attempt_summary(a),'result',a.result) END $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.pretest_error(e text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT jsonb_build_object('ok',false,'error',e,'retryable',e IN('retryable_failure','rate_limited')) $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.pretest_command(op text,p_text uuid,p_attempt uuid,p_revision integer,p_answers jsonb,p_request uuid,p_extension text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d sitov_pronunciation_private.pretest_definitions;a sitov_pronunciation_private.pretest_attempts;receipt record;payload jsonb;response jsonb;tasks jsonb;prior jsonb;cores jsonb;fails jsonb;proof jsonb;correct integer;total integer;passed boolean;ticket uuid;path text;expires timestamptz;BEGIN
 IF auth.uid() IS NULL THEN RETURN sitov_pronunciation_private.pretest_error('authentication_required');END IF;
 IF identity_private.current_profile_role() IN('teacher','admin') AND NOT sitov_access_private.staff() THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sitov-pretest:'||auth.uid()::text,0));
 IF op IN('get','save','submit') THEN SELECT * INTO a FROM sitov_pronunciation_private.pretest_attempts WHERE id=p_attempt AND student_id=auth.uid() FOR UPDATE;IF NOT FOUND THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;p_text:=a.text_id;END IF;
 IF op='get' AND a.status IN('passed','failed','outdated') THEN RETURN jsonb_build_object('ok',true,'data',sitov_pronunciation_private.attempt_response(a));END IF;
 IF p_text IS NULL OR NOT sitov_access_private.item_allowed(auth.uid(),'reading_text',p_text::text) THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 IF op<>'get' AND p_request IS NULL THEN RETURN sitov_pronunciation_private.pretest_error('invalid_input');END IF;
 payload:=jsonb_build_object('op',op,'text',p_text,'attempt',p_attempt,'revision',p_revision,'answers',p_answers,'extension',p_extension);
 IF op<>'get' THEN SELECT * INTO receipt FROM sitov_pronunciation_private.pretest_receipts WHERE student_id=auth.uid() AND request_id=p_request;IF FOUND THEN IF receipt.payload<>payload THEN RETURN sitov_pronunciation_private.pretest_error('request_conflict');END IF;RETURN receipt.response;END IF;END IF;
 d:=sitov_pronunciation_private.current_pretest(p_text);
 IF op='get' THEN IF a.status='in_progress' AND a.definition_id IS DISTINCT FROM d.id THEN UPDATE sitov_pronunciation_private.pretest_attempts SET status='outdated',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;END IF;RETURN jsonb_build_object('ok',true,'data',sitov_pronunciation_private.attempt_response(a));END IF;
 IF op IN('save','submit') AND a.definition_id IS DISTINCT FROM d.id THEN RETURN sitov_pronunciation_private.pretest_error('version_conflict');END IF;
 IF d.id IS NULL THEN RETURN sitov_pronunciation_private.pretest_error('authoring_not_ready');END IF;
 IF op='start' THEN
 UPDATE sitov_pronunciation_private.pretest_attempts SET status='outdated',updated_at=clock_timestamp() WHERE student_id=auth.uid() AND text_id=p_text AND status='in_progress' AND definition_id<>d.id;
 SELECT * INTO a FROM sitov_pronunciation_private.pretest_attempts WHERE student_id=auth.uid() AND text_id=p_text AND definition_id=d.id AND status IN('in_progress','passed') ORDER BY started_at DESC LIMIT 1;
 IF NOT FOUND THEN
 IF (SELECT count(*) FROM sitov_pronunciation_private.pretest_attempts WHERE student_id=auth.uid() AND started_at>clock_timestamp()-interval '1 minute')>=6 THEN RETURN sitov_pronunciation_private.pretest_error('rate_limited');END IF;
 SELECT previous.tasks INTO prior FROM sitov_pronunciation_private.pretest_attempts previous WHERE previous.student_id=auth.uid() AND previous.text_id=p_text AND previous.definition_id=d.id ORDER BY previous.started_at DESC LIMIT 1;
 SELECT jsonb_agg(q ORDER BY core_id,position) INTO tasks FROM (SELECT c->>'id' core_id,p.q,row_number() OVER() position FROM jsonb_array_elements(d.definition->'competencies') c CROSS JOIN LATERAL (SELECT q FROM jsonb_array_elements(d.definition->'tasks') q WHERE q->>'competencyId'=c->>'id' ORDER BY EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(prior,'[]')) old WHERE old->>'id'=q->>'id'),random() LIMIT (c->>'itemsPerAttempt')::int) p) chosen;
 INSERT INTO sitov_pronunciation_private.pretest_attempts(student_id,text_id,definition_id,tasks) VALUES(auth.uid(),p_text,d.id,tasks) RETURNING * INTO a;END IF;
 response:=jsonb_build_object('ok',true,'data',sitov_pronunciation_private.attempt_response(a));
 ELSIF op IN('save','submit') THEN
 IF a.definition_id<>d.id THEN RETURN sitov_pronunciation_private.pretest_error('version_conflict');END IF;
 IF a.status<>'in_progress' THEN response:=jsonb_build_object('ok',true,'data',CASE WHEN op='save' THEN sitov_pronunciation_private.attempt_summary(a) ELSE sitov_pronunciation_private.attempt_response(a) END);
 ELSE
 IF p_revision IS NULL OR p_revision<>a.revision THEN RETURN sitov_pronunciation_private.pretest_error('attempt_conflict');END IF;
 IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each(p_answers) v WHERE jsonb_typeof(v.value)<>'string' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.tasks) q CROSS JOIN LATERAL jsonb_array_elements(q->'options') o WHERE q->>'id'=v.key AND o->>'id'=v.value#>>'{}')) THEN RETURN sitov_pronunciation_private.pretest_error('invalid_answer');END IF;
 IF op='submit' AND (SELECT count(*) FROM jsonb_object_keys(p_answers))<>jsonb_array_length(a.tasks) THEN RETURN sitov_pronunciation_private.pretest_error('incomplete_attempt');END IF;
 UPDATE sitov_pronunciation_private.pretest_attempts SET answers=p_answers,revision=revision+1,updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 IF op='submit' THEN
 SELECT jsonb_agg(jsonb_build_object('id',id,'correct',n,'total',t,'required',(2*t+2)/3,'met',n>=(2*t+2)/3)) INTO cores FROM (SELECT q->>'competencyId' id,count(*)::int t,count(*) FILTER(WHERE p_answers->> (q->>'id')=q->>'correctOptionId')::int n FROM jsonb_array_elements(a.tasks) q GROUP BY q->>'competencyId') s;
 SELECT sum((x->>'correct')::int),sum((x->>'total')::int),coalesce(jsonb_agg(x->>'id') FILTER(WHERE NOT (x->>'met')::boolean),'[]') INTO correct,total,fails FROM jsonb_array_elements(cores) x;
 passed:=correct>=(3*total+3)/4 AND jsonb_array_length(fails)=0;proof:=NULL;
 IF passed THEN INSERT INTO sitov_pronunciation_private.pretest_passes(student_id,definition_id,attempt_id) VALUES(auth.uid(),d.id,a.id) ON CONFLICT(student_id,definition_id) DO NOTHING;SELECT jsonb_build_object('id',p.id,'textId',p_text,'textVersion',d.text_version,'testVersion',d.test_version,'passedAttemptId',p.attempt_id,'passedAt',p.passed_at,'compatibilityId',NULL) INTO proof FROM sitov_pronunciation_private.pretest_passes p WHERE student_id=auth.uid() AND definition_id=d.id;END IF;
 UPDATE sitov_pronunciation_private.pretest_attempts SET status=CASE WHEN passed THEN 'passed' ELSE 'failed' END,result=jsonb_build_object('attemptId',a.id,'textId',p_text,'textVersion',d.text_version,'testVersion',d.test_version,'passed',passed,'correct',correct,'total',total,'competencies',cores,'failedCompetencyIds',fails,'learningLinks','[]'::jsonb,'proof',proof) WHERE id=a.id RETURNING * INTO a;
 END IF;
 response:=jsonb_build_object('ok',true,'data',CASE WHEN op='save' THEN sitov_pronunciation_private.attempt_summary(a) ELSE sitov_pronunciation_private.attempt_response(a) END);END IF;
 ELSIF op='ticket' THEN
 IF NOT sitov_pronunciation_private.current_pass(p_text) THEN RETURN sitov_pronunciation_private.pretest_error('test_required');END IF;
 IF p_extension IS NULL OR p_extension NOT IN('webm','mp4','ogg','wav','mp3') THEN RETURN sitov_pronunciation_private.pretest_error('invalid_input');END IF;
 ticket:=gen_random_uuid();path:=auth.uid()::text||'/'||ticket::text||'.'||p_extension;expires:=clock_timestamp()+interval '10 minutes';
 INSERT INTO sitov_pronunciation_private.upload_tickets(id,student_id,text_id,definition_id,path,expires_at) VALUES(ticket,auth.uid(),p_text,d.id,path,expires);
 response:=jsonb_build_object('ok',true,'data',jsonb_build_object('ticketId',ticket,'path',path,'textVersion',d.text_version,'expiresAt',expires));
 ELSE RETURN sitov_pronunciation_private.pretest_error('invalid_input');END IF;
 INSERT INTO sitov_pronunciation_private.pretest_receipts VALUES(auth.uid(),p_request,payload,response);RETURN response;END $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.pretest_catalog(p_level text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;d sitov_pronunciation_private.pretest_definitions;a sitov_pronunciation_private.pretest_attempts;entries jsonb:='[]';status text;proof jsonb;reason text;BEGIN
 IF auth.uid() IS NULL THEN RETURN sitov_pronunciation_private.pretest_error('authentication_required');END IF;
 FOR r IN SELECT t.id,t.sentence_de,t.focus,u.id unit_id,u.label FROM public.learning_reading_texts t JOIN public.learning_units u ON u.id=t.unit_id WHERE u.level=p_level AND sitov_access_private.item_allowed(auth.uid(),'reading_text',t.id::text) ORDER BY u.sort_order,t.id LOOP
 d:=sitov_pronunciation_private.current_pretest(r.id);a:=NULL;proof:=NULL;reason:=NULL;
 IF d.id IS NULL THEN status:='locked';reason:=CASE WHEN EXISTS(SELECT 1 FROM sitov_pronunciation_private.pretest_attempts old WHERE old.student_id=auth.uid() AND old.text_id=r.id) THEN 'version_changed' ELSE 'authoring_not_ready' END;ELSE SELECT latest.* INTO a FROM sitov_pronunciation_private.pretest_attempts latest WHERE latest.student_id=auth.uid() AND latest.text_id=r.id AND latest.definition_id=d.id AND latest.status<>'outdated' ORDER BY latest.started_at DESC LIMIT 1;status:=coalesce(a.status,'available');IF status='passed' THEN proof:=a.result->'proof';END IF;END IF;
 entries:=entries||jsonb_build_array(jsonb_build_object('textId',r.id,'unitId',r.unit_id,'level',p_level,'title',r.label,'focus',r.focus,'kind','regular','textVersion',sitov_pronunciation_private.pretest_hash(r.sentence_de),'testVersion',d.test_version,'status',status,'lockedReason',reason,'attempt',CASE WHEN a.id IS NULL THEN NULL ELSE sitov_pronunciation_private.attempt_summary(a) END,'proof',proof,'target',CASE status WHEN 'locked' THEN NULL WHEN 'passed' THEN 'pronunciation' WHEN 'in_progress' THEN 'resume_pretest' ELSE 'pretest' END));END LOOP;
 RETURN jsonb_build_object('ok',true,'data',entries);END $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.pretest_staff(p_text uuid,p_student uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT sitov_access_private.staff() THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('definitions',(SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]') FROM sitov_pronunciation_private.pretest_definitions d WHERE text_id=p_text),'attempts',(SELECT coalesce(jsonb_agg(sitov_pronunciation_private.attempt_response(a)),'[]') FROM sitov_pronunciation_private.pretest_attempts a WHERE text_id=p_text AND (p_student IS NULL OR student_id=p_student))));END $$;
CREATE OR REPLACE FUNCTION public.sitov_get_pronunciation_pretests(p_level text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_pronunciation_private.pretest_catalog(p_level) $$;
CREATE OR REPLACE FUNCTION public.sitov_start_pronunciation_pretest(p_text_id uuid,p_request_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_pronunciation_private.pretest_command('start',p_text_id,NULL,NULL,NULL,p_request_id) $$;
CREATE OR REPLACE FUNCTION public.sitov_get_pronunciation_pretest_attempt(p_attempt_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_pronunciation_private.pretest_command('get',NULL,p_attempt_id,NULL,NULL,NULL) $$;
CREATE OR REPLACE FUNCTION public.sitov_save_pronunciation_pretest_answers(p_attempt_id uuid,p_revision integer,p_answers jsonb,p_request_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_pronunciation_private.pretest_command('save',NULL,p_attempt_id,p_revision,p_answers,p_request_id) $$;
CREATE OR REPLACE FUNCTION public.sitov_submit_pronunciation_pretest(p_attempt_id uuid,p_revision integer,p_answers jsonb,p_request_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_pronunciation_private.pretest_command('submit',NULL,p_attempt_id,p_revision,p_answers,p_request_id) $$;
CREATE OR REPLACE FUNCTION public.sitov_get_pronunciation_pretest_staff(p_text_id uuid,p_student_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_pronunciation_private.pretest_staff(p_text_id,p_student_id) $$;
CREATE OR REPLACE FUNCTION public.sitov_create_pronunciation_upload_ticket(p_text_id uuid,p_request_id uuid,p_extension text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_pronunciation_private.pretest_command('ticket',p_text_id,NULL,NULL,NULL,p_request_id,p_extension) $$;
-- Do not revoke unrelated old guards. Only new functions receive API grants.
DO $$ DECLARE f record;BEGIN FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sitov_pronunciation_private' AND p.proname IN('pretest_hash','valid_pool','guard_definition','current_pretest','current_pass','attempt_summary','attempt_response','pretest_error','pretest_command','pretest_catalog','pretest_staff') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);END LOOP;END $$;
GRANT EXECUTE ON FUNCTION sitov_pronunciation_private.pretest_command(text,uuid,uuid,integer,jsonb,uuid,text),sitov_pronunciation_private.pretest_catalog(text),sitov_pronunciation_private.pretest_staff(uuid,uuid),sitov_pronunciation_private.current_pass(uuid) TO authenticated;
DO $$ DECLARE f record;BEGIN FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('sitov_get_pronunciation_pretests','sitov_start_pronunciation_pretest','sitov_get_pronunciation_pretest_attempt','sitov_save_pronunciation_pretest_answers','sitov_submit_pronunciation_pretest','sitov_get_pronunciation_pretest_staff','sitov_create_pronunciation_upload_ticket') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);END LOOP;END $$;

-- Preserve exact prior definitions for a coordinated, non-destructive rollback.
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.pretest_legacy_functions(signature text PRIMARY KEY,definition text NOT NULL);
REVOKE ALL ON sitov_pronunciation_private.pretest_legacy_functions FROM PUBLIC,anon,authenticated;
ALTER TABLE sitov_pronunciation_private.pretest_legacy_functions ENABLE ROW LEVEL SECURITY;
INSERT INTO sitov_pronunciation_private.pretest_legacy_functions SELECT signature,pg_get_functiondef(signature::regprocedure) FROM unnest(ARRAY[
 'sitov_pronunciation_private.text_allowed(uuid)','sitov_pronunciation_private.guard_submission()',
 'sitov_pronunciation_private.can_record()','pronunciation_private.create_submission(uuid,text)',
 'pronunciation_private.can_access_submission(uuid)']) signature ON CONFLICT DO NOTHING;
ALTER TABLE sitov_pronunciation_private.upload_tickets ALTER COLUMN text_id DROP NOT NULL;
ALTER TABLE sitov_pronunciation_private.upload_tickets ALTER COLUMN definition_id DROP NOT NULL;
ALTER TABLE sitov_pronunciation_private.upload_tickets ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'target' CHECK(purpose IN('target','reply'));
ALTER TABLE sitov_pronunciation_private.upload_tickets ADD COLUMN IF NOT EXISTS submission_id uuid REFERENCES public.submissions(id);
-- The BEFORE INSERT guard binds NEW.id atomically before the submission exists.
ALTER TABLE sitov_pronunciation_private.upload_tickets ALTER CONSTRAINT upload_tickets_submission_id_fkey DEFERRABLE INITIALLY DEFERRED;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.text_allowed(p_prompt uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT sitov_pronunciation_private.current_pass(p_prompt) $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.staff_preview() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT sitov_access_private.staff() $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.staff_preview() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION sitov_pronunciation_private.staff_preview() TO authenticated;
DROP POLICY IF EXISTS sitov_pronunciation_readiness_bounds ON public.learning_reading_texts;
CREATE POLICY sitov_pronunciation_readiness_bounds ON public.learning_reading_texts AS RESTRICTIVE FOR SELECT TO authenticated USING(sitov_pronunciation_private.staff_preview() OR sitov_pronunciation_private.current_pass(id));
-- Historical submissions and saved text snapshots do not grant any target rights.
CREATE OR REPLACE FUNCTION pronunciation_private.can_access_submission(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.submissions s WHERE s.id=p_id AND s.type='audio' AND (s.auth_user_id=auth.uid() OR sitov_access_private.staff())) $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.ticket_upload_allowed(p_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM sitov_pronunciation_private.upload_tickets t WHERE t.student_id=auth.uid() AND t.path=p_path AND t.consumed_at IS NULL AND t.expires_at>clock_timestamp() AND (
 (t.purpose='target' AND t.submission_id IS NULL AND t.definition_id=(sitov_pronunciation_private.current_pretest(t.text_id)).id AND sitov_pronunciation_private.current_pass(t.text_id)) OR
 (t.purpose='reply' AND t.text_id IS NULL AND t.definition_id IS NULL AND pronunciation_private.can_access_submission(t.submission_id)))) $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.can_record() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM sitov_pronunciation_private.upload_tickets t WHERE t.student_id=auth.uid() AND sitov_pronunciation_private.ticket_upload_allowed(t.path)) $$;
DROP POLICY IF EXISTS sitov_pronunciation_ready_upload ON storage.objects;
CREATE POLICY sitov_pronunciation_ready_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id NOT IN('pronunciation_audio','audio_submissions') OR bucket_id='pronunciation_audio' AND sitov_pronunciation_private.ticket_upload_allowed(name));
DROP POLICY IF EXISTS sitov_pronunciation_owned_upload ON storage.objects;
CREATE POLICY sitov_pronunciation_owned_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='pronunciation_audio' AND sitov_pronunciation_private.ticket_upload_allowed(name));
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.guard_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ticket sitov_pronunciation_private.upload_tickets;source_text text;BEGIN
 IF auth.uid() IS NULL OR NEW.type<>'audio' OR NEW.prompt_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND (NEW.prompt_id,NEW.content_url,NEW.auth_user_id) IS NOT DISTINCT FROM (OLD.prompt_id,OLD.content_url,OLD.auth_user_id) THEN RETURN NEW;END IF;
 IF NEW.content_url IS NULL OR NEW.content_url NOT LIKE 'storage://pronunciation_audio/'||auth.uid()::text||'/%' OR NEW.auth_user_id<>auth.uid() THEN RAISE EXCEPTION 'test_required' USING ERRCODE='42501';END IF;
 SELECT * INTO ticket FROM sitov_pronunciation_private.upload_tickets t WHERE t.path=replace(NEW.content_url,'storage://pronunciation_audio/','') AND t.student_id=auth.uid() FOR UPDATE;
 SELECT r.sentence_de INTO source_text FROM public.learning_reading_texts r WHERE r.id=NEW.prompt_id FOR SHARE;
 PERFORM 1 FROM sitov_pronunciation_private.pretest_definitions d WHERE d.id=ticket.definition_id FOR SHARE;
 IF ticket.id IS NULL OR ticket.purpose<>'target' OR ticket.text_id<>NEW.prompt_id OR NOT sitov_pronunciation_private.ticket_upload_allowed(ticket.path) OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='pronunciation_audio' AND o.name=ticket.path) THEN RAISE EXCEPTION 'invalid_upload_ticket' USING ERRCODE='42501';END IF;
 NEW.text_content:=source_text;
 UPDATE sitov_pronunciation_private.upload_tickets SET consumed_at=clock_timestamp(),submission_id=NEW.id WHERE id=ticket.id;RETURN NEW;END $$;
-- Ownership reassignment cannot bypass new-reading authorization.
DROP TRIGGER IF EXISTS sitov_pronunciation_ready_submission ON public.submissions;
CREATE TRIGGER sitov_pronunciation_ready_submission BEFORE INSERT OR UPDATE OF prompt_id,content_url,auth_user_id ON public.submissions FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.guard_submission();
CREATE OR REPLACE FUNCTION pronunciation_private.create_submission(p_prompt_id uuid,p_audio_path text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;level text;ticket sitov_pronunciation_private.upload_tickets;BEGIN
 IF auth.uid() IS NULL OR p_audio_path IS NULL OR p_audio_path NOT LIKE 'storage://pronunciation_audio/'||auth.uid()::text||'/%' THEN RAISE EXCEPTION 'invalid_upload_ticket' USING ERRCODE='42501';END IF;
 SELECT * INTO ticket FROM sitov_pronunciation_private.upload_tickets t WHERE 'storage://pronunciation_audio/'||t.path=p_audio_path AND t.student_id=auth.uid() FOR UPDATE;
 IF ticket.id IS NULL OR ticket.purpose<>'target' OR ticket.text_id IS DISTINCT FROM p_prompt_id THEN RAISE EXCEPTION 'invalid_upload_ticket' USING ERRCODE='42501';END IF;
 IF ticket.consumed_at IS NOT NULL THEN
  -- Exact historical receipt only: no current body/reference or new authorization.
  SELECT s.id INTO result FROM public.submissions s WHERE s.id=ticket.submission_id AND s.auth_user_id=auth.uid() AND s.type='audio' AND s.prompt_id=p_prompt_id AND s.content_url=p_audio_path;
  IF result IS NULL AND ticket.submission_id IS NULL THEN
   -- Older consumed tickets predate the explicit submission binding. Match one
   -- exact owned row only; ambiguous or foreign matches remain denied.
   SELECT min(s.id::text)::uuid INTO result FROM public.submissions s WHERE s.auth_user_id=auth.uid() AND s.type='audio' AND s.prompt_id=p_prompt_id AND s.content_url=p_audio_path HAVING count(*)=1;
  END IF;
  IF result IS NULL THEN RAISE EXCEPTION 'invalid_upload_ticket' USING ERRCODE='42501';END IF;
  RETURN result;
 END IF;
 IF NOT sitov_pronunciation_private.current_pass(p_prompt_id) THEN RAISE EXCEPTION 'test_required' USING ERRCODE='42501';END IF;
 SELECT u.level INTO level FROM public.learning_reading_texts r JOIN public.learning_units u ON u.id=r.unit_id WHERE r.id=p_prompt_id;
 INSERT INTO public.submissions(auth_user_id,type,content_url,status,level,prompt_id) VALUES(auth.uid(),'audio',p_audio_path,'pending',level,p_prompt_id) RETURNING id INTO result;RETURN result;END $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.reply_ticket(p_submission uuid,p_request uuid,p_extension text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE payload jsonb;receipt record;id uuid;path text;expires timestamptz;response jsonb;BEGIN
 IF auth.uid() IS NULL THEN RETURN sitov_pronunciation_private.pretest_error('authentication_required');END IF;
 IF NOT pronunciation_private.can_access_submission(p_submission) THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 IF p_request IS NULL OR p_extension IS NULL OR p_extension NOT IN('webm','mp4','ogg','wav','mp3') THEN RETURN sitov_pronunciation_private.pretest_error('invalid_input');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sitov-pretest:'||auth.uid()::text,0));payload:=jsonb_build_object('op','reply','submission',p_submission,'extension',p_extension);
 SELECT * INTO receipt FROM sitov_pronunciation_private.pretest_receipts WHERE student_id=auth.uid() AND request_id=p_request;
 IF FOUND THEN IF receipt.payload<>payload THEN RETURN sitov_pronunciation_private.pretest_error('request_conflict');END IF;RETURN receipt.response;END IF;
 id:=gen_random_uuid();path:=auth.uid()::text||'/'||id::text||'.'||p_extension;expires:=clock_timestamp()+interval '10 minutes';
 INSERT INTO sitov_pronunciation_private.upload_tickets(id,student_id,purpose,submission_id,path,expires_at) VALUES(id,auth.uid(),'reply',p_submission,path,expires);
 response:=jsonb_build_object('ok',true,'data',jsonb_build_object('ticketId',id,'path',path,'expiresAt',expires,'submissionId',p_submission,'purpose','reply'));
 INSERT INTO sitov_pronunciation_private.pretest_receipts VALUES(auth.uid(),p_request,payload,response);RETURN response;END $$;
CREATE OR REPLACE FUNCTION public.sitov_create_pronunciation_reply_upload_ticket(p_submission_id uuid,p_request_id uuid,p_extension text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sitov_pronunciation_private.reply_ticket(p_submission_id,p_request_id,p_extension) $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.consume_reply_ticket() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t sitov_pronunciation_private.upload_tickets;BEGIN
 IF NEW.audio_path IS NULL THEN RETURN NEW;END IF;
 SELECT * INTO t FROM sitov_pronunciation_private.upload_tickets WHERE path=replace(NEW.audio_path,'storage://pronunciation_audio/','') AND student_id=auth.uid() FOR UPDATE;
 IF t.id IS NULL OR t.purpose<>'reply' OR t.submission_id<>NEW.submission_id OR NOT sitov_pronunciation_private.ticket_upload_allowed(t.path) OR NEW.sender_id<>auth.uid() OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='pronunciation_audio' AND o.name=t.path) THEN RAISE EXCEPTION 'invalid_reply_ticket' USING ERRCODE='42501';END IF;
 UPDATE sitov_pronunciation_private.upload_tickets SET consumed_at=clock_timestamp() WHERE id=t.id;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS sitov_pretest_reply_ticket ON public.pronunciation_messages;
CREATE TRIGGER sitov_pretest_reply_ticket BEFORE INSERT ON public.pronunciation_messages FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.consume_reply_ticket();
REVOKE ALL ON FUNCTION sitov_pronunciation_private.ticket_upload_allowed(text),sitov_pronunciation_private.reply_ticket(uuid,uuid,text),sitov_pronunciation_private.consume_reply_ticket() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sitov_pronunciation_private.ticket_upload_allowed(text),sitov_pronunciation_private.reply_ticket(uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.sitov_create_pronunciation_reply_upload_ticket(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_create_pronunciation_reply_upload_ticket(uuid,uuid,text) TO authenticated;
-- Exact selected-item commercial rights need a new permissive port as well as
-- restrictive bounds; the older unit-only release policy cannot grant this path.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.unit_has_current_pass(p_unit uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.learning_reading_texts r WHERE r.unit_id=p_unit AND sitov_pronunciation_private.current_pass(r.id)) $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.unit_has_current_pass(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION sitov_pronunciation_private.unit_has_current_pass(uuid) TO authenticated;
DROP POLICY IF EXISTS sitov_pretest_released_read ON public.learning_reading_texts;
CREATE POLICY sitov_pretest_released_read ON public.learning_reading_texts FOR SELECT TO authenticated USING(sitov_pronunciation_private.current_pass(id) AND learning_private.german_text_allowed(sentence_de) AND learning_private.german_text_allowed(focus));
DROP POLICY IF EXISTS sitov_pretest_released_unit ON public.learning_units;
CREATE POLICY sitov_pretest_released_unit ON public.learning_units FOR SELECT TO authenticated USING(trainer='pronunciation' AND sitov_pronunciation_private.unit_has_current_pass(id));

-- Operational rollback switch applies inside triggers, including old SECURITY DEFINER wrappers.
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.write_control(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
REVOKE ALL ON sitov_pronunciation_private.write_control FROM PUBLIC,anon,authenticated;
ALTER TABLE sitov_pronunciation_private.write_control ENABLE ROW LEVEL SECURITY;
INSERT INTO sitov_pronunciation_private.write_control(singleton,enabled) VALUES(true,false) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.writes_enabled() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT enabled FROM sitov_pronunciation_private.write_control WHERE singleton),false) $$;
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.guard_writes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE protected boolean;BEGIN
 IF TG_TABLE_NAME='submissions' THEN
  IF TG_OP='DELETE' THEN protected:=OLD.type='audio';ELSIF TG_OP='UPDATE' THEN protected:=OLD.type='audio' OR NEW.type='audio';ELSE protected:=NEW.type='audio';END IF;
 ELSIF TG_TABLE_NAME='objects' THEN
  IF TG_OP='DELETE' THEN protected:=OLD.bucket_id IN('pronunciation_audio','audio_submissions');ELSIF TG_OP='UPDATE' THEN protected:=OLD.bucket_id IN('pronunciation_audio','audio_submissions') OR NEW.bucket_id IN('pronunciation_audio','audio_submissions');ELSE protected:=NEW.bucket_id IN('pronunciation_audio','audio_submissions');END IF;
 ELSE protected:=true;END IF;
 IF protected AND auth.uid() IS NOT NULL AND NOT sitov_pronunciation_private.writes_enabled() THEN RAISE EXCEPTION 'pronunciation_writes_frozen' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.writes_enabled(),sitov_pronunciation_private.guard_writes() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sitov_pretest_write_freeze ON public.submissions;
CREATE TRIGGER sitov_pretest_write_freeze BEFORE INSERT OR UPDATE OR DELETE ON public.submissions FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.guard_writes();
DROP TRIGGER IF EXISTS sitov_pretest_write_freeze ON public.pronunciation_messages;
CREATE TRIGGER sitov_pretest_write_freeze BEFORE INSERT OR UPDATE OR DELETE ON public.pronunciation_messages FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.guard_writes();
DROP TRIGGER IF EXISTS sitov_pretest_write_freeze ON storage.objects;
CREATE TRIGGER sitov_pretest_write_freeze BEFORE INSERT OR UPDATE OR DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.guard_writes();
DROP TRIGGER IF EXISTS sitov_pretest_write_freeze ON pronunciation_private.staff_hidden_messages;
CREATE TRIGGER sitov_pretest_write_freeze BEFORE INSERT OR UPDATE OR DELETE ON pronunciation_private.staff_hidden_messages FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.guard_writes();
DROP TRIGGER IF EXISTS sitov_pretest_write_freeze ON pronunciation_private.staff_hidden_submissions;
CREATE TRIGGER sitov_pretest_write_freeze BEFORE INSERT OR UPDATE OR DELETE ON pronunciation_private.staff_hidden_submissions FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.guard_writes();
-- Re-enable only after the exact current forward gates and APIs have been restored.
UPDATE sitov_pronunciation_private.write_control SET enabled=true WHERE singleton;
