-- Phase 3 prerequisite. Commit separately before 34 uses the new enum values.
-- R8: migrate-local.py creates the verified backup before execution.
ALTER TYPE public.exercise_type ADD VALUE IF NOT EXISTS 'multi_blank';
ALTER TYPE public.exercise_type ADD VALUE IF NOT EXISTS 'matching';
ALTER TYPE public.exercise_type ADD VALUE IF NOT EXISTS 'categorize';
ALTER TYPE public.exercise_type ADD VALUE IF NOT EXISTS 'dialogue';
ALTER TYPE public.exercise_type ADD VALUE IF NOT EXISTS 'listening';
ALTER TYPE public.exercise_type ADD VALUE IF NOT EXISTS 'transform';
