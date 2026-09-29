-- CSV-only Papierkram reconciliation and privately issued attendance certificates.
-- Additive migration; apply within the migration runner's transaction.
-- Client writes are deliberately absent. Server operations validate the session
-- and staff role before using a service-role transaction/RPC.
CREATE SCHEMA IF NOT EXISTS certificates_private;
REVOKE ALL ON SCHEMA certificates_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA certificates_private TO service_role;

CREATE TABLE IF NOT EXISTS public.import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_key text NOT NULL DEFAULT 'papierkram',
 kind text NOT NULL CHECK(kind IN ('customers','invoices','products')),
 status text NOT NULL DEFAULT 'preview' CHECK(status IN ('preview','applied','failed')),
 filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 255),
 file_sha256 text NOT NULL CHECK(file_sha256 ~ '^[a-f0-9]{64}$'),
 exported_at timestamptz NOT NULL,
 scope jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(scope)='object'),
 is_complete_snapshot boolean NOT NULL DEFAULT false,
 export_year integer CHECK(export_year BETWEEN 2000 AND 2200),
 baseline_hash text,
 summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(summary)='object'),
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 applied_at timestamptz,
 CHECK((status='applied')=(applied_at IS NOT NULL)),
 CHECK(NOT is_complete_snapshot OR (kind='invoices' AND export_year IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS import_batches_export_idx ON public.import_batches(account_key,kind,exported_at DESC);
CREATE INDEX IF NOT EXISTS import_batches_checksum_idx ON public.import_batches(account_key,kind,file_sha256);
CREATE INDEX IF NOT EXISTS import_batches_actor_idx ON public.import_batches(created_by);

CREATE TABLE IF NOT EXISTS public.import_rows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE RESTRICT,
 row_number integer NOT NULL CHECK(row_number>0),
 external_key text,
 raw_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(raw_data)='object'),
 normalized_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(normalized_data)='object'),
 disposition text NOT NULL CHECK(disposition IN ('new','updated','unchanged','conflict','ignored','error')),
 issues jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(issues)='array'),
 resolution jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(resolution)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(batch_id,row_number)
);

CREATE TABLE IF NOT EXISTS public.external_customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_key text NOT NULL DEFAULT 'papierkram',
 customer_number text NOT NULL CHECK(length(btrim(customer_number)) BETWEEN 1 AND 100),
 person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT,
 display_name text NOT NULL DEFAULT '',
 email text,
 phone text,
 street text,
 postal_code text,
 city text,
 source_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(source_data)='object'),
 review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','resolved','ignored')),
 review_reason text,
 source_revision integer NOT NULL DEFAULT 1 CHECK(source_revision>0),
 source_exported_at timestamptz,
 last_import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_key,customer_number),
 CHECK(review_status<>'resolved' OR person_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS external_customers_person_idx ON public.external_customers(person_id);
CREATE INDEX IF NOT EXISTS external_customers_email_idx ON public.external_customers(lower(btrim(email)));
CREATE INDEX IF NOT EXISTS external_customers_import_idx ON public.external_customers(last_import_batch_id);

CREATE TABLE IF NOT EXISTS public.external_products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_key text NOT NULL DEFAULT 'papierkram',
 article_number text NOT NULL CHECK(length(btrim(article_number)) BETWEEN 1 AND 100),
 name text NOT NULL CHECK(length(btrim(name))>0),
 description text NOT NULL DEFAULT '',
 unit text,
 unit_price numeric(12,2) CHECK(unit_price>=0),
 source_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(source_data)='object'),
 review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','resolved','ignored')),
 review_reason text,
 source_revision integer NOT NULL DEFAULT 1 CHECK(source_revision>0),
 source_exported_at timestamptz,
 last_import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_key,article_number)
);
CREATE INDEX IF NOT EXISTS external_products_import_idx ON public.external_products(last_import_batch_id);

-- A single Papierkram SKU can correspond to multiple timetable courses.
CREATE TABLE IF NOT EXISTS public.external_product_courses (
 product_id uuid NOT NULL REFERENCES public.external_products(id) ON DELETE RESTRICT,
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
 certificate_title text NOT NULL CHECK(length(btrim(certificate_title))>0),
 certificate_description text NOT NULL DEFAULT '',
 schedule_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(schedule_snapshot)='array'),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(product_id,course_id)
);
CREATE INDEX IF NOT EXISTS external_product_courses_course_idx ON public.external_product_courses(course_id);

CREATE TABLE IF NOT EXISTS public.invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_key text NOT NULL DEFAULT 'papierkram',
 invoice_number text NOT NULL CHECK(length(btrim(invoice_number)) BETWEEN 1 AND 100),
 external_customer_id uuid REFERENCES public.external_customers(id) ON DELETE RESTRICT,
 customer_number text,
 document_type text NOT NULL DEFAULT 'invoice' CHECK(document_type IN ('invoice','cancellation','credit_note','unknown')),
 source_status text NOT NULL,
 payment_status text NOT NULL DEFAULT 'unknown' CHECK(payment_status IN ('unpaid','partial','paid','overpaid','reminded','unknown')),
 validity text NOT NULL DEFAULT 'review' CHECK(validity IN ('valid','cancelled','replaced','review')),
 invoice_date date NOT NULL,
 due_date date,
 paid_at date,
 service_month date CHECK(extract(day FROM service_month)=1),
 service_month_source text CHECK(service_month_source IN ('subject','existing','manual','booking')),
 gross_amount numeric(12,2) NOT NULL,
 paid_amount numeric(12,2) NOT NULL DEFAULT 0,
 discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK(discount_amount>=0),
 currency text NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
 article_numbers text[] NOT NULL DEFAULT '{}'::text[],
 subject text NOT NULL DEFAULT '',
 source_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(source_data)='object'),
 source_revision integer NOT NULL DEFAULT 1 CHECK(source_revision>0),
 source_exported_at timestamptz NOT NULL,
 last_import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE RESTRICT,
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 review_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_key,invoice_number)
);
CREATE INDEX IF NOT EXISTS invoices_customer_idx ON public.invoices(external_customer_id);
CREATE INDEX IF NOT EXISTS invoices_month_idx ON public.invoices(service_month,payment_status,validity);
CREATE INDEX IF NOT EXISTS invoices_import_idx ON public.invoices(last_import_batch_id);
CREATE INDEX IF NOT EXISTS invoices_account_date_idx ON public.invoices(account_key,invoice_date);

CREATE TABLE IF NOT EXISTS public.invoice_relations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 original_invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
 related_invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
 relation_type text NOT NULL CHECK(relation_type IN ('cancels','replaces')),
 confirmed boolean NOT NULL DEFAULT false,
 confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 confirmed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(original_invoice_id,related_invoice_id,relation_type),
 CHECK(original_invoice_id<>related_invoice_id),
 CHECK(confirmed=(confirmed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS invoice_relations_related_idx ON public.invoice_relations(related_invoice_id);
CREATE INDEX IF NOT EXISTS invoice_relations_actor_idx ON public.invoice_relations(confirmed_by);

CREATE TABLE IF NOT EXISTS public.invoice_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
 person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
 booking_item_id uuid REFERENCES public.booking_items(id) ON DELETE RESTRICT,
 start_date date NOT NULL,
 end_date date NOT NULL CHECK(end_date>=start_date),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','excluded')),
 source text NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','import','booking')),
 source_revision integer NOT NULL DEFAULT 1 CHECK(source_revision>0),
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(invoice_id,person_id,course_id,start_date,end_date),
 CHECK(date_trunc('month',start_date)=date_trunc('month',end_date))
);
CREATE INDEX IF NOT EXISTS invoice_allocations_person_course_idx ON public.invoice_allocations(person_id,course_id,start_date,end_date);
CREATE INDEX IF NOT EXISTS invoice_allocations_course_idx ON public.invoice_allocations(course_id);
CREATE INDEX IF NOT EXISTS invoice_allocations_booking_idx ON public.invoice_allocations(booking_item_id);
CREATE INDEX IF NOT EXISTS invoice_allocations_actor_idx ON public.invoice_allocations(created_by);

CREATE TABLE IF NOT EXISTS public.participation_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
 booking_item_id uuid REFERENCES public.booking_items(id) ON DELETE RESTRICT,
 start_date date NOT NULL,
 end_date date NOT NULL CHECK(end_date>=start_date),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','revoked')),
 confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 confirmed_at timestamptz,
 title_snapshot text NOT NULL CHECK(length(btrim(title_snapshot))>0),
 description_snapshot text NOT NULL DEFAULT '',
 schedule_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(schedule_snapshot)='array'),
 source_revision integer NOT NULL DEFAULT 1 CHECK(source_revision>0),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'confirmed' OR confirmed_at IS NOT NULL),
 CHECK(date_trunc('month',start_date)=date_trunc('month',end_date)),
 UNIQUE(person_id,course_id,start_date,end_date)
);
CREATE INDEX IF NOT EXISTS participation_periods_course_idx ON public.participation_periods(course_id,start_date);
CREATE INDEX IF NOT EXISTS participation_periods_booking_idx ON public.participation_periods(booking_item_id);
CREATE INDEX IF NOT EXISTS participation_periods_actor_idx ON public.participation_periods(confirmed_by);

CREATE TABLE IF NOT EXISTS public.certificate_issues (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
 certificate_number text UNIQUE,
 status text NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','issued','failed','revoked')),
 requested_month date CHECK(extract(day FROM requested_month)=1),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 template_version text NOT NULL DEFAULT '1',
 storage_bucket text NOT NULL DEFAULT 'certificates' CHECK(storage_bucket='certificates'),
 storage_path text UNIQUE,
 pdf_sha256 text CHECK(pdf_sha256 ~ '^[a-f0-9]{64}$'),
 requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 issued_at timestamptz,
 revoked_at timestamptz,
 revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 revoked_reason text,
 failure_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'issued' OR (issued_at IS NOT NULL AND storage_path IS NOT NULL AND pdf_sha256 IS NOT NULL AND certificate_number IS NOT NULL)),
 CHECK(status<>'revoked' OR (revoked_at IS NOT NULL AND nullif(btrim(revoked_reason),'') IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS certificate_issues_person_idx ON public.certificate_issues(person_id,created_at DESC);
CREATE INDEX IF NOT EXISTS certificate_issues_requester_idx ON public.certificate_issues(requested_by);
CREATE INDEX IF NOT EXISTS certificate_issues_revoker_idx ON public.certificate_issues(revoked_by);

CREATE TABLE IF NOT EXISTS public.certificate_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 issue_id uuid NOT NULL REFERENCES public.certificate_issues(id) ON DELETE RESTRICT,
 participation_period_id uuid NOT NULL REFERENCES public.participation_periods(id) ON DELETE RESTRICT,
 invoice_allocation_id uuid NOT NULL REFERENCES public.invoice_allocations(id) ON DELETE RESTRICT,
 source_revision integer NOT NULL CHECK(source_revision>0),
 participation_revision integer NOT NULL CHECK(participation_revision>0),
 invoice_revision integer NOT NULL CHECK(invoice_revision>0),
 allocation_revision integer NOT NULL CHECK(allocation_revision>0),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(issue_id,participation_period_id,invoice_allocation_id)
);
CREATE INDEX IF NOT EXISTS certificate_sources_participation_idx ON public.certificate_sources(participation_period_id);
CREATE INDEX IF NOT EXISTS certificate_sources_allocation_idx ON public.certificate_sources(invoice_allocation_id);

CREATE TABLE IF NOT EXISTS public.certificate_audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entity_type text NOT NULL,
 entity_id uuid NOT NULL,
 action text NOT NULL,
 before_data jsonb,
 after_data jsonb,
 actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS certificate_audit_entity_idx ON public.certificate_audit_log(entity_type,entity_id,created_at DESC);
CREATE INDEX IF NOT EXISTS certificate_audit_actor_idx ON public.certificate_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS certificate_audit_import_idx ON public.certificate_audit_log(import_batch_id);

COMMENT ON TABLE public.invoice_cases IS 'Existing bookkeeping workflow: invoice requested/created. CSV payment and document validity are held separately in invoices.';
COMMENT ON COLUMN public.import_batches.scope IS 'Explicit export coverage (e.g. invoice year and archived documents). Absence from a partial export never proves cancellation.';
COMMENT ON COLUMN public.import_rows.raw_data IS 'Whitelisted source columns only. Do not retain unrelated bank account or contact export columns.';
COMMENT ON COLUMN public.invoices.service_month IS 'Confirmed service month; never inferred from invoice date plus one month. A later payment update preserves this assignment.';
COMMENT ON COLUMN public.invoice_relations.relation_type IS 'The related document cancels or replaces the original. Copy/template notes are not evidence of this relation.';
COMMENT ON TABLE public.certificate_sources IS 'Immutable source versions used at issuance. Current eligibility is rechecked before serving a stored PDF.';

CREATE OR REPLACE FUNCTION certificates_private.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at:=clock_timestamp(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION certificates_private.touch_updated_at() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION certificates_private.validate_participation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='confirmed' AND NEW.end_date>(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date THEN
  RAISE EXCEPTION 'Future participation cannot be confirmed' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION certificates_private.validate_participation() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS certificate_participation_valid ON public.participation_periods;
CREATE TRIGGER certificate_participation_valid BEFORE INSERT OR UPDATE ON public.participation_periods
 FOR EACH ROW EXECUTE FUNCTION certificates_private.validate_participation();

CREATE OR REPLACE FUNCTION certificates_private.preserve_issue_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status IN ('issued','revoked') THEN RAISE EXCEPTION 'Issued certificates are retained' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 IF OLD.status IN ('issued','revoked') THEN
  IF ROW(NEW.person_id,NEW.certificate_number,NEW.requested_month,NEW.snapshot,NEW.template_version,NEW.storage_bucket,NEW.storage_path,NEW.pdf_sha256,NEW.issued_at)
   IS DISTINCT FROM ROW(OLD.person_id,OLD.certificate_number,OLD.requested_month,OLD.snapshot,OLD.template_version,OLD.storage_bucket,OLD.storage_path,OLD.pdf_sha256,OLD.issued_at)
   OR NEW.status NOT IN ('issued','revoked') OR (OLD.status='revoked' AND NEW.status<>'revoked') THEN
   RAISE EXCEPTION 'Issued certificate content is immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION certificates_private.preserve_issue_snapshot() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS certificate_issue_immutable ON public.certificate_issues;
CREATE TRIGGER certificate_issue_immutable BEFORE UPDATE OR DELETE ON public.certificate_issues
 FOR EACH ROW EXECUTE FUNCTION certificates_private.preserve_issue_snapshot();

DO $policies$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['import_batches','import_rows','external_customers','external_products','external_product_courses','invoices','invoice_relations','invoice_allocations','participation_periods','certificate_issues','certificate_sources','certificate_audit_log'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',table_name);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',table_name);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',table_name);
  EXECUTE format('DROP POLICY IF EXISTS certificate_staff_read ON public.%I',table_name);
  EXECUTE format('CREATE POLICY certificate_staff_read ON public.%I FOR SELECT TO authenticated USING ((SELECT business_private.is_staff()))',table_name);
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['import_batches','import_rows','external_customers','external_products','external_product_courses','invoices','invoice_relations','invoice_allocations','participation_periods','certificate_issues'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS certificate_touch_updated_at ON public.%I',table_name);
  EXECUTE format('CREATE TRIGGER certificate_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION certificates_private.touch_updated_at()',table_name);
 END LOOP;
END $policies$;
-- Audit entries and source snapshots are append-only to the runtime role.
REVOKE UPDATE,DELETE,TRUNCATE ON public.certificate_audit_log,public.certificate_sources FROM service_role;
DROP POLICY IF EXISTS certificate_person_read ON public.participation_periods;
CREATE POLICY certificate_person_read ON public.participation_periods FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.people p WHERE p.id=person_id AND p.auth_user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS certificate_person_read ON public.certificate_issues;
CREATE POLICY certificate_person_read ON public.certificate_issues FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.people p WHERE p.id=person_id AND p.auth_user_id=(SELECT auth.uid())));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('certificates','certificates',false,10485760,ARRAY['application/pdf'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Restrictive policy also defeats any unrelated permissive "staff may read all"
-- policy that could otherwise accidentally expose this private bucket.
DROP POLICY IF EXISTS certificates_server_only ON storage.objects;
CREATE POLICY certificates_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING(bucket_id<>'certificates') WITH CHECK(bucket_id<>'certificates');

-- The existing verified identity claim may discard only a completely empty
-- account person. New certificate/finance references must block that operation.
CREATE OR REPLACE FUNCTION business_private.has_certificate_history(p_person uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.external_customers WHERE person_id=p_person)
 OR EXISTS(SELECT 1 FROM public.invoice_allocations WHERE person_id=p_person)
 OR EXISTS(SELECT 1 FROM public.participation_periods WHERE person_id=p_person)
 OR EXISTS(SELECT 1 FROM public.certificate_issues WHERE person_id=p_person)
$$;
REVOKE ALL ON FUNCTION business_private.has_certificate_history(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.has_certificate_history(uuid) TO service_role;

-- Preserve the deployed functions and their ACLs while extending only the
-- three known emptiness predicates. Fail on definition drift instead of
-- silently replacing unrelated, newer identity logic.
DO $identity_guards$
DECLARE signature text; definition text; old_predicate text; new_predicate text;
BEGIN
 FOR signature,old_predicate,new_predicate IN SELECT * FROM (VALUES
  ('business_private.claim_person()',
   'AND NOT EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=v_person.id) THEN',
   'AND NOT EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=v_person.id) AND NOT business_private.has_certificate_history(v_person.id) THEN'),
  ('business_private.list_registration_identity_conflicts()',
   'AND NOT EXISTS(SELECT 1 FROM public.invoice_cases i WHERE i.person_id=account.id)',
   'AND NOT EXISTS(SELECT 1 FROM public.invoice_cases i WHERE i.person_id=account.id) AND NOT business_private.has_certificate_history(account.id)'),
  ('business_private.resolve_registration_identity(uuid,uuid)',
   'OR EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=current_person.id)',
   'OR EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=current_person.id) OR business_private.has_certificate_history(current_person.id)')
 ) AS changes(signature,old_predicate,new_predicate) LOOP
  definition:=pg_get_functiondef(signature::regprocedure);
  IF strpos(definition,new_predicate)=0 THEN
   IF strpos(definition,old_predicate)=0 THEN
    RAISE EXCEPTION 'certificate_identity_guard_drift: %',signature USING ERRCODE='23514';
   END IF;
   EXECUTE replace(definition,old_predicate,new_predicate);
  END IF;
 END LOOP;
END $identity_guards$;

NOTIFY pgrst,'reload schema';
