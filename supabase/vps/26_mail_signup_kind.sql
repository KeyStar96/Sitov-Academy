-- Commit this enum extension before migration 27 uses its new value.
ALTER TYPE public.mail_kind ADD VALUE IF NOT EXISTS 'new_signup';
-- Rollback: retain the unused enum label; removing it would rewrite existing mail
-- history. Restore migration 27 and the matching worker first. No data deletion.
