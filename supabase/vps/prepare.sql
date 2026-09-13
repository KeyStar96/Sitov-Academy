-- Run only on the VPS after a verified backup and with application writes stopped.
-- The owner approved a fresh student start. Preserve staff accounts and all content.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';

SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE command ~* 'supabase[.]co';
ALTER TABLE public.registrations DISABLE TRIGGER "notify-registration-insert";
ALTER TABLE public.trial_lessons DISABLE TRIGGER "notify-trial-insert";

TRUNCATE public.pronunciation_messages,public.teacher_feedback,public.submissions,
 public.user_exercise_progress,public.user_vocabulary_progress,public.vocabulary_direction_progress,
 public.vocabulary_learning_state,public.vocabulary_onboarding,vocabulary_private.answer_receipts,
 learning_reset_private.audio_objects,learning_reset_private.jobs,
 public.student_trainer_access,public.teacher_student_notes,
 public.manual_invoice_status,monthly_booking_private.booking_courses,
 public.monthly_course_bookings,public.enrollments,public.registrations,
 public.trial_lessons,public.cancellations,monthly_booking_private.profile_contact_migration_audit;

DELETE FROM auth.users a WHERE NOT EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=a.id AND p.role IN('teacher','admin')
);
DELETE FROM public.profiles p WHERE NOT EXISTS(SELECT 1 FROM auth.users a WHERE a.id=p.id);
DELETE FROM public.users;

-- Dead reference audio is regenerated locally on demand. Authored text is untouched.
UPDATE public.vocabulary_cards SET audio_url=NULL WHERE audio_url IS NOT NULL;
UPDATE public.exercises SET solution_audio_url=NULL WHERE solution_audio_url IS NOT NULL;
UPDATE public.pronunciation_prompts SET audio_url=NULL WHERE audio_url IS NOT NULL;

-- Metadata-only repair: preflight proved the configured MinIO bucket is empty.
-- Never use this step against a bucket containing actual object files.
SET LOCAL storage.allow_delete_query='true';
DELETE FROM storage.objects;
UPDATE storage.buckets SET public=false WHERE id='audio_submissions';
COMMIT;
