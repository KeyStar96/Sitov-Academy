-- Sitov Academy fail-closed API rollback; retain all definitions/attempts/proofs/receipts/tickets.
-- Deploy together with matched application release; does not restore/bypass any learner gate.
REVOKE EXECUTE ON FUNCTION public.sitov_get_pronunciation_pretests(text),
 public.sitov_start_pronunciation_pretest(uuid,uuid),public.sitov_get_pronunciation_pretest_attempt(uuid),
 public.sitov_save_pronunciation_pretest_answers(uuid,integer,jsonb,uuid),
 public.sitov_submit_pronunciation_pretest(uuid,integer,jsonb,uuid),
 public.sitov_get_pronunciation_pretest_staff(uuid,uuid),
 public.sitov_create_pronunciation_upload_ticket(uuid,uuid,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION sitov_pronunciation_private.pretest_command(text,uuid,uuid,integer,jsonb,uuid,text),
 sitov_pronunciation_private.pretest_catalog(text),sitov_pronunciation_private.pretest_staff(uuid,uuid),
 sitov_pronunciation_private.current_pass(uuid) FROM authenticated;
