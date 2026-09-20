-- Commit this enum extension before migration 14 uses its new value.
ALTER TYPE public.mail_kind ADD VALUE IF NOT EXISTS 'course_exception_added';
-- Rollback: retain the unused enum label; removing it would rewrite existing mail
-- history. Restore migration 14 and the matching worker first. No data deletion.
