-- Stop app/mail; take a fresh backup; run atomically on VPS with psql -1.
-- Retain the new worker until any queued new_signup jobs are drained.
-- Existing outbox history and enum label remain valid; do not delete sent mail.
DROP TRIGGER IF EXISTS on_auth_user_created_notify_staff ON auth.users;
DROP FUNCTION IF EXISTS business_private.notify_staff_of_signup();
DROP FUNCTION IF EXISTS business_private.staff_signup_payload(text,jsonb);
