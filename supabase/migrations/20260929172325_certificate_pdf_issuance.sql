-- PDF issuance reserves an immutable snapshot before rendering, then verifies
-- all payment/attendance sources again after the private Storage upload.
CREATE OR REPLACE FUNCTION certificates_private.verified_person(p_actor uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT person.id FROM auth.users u JOIN public.profiles profile ON profile.id=u.id
 JOIN public.people person ON person.auth_user_id=profile.id
 WHERE u.id=p_actor AND u.email_confirmed_at IS NOT NULL AND nullif(btrim(u.email),'') IS NOT NULL
  AND NOT coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)
$$;
REVOKE ALL ON FUNCTION certificates_private.verified_person(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION certificates_private.verified_person(uuid) TO service_role;

CREATE OR REPLACE FUNCTION certificates_private.issue_sources_current(p_issue uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE issue public.certificate_issues; current_periods jsonb; snapshot_period jsonb; current_period jsonb;
BEGIN
 SELECT * INTO issue FROM public.certificate_issues WHERE id=p_issue;
 IF issue.id IS NULL OR jsonb_typeof(issue.snapshot->'periods') IS DISTINCT FROM 'array'
  OR jsonb_array_length(issue.snapshot->'periods')=0 THEN RETURN false; END IF;
 current_periods:=public.certificate_eligibility(issue.person_id);
 FOR snapshot_period IN SELECT value FROM jsonb_array_elements(issue.snapshot->'periods') LOOP
  SELECT value INTO current_period FROM jsonb_array_elements(current_periods)
   WHERE value->>'id'=snapshot_period->>'id';
  IF current_period IS NULL OR NOT (current_period->>'eligible')::boolean
   OR (current_period->>'revision')::integer IS DISTINCT FROM (snapshot_period->>'revision')::integer
   OR (current_period->>'source_revision')::integer IS DISTINCT FROM (snapshot_period->>'source_revision')::integer
   OR current_period->'allocations' IS DISTINCT FROM snapshot_period->'allocations' THEN RETURN false; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT participation_period_id) FROM public.certificate_sources WHERE issue_id=issue.id)
  <>jsonb_array_length(issue.snapshot->'periods') THEN RETURN false; END IF;
 RETURN NOT EXISTS(SELECT 1 FROM public.certificate_sources s
  JOIN public.participation_periods p ON p.id=s.participation_period_id
  JOIN public.invoice_allocations a ON a.id=s.invoice_allocation_id
  JOIN public.invoices i ON i.id=a.invoice_id
  WHERE s.issue_id=issue.id AND (p.person_id<>issue.person_id OR a.person_id<>issue.person_id OR a.course_id<>p.course_id
   OR s.source_revision<>p.source_revision OR s.participation_revision<>p.revision
   OR s.invoice_revision<>i.source_revision OR s.allocation_revision<>a.source_revision));
END $$;

CREATE OR REPLACE FUNCTION public.certificate_issue_command(p_actor uuid,p_command text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE person uuid; person_row public.people; selected_month date; periods jsonb; snapshot_data jsonb;
 issue public.certificate_issues; period jsonb; allocation jsonb; identifier uuid; today date; digest text;
BEGIN
 person:=certificates_private.verified_person(p_actor);
 IF person IS NULL THEN RAISE EXCEPTION 'Verified certificate owner required' USING ERRCODE='42501'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'Invalid certificate request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('certificate-reconciliation',0));
 PERFORM set_config('certificates.actor_id',p_actor::text,true);
 -- Lock the persisted business identity while taking its contact snapshot.
 SELECT * INTO person_row FROM public.people WHERE id=person AND auth_user_id=p_actor FOR SHARE;
 IF person_row.id IS NULL THEN RAISE EXCEPTION 'Certificate owner changed' USING ERRCODE='42501'; END IF;
 today:=(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date;
 IF p_command='reserve' THEN
  selected_month:=nullif(p_payload->>'month','')::date;
  IF selected_month IS NOT NULL AND extract(day FROM selected_month)<>1 THEN RAISE EXCEPTION 'Choose a calendar month' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(value ORDER BY value->>'start_date',value->>'course_id',value->>'id'),'[]') INTO periods
   FROM jsonb_array_elements(public.certificate_eligibility(person))
   WHERE (value->>'eligible')::boolean AND (selected_month IS NULL OR date_trunc('month',(value->>'start_date')::date)::date=selected_month);
  IF jsonb_array_length(periods)=0 THEN RETURN jsonb_build_object('error','conflict','message','Für diese Auswahl stehen keine bestätigten und bezahlten Teilnahmezeiträume zur Verfügung.'); END IF;
  IF jsonb_array_length(periods)>600 THEN RETURN jsonb_build_object('error','invalid_input','message','Bitte einen einzelnen Monat auswählen.'); END IF;
  snapshot_data:=jsonb_build_object('person',jsonb_build_object('display_name',person_row.display_name,'street',person_row.street,'postal_code',person_row.postal_code,'city',person_row.city),
   'periods',periods,'date',today);
  UPDATE public.certificate_issues SET status='failed',failure_reason='generation_expired'
   WHERE status='generating' AND created_at<clock_timestamp()-interval '10 minutes';
  SELECT * INTO issue FROM public.certificate_issues i WHERE i.person_id=person AND i.requested_month IS NOT DISTINCT FROM selected_month
   AND i.template_version='1' AND i.snapshot=snapshot_data AND i.status='issued' ORDER BY i.issued_at DESC LIMIT 1 FOR UPDATE;
  IF issue.id IS NOT NULL AND certificates_private.issue_sources_current(issue.id) THEN RETURN to_jsonb(issue); END IF;
  IF EXISTS(SELECT 1 FROM public.certificate_issues i WHERE i.person_id=person AND i.status='generating') THEN
   RETURN jsonb_build_object('error','conflict','message','Die Bescheinigung wird bereits erstellt. Bitte kurz warten und erneut versuchen.');
  END IF;
  IF (SELECT count(*) FROM public.certificate_issues WHERE status='generating')>=3 THEN
   RETURN jsonb_build_object('error','conflict','message','Aktuell werden mehrere Bescheinigungen erstellt. Bitte kurz warten und erneut versuchen.');
  END IF;
  identifier:=gen_random_uuid();
  INSERT INTO public.certificate_issues(id,person_id,certificate_number,requested_month,snapshot,template_version,storage_path,requested_by)
   VALUES(identifier,person,'SA-'||extract(year FROM today)::text||'-'||upper(replace(identifier::text,'-','')),selected_month,snapshot_data,'1',person::text||'/'||identifier::text||'.pdf',p_actor)
   RETURNING * INTO issue;
  FOR period IN SELECT value FROM jsonb_array_elements(periods) LOOP
   FOR allocation IN SELECT value FROM jsonb_array_elements(period->'allocations') LOOP
    INSERT INTO public.certificate_sources(issue_id,participation_period_id,invoice_allocation_id,source_revision,participation_revision,invoice_revision,allocation_revision,snapshot)
    VALUES(issue.id,(period->>'id')::uuid,(allocation->>'id')::uuid,(period->>'source_revision')::integer,(period->>'revision')::integer,
     (allocation->>'invoice_revision')::integer,(allocation->>'source_revision')::integer,jsonb_build_object('period',period,'allocation',allocation));
   END LOOP;
  END LOOP;
  RETURN to_jsonb(issue);
 END IF;
 identifier:=nullif(p_payload->>'id','')::uuid;
 SELECT * INTO issue FROM public.certificate_issues WHERE id=identifier AND person_id=person FOR UPDATE;
 IF issue.id IS NULL THEN RAISE EXCEPTION 'Certificate not available' USING ERRCODE='42501'; END IF;
 IF p_command='fail' THEN
  UPDATE public.certificate_issues SET status='failed',failure_reason='pdf_generation_failed' WHERE id=issue.id AND status='generating' RETURNING * INTO issue;
  IF issue.id IS NULL THEN SELECT * INTO issue FROM public.certificate_issues WHERE id=identifier AND person_id=person; END IF;
  RETURN to_jsonb(issue);
 ELSIF p_command IN ('finalize','download') THEN
  IF (p_command='finalize' AND issue.status NOT IN ('generating','issued')) OR (p_command='download' AND issue.status<>'issued') THEN
   RETURN jsonb_build_object('error','conflict','message','Diese Bescheinigung ist nicht mehr verfügbar. Bitte eine neue Bescheinigung erstellen.');
  END IF;
  IF NOT certificates_private.issue_sources_current(issue.id) THEN
   UPDATE public.certificate_issues SET status=CASE WHEN status='issued' THEN 'revoked' ELSE 'failed' END,
    revoked_at=CASE WHEN status='issued' THEN clock_timestamp() ELSE revoked_at END,
    revoked_reason=CASE WHEN status='issued' THEN 'Die zugrunde liegenden Teilnahme- oder Rechnungsdaten wurden geändert.' ELSE revoked_reason END,
    failure_reason=CASE WHEN status='generating' THEN 'source_changed' ELSE failure_reason END
    WHERE id=issue.id;
   RETURN jsonb_build_object('error','conflict','message','Die zugrunde liegenden Daten wurden geändert. Bitte eine neue Bescheinigung erstellen.');
  END IF;
  IF p_command='download' THEN RETURN to_jsonb(issue); END IF;
  digest:=p_payload->>'pdf_sha256';
  IF digest IS NULL OR digest !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid PDF digest' USING ERRCODE='22023'; END IF;
  IF issue.status='issued' THEN
   IF issue.pdf_sha256<>digest THEN RETURN jsonb_build_object('error','conflict','message','Die gespeicherte Datei stimmt nicht mit dieser Bescheinigung überein.'); END IF;
   RETURN to_jsonb(issue);
  END IF;
  IF issue.created_at<clock_timestamp()-interval '10 minutes' THEN
   UPDATE public.certificate_issues SET status='failed',failure_reason='generation_expired' WHERE id=issue.id;
   RETURN jsonb_build_object('error','conflict','message','Die Erstellung ist abgelaufen. Bitte erneut versuchen.');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='certificates' AND o.name=issue.storage_path
   AND o.metadata->>'mimetype'='application/pdf' AND (o.metadata->>'size')::numeric BETWEEN 1 AND 10485760
   AND o.user_metadata->>'issue_id'=issue.id::text AND o.user_metadata->>'sha256'=digest) THEN
   UPDATE public.certificate_issues SET status='failed',failure_reason='storage_upload_missing' WHERE id=issue.id;
   RETURN jsonb_build_object('error','conflict','message','Die PDF-Datei wurde nicht vollständig gespeichert. Bitte erneut versuchen.');
  END IF;
  UPDATE public.certificate_issues SET status='issued',pdf_sha256=digest,issued_at=clock_timestamp() WHERE id=issue.id RETURNING * INTO issue;
  RETURN to_jsonb(issue);
 END IF;
 RAISE EXCEPTION 'Unknown certificate command' USING ERRCODE='22023';
END $$;

REVOKE ALL ON FUNCTION certificates_private.issue_sources_current(uuid),public.certificate_issue_command(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION certificates_private.issue_sources_current(uuid),public.certificate_issue_command(uuid,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
