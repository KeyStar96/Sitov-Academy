-- Run with ON_ERROR_STOP only in the disposable clone, then roll back fixtures.
BEGIN;
DO $$
DECLARE course uuid:=gen_random_uuid(); other_course uuid:=gen_random_uuid(); booking uuid;
 start_day date:=(date_trunc('month',now())+interval '1 month')::date;
 teacher uuid; payload jsonb; response jsonb; total integer;
BEGIN
 IF current_database()<>'sitov_phase2_verify' THEN RAISE EXCEPTION 'clone_required'; END IF;
 SELECT id INTO teacher FROM public.profiles WHERE role IN ('teacher','admin') LIMIT 1;
 IF teacher IS NULL THEN RAISE EXCEPTION 'clone_teacher_required'; END IF;
 INSERT INTO public.courses(id,slug,title,type,category,level,unit_price)
 VALUES(course,'phase6-'||course,'Phase 6 Test','presence','german','A1.1',5),
 (other_course,'phase6-'||other_course,'Other Test','presence','german','A1.1',5);
 INSERT INTO public.course_schedules(course_id,weekday,start_time,end_time)
 SELECT course,day,'09:00'::time,'10:00'::time FROM generate_series(1,7) day;
 INSERT INTO public.course_exceptions(course_id,date,reason) VALUES(course,start_day+1,'Phase6 known');
 response:=public.submit_business_registration(jsonb_build_object('name','Phase6 Fixture','email','phase6@example.test'),jsonb_build_array(jsonb_build_object('course_id',course)),start_day,'{"privacy":true,"agb":true}','uk',false);
 IF jsonb_typeof(response)<>'string' THEN RAISE EXCEPTION 'registration_failed %',response; END IF;
 booking:=(response#>>'{}')::uuid;
 SELECT m.payload INTO payload FROM private.mail_outbox m WHERE dedupe_key='registration:'||booking;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'exceptions') e WHERE e->>'date'=(start_day+1)::text AND e->>'courseId'=course::text) THEN RAISE EXCEPTION 'snapshot_missing'; END IF;
 PERFORM set_config('request.jwt.claim.sub',teacher::text,true);
 response:=public.confirm_business_booking(booking);
 IF response IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'confirm_failed %',response; END IF;
 response:=public.save_course_exception(course,start_day+2,'Phase6 later');
 IF NOT response ? 'id' OR response ? 'error' THEN RAISE EXCEPTION 'exception_failed %',response; END IF;
 IF (SELECT count(*) FROM private.mail_outbox WHERE dedupe_key='course-exception:'||booking||':'||course||':'||(start_day+2))<>1 THEN RAISE EXCEPTION 'notice_missing'; END IF;
 SELECT count(*) INTO total FROM private.mail_outbox;
 DELETE FROM public.course_exceptions WHERE course_id=course AND date=start_day+2;
 INSERT INTO public.course_exceptions(course_id,date,reason) VALUES(course,start_day+2,'Phase6 same');
 IF (SELECT count(*) FROM private.mail_outbox)<>total THEN RAISE EXCEPTION 'duplicate_notice'; END IF;
 INSERT INTO public.course_exceptions(course_id,date,reason) VALUES(other_course,start_day+3,'Unrelated');
 IF (SELECT count(*) FROM private.mail_outbox)<>total THEN RAISE EXCEPTION 'unrelated_notice'; END IF;
 UPDATE public.bookings SET status='cancelled' WHERE id=booking;
 INSERT INTO public.course_exceptions(course_id,date,reason) VALUES(course,start_day+3,'Cancelled booking');
 IF (SELECT count(*) FROM private.mail_outbox)<>total THEN RAISE EXCEPTION 'cancelled_booking_notice'; END IF;
 IF has_function_privilege('anon','business_private.booking_mail_exceptions(uuid)','EXECUTE') OR has_function_privilege('authenticated','business_private.booking_mail_exceptions(uuid)','EXECUTE') THEN RAISE EXCEPTION 'unsafe_acl'; END IF;
 RAISE NOTICE 'Phase 6 PostgreSQL: snapshots, confirmation, notices, dedupe, scope, cancellation and ACL passed';
END $$;
ROLLBACK;
