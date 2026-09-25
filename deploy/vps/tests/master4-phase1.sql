-- Read-only catalog and grading acceptance against the real PostgreSQL clone/live DB.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
DO $verify$
DECLARE result jsonb; item record;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('ich heiße anna','Ich heiße Anna.','EXACT',NULL::text,'capitalization_punctuation'),
  ('Ich heisse Anna','Ich heiße Anna.','SOFT_ERROR','umlaut',NULL),
  ('ich heise anna','Ich heiße Anna.','SOFT_ERROR','typo',NULL),
  ('der','den','INCORRECT',NULL,NULL),
  ('ihm','ihn','INCORRECT',NULL,NULL),
  ('am','an','INCORRECT',NULL,NULL),
  ('Wie geht’s?','Wie geht''s?','EXACT',NULL,NULL),
  ('2,50 €','250 €','INCORRECT',NULL,NULL),
  ('2001','2000','INCORRECT',NULL,NULL),
  ('A123','A124','INCORRECT',NULL,NULL)
 ) checks(input,answer,status,reason,hint) LOOP
  result:=learning_private.grade_answer(item.input,ARRAY[item.answer]);
  IF result->>'status' IS DISTINCT FROM item.status
   OR result->>'reason' IS DISTINCT FROM item.reason
   OR result->>'hint' IS DISTINCT FROM item.hint THEN RAISE EXCEPTION 'phase1_grade_contract_failed'; END IF;
 END LOOP;
 IF vocabulary_private.answer_article_feedback('Eltern','Eltern','die',NULL) IS DISTINCT FROM 'article_missing'
  OR vocabulary_private.answer_article_feedback('der Eltern','Eltern','die',NULL) IS DISTINCT FROM 'article_wrong'
  OR vocabulary_private.answer_article_feedback('die Eltern','Eltern','die',NULL) IS NOT NULL
 THEN RAISE EXCEPTION 'phase1_article_contract_failed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND table_name='learning_vocabulary_cards' AND column_name='target_form' AND udt_name='_text')
 THEN RAISE EXCEPTION 'phase1_target_form_missing'; END IF;
 IF (SELECT count(*) FROM learning_private.vocabulary_variant_backups WHERE is_active)<>15
 THEN RAISE EXCEPTION 'phase1_variant_decisions_incomplete'; END IF;
 IF has_function_privilege('anon','learning_private.grade_answer(text,text[])','EXECUTE')
  OR has_table_privilege('authenticated','learning_private.vocabulary_variant_backups','SELECT')
 THEN RAISE EXCEPTION 'phase1_private_grants_exposed'; END IF;
END $verify$;
SELECT 'phase1_catalog_and_grading_ok' AS result;
ROLLBACK;
