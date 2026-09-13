BEGIN;
ALTER TABLE public.student_trainer_access ADD COLUMN IF NOT EXISTS allowed_lessons text[];
ALTER TABLE public.pronunciation_prompts ADD COLUMN IF NOT EXISTS lesson text NOT NULL DEFAULT 'Lektion 1';
COMMIT;
