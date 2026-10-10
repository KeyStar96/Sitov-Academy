-- Sitov Academy: run the complete publication proof on every read again (migration 94).
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.current_pretest(p_text uuid) RETURNS sitov_pronunciation_private.pretest_definitions LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT d FROM sitov_pronunciation_private.pretest_definitions d JOIN public.learning_reading_texts r ON r.id=d.text_id WHERE d.text_id=p_text AND d.active AND d.text_version=sitov_pronunciation_private.pretest_hash(r.sentence_de) AND sitov_pronunciation_private.publication_ready(d.id,d.text_id,d.text_version,d.test_version,d.definition) $$;
DROP TRIGGER IF EXISTS sitov_publication_unmark ON public.learning_reading_texts;
DROP TRIGGER IF EXISTS sitov_publication_unmark ON storage.objects;
DROP TRIGGER IF EXISTS sitov_publication_mark ON sitov_pronunciation_private.pretest_definitions;
DROP FUNCTION IF EXISTS sitov_pronunciation_private.sitov_mark_publications();
DROP FUNCTION IF EXISTS sitov_pronunciation_private.sitov_unmark_publication_text();
DROP FUNCTION IF EXISTS sitov_pronunciation_private.sitov_unmark_publication_audio();
DROP FUNCTION IF EXISTS sitov_pronunciation_private.sitov_mark_publication();
DROP INDEX IF EXISTS sitov_pronunciation_private.sitov_pretest_approvals_reference;
DROP INDEX IF EXISTS sitov_pronunciation_private.sitov_pretest_question_audio_proofs_path;
DROP TABLE IF EXISTS sitov_pronunciation_private.sitov_publication_marks;
NOTIFY pgrst,'reload schema';
