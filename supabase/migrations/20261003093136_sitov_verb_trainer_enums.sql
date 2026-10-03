-- Commit this file before 63: PostgreSQL cannot use a new enum value in the adding transaction.
ALTER TYPE public.trainer_code ADD VALUE IF NOT EXISTS 'verbs';
ALTER TYPE public.learning_session_mode ADD VALUE IF NOT EXISTS 'verbs';
