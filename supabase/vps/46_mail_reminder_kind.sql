-- Commit this enum extension before migration 47 uses its new value.
ALTER TYPE public.mail_kind ADD VALUE IF NOT EXISTS 'learning_reminder';
-- Rollback: retain the unused enum label; removing it would rewrite existing mail
-- history. Roll back 47 and deploy the matching worker first. No data deletion.
