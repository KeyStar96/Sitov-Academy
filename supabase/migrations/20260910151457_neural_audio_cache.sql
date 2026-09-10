-- Public curriculum audio, immutable content-addressed MP3s.
-- Existing buckets, files and vocabulary rows are untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('audio_cache', 'audio_cache', true, 1048576, ARRAY['audio/mpeg']::text[])
ON CONFLICT (id) DO NOTHING;

-- A pre-existing bucket with incompatible settings must be reviewed rather than silently exposed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'audio_cache' AND public = true
      AND file_size_limit = 1048576 AND allowed_mime_types = ARRAY['audio/mpeg']::text[]
  ) THEN
    RAISE EXCEPTION 'audio_cache already exists with incompatible settings';
  END IF;
END;
$$;

-- No INSERT/UPDATE/DELETE policy for anon/authenticated: only the server service-role uploads.
-- A public bucket permits file retrieval, but not object listing or mutations without a policy.
COMMIT;
