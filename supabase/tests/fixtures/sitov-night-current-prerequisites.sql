-- QA-only synthetic Supabase SQL boundaries. No Auth/Storage HTTP services.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres SUPERUSER; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator NOINHERIT; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN CREATE ROLE supabase_admin SUPERUSER; END IF;
END $$;
GRANT anon,authenticated,service_role TO authenticator;
SET ROLE postgres;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),auth.jwt()->>'sub')::uuid
$$;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,
 raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE auth.mfa_factors(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES auth.users(id),status text,factor_type text);
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,owner uuid,
 public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[],
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bucket_id text REFERENCES storage.buckets(id),name text NOT NULL,owner uuid,
 owner_id text,metadata jsonb,user_metadata jsonb,version text,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
 last_accessed_at timestamptz DEFAULT now(),UNIQUE(bucket_id,name));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth,storage TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;
INSERT INTO storage.buckets(id,name,public) VALUES
 ('pronunciation_audio','pronunciation_audio',false),
 ('audio_submissions','audio_submissions',false),('audio_cache','audio_cache',false),
 ('lms-media','lms-media',false);
RESET ROLE;
-- Only an empty public schema is removed by the installer after verification.
