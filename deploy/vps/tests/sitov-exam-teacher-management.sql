-- Sitov Academy native exam-management smoke. Synthetic identities, claims,
-- answers and queued notifications are rolled back before workers see them.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
SELECT set_config('sitov.exam_management.student',gen_random_uuid()::text,true),
 set_config('sitov.exam_management.teacher',gen_random_uuid()::text,true),
 set_config('sitov.exam_management.second_teacher',gen_random_uuid()::text,true),
 set_config('sitov.exam_management.admin',gen_random_uuid()::text,true),
 set_config('sitov.exam_management.run',gen_random_uuid()::text,true),
 set_config('sitov.exam_management.attempt',gen_random_uuid()::text,true);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at,email_confirmed_at)
 SELECT current_setting('sitov.exam_management.'||k)::uuid,current_setting('sitov.exam_management.'||k)||'@sitov-exam-management.invalid',
 '{}'::jsonb,'{}'::jsonb,'authenticated','authenticated',now(),now(),now()
 FROM unnest(ARRAY['student','teacher','second_teacher','admin']) k;
INSERT INTO public.profiles(id,role,ui_language,notify_pronunciation_feedback,notify_new_content,notify_learning_reminders)
 SELECT current_setting('sitov.exam_management.'||k)::uuid,
 CASE WHEN k='admin' THEN 'admin' WHEN k='student' THEN 'student' ELSE 'teacher' END::public.profile_role,
 'de',false,false,false FROM unnest(ARRAY['student','teacher','second_teacher','admin']) k
 ON CONFLICT(id) DO UPDATE SET role=excluded.role,ui_language='de',notify_pronunciation_feedback=false,notify_new_content=false,notify_learning_reminders=false;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.exam_management.teacher'),true);
DO $$ BEGIN
 BEGIN
  PERFORM public.sitov_assign_simulation_student(current_setting('sitov.exam_management.student')::uuid,current_setting('sitov.exam_management.teacher')::uuid);
  RAISE EXCEPTION 'sitov_exam_management_browser_rpc_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.sitov_exam_teacher_assignments(student_id,teacher_id,assigned_by)
  VALUES(current_setting('sitov.exam_management.student')::uuid,current_setting('sitov.exam_management.teacher')::uuid,current_setting('sitov.exam_management.teacher')::uuid);
  RAISE EXCEPTION 'sitov_exam_management_browser_assignment_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.exam_management.student'),true);
DO $$ BEGIN
 BEGIN
  PERFORM public.sitov_assign_simulation_student(current_setting('sitov.exam_management.student')::uuid,current_setting('sitov.exam_management.student')::uuid);
  RAISE EXCEPTION 'sitov_exam_management_student_rpc_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM public.sitov_assign_simulation_student(current_setting('sitov.exam_management.student')::uuid,current_setting('sitov.exam_management.student')::uuid);
  RAISE EXCEPTION 'sitov_exam_management_untrusted_actor_allowed';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM<>'unauthorized_simulation_assignment' THEN RAISE; END IF;
 END;
 IF public.sitov_assign_simulation_student(current_setting('sitov.exam_management.student')::uuid,current_setting('sitov.exam_management.teacher')::uuid) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'sitov_exam_management_claim_failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sitov_exam_teacher_assignments WHERE student_id=current_setting('sitov.exam_management.student')::uuid
  AND teacher_id=current_setting('sitov.exam_management.teacher')::uuid AND assigned_by=teacher_id)
 OR NOT EXISTS(SELECT 1 FROM public.sitov_simulation_feature_grants WHERE student_id=current_setting('sitov.exam_management.student')::uuid
  AND granted_by=current_setting('sitov.exam_management.teacher')::uuid)
 THEN RAISE EXCEPTION 'sitov_exam_management_atomic_claim_incomplete'; END IF;
 PERFORM set_config('sitov.exam_management.assignment',(SELECT row_to_json(a)::text FROM public.sitov_exam_teacher_assignments a WHERE student_id=current_setting('sitov.exam_management.student')::uuid),true);
 PERFORM set_config('sitov.exam_management.grant',(SELECT row_to_json(g)::text FROM public.sitov_simulation_feature_grants g WHERE student_id=current_setting('sitov.exam_management.student')::uuid),true);
END $$;

INSERT INTO public.sitov_exam_attempts(id,student_id,task_id,task_version,unit_id,answer,mode,request_id)
 VALUES(current_setting('sitov.exam_management.attempt')::uuid,current_setting('sitov.exam_management.student')::uuid,'sitov-management-existing',1,'sitov-management-existing','"bestehende Antwort"','practice',current_setting('sitov.exam_management.attempt')::uuid);
SELECT set_config('sitov.exam_management.snapshot',jsonb_build_object(
 'id',current_setting('sitov.exam_management.run'),'version',1,'level','B1','provider','telc','mode','practice','status','completed',
 'startedAt','2026-10-04T08:00:00Z','expiresAt','2026-10-04T11:00:00Z','completedAt','2026-10-04T09:00:00Z',
 'tasks',jsonb_build_array(jsonb_build_object('id','sitov-management-existing','correctAnswer','server-only')),
 'answers',jsonb_build_object('sitov-management-existing','bestehende Prüfungsantwort'),'coverage',jsonb_build_object('fullExam',false))::text,true);
INSERT INTO public.sitov_simulation_runs(id,student_id,level,provider,mode,status,started_at,expires_at,completed_at,start_request_id,start_request_hash,server_snapshot)
 VALUES(current_setting('sitov.exam_management.run')::uuid,current_setting('sitov.exam_management.student')::uuid,'B1','telc','practice','completed',
 '2026-10-04T08:00:00Z','2026-10-04T11:00:00Z','2026-10-04T09:00:00Z',current_setting('sitov.exam_management.run')::uuid,'sitov-management-fixture',current_setting('sitov.exam_management.snapshot')::jsonb);

DO $$ BEGIN
 PERFORM public.sitov_assign_simulation_student(current_setting('sitov.exam_management.student')::uuid,current_setting('sitov.exam_management.teacher')::uuid);
 IF (SELECT to_jsonb(a) FROM public.sitov_exam_teacher_assignments a WHERE student_id=current_setting('sitov.exam_management.student')::uuid)<>current_setting('sitov.exam_management.assignment')::jsonb
 OR (SELECT to_jsonb(g) FROM public.sitov_simulation_feature_grants g WHERE student_id=current_setting('sitov.exam_management.student')::uuid)<>current_setting('sitov.exam_management.grant')::jsonb
 THEN RAISE EXCEPTION 'sitov_exam_management_replay_changed_assignment'; END IF;
 BEGIN
  PERFORM public.sitov_assign_simulation_student(current_setting('sitov.exam_management.student')::uuid,current_setting('sitov.exam_management.second_teacher')::uuid);
  RAISE EXCEPTION 'sitov_exam_management_other_teacher_claim_allowed';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM<>'simulation_student_already_assigned' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.sitov_exam_teacher_assignments SET teacher_id=current_setting('sitov.exam_management.second_teacher')::uuid,assigned_by=current_setting('sitov.exam_management.second_teacher')::uuid
  WHERE student_id=current_setting('sitov.exam_management.student')::uuid;
  RAISE EXCEPTION 'sitov_exam_management_teacher_reassignment_allowed';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM<>'invalid_exam_teacher_assignment' THEN RAISE; END IF;
 END;
 UPDATE public.sitov_exam_teacher_assignments SET teacher_id=current_setting('sitov.exam_management.second_teacher')::uuid,assigned_by=current_setting('sitov.exam_management.admin')::uuid
 WHERE student_id=current_setting('sitov.exam_management.student')::uuid;
 PERFORM public.sitov_assign_simulation_student(current_setting('sitov.exam_management.student')::uuid,current_setting('sitov.exam_management.second_teacher')::uuid);
 IF (SELECT server_snapshot FROM public.sitov_simulation_runs WHERE id=current_setting('sitov.exam_management.run')::uuid)<>current_setting('sitov.exam_management.snapshot')::jsonb
 OR (SELECT answer FROM public.sitov_exam_attempts WHERE id=current_setting('sitov.exam_management.attempt')::uuid)<>'"bestehende Antwort"'::jsonb
 OR (SELECT to_jsonb(g) FROM public.sitov_simulation_feature_grants g WHERE student_id=current_setting('sitov.exam_management.student')::uuid)<>current_setting('sitov.exam_management.grant')::jsonb
 THEN RAISE EXCEPTION 'sitov_exam_management_existing_evidence_changed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'sitov_exam_teacher_management_ok' AS result;
