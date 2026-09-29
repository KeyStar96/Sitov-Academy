-- Transactional, service-only CSV reconciliation. No Papierkram network API.
CREATE OR REPLACE FUNCTION certificates_private.verified_staff(p_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE p.id=p_actor AND p.role IN ('teacher','admin') AND u.email_confirmed_at IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION certificates_private.verified_staff(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION certificates_private.verified_staff(uuid) TO service_role;

CREATE OR REPLACE FUNCTION certificates_private.account_baseline(p_account text) RETURNS text
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_array(
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,source_revision) ORDER BY id),'[]') FROM public.external_customers WHERE account_key=p_account),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,source_revision) ORDER BY id),'[]') FROM public.external_products WHERE account_key=p_account),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,source_revision) ORDER BY id),'[]') FROM public.invoices WHERE account_key=p_account),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(m.product_id,m.course_id,m.version) ORDER BY m.product_id,m.course_id),'[]') FROM public.external_product_courses m JOIN public.external_products p ON p.id=m.product_id WHERE p.account_key=p_account),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,email,auth_user_id) ORDER BY id),'[]') FROM public.people),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,person_id,target_month,start_date,status,revision) ORDER BY id),'[]') FROM public.bookings),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,booking_id,course_id) ORDER BY id),'[]') FROM public.booking_items)
 )::text)
$$;

CREATE OR REPLACE FUNCTION certificates_private.record_change() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE before_value jsonb; after_value jsonb; entity uuid; actor uuid;
BEGIN
 actor:=nullif(current_setting('certificates.actor_id',true),'')::uuid;
 IF TG_OP<>'INSERT' THEN before_value:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN after_value:=to_jsonb(NEW); END IF;
 IF before_value IS NOT DISTINCT FROM after_value THEN RETURN NULL; END IF;
 entity:=coalesce((after_value->>'id')::uuid,(before_value->>'id')::uuid,(after_value->>'product_id')::uuid,(before_value->>'product_id')::uuid);
 INSERT INTO public.certificate_audit_log(entity_type,entity_id,action,before_data,after_data,actor_id)
 VALUES(TG_TABLE_NAME,entity,lower(TG_OP),before_value,after_value,actor);
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION certificates_private.bump_source_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE ignored text[]:=ARRAY['source_revision','revision','updated_at','last_seen_at','last_import_batch_id','source_exported_at'];
BEGIN
 IF (to_jsonb(NEW)-ignored) IS DISTINCT FROM (to_jsonb(OLD)-ignored) THEN
  NEW.source_revision:=OLD.source_revision+1;
  IF TG_TABLE_NAME='participation_periods' THEN NEW.revision:=OLD.revision+1; END IF;
 ELSE
  NEW.source_revision:=OLD.source_revision;
  IF TG_TABLE_NAME='participation_periods' THEN NEW.revision:=OLD.revision; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION certificates_private.invalidate_sources() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE target_ids uuid[];
BEGIN
 IF TG_OP='UPDATE' AND NEW.source_revision=OLD.source_revision THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME='invoices' THEN
  SELECT array_agg(DISTINCT s.issue_id) INTO target_ids FROM public.certificate_sources s
  JOIN public.invoice_allocations a ON a.id=s.invoice_allocation_id WHERE a.invoice_id=NEW.id;
 ELSIF TG_TABLE_NAME='invoice_allocations' THEN
  SELECT array_agg(DISTINCT s.issue_id) INTO target_ids FROM public.certificate_sources s WHERE s.invoice_allocation_id=NEW.id;
 ELSIF TG_TABLE_NAME='participation_periods' THEN
  SELECT array_agg(DISTINCT s.issue_id) INTO target_ids FROM public.certificate_sources s WHERE s.participation_period_id=NEW.id;
 END IF;
 UPDATE public.certificate_issues SET status=CASE WHEN status='generating' THEN 'failed' ELSE 'revoked' END,
 revoked_at=CASE WHEN status='issued' THEN clock_timestamp() ELSE revoked_at END,
 revoked_reason=CASE WHEN status='issued' THEN 'Die zugrunde liegenden Teilnahme- oder Rechnungsdaten wurden geändert.' ELSE revoked_reason END,
 failure_reason=CASE WHEN status='generating' THEN 'source_changed' ELSE failure_reason END
 WHERE id=ANY(target_ids) AND status IN ('generating','issued');
 -- A newly added obligation can invalidate existing certificates even though
 -- that obligation was not among their original source rows.
 IF TG_TABLE_NAME='invoice_allocations' THEN
  UPDATE public.certificate_issues i SET status=CASE WHEN i.status='generating' THEN 'failed' ELSE 'revoked' END,
   revoked_at=CASE WHEN i.status='issued' THEN clock_timestamp() ELSE i.revoked_at END,
   revoked_reason=CASE WHEN i.status='issued' THEN 'Die Rechnungszuordnung wurde geändert.' ELSE i.revoked_reason END,
   failure_reason=CASE WHEN i.status='generating' THEN 'source_changed' ELSE i.failure_reason END
  WHERE i.status IN ('generating','issued') AND EXISTS(SELECT 1 FROM public.certificate_sources s JOIN public.participation_periods p ON p.id=s.participation_period_id
   WHERE s.issue_id=i.id AND p.person_id=NEW.person_id AND p.course_id=NEW.course_id AND p.start_date<=NEW.end_date AND p.end_date>=NEW.start_date);
 END IF;
 RETURN NULL;
END $$;

DO $triggers$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['external_customers','external_products','invoices','invoice_allocations','participation_periods'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS certificate_revision ON public.%I',t);
  EXECUTE format('CREATE TRIGGER certificate_revision BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION certificates_private.bump_source_revision()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['external_customers','external_products','external_product_courses','invoices','invoice_relations','invoice_allocations','participation_periods','certificate_issues'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS certificate_audit ON public.%I',t);
  EXECUTE format('CREATE TRIGGER certificate_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION certificates_private.record_change()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['invoices','invoice_allocations','participation_periods'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS certificate_invalidate ON public.%I',t);
  EXECUTE format('CREATE TRIGGER certificate_invalidate AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION certificates_private.invalidate_sources()',t);
 END LOOP;
END $triggers$;

CREATE OR REPLACE FUNCTION certificates_private.refresh_allocations(p_invoice uuid) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE inv public.invoices; person uuid; item record; problem text; article text;
BEGIN
 SELECT * INTO inv FROM public.invoices WHERE id=p_invoice FOR UPDATE;
 SELECT person_id INTO person FROM public.external_customers WHERE id=inv.external_customer_id AND review_status='resolved';
 IF person IS NULL THEN problem:='customer_unresolved';
 ELSIF inv.service_month IS NULL THEN problem:='service_month_missing';
 ELSIF cardinality(inv.article_numbers)=0 THEN problem:='product_unmapped';
 ELSE
  FOREACH article IN ARRAY inv.article_numbers LOOP
   IF NOT EXISTS(SELECT 1 FROM public.external_products p JOIN public.external_product_courses m ON m.product_id=p.id
    WHERE p.account_key=inv.account_key AND p.article_number=article AND p.review_status='resolved') THEN problem:='product_unmapped'; EXIT; END IF;
  END LOOP;
 END IF;
 IF problem IS NULL AND inv.document_type='invoice' AND inv.validity NOT IN ('cancelled','replaced') THEN
  FOR item IN SELECT DISTINCT ON (bi.course_id,b.start_date) bi.id,bi.course_id,b.start_date,m.certificate_title,m.certificate_description,m.schedule_snapshot
   FROM public.bookings b JOIN public.booking_items bi ON bi.booking_id=b.id
   JOIN public.external_product_courses m ON m.course_id=bi.course_id JOIN public.external_products p ON p.id=m.product_id
   WHERE b.person_id=person AND b.target_month=inv.service_month AND b.status='confirmed' AND b.kind<>'trial'
    AND p.account_key=inv.account_key AND p.article_number=ANY(inv.article_numbers) AND p.review_status='resolved'
   ORDER BY bi.course_id,b.start_date,bi.id
  LOOP
   INSERT INTO public.invoice_allocations(invoice_id,person_id,course_id,booking_item_id,start_date,end_date,status,source,created_by)
   SELECT inv.id,person,item.course_id,item.id,greatest(item.start_date,inv.service_month),(inv.service_month+interval '1 month - 1 day')::date,'confirmed','booking',nullif(current_setting('certificates.actor_id',true),'')::uuid
   WHERE NOT EXISTS(SELECT 1 FROM public.invoice_allocations a WHERE a.invoice_id=inv.id AND a.person_id=person AND a.course_id=item.course_id AND a.source='manual')
   ON CONFLICT(invoice_id,person_id,course_id,start_date,end_date) DO NOTHING;
   INSERT INTO public.participation_periods(person_id,course_id,booking_item_id,start_date,end_date,title_snapshot,description_snapshot,schedule_snapshot)
   SELECT person,item.course_id,item.id,greatest(item.start_date,inv.service_month),(inv.service_month+interval '1 month - 1 day')::date,item.certificate_title,item.certificate_description,item.schedule_snapshot
   WHERE NOT EXISTS(SELECT 1 FROM public.participation_periods p WHERE p.person_id=person AND p.course_id=item.course_id
    AND p.start_date<=(inv.service_month+interval '1 month - 1 day')::date AND p.end_date>=greatest(item.start_date,inv.service_month) AND p.status<>'revoked')
   ON CONFLICT DO NOTHING;
  END LOOP;
  FOREACH article IN ARRAY inv.article_numbers LOOP
   IF NOT EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.external_product_courses m ON m.course_id=a.course_id
    JOIN public.external_products p ON p.id=m.product_id WHERE a.invoice_id=inv.id AND a.status='confirmed'
    AND p.account_key=inv.account_key AND p.article_number=article) THEN problem:='allocation_missing'; END IF;
  END LOOP;
 END IF;
 -- Source-import problems and deliberate review decisions must never be cleared
 -- merely because a product/customer mapping has become available.
 IF inv.review_reason IS NULL OR inv.review_reason IN ('customer_unresolved','service_month_missing','product_unmapped','allocation_missing') THEN
  UPDATE public.invoices SET review_reason=problem WHERE id=inv.id AND review_reason IS DISTINCT FROM problem;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.certificate_eligibility(p_person uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE period record; reason text; allocations jsonb; output jsonb:='[]';
BEGIN
 FOR period IN SELECT * FROM public.participation_periods WHERE person_id=p_person ORDER BY start_date,course_id,id LOOP
  reason:=NULL;
  IF period.status<>'confirmed' THEN reason:='participation_unconfirmed';
  ELSIF period.end_date>(current_timestamp AT TIME ZONE 'Europe/Berlin')::date THEN reason:='future_period';
  ELSIF NOT EXISTS(SELECT 1 FROM public.invoice_allocations a WHERE a.person_id=p_person AND a.course_id=period.course_id
   AND a.status='confirmed' AND a.start_date<=period.end_date AND a.end_date>=period.start_date) THEN reason:='allocation_missing';
  ELSIF EXISTS(SELECT 1 FROM generate_series(period.start_date::timestamp,period.end_date::timestamp,interval '1 day') day
   WHERE NOT EXISTS(SELECT 1 FROM public.invoice_allocations a WHERE a.person_id=p_person AND a.course_id=period.course_id
    AND a.status='confirmed' AND a.start_date<=day::date AND a.end_date>=day::date)) THEN reason:='coverage_gap';
  ELSIF EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
   LEFT JOIN public.external_customers c ON c.id=i.external_customer_id
   WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status<>'excluded'
   AND a.start_date<=period.end_date AND a.end_date>=period.start_date
   AND (a.status<>'confirmed' OR c.person_id IS DISTINCT FROM p_person OR c.review_status<>'resolved'
    OR i.service_month IS DISTINCT FROM date_trunc('month',period.start_date)::date OR i.review_reason IS NOT NULL
    OR i.validity<>'valid' OR i.document_type<>'invoice')) THEN reason:='invoice_review';
  ELSIF EXISTS(SELECT 1 FROM public.invoices i JOIN public.external_customers c ON c.id=i.external_customer_id
   WHERE c.person_id=p_person AND i.service_month=date_trunc('month',period.start_date)::date AND i.document_type='invoice'
    AND i.validity NOT IN ('cancelled','replaced') AND EXISTS(SELECT 1 FROM public.external_products p JOIN public.external_product_courses m ON m.product_id=p.id
      WHERE p.account_key=i.account_key AND p.article_number=ANY(i.article_numbers) AND m.course_id=period.course_id)
    AND (i.validity<>'valid' OR i.review_reason IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.invoice_allocations a WHERE a.invoice_id=i.id AND a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'))
   ) THEN reason:='invoice_review';
  ELSIF EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
   WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'
    AND a.start_date<=period.end_date AND a.end_date>=period.start_date
    AND (i.payment_status NOT IN ('paid','overpaid') OR i.gross_amount<0 OR i.paid_amount+i.discount_amount<i.gross_amount)) THEN reason:='invoice_unpaid';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'invoice_id',i.id,'start_date',a.start_date,'end_date',a.end_date,
   'source_revision',a.source_revision,'invoice_revision',i.source_revision,'payment_status',i.payment_status,'validity',i.validity,'invoice_number',i.invoice_number) ORDER BY a.id),'[]')
  INTO allocations FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
  WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed' AND a.start_date<=period.end_date AND a.end_date>=period.start_date;
  output:=output||jsonb_build_array(to_jsonb(period)||jsonb_build_object('eligible',reason IS NULL,'reason',reason,'allocations',allocations));
 END LOOP;
 RETURN output;
END $$;

CREATE OR REPLACE FUNCTION certificates_private.apply_rows(p_batch uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE batch public.import_batches; row_data record; d jsonb; person uuid; matches integer; duplicates integer;
 customer public.external_customers; product public.external_products; inv public.invoices; email_value text; key_value text;
 disposition_value text; changed integer:=0; conflicts integer:=0; missing integer:=0; inv_id uuid;
BEGIN
 SELECT * INTO batch FROM public.import_batches WHERE id=p_batch FOR UPDATE;
 IF batch.id IS NULL THEN RAISE EXCEPTION 'Import not found' USING ERRCODE='22023'; END IF;
 IF batch.status='applied' THEN RETURN jsonb_build_object('batch_id',batch.id,'status','applied','summary',batch.summary); END IF;
 IF EXISTS(SELECT 1 FROM public.import_rows WHERE batch_id=batch.id AND disposition='error') THEN
  RAISE EXCEPTION 'Import contains invalid rows; correct the CSV before applying it' USING ERRCODE='23514';
 END IF;
 IF batch.kind='invoices' AND batch.is_complete_snapshot AND EXISTS(SELECT 1 FROM public.import_rows r WHERE r.batch_id=batch.id
  AND r.disposition<>'ignored' AND extract(year FROM (r.normalized_data->>'invoice_date')::date) IS DISTINCT FROM batch.export_year) THEN
  RAISE EXCEPTION 'A complete year export contains invoices from a different year' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.import_batches b WHERE b.id<>batch.id AND b.account_key=batch.account_key AND b.kind=batch.kind AND b.status='applied' AND b.file_sha256=batch.file_sha256 AND b.exported_at=batch.exported_at AND b.scope=batch.scope) THEN
  UPDATE public.import_batches SET status='applied',applied_at=clock_timestamp(),summary=summary||'{"duplicate":true}'::jsonb WHERE id=batch.id;
  RETURN jsonb_build_object('batch_id',batch.id,'status','applied','summary',jsonb_build_object('duplicate',true));
 END IF;
 IF batch.baseline_hash IS DISTINCT FROM certificates_private.account_baseline(batch.account_key) THEN
  RAISE EXCEPTION 'Import preview is stale; upload again' USING ERRCODE='40001';
 END IF;
 IF EXISTS(SELECT 1 FROM public.import_batches b WHERE b.account_key=batch.account_key AND b.kind=batch.kind AND b.status='applied' AND b.exported_at>batch.exported_at) THEN
  RAISE EXCEPTION 'An older export cannot overwrite a newer import' USING ERRCODE='40001';
 END IF;
 FOR row_data IN SELECT * FROM public.import_rows WHERE batch_id=batch.id ORDER BY row_number LOOP
  IF row_data.disposition IN ('ignored','error') THEN CONTINUE; END IF;
  d:=row_data.normalized_data; disposition_value:='updated';
  IF batch.kind='customers' THEN
   key_value:=d->>'customer_number'; email_value:=nullif(lower(btrim(d->>'email')),'');
   SELECT * INTO customer FROM public.external_customers WHERE account_key=batch.account_key AND customer_number=key_value FOR UPDATE;
   IF customer.source_exported_at>batch.exported_at THEN RAISE EXCEPTION 'Stale customer export' USING ERRCODE='40001'; END IF;
   person:=customer.person_id;
   IF customer.id IS NULL THEN disposition_value:='new'; ELSIF customer.source_data=d THEN disposition_value:='unchanged'; END IF;
   IF person IS NULL AND email_value IS NOT NULL THEN
    SELECT count(*) INTO duplicates FROM public.import_rows r WHERE r.batch_id=batch.id AND r.disposition NOT IN ('ignored','error') AND lower(btrim(r.normalized_data->>'email'))=email_value;
    SELECT count(*),(array_agg(p.id ORDER BY p.id))[1] INTO matches,person FROM public.people p WHERE lower(btrim(p.email))=email_value;
    IF duplicates>1 OR matches>1 OR EXISTS(SELECT 1 FROM public.external_customers ec WHERE ec.account_key=batch.account_key AND ec.customer_number<>key_value AND lower(btrim(ec.email))=email_value) THEN person:=NULL;
    ELSIF matches=0 THEN
     INSERT INTO public.people(display_name,email,phone,street,postal_code,city)
     VALUES(d->>'display_name',email_value,d->>'phone',d->>'street',d->>'postal_code',d->>'city') RETURNING id INTO person;
    END IF;
   END IF;
   IF person IS NULL THEN disposition_value:='conflict'; conflicts:=conflicts+1; END IF;
   INSERT INTO public.external_customers(account_key,customer_number,person_id,display_name,email,phone,street,postal_code,city,source_data,review_status,review_reason,source_exported_at,last_import_batch_id)
   VALUES(batch.account_key,key_value,person,d->>'display_name',email_value,d->>'phone',d->>'street',d->>'postal_code',d->>'city',d,
    CASE WHEN person IS NULL THEN 'pending' ELSE 'resolved' END,CASE WHEN person IS NULL THEN 'email_missing_or_ambiguous' END,batch.exported_at,batch.id)
   ON CONFLICT(account_key,customer_number) DO UPDATE SET display_name=excluded.display_name,email=excluded.email,phone=excluded.phone,street=excluded.street,postal_code=excluded.postal_code,city=excluded.city,
    person_id=coalesce(external_customers.person_id,excluded.person_id),source_data=excluded.source_data,review_status=CASE WHEN coalesce(external_customers.person_id,excluded.person_id) IS NOT NULL THEN 'resolved' ELSE excluded.review_status END,
    review_reason=CASE WHEN coalesce(external_customers.person_id,excluded.person_id) IS NOT NULL THEN NULL ELSE excluded.review_reason END,source_exported_at=excluded.source_exported_at,last_import_batch_id=excluded.last_import_batch_id;
  ELSIF batch.kind='products' THEN
   SELECT * INTO product FROM public.external_products WHERE account_key=batch.account_key AND article_number=d->>'article_number' FOR UPDATE;
   IF product.source_exported_at>batch.exported_at THEN RAISE EXCEPTION 'Stale product export' USING ERRCODE='40001'; END IF;
   IF product.id IS NULL THEN disposition_value:='new'; ELSIF product.source_data=d THEN disposition_value:='unchanged'; END IF;
   INSERT INTO public.external_products(account_key,article_number,name,description,unit,unit_price,source_data,source_exported_at,last_import_batch_id)
   VALUES(batch.account_key,d->>'article_number',d->>'name',coalesce(d->>'description',''),d->>'unit',(d->>'unit_price')::numeric,d,batch.exported_at,batch.id)
   ON CONFLICT(account_key,article_number) DO UPDATE SET name=excluded.name,description=excluded.description,unit=excluded.unit,unit_price=excluded.unit_price,source_data=excluded.source_data,source_exported_at=excluded.source_exported_at,last_import_batch_id=excluded.last_import_batch_id;
  ELSE
   SELECT * INTO inv FROM public.invoices WHERE account_key=batch.account_key AND invoice_number=d->>'invoice_number' FOR UPDATE;
   IF inv.source_exported_at>batch.exported_at THEN RAISE EXCEPTION 'Stale invoice export' USING ERRCODE='40001'; END IF;
   IF inv.id IS NULL THEN disposition_value:='new'; ELSIF inv.source_data=d THEN disposition_value:='unchanged'; END IF;
   INSERT INTO public.invoices(account_key,invoice_number,external_customer_id,customer_number,document_type,source_status,payment_status,validity,invoice_date,due_date,paid_at,service_month,service_month_source,gross_amount,paid_amount,discount_amount,article_numbers,subject,source_data,source_exported_at,last_import_batch_id,review_reason)
   VALUES(batch.account_key,d->>'invoice_number',(SELECT id FROM public.external_customers WHERE account_key=batch.account_key AND customer_number=d->>'customer_number'),d->>'customer_number',d->>'document_type',d->>'source_status',d->>'payment_status',d->>'validity',(d->>'invoice_date')::date,nullif(d->>'due_date','')::date,nullif(d->>'paid_at','')::date,nullif(d->>'service_month','')::date,'subject',(d->>'gross_amount')::numeric,(d->>'paid_amount')::numeric,(d->>'discount_amount')::numeric,ARRAY(SELECT jsonb_array_elements_text(d->'article_numbers')),coalesce(d->>'subject',''),d,batch.exported_at,batch.id,nullif(d->>'review_reason',''))
   ON CONFLICT(account_key,invoice_number) DO UPDATE SET
    external_customer_id=excluded.external_customer_id,customer_number=excluded.customer_number,document_type=excluded.document_type,source_status=excluded.source_status,payment_status=excluded.payment_status,
    validity=CASE WHEN invoices.validity IN ('cancelled','replaced') AND EXISTS(SELECT 1 FROM public.invoice_relations r WHERE r.original_invoice_id=invoices.id AND r.confirmed) THEN invoices.validity ELSE excluded.validity END,
    invoice_date=excluded.invoice_date,due_date=excluded.due_date,paid_at=excluded.paid_at,
    service_month=coalesce(invoices.service_month,excluded.service_month),service_month_source=coalesce(invoices.service_month_source,excluded.service_month_source),
    gross_amount=excluded.gross_amount,paid_amount=excluded.paid_amount,discount_amount=excluded.discount_amount,article_numbers=excluded.article_numbers,subject=excluded.subject,source_data=excluded.source_data,source_exported_at=excluded.source_exported_at,last_import_batch_id=excluded.last_import_batch_id,last_seen_at=clock_timestamp(),
    review_reason=CASE WHEN invoices.service_month IS NOT NULL AND excluded.service_month IS NOT NULL AND invoices.service_month<>excluded.service_month THEN 'service_month_conflict'
     WHEN invoices.customer_number IS DISTINCT FROM excluded.customer_number THEN 'customer_changed'
     WHEN invoices.service_month IS NOT NULL AND excluded.review_reason IN ('missing_month','service_month_missing') THEN NULL
     ELSE excluded.review_reason END
   RETURNING id INTO inv_id;
   PERFORM certificates_private.refresh_allocations(inv_id);
  END IF;
  UPDATE public.import_rows SET disposition=disposition_value WHERE id=row_data.id;
  IF disposition_value IN ('new','updated') THEN changed:=changed+1; END IF;
 END LOOP;
 IF batch.kind='invoices' AND batch.is_complete_snapshot AND batch.export_year IS NOT NULL AND batch.scope->>'includes_archived'='true' THEN
  UPDATE public.invoices i SET validity='review',review_reason='missing_from_snapshot'
   WHERE i.account_key=batch.account_key AND extract(year FROM i.invoice_date)=batch.export_year
    AND i.source_exported_at<=batch.exported_at AND i.validity NOT IN ('cancelled','replaced')
    AND NOT EXISTS(SELECT 1 FROM public.import_rows r WHERE r.batch_id=batch.id AND r.external_key=i.invoice_number);
  GET DIAGNOSTICS missing=ROW_COUNT;
 END IF;
 IF batch.kind='customers' THEN
  UPDATE public.invoices i SET external_customer_id=c.id FROM public.external_customers c
   WHERE c.account_key=batch.account_key AND i.account_key=c.account_key AND c.customer_number=i.customer_number AND i.external_customer_id IS NULL;
 END IF;
 IF batch.kind IN ('customers','products') THEN
  FOR inv_id IN SELECT id FROM public.invoices WHERE account_key=batch.account_key LOOP PERFORM certificates_private.refresh_allocations(inv_id); END LOOP;
 END IF;
 UPDATE public.import_batches SET status='applied',applied_at=clock_timestamp(),summary=summary||jsonb_build_object('changed',changed,'conflicts',conflicts,'missing',missing) WHERE id=batch.id RETURNING summary INTO d;
 RETURN jsonb_build_object('batch_id',batch.id,'status','applied','summary',d);
END $$;

CREATE OR REPLACE FUNCTION public.certificate_staff_command(p_actor uuid,p_command text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE account text:=coalesce(p_payload->>'account_key','papierkram'); batch_id uuid; row_value jsonb; entry jsonb; identifier uuid;
 person uuid; customer public.external_customers; inv public.invoices; related public.invoices; course public.courses; period public.participation_periods;
 target_course_id uuid; start_day date; end_day date; changed integer:=0; reason text;
BEGIN
 IF NOT certificates_private.verified_staff(p_actor) THEN RAISE EXCEPTION 'Verified staff required' USING ERRCODE='42501'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>12582912 THEN RAISE EXCEPTION 'Invalid command payload' USING ERRCODE='22023'; END IF;
 -- One reconciliation lock avoids customer/invoice/order races across all
 -- commands, including commands whose account is obtained from the target row.
 PERFORM pg_advisory_xact_lock(hashtextextended('certificate-reconciliation',0));
 PERFORM set_config('certificates.actor_id',p_actor::text,true);
 IF p_command='stage_import' THEN
  IF jsonb_typeof(p_payload->'rows')<>'array' OR jsonb_array_length(p_payload->'rows')>10000 THEN RAISE EXCEPTION 'Invalid import rows' USING ERRCODE='22023'; END IF;
  IF p_payload->>'expected_baseline' IS DISTINCT FROM certificates_private.account_baseline(account) THEN
   RAISE EXCEPTION 'Preview source changed; refresh before uploading' USING ERRCODE='40001';
  END IF;
  INSERT INTO public.import_batches(account_key,kind,filename,file_sha256,exported_at,scope,is_complete_snapshot,export_year,baseline_hash,summary,created_by)
  VALUES(account,p_payload->>'kind',p_payload->>'filename',p_payload->>'file_sha256',(p_payload->>'exported_at')::timestamptz,coalesce(p_payload->'scope','{}'),coalesce((p_payload->>'is_complete_snapshot')::boolean,false),nullif(p_payload->>'export_year','')::integer,certificates_private.account_baseline(account),coalesce(p_payload->'summary','{}'),p_actor) RETURNING id INTO batch_id;
  FOR row_value IN SELECT value FROM jsonb_array_elements(p_payload->'rows') LOOP
   INSERT INTO public.import_rows(batch_id,row_number,external_key,raw_data,normalized_data,disposition,issues)
   VALUES(batch_id,(row_value->>'row_number')::integer,row_value->>'external_key',coalesce(row_value->'raw_data','{}'),coalesce(row_value->'normalized_data','{}'),coalesce(row_value->>'disposition','new'),coalesce(row_value->'issues','[]'));
  END LOOP;
  RETURN jsonb_build_object('batch_id',batch_id,'status','preview','summary',coalesce(p_payload->'summary','{}'));
 ELSIF p_command='apply_import' THEN
  RETURN certificates_private.apply_rows((p_payload->>'batch_id')::uuid);
 ELSIF p_command='resolve_customer' THEN
  SELECT * INTO customer FROM public.external_customers WHERE id=(p_payload->>'id')::uuid FOR UPDATE;
  IF customer.id IS NULL THEN RAISE EXCEPTION 'Customer not found' USING ERRCODE='22023'; END IF;
  person:=nullif(p_payload->>'person_id','')::uuid;
  IF person IS NULL THEN
   IF nullif(btrim(p_payload->>'email'),'') IS NULL OR nullif(btrim(p_payload->>'display_name'),'') IS NULL THEN RAISE EXCEPTION 'Name and email required' USING ERRCODE='22023'; END IF;
   INSERT INTO public.people(display_name,email,phone,street,postal_code,city) VALUES(p_payload->>'display_name',lower(btrim(p_payload->>'email')),p_payload->>'phone',p_payload->>'street',p_payload->>'postal_code',p_payload->>'city') RETURNING id INTO person;
  END IF;
  IF customer.person_id IS NOT NULL AND customer.person_id<>person THEN RAISE EXCEPTION 'Existing customer mapping cannot be reassigned' USING ERRCODE='23514'; END IF;
  UPDATE public.external_customers SET person_id=person,review_status='resolved',review_reason=NULL WHERE id=customer.id;
  FOR identifier IN SELECT id FROM public.invoices WHERE external_customer_id=customer.id LOOP PERFORM certificates_private.refresh_allocations(identifier); END LOOP;
  RETURN jsonb_build_object('id',customer.id,'person_id',person);
 ELSIF p_command='map_product' THEN
  identifier:=(p_payload->>'id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.external_products WHERE id=identifier) OR jsonb_typeof(p_payload->'course_ids')<>'array' OR jsonb_array_length(p_payload->'course_ids')=0 THEN RAISE EXCEPTION 'Product and courses required' USING ERRCODE='22023'; END IF;
  -- Correct an unused mapping; mappings with accounting history are retained.
  IF EXISTS(SELECT 1 FROM public.external_product_courses m WHERE m.product_id=identifier AND NOT (to_jsonb(m.course_id::text)<@(p_payload->'course_ids'))
    AND EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id JOIN public.external_products p ON p.id=m.product_id
     WHERE a.course_id=m.course_id AND i.account_key=p.account_key AND p.article_number=ANY(i.article_numbers))) THEN
   RAISE EXCEPTION 'A mapping with invoice history cannot be removed' USING ERRCODE='23514';
  END IF;
  DELETE FROM public.external_product_courses m WHERE m.product_id=identifier AND NOT (to_jsonb(m.course_id::text)<@(p_payload->'course_ids'));
  FOR target_course_id IN SELECT value::uuid FROM jsonb_array_elements_text(p_payload->'course_ids') LOOP
   SELECT * INTO course FROM public.courses WHERE id=target_course_id;
   IF course.id IS NULL THEN RAISE EXCEPTION 'Course not found' USING ERRCODE='22023'; END IF;
   INSERT INTO public.external_product_courses(product_id,course_id,certificate_title,certificate_description,schedule_snapshot)
   VALUES(identifier,course.id,coalesce(nullif(p_payload->>'title',''),course.title),coalesce(p_payload->>'description',course.description),
    coalesce((SELECT jsonb_agg(jsonb_build_object('weekday',s.weekday,'start_time',s.start_time,'end_time',s.end_time) ORDER BY s.weekday,s.start_time) FROM public.course_schedules s WHERE s.course_id=course.id),'[]'))
   ON CONFLICT(product_id,course_id) DO UPDATE SET certificate_title=excluded.certificate_title,certificate_description=excluded.certificate_description,schedule_snapshot=excluded.schedule_snapshot,version=external_product_courses.version+1;
  END LOOP;
  UPDATE public.external_products SET review_status='resolved',review_reason=NULL WHERE id=identifier;
  FOR batch_id IN SELECT i.id FROM public.invoices i JOIN public.external_products p ON p.account_key=i.account_key AND p.article_number=ANY(i.article_numbers) WHERE p.id=identifier LOOP PERFORM certificates_private.refresh_allocations(batch_id); END LOOP;
  RETURN jsonb_build_object('id',identifier);
 ELSIF p_command='resolve_invoice' THEN
  identifier:=(p_payload->>'id')::uuid;
  UPDATE public.invoices SET service_month=(p_payload->>'service_month')::date,service_month_source='manual',validity=p_payload->>'validity',review_reason=NULL WHERE id=identifier;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE='22023'; END IF;
  PERFORM certificates_private.refresh_allocations(identifier);
  RETURN jsonb_build_object('id',identifier);
 ELSIF p_command='relate_invoice' THEN
  SELECT * INTO inv FROM public.invoices WHERE id=(p_payload->>'original')::uuid FOR UPDATE;
  SELECT * INTO related FROM public.invoices WHERE id=(p_payload->>'related')::uuid FOR UPDATE;
  reason:=p_payload->>'type';
  IF inv.id IS NULL OR related.id IS NULL OR inv.id=related.id OR inv.document_type<>'invoice' OR inv.account_key<>related.account_key OR inv.external_customer_id IS NULL OR inv.external_customer_id IS DISTINCT FROM related.external_customer_id OR inv.service_month IS NULL OR reason NOT IN ('cancels','replaces') THEN RAISE EXCEPTION 'Invalid invoice relation' USING ERRCODE='23514'; END IF;
  IF reason='replaces' AND (related.document_type<>'invoice' OR related.service_month IS DISTINCT FROM inv.service_month) THEN RAISE EXCEPTION 'Replacement must cover the same customer and month' USING ERRCODE='23514'; END IF;
  IF reason='cancels' AND related.document_type NOT IN ('cancellation','credit_note') THEN RAISE EXCEPTION 'Cancellation document required' USING ERRCODE='23514'; END IF;
  IF reason='cancels' AND related.service_month IS NOT NULL AND related.service_month<>inv.service_month THEN RAISE EXCEPTION 'Cancellation must cover the original service month' USING ERRCODE='23514'; END IF;
  IF reason='cancels' AND related.service_month IS NULL THEN
   UPDATE public.invoices SET service_month=inv.service_month,service_month_source='manual' WHERE id=related.id;
  END IF;
  INSERT INTO public.invoice_relations(original_invoice_id,related_invoice_id,relation_type,confirmed,confirmed_by,confirmed_at)
  VALUES(inv.id,related.id,reason,true,p_actor,clock_timestamp()) ON CONFLICT(original_invoice_id,related_invoice_id,relation_type) DO UPDATE SET confirmed=true,confirmed_by=p_actor,confirmed_at=clock_timestamp();
  UPDATE public.invoices SET validity=CASE WHEN reason='replaces' THEN 'replaced' ELSE 'cancelled' END,review_reason=NULL WHERE id=inv.id;
  IF reason='replaces' THEN
   INSERT INTO public.invoice_allocations(invoice_id,person_id,course_id,start_date,end_date,status,source,created_by)
   SELECT related.id,a.person_id,a.course_id,a.start_date,a.end_date,'confirmed','manual',p_actor FROM public.invoice_allocations a
    WHERE a.invoice_id=inv.id AND a.status='confirmed' AND EXISTS(SELECT 1 FROM public.external_products p JOIN public.external_product_courses m ON m.product_id=p.id WHERE p.account_key=related.account_key AND p.article_number=ANY(related.article_numbers) AND m.course_id=a.course_id)
   ON CONFLICT DO NOTHING;
   UPDATE public.invoice_allocations SET status='excluded' WHERE invoice_id=inv.id;
   PERFORM certificates_private.refresh_allocations(related.id);
  END IF;
  RETURN jsonb_build_object('id',inv.id,'related_id',related.id);
 ELSIF p_command='allocate' THEN
  SELECT * INTO inv FROM public.invoices WHERE id=(p_payload->>'invoice_id')::uuid FOR UPDATE;
  SELECT person_id INTO person FROM public.external_customers WHERE id=inv.external_customer_id AND review_status='resolved';
  target_course_id:=(p_payload->>'course_id')::uuid; start_day:=(p_payload->>'start')::date; end_day:=(p_payload->>'end')::date;
  IF inv.id IS NULL OR person IS NULL OR inv.document_type<>'invoice' OR (inv.validity IN ('cancelled','replaced') AND coalesce(p_payload->>'status','confirmed')<>'excluded') OR date_trunc('month',start_day)::date IS DISTINCT FROM inv.service_month OR date_trunc('month',end_day)::date IS DISTINCT FROM inv.service_month OR start_day>end_day
   OR NOT EXISTS(SELECT 1 FROM public.external_products p JOIN public.external_product_courses m ON m.product_id=p.id WHERE p.account_key=inv.account_key AND p.article_number=ANY(inv.article_numbers) AND p.review_status='resolved' AND m.course_id=target_course_id) THEN RAISE EXCEPTION 'Allocation does not match invoice/customer/course/month' USING ERRCODE='23514'; END IF;
  identifier:=nullif(p_payload->>'id','')::uuid;
  IF identifier IS NOT NULL THEN
   UPDATE public.invoice_allocations SET course_id=target_course_id,start_date=start_day,end_date=end_day,status=coalesce(p_payload->>'status','confirmed'),source='manual'
    WHERE id=identifier AND invoice_id=inv.id AND person_id=person;
   IF NOT FOUND THEN RAISE EXCEPTION 'Allocation not found' USING ERRCODE='22023'; END IF;
  ELSE
   INSERT INTO public.invoice_allocations(invoice_id,person_id,course_id,start_date,end_date,status,source,created_by)
   VALUES(inv.id,person,target_course_id,start_day,end_day,coalesce(p_payload->>'status','confirmed'),'manual',p_actor)
   ON CONFLICT(invoice_id,person_id,course_id,start_date,end_date) DO UPDATE SET status=excluded.status RETURNING id INTO identifier;
  END IF;
  PERFORM certificates_private.refresh_allocations(inv.id);
  RETURN jsonb_build_object('id',identifier,'person_id',person);
 ELSIF p_command='confirm_participation' THEN
  IF jsonb_typeof(p_payload->'periods')<>'array' OR jsonb_array_length(p_payload->'periods')>500 THEN RAISE EXCEPTION 'Invalid participation batch' USING ERRCODE='22023'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_payload->'periods') LOOP
   identifier:=nullif(entry->>'id','')::uuid; person:=(entry->>'person_id')::uuid; target_course_id:=(entry->>'course_id')::uuid; start_day:=(entry->>'start')::date; end_day:=(entry->>'end')::date;
   IF EXISTS(SELECT 1 FROM public.participation_periods p WHERE p.person_id=person AND p.course_id=target_course_id AND p.status<>'revoked' AND p.start_date<=end_day AND p.end_date>=start_day AND (identifier IS NULL OR p.id<>identifier)) THEN RAISE EXCEPTION 'Overlapping participation period' USING ERRCODE='23514'; END IF;
   IF identifier IS NOT NULL THEN
    SELECT * INTO period FROM public.participation_periods WHERE id=identifier FOR UPDATE;
    IF period.id IS NULL OR period.person_id<>person OR period.course_id<>target_course_id OR (entry->>'revision')::integer IS DISTINCT FROM period.revision THEN RAISE EXCEPTION 'Participation changed; refresh first' USING ERRCODE='40001'; END IF;
    UPDATE public.participation_periods SET start_date=start_day,end_date=end_day,status='confirmed',confirmed_by=p_actor,confirmed_at=clock_timestamp(),title_snapshot=entry->>'title',description_snapshot=coalesce(entry->>'description',''),schedule_snapshot=coalesce(entry->'schedule','[]') WHERE id=identifier;
   ELSE
    INSERT INTO public.participation_periods(person_id,course_id,start_date,end_date,status,confirmed_by,confirmed_at,title_snapshot,description_snapshot,schedule_snapshot)
    VALUES(person,target_course_id,start_day,end_day,'confirmed',p_actor,clock_timestamp(),entry->>'title',coalesce(entry->>'description',''),coalesce(entry->'schedule','[]'));
   END IF;
   changed:=changed+1;
  END LOOP;
  RETURN jsonb_build_object('confirmed_count',changed);
 ELSIF p_command='revoke_participation' THEN
  identifier:=(p_payload->>'id')::uuid; reason:=nullif(btrim(p_payload->>'reason'),'');
  IF reason IS NULL THEN RAISE EXCEPTION 'Revocation reason required' USING ERRCODE='22023'; END IF;
  UPDATE public.participation_periods SET status='revoked',note=reason
   WHERE id=identifier AND revision=(p_payload->>'revision')::integer;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participation changed; refresh first' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('id',identifier);
 ELSIF p_command='revoke_issue' THEN
  identifier:=(p_payload->>'id')::uuid; reason:=nullif(btrim(p_payload->>'reason'),'');
  IF reason IS NULL THEN RAISE EXCEPTION 'Revocation reason required' USING ERRCODE='22023'; END IF;
  UPDATE public.certificate_issues SET status='revoked',revoked_at=clock_timestamp(),revoked_by=p_actor,revoked_reason=reason WHERE id=identifier AND status IN ('issued','revoked');
  IF NOT FOUND THEN RAISE EXCEPTION 'Issued certificate not found' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('id',identifier);
 END IF;
 RAISE EXCEPTION 'Unknown certificate command' USING ERRCODE='22023';
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA certificates_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA certificates_private TO service_role;
REVOKE ALL ON FUNCTION public.certificate_staff_command(uuid,text,jsonb),public.certificate_eligibility(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.certificate_staff_command(uuid,text,jsonb),public.certificate_eligibility(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
