-- Add allowed_lessons to student_trainer_access
ALTER TABLE public.student_trainer_access ADD COLUMN allowed_lessons text[];

-- Add lesson to pronunciation_prompts
ALTER TABLE public.pronunciation_prompts ADD COLUMN lesson text NOT NULL DEFAULT 'Lektion 1';
