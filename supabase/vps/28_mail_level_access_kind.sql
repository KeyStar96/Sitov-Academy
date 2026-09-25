-- Commit this enum extension before migration 29 uses its new value.
ALTER TYPE public.mail_kind ADD VALUE IF NOT EXISTS 'level_access_granted';
-- Rollback: retain the unused enum label; removing it would rewrite existing mail
-- history. Restore migration 29 and the matching worker first. No data deletion.
