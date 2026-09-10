-- Keep one permissive policy per command, avoiding duplicate SELECT evaluation.
DROP POLICY trainer_overrides_staff ON public.student_trainer_access;
CREATE POLICY trainer_overrides_insert ON public.student_trainer_access FOR INSERT TO authenticated
 WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'));
CREATE POLICY trainer_overrides_update ON public.student_trainer_access FOR UPDATE TO authenticated
 USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'))
 WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'));
CREATE POLICY trainer_overrides_delete ON public.student_trainer_access FOR DELETE TO authenticated
 USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'));
