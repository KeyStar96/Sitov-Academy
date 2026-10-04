-- Sitov Academy: teachers can take responsibility for an unassigned learner.
-- Existing assignments remain exclusive; administrators retain reassignment.
CREATE OR REPLACE FUNCTION sitov_exam_private.validate_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 -- UPDATE may already hold the assignment row lock. Keep advisory locking
 -- in the claim RPC before it touches that row, avoiding the reverse order.
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.student_id AND role='student')
 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.teacher_id AND role IN('teacher','admin'))
 OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=NEW.assigned_by AND (
  p.role='admin' OR (p.role='teacher' AND p.id=NEW.teacher_id
   AND (TG_OP='INSERT' OR (OLD.teacher_id=NEW.teacher_id AND OLD.student_id=NEW.student_id)))))
 THEN RAISE EXCEPTION 'invalid_exam_teacher_assignment' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_exam_private.validate_assignment() FROM PUBLIC,anon,authenticated,service_role;

-- Only trusted server code supplies the authenticated staff ID. The invoker
-- must hold service_role's existing table privileges; this function adds none.
CREATE OR REPLACE FUNCTION public.sitov_assign_simulation_student(p_student_id uuid,p_staff_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE assigned_teacher uuid; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_staff_id AND role IN('teacher','admin'))
 THEN RAISE EXCEPTION 'unauthorized_simulation_assignment' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||p_student_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student')
 THEN RAISE EXCEPTION 'invalid_simulation_student' USING ERRCODE='42501'; END IF;

 INSERT INTO public.sitov_exam_teacher_assignments(student_id,teacher_id,assigned_by,response_days)
 VALUES(p_student_id,p_staff_id,p_staff_id,7) ON CONFLICT(student_id) DO NOTHING;
 SELECT teacher_id INTO assigned_teacher FROM public.sitov_exam_teacher_assignments
 WHERE student_id=p_student_id FOR UPDATE;
 IF assigned_teacher IS DISTINCT FROM p_staff_id
 THEN RAISE EXCEPTION 'simulation_student_already_assigned' USING ERRCODE='42501'; END IF;

 INSERT INTO public.sitov_simulation_feature_grants(student_id,granted_by)
 VALUES(p_student_id,p_staff_id) ON CONFLICT(student_id) DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.sitov_assign_simulation_student(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sitov_assign_simulation_student(uuid,uuid) TO service_role;
