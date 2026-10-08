-- Sitov Academy fail-closed API rollback; retain all definitions/attempts/proofs/receipts/tickets.
-- Deploy together with matched application release; does not restore/bypass any learner gate.
-- Freeze first: trigger checks execute even inside existing SECURITY DEFINER wrappers.
UPDATE sitov_pronunciation_private.write_control SET enabled=false WHERE singleton;
REVOKE EXECUTE ON FUNCTION public.sitov_get_pronunciation_pretests(text),
 public.sitov_start_pronunciation_pretest(uuid,uuid),public.sitov_get_pronunciation_pretest_attempt(uuid),
 public.sitov_save_pronunciation_pretest_answers(uuid,integer,jsonb,uuid),
 public.sitov_submit_pronunciation_pretest(uuid,integer,jsonb,uuid),
 public.sitov_get_pronunciation_pretest_staff(uuid,uuid),
 public.sitov_create_pronunciation_upload_ticket(uuid,uuid,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION sitov_pronunciation_private.pretest_command(text,uuid,uuid,integer,jsonb,uuid,text),
 sitov_pronunciation_private.pretest_catalog(text),sitov_pronunciation_private.pretest_staff(uuid,uuid),
 sitov_pronunciation_private.current_pass(uuid) FROM authenticated;
-- Freeze new target/reply writes even for existing ticket holders; history is retained.
REVOKE EXECUTE ON FUNCTION public.sitov_create_pronunciation_reply_upload_ticket(uuid,uuid,text),
 sitov_pronunciation_private.reply_ticket(uuid,uuid,text) FROM authenticated;
DROP POLICY IF EXISTS sitov_pretest_released_read ON public.learning_reading_texts;
DROP POLICY IF EXISTS sitov_pretest_released_unit ON public.learning_units;
DROP POLICY IF EXISTS sitov_pronunciation_ready_upload ON storage.objects;
CREATE POLICY sitov_pronunciation_ready_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id NOT IN('pronunciation_audio','audio_submissions'));
