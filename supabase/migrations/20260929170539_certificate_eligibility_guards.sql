-- Eligibility is a current calculation; a historical paid flag never grants
-- blanket permission for all courses, later obligations, or changed SKUs.
CREATE OR REPLACE FUNCTION public.certificate_import_baseline(p_account text DEFAULT 'papierkram') RETURNS text
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT certificates_private.account_baseline(p_account)
$$;
REVOKE ALL ON FUNCTION public.certificate_import_baseline(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.certificate_import_baseline(text) TO service_role;

CREATE OR REPLACE FUNCTION certificates_private.invoice_has_course(p_invoice uuid,p_course uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.invoices i
 JOIN public.external_products p ON p.account_key=i.account_key AND p.article_number=ANY(i.article_numbers)
 JOIN public.external_product_courses m ON m.product_id=p.id
 WHERE i.id=p_invoice AND p.review_status='resolved' AND m.course_id=p_course)
$$;

CREATE OR REPLACE FUNCTION certificates_private.valid_invoice_relation(p_related uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.invoice_relations r
 JOIN public.invoices original ON original.id=r.original_invoice_id
 JOIN public.invoices related ON related.id=r.related_invoice_id
 WHERE r.related_invoice_id=p_related AND r.confirmed AND original.document_type='invoice'
  AND original.account_key=related.account_key AND original.external_customer_id IS NOT NULL
  AND original.external_customer_id=related.external_customer_id AND original.service_month IS NOT NULL
  AND original.service_month=related.service_month
  AND ((r.relation_type='cancels' AND related.document_type IN ('cancellation','credit_note'))
    OR (r.relation_type='replaces' AND related.document_type='invoice')))
$$;

-- An explicit correction relationship confirms the current document identity
-- and charge. Payment-only updates remain valid; a changed customer, month,
-- document type, SKU or charge requires the teacher to confirm it again.
CREATE OR REPLACE FUNCTION certificates_private.invalidate_invoice_relations() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE affected uuid[];
BEGIN
 IF ROW(NEW.account_key,NEW.external_customer_id,NEW.customer_number,NEW.document_type,NEW.service_month,NEW.gross_amount,NEW.article_numbers)
  IS NOT DISTINCT FROM ROW(OLD.account_key,OLD.external_customer_id,OLD.customer_number,OLD.document_type,OLD.service_month,OLD.gross_amount,OLD.article_numbers) THEN RETURN NULL; END IF;
 SELECT array_agg(DISTINCT original_invoice_id) INTO affected FROM public.invoice_relations
 WHERE confirmed AND (original_invoice_id=NEW.id OR related_invoice_id=NEW.id);
 UPDATE public.invoice_relations SET confirmed=false,confirmed_at=NULL,confirmed_by=NULL
 WHERE confirmed AND (original_invoice_id=NEW.id OR related_invoice_id=NEW.id);
 UPDATE public.invoices SET validity='review',review_reason='invoice_relation_changed'
 WHERE id=ANY(affected) AND (validity<>'review' OR review_reason IS DISTINCT FROM 'invoice_relation_changed');
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS certificate_00_relation_invalidate ON public.invoices;
CREATE TRIGGER certificate_00_relation_invalidate AFTER UPDATE ON public.invoices
 FOR EACH ROW EXECUTE FUNCTION certificates_private.invalidate_invoice_relations();

CREATE OR REPLACE FUNCTION public.certificate_eligibility(p_person uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE period record; reason text; allocations jsonb; output jsonb:='[]';
BEGIN
 FOR period IN SELECT * FROM public.participation_periods WHERE person_id=p_person ORDER BY start_date,course_id,id LOOP
  reason:=NULL;
  IF period.status<>'confirmed' THEN reason:='participation_unconfirmed';
  ELSIF period.end_date>(current_timestamp AT TIME ZONE 'Europe/Berlin')::date THEN reason:='future_period';
  -- A cancellation-only partial export must not leave an older paid document
  -- usable until a teacher confirms which original it cancels. An unknown
  -- cancellation month is conservatively unresolved for this customer.
  ELSIF EXISTS(SELECT 1 FROM public.invoices i JOIN public.external_customers c ON c.id=i.external_customer_id
   WHERE c.person_id=p_person AND i.document_type IN ('cancellation','credit_note','unknown')
    AND (i.service_month IS NULL OR i.service_month=date_trunc('month',period.start_date)::date)
    AND NOT certificates_private.valid_invoice_relation(i.id))
   THEN reason:='cancellation_unresolved';
  ELSIF EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
   LEFT JOIN public.external_customers c ON c.id=i.external_customer_id
   WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status<>'excluded'
    AND a.start_date<=period.end_date AND a.end_date>=period.start_date
    AND i.validity NOT IN ('cancelled','replaced')
    AND (a.status<>'confirmed' OR c.person_id IS DISTINCT FROM p_person OR c.review_status<>'resolved'
     OR i.service_month IS DISTINCT FROM date_trunc('month',period.start_date)::date
     OR i.review_reason IS NOT NULL OR i.validity<>'valid' OR i.document_type<>'invoice'
     OR NOT certificates_private.invoice_has_course(i.id,period.course_id))) THEN reason:='invoice_review';
  -- Also consider required invoices which have not been allocated yet. Leaving
  -- a new unpaid invoice unallocated cannot bypass the payment requirement.
  ELSIF EXISTS(SELECT 1 FROM public.invoices i JOIN public.external_customers c ON c.id=i.external_customer_id
   WHERE c.person_id=p_person AND i.document_type='invoice' AND i.validity NOT IN ('cancelled','replaced')
    AND (i.service_month IS NULL OR i.service_month=date_trunc('month',period.start_date)::date)
    AND (certificates_private.invoice_has_course(i.id,period.course_id)
     OR cardinality(i.article_numbers)=0 OR EXISTS(SELECT 1 FROM unnest(i.article_numbers) sku
      WHERE NOT EXISTS(SELECT 1 FROM public.external_products p JOIN public.external_product_courses m ON m.product_id=p.id
       WHERE p.account_key=i.account_key AND p.article_number=sku AND p.review_status='resolved')))
    AND (i.service_month IS NULL OR i.validity<>'valid' OR i.review_reason IS NOT NULL
     OR NOT EXISTS(SELECT 1 FROM public.invoice_allocations a WHERE a.invoice_id=i.id AND a.person_id=p_person
      AND a.course_id=period.course_id AND a.status='confirmed')))
   THEN reason:='invoice_review';
  ELSIF NOT EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
   WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'
    AND a.start_date<=period.end_date AND a.end_date>=period.start_date
    AND i.document_type='invoice' AND i.validity='valid') THEN reason:='allocation_missing';
  ELSIF EXISTS(SELECT 1 FROM generate_series(period.start_date::timestamp,period.end_date::timestamp,interval '1 day') day
   WHERE NOT EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
    WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'
     AND a.start_date<=day::date AND a.end_date>=day::date AND i.document_type='invoice' AND i.validity='valid'))
   THEN reason:='coverage_gap';
  ELSIF EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
   WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'
    AND a.start_date<=period.end_date AND a.end_date>=period.start_date
    AND i.validity NOT IN ('cancelled','replaced')
    AND (i.payment_status NOT IN ('paid','overpaid') OR i.gross_amount<=0 OR i.paid_amount<0
     OR i.discount_amount<0 OR i.discount_amount>i.gross_amount OR i.paid_amount+i.discount_amount<i.gross_amount))
   THEN reason:='invoice_unpaid';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'invoice_id',i.id,'start_date',a.start_date,'end_date',a.end_date,
   'source_revision',a.source_revision,'invoice_revision',i.source_revision,'payment_status',i.payment_status,
   'validity',i.validity,'invoice_number',i.invoice_number) ORDER BY a.id),'[]') INTO allocations
  FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
  WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'
   AND a.start_date<=period.end_date AND a.end_date>=period.start_date
   AND i.document_type='invoice' AND i.validity NOT IN ('cancelled','replaced');
  output:=output||jsonb_build_array(to_jsonb(period)||jsonb_build_object('eligible',reason IS NULL,'reason',reason,'allocations',allocations));
 END LOOP;
 RETURN output;
END $$;

-- A new, as-yet unallocated cancellation or invoice was not among the stored
-- certificate sources. Re-evaluate existing issues for the affected customer.
CREATE OR REPLACE FUNCTION certificates_private.invalidate_customer_issues() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE person uuid; people uuid[]; issue record; eligibility jsonb; valid_period_ids uuid[];
BEGIN
 IF TG_OP='UPDATE' AND NEW.source_revision=OLD.source_revision THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' THEN
  SELECT array_agg(DISTINCT person_id) INTO people FROM public.external_customers WHERE id IN (OLD.external_customer_id,NEW.external_customer_id) AND person_id IS NOT NULL;
 ELSE
  SELECT array_agg(person_id) INTO people FROM public.external_customers WHERE id=NEW.external_customer_id AND person_id IS NOT NULL;
 END IF;
 FOREACH person IN ARRAY coalesce(people,'{}'::uuid[]) LOOP
 eligibility:=public.certificate_eligibility(person);
 SELECT coalesce(array_agg((x->>'id')::uuid),'{}'::uuid[]) INTO valid_period_ids
 FROM jsonb_array_elements(eligibility) x WHERE (x->>'eligible')::boolean;
 FOR issue IN SELECT i.id,i.status FROM public.certificate_issues i WHERE i.person_id=person AND i.status IN ('issued','generating')
  AND EXISTS(SELECT 1 FROM public.certificate_sources s WHERE s.issue_id=i.id AND NOT (s.participation_period_id=ANY(valid_period_ids))) LOOP
  UPDATE public.certificate_issues SET status=CASE WHEN issue.status='issued' THEN 'revoked' ELSE 'failed' END,
   revoked_at=CASE WHEN issue.status='issued' THEN clock_timestamp() ELSE revoked_at END,
   revoked_reason=CASE WHEN issue.status='issued' THEN 'Die Zahlungsgrundlage hat sich geändert.' ELSE revoked_reason END,
   failure_reason=CASE WHEN issue.status='generating' THEN 'source_changed' ELSE failure_reason END WHERE id=issue.id;
 END LOOP;
 END LOOP;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS certificate_customer_invalidate ON public.invoices;
CREATE TRIGGER certificate_customer_invalidate AFTER INSERT OR UPDATE ON public.invoices
 FOR EACH ROW EXECUTE FUNCTION certificates_private.invalidate_customer_issues();

REVOKE ALL ON FUNCTION certificates_private.invoice_has_course(uuid,uuid),certificates_private.valid_invoice_relation(uuid),certificates_private.invalidate_invoice_relations(),certificates_private.invalidate_customer_issues() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION certificates_private.invoice_has_course(uuid,uuid),certificates_private.valid_invoice_relation(uuid),certificates_private.invalidate_invoice_relations(),certificates_private.invalidate_customer_issues() TO service_role;
REVOKE ALL ON FUNCTION public.certificate_eligibility(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.certificate_eligibility(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
