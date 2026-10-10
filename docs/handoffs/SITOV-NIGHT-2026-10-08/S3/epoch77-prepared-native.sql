-- Sitov Academy S3 epoch77. PREPARATION ONLY. Never executed by this worker.
-- M binds $1 as a JSON object with definitions array of 3..6 complete payload rows.
-- Database hashes below are PostgreSQL JSONB hashes, NEVER definitionContentHashJS.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
SET LOCAL application_name='sitov_S3_epoch77_preparation';
PREPARE sitov_epoch77_preflight(jsonb) AS
WITH x AS (SELECT value v FROM jsonb_array_elements($1->'definitions'))
SELECT x.v->>'textId' AS text_id,
 r.sentence_de IS NOT DISTINCT FROM x.v#>>'{source,text}' AS exact_current_source,
 sitov_pronunciation_private.pretest_hash(to_jsonb(r)::text) AS actual_source_row_jsonb_sha256,
 sitov_pronunciation_private.pretest_hash((x.v#>'{draft,definition}')::text) AS actual_db_test_version,
 x.v->>'definitionContentHashJS' AS separate_js_definition_content_hash,
 sitov_pronunciation_private.valid_authoring(r.sentence_de,x.v#>'{draft,definition}') AS native_authoring_valid,
 (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id) FROM sitov_pronunciation_private.pretest_definitions d WHERE d.text_id=r.id) AS full_existing_definitions,
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM sitov_pronunciation_private.pretest_approvals a JOIN sitov_pronunciation_private.pretest_definitions d ON d.id=a.definition_id WHERE d.text_id=r.id) AS full_existing_approvals,
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.definition_id,p.text_sha256) FROM sitov_pronunciation_private.pretest_question_audio_proofs p JOIN sitov_pronunciation_private.pretest_definitions d ON d.id=p.definition_id WHERE d.text_id=r.id) AS full_existing_question_proofs,
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM sitov_pronunciation_private.pretest_attempts a WHERE a.text_id=r.id) AS full_existing_attempts,
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM sitov_pronunciation_private.pretest_passes p JOIN sitov_pronunciation_private.pretest_definitions d ON d.id=p.definition_id WHERE d.text_id=r.id) AS full_existing_passes,
 (SELECT id FROM sitov_pronunciation_private.pretest_definitions d WHERE d.text_id=r.id AND d.active) AS actual_base_active_definition_id,
 (SELECT id FROM sitov_pronunciation_private.pretest_definitions d WHERE d.text_id=r.id AND d.text_version=x.v->>'textVersion' AND d.definition=x.v#>'{draft,definition}' AND d.test_version=sitov_pronunciation_private.pretest_hash((x.v#>'{draft,definition}')::text)) AS reusable_exact_definition_id
FROM x LEFT JOIN public.learning_reading_texts r ON r.id=(x.v->>'textId')::uuid
WHERE jsonb_array_length($1->'definitions') BETWEEN 3 AND 6;
-- Run only after M has independently captured and checked complete immutable history.
-- A missing baseline source hash makes every row ineligible. Any source mismatch HOLDs
-- the entire batch. NO source UPDATE and NO definition/approval/proof UPDATE/DELETE.
PREPARE sitov_epoch77_insert_inactive(jsonb) AS
WITH x AS MATERIALIZED (SELECT value v FROM jsonb_array_elements($1->'definitions')),
 locked AS MATERIALIZED (
 SELECT r.*,x.v FROM x JOIN public.learning_reading_texts r ON r.id=(x.v->>'textId')::uuid FOR UPDATE OF r
), checks AS MATERIALIZED (
 SELECT *,sentence_de IS NOT DISTINCT FROM v#>>'{source,text}'
 AND text_version_is_exact AS ok FROM (
 SELECT locked.*,
 sitov_pronunciation_private.pretest_hash(sentence_de)=v->>'textVersion'
 AND sitov_pronunciation_private.pretest_hash((to_jsonb(locked)-'v')::text)=v->>'expectedSourceRowJsonbSHA256'
 AND coalesce(v->>'expectedFullHistorySnapshot','')<>''
 AND v->>'nativeHistoryRecheckResult'='exact'
 AND v->>'nativeAudioGETVerified'='true'
 AND v->>'primaryReferenceCachePath' IS NOT NULL
 AND sitov_pronunciation_private.valid_authoring(sentence_de,v#>'{draft,definition}') AS text_version_is_exact
 FROM locked) s
), inserted AS (
 INSERT INTO sitov_pronunciation_private.pretest_definitions(text_id,text_version,test_version,definition,active)
 SELECT (v->>'textId')::uuid,v->>'textVersion',sitov_pronunciation_private.pretest_hash((v#>'{draft,definition}')::text),v#>'{draft,definition}',false
 FROM checks WHERE (SELECT count(*) FROM x) BETWEEN 3 AND 6
 AND (SELECT count(*) FROM checks)=(SELECT count(*) FROM x) AND NOT EXISTS(SELECT 1 FROM checks WHERE NOT coalesce(ok,false))
 AND NOT EXISTS(SELECT 1 FROM sitov_pronunciation_private.pretest_definitions d WHERE d.text_id=(v->>'textId')::uuid AND d.text_version=v->>'textVersion' AND d.test_version=sitov_pronunciation_private.pretest_hash((v#>'{draft,definition}')::text))
 ON CONFLICT(text_id,text_version,test_version) DO NOTHING RETURNING id,text_id,text_version,test_version,active
) SELECT * FROM inserted;
-- Actual proof insertion remains a separately reviewed M transaction:
-- deduplicate (definition_id, DB test_version, normalized text SHA), require exact
-- imported storage.objects row/user_metadata/audio SHA and DB hash(wordTimings::text).
-- Before reusing any existing proof/approval compare every column; conflicts HOLD.
-- Grouped clocks must pass vocabulary_private.sitov_spoken_alignment_valid(text,metadata)
-- installed by117. Keep spoken intervals/groups unchanged; never reshape to display count.
-- Approval is separate from definition: original author/reviewer/document/time exact;
-- M must explicitly adopt independent agent review into DB independent_approved status,
-- with humanReview=false and calibration=pending retained in external evidence.
-- Existing genuine reference recordings/history are immutable; no approval guessed.
PREPARE sitov_epoch77_publication_ready(uuid,uuid,text,text,uuid) AS
 SELECT public.sitov_get_pronunciation_pretest_publication($1,$2,$3,$4,$5);
PREPARE sitov_epoch77_publish(uuid,uuid,text,text,uuid,uuid) AS
 SELECT public.sitov_publish_pronunciation_pretest($1,$2,$3,$4,$5,$6);
-- Only M may call publication through the REAL authenticated staff authority102/105,
-- with the exact DB-computed test_version, fresh base-active CAS and stable request UUID.
-- No role/session/auth spoof, write-control enablement or direct active update.
-- This file intentionally rolls back and does not EXECUTE any prepared statement.
ROLLBACK;
