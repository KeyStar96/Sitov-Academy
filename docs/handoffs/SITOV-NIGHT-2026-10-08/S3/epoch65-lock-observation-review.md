# Sitov Academy — S3 epoch65

Base `0ca33ef741af24d319739da186d4c645f62a6e17`; own branch `codex/sitov-night-s3-locks65`. Only the opt-in two-session harness changes. The native fixture remains byte-identical with 54 assertions. Canonical/VPS 114 remains SHA256 `45c03b30a075920e53d15e4e311e229262f63a19d7016f9c4b21d98efd0d379a`.

## Failure and correction

The first bounded diagnostic preserves the prior failure as full structured stdout/stderr: importer `Lock/advisory`, `blockedByA=true`, returned SQLSTATE `55P03`; B_row reported a lock timeout, but A emitted no ROW_WAIT marker. Python raw-string newline handling and stdout draining are correct in this base. A had already read pg_stat_activity during its long transaction; refreshing with `pg_stat_clear_snapshot()` makes the newly created B_row backend visible. A short bounded observation loop now handles the interval before B begins waiting without weakening either Lock or pg_blocking_pids assertions. Reader threads are joined before process-output inspection; role markers verify A/row `supabase_admin` and importer `service_role`. Partial observations and complete output/error streams are persisted before the final success assertion. A remote20s alarm and outer25s SSH timeout bound execution.

The second diagnostic exposed a separate proof error: B_row was blocked on `Lock/relation` because A still held 114 trigger-DDL locks. That observation is retained privately and is not a row-lock proof.

## Final executed proof

Only two connections are active at once; A is reused, while importer B closes before row B opens.

1. A applies 114 twice and the existing 54-assertion fixture in one uncommitted transaction. The currently installed service importer in B is observed waiting on `Lock/advisory`, with A in pg_blocking_pids, and returns `55P03`.
2. A emits native54/allPassed, then ROLLBACK; archiveAbsent=true and fixtureRows=0 are asserted. This releases the DDL relation locks before the row proof.
3. A starts a separate bounded transaction and selects one existing exercise FOR UPDATE without changing it. Row B is observed on `Lock/transactionid`, with A in pg_blocking_pids, and receives its expected lock timeout. A then rolls back; all child processes are closed.

These are actual catalog/row lock coordination proofs. They do not prove cross-session 114 checked-writer CAS or receipt replay: 114 remains uncommitted in A and cannot be used by B. `crossSession114CASOrReplayProven=false` remains explicit. There is no source-SQL change, persisted DDL, content application, production/sharedQA write, full185/188 stream, runtime start/deploy, audio or model work.

## Closure

The 5222-row clone metadata comparison preserves raw SHA256s in the companion JSON. Raw equality is false: only mail_outbox relminmxid/relfrozenxid/relallvisible and its pkey/due-index relpages differ. After excluding these recorded physical pg_class fields, all compared metadata including function bodies, owners/ACLs, schemas, policies and columns is exact. The comparison does not establish why the physical fields changed.

Pre/post guards: three HTTP200 each, memory2734→2722MiB (minimum1984), exact isolated container caps/images, no OOM, scoped sessions0 before/after. Final rollback confirms fixture0/archiveAbsent and openChildProcesses0. Python syntax/compile, opt-in denial before SSH, and diff checks passed. No additional matrix was added.

Private evidence: S3/epoch65-diagnostic/epoch64-two-session.stdout + stderr (original failure); S3/epoch65-relation-diagnostic/epoch65-two-session.stdout + stderr (relation-lock observation); S3/epoch65-two-session.stdout + stderr (final proof); epoch65-before/after-metadata-private.jsonl; epoch65-runtime-before/after.stdout. These are kept out of Git.
