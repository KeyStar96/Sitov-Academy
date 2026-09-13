-- Retire the former external mail HTTP schedules, including their embedded keys.
SELECT cron.unschedule(jobid) FROM cron.job WHERE command ~* 'supabase[.]co';

-- Local infrastructure helpers, independent of the public learning catalog.
CREATE SCHEMA IF NOT EXISTS platform_private;
REVOKE ALL ON SCHEMA platform_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA platform_private TO service_role;

CREATE TABLE platform_private.rate_limits (
  key_hash text PRIMARY KEY CHECK(length(key_hash)=64),
  count integer NOT NULL CHECK(count>0),
  expires_at timestamptz NOT NULL
);
ALTER TABLE platform_private.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_private.rate_limits FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON platform_private.rate_limits TO service_role;
CREATE INDEX rate_limits_expiration_idx ON platform_private.rate_limits(expires_at);

CREATE FUNCTION public.consume_rate_limit(p_key text,p_limit integer,p_window_seconds integer)
RETURNS TABLE(success boolean,remaining integer,reset_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_count integer; v_reset timestamptz; v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_key IS NULL OR p_key !~ '^[a-f0-9]{64}$'
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10000
    OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;
  INSERT INTO platform_private.rate_limits AS r(key_hash,count,expires_at)
  VALUES(p_key,1,v_now+make_interval(secs=>p_window_seconds))
  ON CONFLICT(key_hash) DO UPDATE SET
    count=CASE WHEN r.expires_at<=v_now THEN 1 ELSE LEAST(r.count+1,p_limit+1) END,
    expires_at=CASE WHEN r.expires_at<=v_now THEN excluded.expires_at ELSE r.expires_at END
  RETURNING r.count,r.expires_at INTO v_count,v_reset;
  RETURN QUERY SELECT v_count<=p_limit,GREATEST(0,p_limit-v_count),v_reset;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text,integer,integer) TO service_role;

-- This job executes only local SQL. No HTTP callback or cloud key is involved.
SELECT cron.schedule('sitov-rate-limit-cleanup','17 * * * *',
  'DELETE FROM platform_private.rate_limits WHERE expires_at < now() - interval ''1 hour''');

-- The normalized business RPCs replaced these old-table wrappers. Keep the
-- current_profile_role and validate_teacher_note helpers used by learning RLS.
-- RESTRICT is intentional: an unexpected live dependency must stop deployment.
DROP FUNCTION IF EXISTS public.confirm_staff_registration(text,uuid);
DROP FUNCTION IF EXISTS public.set_manual_invoice_status(text,uuid,date,boolean,text);
DROP FUNCTION IF EXISTS monthly_booking_private.confirm_staff_registration(text,uuid);
DROP FUNCTION IF EXISTS monthly_booking_private.set_manual_invoice_status(text,uuid,date,boolean,text);
DROP FUNCTION IF EXISTS monthly_booking_private.claim_verified_legacy_profile();
DROP FUNCTION IF EXISTS monthly_booking_private.validate_booking();
DROP FUNCTION IF EXISTS monthly_booking_private.sync_booking_courses();
DROP FUNCTION IF EXISTS monthly_booking_private.sync_confirmed_profile_email();
DROP TABLE IF EXISTS monthly_booking_private.booking_courses;
DROP TABLE IF EXISTS monthly_booking_private.profile_contact_migration_audit;
