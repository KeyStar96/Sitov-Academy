-- Staff rejection of pending requests restores the two former cancellation mail flows.
-- Status and outbox commit together. Confirmed bookings and invoices are left intact.
BEGIN;
CREATE FUNCTION business_private.decline_booking(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; v_locale text;
BEGIN
 IF NOT business_private.is_staff() THEN RAISE insufficient_privilege; END IF;
 SELECT * INTO b FROM public.bookings WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE no_data_found; END IF;
 -- Retrying an acknowledged rejection or encountering a student's pause is a no-op.
 IF b.status='cancelled' THEN RETURN; END IF;
 IF b.status<>'pending' OR EXISTS(
   SELECT 1 FROM public.invoice_cases i WHERE i.booking_id=b.id AND i.status='created'
 ) THEN RAISE EXCEPTION 'Only pending requests without an issued invoice may be declined' USING ERRCODE='PT409'; END IF;
 SELECT preferred_locale INTO v_locale FROM public.people WHERE id=b.person_id;
 UPDATE public.bookings SET status='cancelled',revision=revision+1,updated_at=now() WHERE id=b.id;
 -- A later, deliberately resubmitted request is a new revision and can receive a new reply.
 PERFORM public.queue_transactional_email('declined:'||b.id||':'||(b.revision+1),
   CASE WHEN b.kind='trial' THEN 'trial_cancelled' ELSE 'booking_cancelled' END,
   b.contact_email,v_locale,jsonb_build_object('name',b.contact_name,'startDate',b.start_date,
     'courses',(SELECT jsonb_agg(jsonb_build_object('title',title_snapshot)) FROM public.booking_items WHERE booking_id=b.id)));
END $$;
REVOKE ALL ON FUNCTION business_private.decline_booking(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION business_private.decline_booking(uuid) TO authenticated;
CREATE FUNCTION public.decline_business_booking(p_id uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT business_private.decline_booking(p_id); $$;
REVOKE ALL ON FUNCTION public.decline_business_booking(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decline_business_booking(uuid) TO authenticated;
COMMIT;
