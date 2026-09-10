-- Longer reading texts require a bounded two-megabyte synthesized reference cache.
UPDATE storage.buckets SET file_size_limit = 2097152 WHERE id = 'audio_cache';
-- Trigger execution does not require clients to call these functions directly.
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.handle_registration_confirmation() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.handle_new_user(), public.handle_registration_confirmation() FROM PUBLIC, anon, authenticated;
