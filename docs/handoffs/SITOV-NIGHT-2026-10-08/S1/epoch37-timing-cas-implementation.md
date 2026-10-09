# Sitov Academy — S1 epoch37: narrow timing CAS implementation

Exact base `0eec8b7c651816a3d8d24e40fd3f5858eb09344b`. New standalone `deploy/vps/sitov-audio-timings-cas.py` and CPU/mock tests; immutable importer and central files unchanged. Worker performed **no DB/QA/production/runtime/SSH/model/FFmpeg/audio execution or adoption**. M owns native SQL/race/Storage execution under the existing user authorization; this handoff adds no new human confirmation requirement.

## Inputs and preparation

Default action is `prepare`, which only creates a new private archive. Required inputs: `--allowlist`, exact `--allowlist-sha`, `--snapshot`, `--archive`. The supplied M allowlist SHA was independently confirmed as `eec931b9af449049c54da65bd036bd6283d680ad50ca31fab59adbc0458c4aa9` (1299 distinct prepared sources). M's newly pinned archived clock measurements supersede the launch-pin gaps described in epoch36; the tool requires their launchCheckpointValidated flag, configured revision, both archived WAV hashes and FFmpeg provenance. It does not discover extra candidates or load any model.

The caller must supply a **fresh full DB-row snapshot**, not the prepared allowlist as an execution payload:

```json
{
  "schemaVersion": 1,
  "inventoryComplete": true,
  "inventoryTables": [{"schema": "storage", "table": "objects"}],
  "objects": ["FULL to_jsonb(storage.objects) ROWS, including null version and every column"],
  "consumerSnapshot": [],
  "readinessBefore": [],
  "readinessAfter": [],
  "allowedInactiveReadinessChanges": []
}
```

The example is structural, not executable. inventoryTables must enumerate every non-pg/non-information_schema r/p table ordered by schema/table, including explicit absence of optional new schemas. consumerSnapshot must contain **all matching rows** in every inventoried table except storage.objects, ordered by schema/table and PostgreSQL `to_jsonb(row)::text`; entries are `{schema,table,rows}`. Discovery matches the selected object paths in complete JSON rows. More than500 matching rows per table is HOLD, not truncation. readiness arrays contain `{id,active,audio,publication}` ordered by ID. If pretest_definitions exists, the SQL adapter evaluates the existing public_audio_ready/publication_ready functions; absent tables yield an explicit empty readiness set. Function/query failure aborts; it never means no consumers. Other/unclassified proof consumers fail closed. A fresh snapshot collector is intentionally external; M must prepare it using this exact contract before native execution.

Each selected batch contains1–50 full objects with unique IDs/paths. Preparation verifies strict allowlist SHA, local MP3/source-metadata/candidate/NPZ hashes, candidate receipt digest and fixed profile/model revision, accepted fixed-threshold classifier support, exact token count and finite/nonoverlapping original-duration bounds. Lexical spans must be positive; punctuation-only tokens require zero spans. Clock candidates must refer to the exact same original MP3/text and archived input provenance. Remote expected metadata must retain the canonical profile/audio/text hashes. Existing wordTimings is required; no-op targets are rejected. Only wordTimings may differ.

Preparation copies the original MP3, full original source metadata, raw receipt/arrays and any archived clock WAVs into a new0700 archive, checks every copied SHA, fsyncs files, and writes a0600 operation.json with full old rows/metadata, planned metadata, source identities and archive-file hashes. It creates an append-only digest-chained PREPARED journal. Source files/manifests are never written. Existing archive directories are refused.

## SQL and recovery behavior

Execution requires explicit database/container/Storage targets; there are no production defaults. `--action apply` is the only mutating path. `--action recover` inspects and authenticates existing outcomes and does not submit writes. Storage adapter uses private local HTTP GETs with the service key retained in process; no upload endpoint or audio overwrite exists. DB calls use supabase_admin,45s client/20s statement/2s lock bounds; each adapter has a180s operation budget, Storage GETs at most5s.

The generated SERIALIZABLE transaction checks exact schema inventory, bounded consumer snapshots and expected pretest readiness, acquires matching consumer-row SHARE locks, then locks storage objects in sorted bucket/path/ID order. It compares the **entire old object row**, current-object predicate, metadata/version and exactly one updated row. jsonb_set changes only wordTimings; complete row comparison permits only user_metadata and the server-managed updated_at difference. Consumer rows are never updated. A second guard proves consumers unchanged and readiness equal to the explicitly allowed after-state before COMMIT. Active or unclassified proof references are HOLD; inactive readiness changes require an explicit ID whitelist. New proof/definition creation and activation are deliberately outside this tool.

Recovery verifies the archive/payload/journal hashes and uses read-only DB snapshots to classify all targets as exact old, exact new (allowing only server updated_at), or changed/mixed. Changed/partial state aborts. An unknown committed outcome is recognized as new and advances PREPARED → COMMITTED_READBACK_PENDING without replay. Exact old state under recover returns NOT_COMMITTED. Apply inspects first, verifies authenticated original bytes/metadata before mutation, and submits the CAS only from exact old state. The journal records complete committed rows. VERIFIED requires authenticated MP3 bytes/length and exact new metadata, followed by another complete DB-state check. Failed readback remains pending. Subsequent drift aborts. The archive lock prevents concurrent local operators.

## Verification and concrete native plan

`python3 -m unittest discover -s deploy/vps/tests -p test_sitov_audio_timings_cas.py -v`: **8 PASS**, covering finite/token/punctuation/bounds/overlap validation; whole-row/version/owner/size and mixed-state classification; active/unclassified proof/readiness holds; journal chain/truncation/transition behavior; bounded/sorted SQL guard generation; unknown-commit recovery without replay; failed authenticated readback never VERIFIED; and rejecting an unverified allowlist before archive creation. Compile, CLI help and Git whitespace checks PASS.

These are CPU/file/mock checks. **Actual generated SQL has not been parsed or executed by PostgreSQL in this worker unit.** Positive end-to-end prepare/archive coverage and broader identity/source-file/race failure cases still need expansion. Do not treat the mock transaction text checks as native transaction proof.

M's next bounded native fixture should: (1) create synthetic objects and fresh exact inventory/consumer/readiness snapshots; (2) exercise real preparation and inspect-only recovery; (3) execute a rollback rehearsal of generated SQL with actual PG15 schema/functions; (4) test concurrent same-object metadata/version/owner changes, serialization errors, new/changed consumers and schema drift; (5) prove rejected/mixed batches change zero rows; (6) simulate disconnect immediately after COMMIT and recover from exact new rows without another UPDATE; (7) fail authenticated byte/metadata readback, then resume pending; (8) verify full source/archive hashes, immutable definitions/proofs/recordings, explicit inactive readiness deltas and unaffected active readiness. A real Storage-backed test is separately required. The current generic consumer scan may hit its20s bound on populated tables; tune only after actual measured native evidence, preserving complete discovery. Consumer-insertion races require native validation of the SERIALIZABLE protocol and cooperating authoring transactions; no guarantee is claimed from mocks.

No current QA/prod counts are hardcoded. In particular this implementation does not inherit the old3-CAS script's2-user/1089-asset assumptions. Old proofs remain immutable; an active proof affected by timing changes requires the separate coordinated new-version proof/activation path. No worker execution occurred. Private summary: `S1/epoch37-validation-private.json`. Clean implementation commit and WAIT recorded in S1.json.
