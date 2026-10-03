-- German inference runs only in the offline authoring workflow. No learner,
-- profile or progress identifiers are stored with these deduplicated texts.
CREATE TABLE public.sitov_audio_preparation_requests (
  cache_path text PRIMARY KEY,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 3000 AND text = btrim(text)),
  profile_fingerprint text NOT NULL CHECK (profile_fingerprint ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'prepared')),
  created_at timestamptz NOT NULL DEFAULT now(),
  prepared_at timestamptz,
  CONSTRAINT sitov_audio_preparation_path CHECK (cache_path ~ '^sitov-qwen-v[0-9]+/de/[0-9a-f]{64}\.mp3$'),
  CONSTRAINT sitov_audio_preparation_state CHECK (
    (status = 'pending' AND prepared_at IS NULL) OR
    (status = 'prepared' AND prepared_at IS NOT NULL)
  )
);

CREATE INDEX sitov_audio_preparation_pending
  ON public.sitov_audio_preparation_requests (created_at, cache_path)
  WHERE status = 'pending';

ALTER TABLE public.sitov_audio_preparation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sitov_audio_preparation_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sitov_audio_preparation_requests TO service_role;
COMMENT ON TABLE public.sitov_audio_preparation_requests IS
  'Sitov Academy internal offline German audio preparation queue; service role only.';
