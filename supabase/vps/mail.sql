-- Native VPS delivery. Apply before business.sql. No pg_net, Resend or external HTTP triggers.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.mail_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE CHECK (length(dedupe_key) BETWEEN 1 AND 240),
  kind text NOT NULL CHECK (kind IN ('registration_received','registration_confirmed','booking_cancelled','cancellation_requested','trial_confirmed','trial_cancelled','new_enrollment','feedback_available','raw')),
  recipient text NOT NULL CHECK (length(recipient) <= 254 AND recipient ~ '^[^[:space:]<>@,;]+@[^[:space:]<>@,;]+\.[^[:space:]<>@,;]+$'),
  locale text NOT NULL DEFAULT 'de' CHECK (locale IN ('de','en','ru','uk','tr')),
  payload jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(payload)='object' AND octet_length(payload::text) <= 262144),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  worker_id uuid,
  last_error text,
  message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CHECK ((status='processing') = (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
ALTER TABLE private.mail_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.mail_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON private.mail_outbox TO service_role;
CREATE INDEX IF NOT EXISTS mail_outbox_due_idx ON private.mail_outbox(available_at,created_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS mail_outbox_lease_idx ON private.mail_outbox(lease_until) WHERE status='processing';

CREATE OR REPLACE FUNCTION public.queue_transactional_email(p_dedupe_key text,p_kind text,p_recipient text,p_locale text,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO private.mail_outbox(dedupe_key,kind,recipient,locale,payload)
  VALUES(p_dedupe_key,p_kind,lower(trim(p_recipient)),CASE WHEN p_locale IN ('de','en','ru','uk','tr') THEN p_locale ELSE 'de' END,p_payload)
  ON CONFLICT(dedupe_key) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN SELECT id INTO v_id FROM private.mail_outbox WHERE dedupe_key=p_dedupe_key; END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.claim_mail_jobs(p_worker_id uuid,p_limit integer DEFAULT 5)
RETURNS SETOF private.mail_outbox LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  -- Exhausted crashed deliveries are quarantined instead of being retried forever.
  UPDATE private.mail_outbox SET status='failed',lease_until=NULL,lease_token=NULL,worker_id=NULL,last_error='lease_expired_at_attempt_limit'
    WHERE status='processing' AND lease_until<now() AND attempts>=8;
  RETURN QUERY WITH picked AS (
    SELECT id FROM private.mail_outbox
    WHERE attempts<8 AND ((status='pending' AND available_at<=now()) OR (status='processing' AND lease_until<now()))
    ORDER BY available_at,created_at LIMIT greatest(1,least(coalesce(p_limit,5),20)) FOR UPDATE SKIP LOCKED
  ) UPDATE private.mail_outbox j SET status='processing',attempts=j.attempts+1,
      worker_id=p_worker_id,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
    FROM picked WHERE j.id=picked.id RETURNING j.*;
END $$;

CREATE OR REPLACE FUNCTION public.complete_mail_job(p_id uuid,p_lease_token uuid,p_message_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer;
BEGIN
  UPDATE private.mail_outbox SET status='sent',sent_at=now(),message_id=left(p_message_id,300),
    lease_token=NULL,lease_until=NULL,worker_id=NULL,last_error=NULL
    WHERE id=p_id AND status='processing' AND lease_token=p_lease_token AND lease_until>now();
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;

CREATE OR REPLACE FUNCTION public.fail_mail_job(p_id uuid,p_lease_token uuid,p_error text,p_permanent boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer;
BEGIN
  UPDATE private.mail_outbox SET status=CASE WHEN p_permanent OR attempts>=8 THEN 'failed' ELSE 'pending' END,
    available_at=now()+make_interval(secs=>least(21600,(30*power(2,greatest(attempts-1,0)))::integer)),
    last_error=left(p_error,200),lease_token=NULL,lease_until=NULL,worker_id=NULL
    WHERE id=p_id AND status='processing' AND lease_token=p_lease_token AND lease_until>now();
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;

REVOKE ALL ON FUNCTION public.queue_transactional_email(text,text,text,text,jsonb),public.claim_mail_jobs(uuid,integer),public.complete_mail_job(uuid,uuid,text),public.fail_mail_job(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_transactional_email(text,text,text,text,jsonb),public.claim_mail_jobs(uuid,integer),public.complete_mail_job(uuid,uuid,text),public.fail_mail_job(uuid,uuid,text,boolean) TO service_role;
COMMENT ON TABLE private.mail_outbox IS 'Transactional native SMTP outbox. Stable dedupe key and Message-ID; at-least-once delivery after SMTP/DB crash. Failed jobs require operator inspection. Contains private mail payloads.';
