-- Sitov Academy: never roll back only app or identity SQL after publication.
-- Stop the app; restore matching DB backup + application together, or fix forward.
-- Preserve old and variant MP3s and archives. This script deliberately changes nothing.
DO $sitov$ BEGIN
 RAISE EXCEPTION 'sitov_audio_variant_joint_restore_required';
END $sitov$;
