# S1 epoch 18 — isolated production restore rehearsal, incomplete

Sitov Academy: **NOT_RELEASE_READY**. No deployment, production write or
migration 93–109 execution occurred. Base:
`751938cb537cce3ec1cf439ec070f81c2a16da68`.

The exact existing QA runtime guard passed with **2,364 MiB** available host
memory, matching scoped container images/resources/internal network, no OOM,
and three successful health responses. The actual 27,881,795-byte production
archive matched SHA-256
`cffcbc9cc9918ceb9e71e5669ead7b8b93922639fb92990ffa299d6513e9b73e`.

S1 created only the assigned database
`sitov_night_migration_rehearsal_20261009` from template0 inside the existing
owned QA database container. Restore targeted that database explicitly, with
original owners and privileges retained. The existing `postgres` database was
not a restore target. No server/global-role/timeout/JIT/cap/network setting was
changed.

The initial TOC exclusion parser missed the declaration spelling
`EXTENSION - pg_cron`. Restore stopped at the operational extension; raw errors
remain private. The partial database is retained. The corrected exclusion list
contains **22 entries**, restricted to pg_cron/pg_net extensions, schemas and
their operational objects. No public/auth/storage/private application entry
was excluded. Its SHA-256 is
`6bb129cb2da3287ef4af474befd3eade1e7562f24b12807479de8c06e750b8d1`.
The original list, corrected list and exact exclusion entries are saved privately.
No retry, object cleanup or database drop was performed.

All **188 non-system QA tables** retain exactly the same names, row counts and
complete row-data hashes before and after. An initial whole-list digest differed
because array order changed; comparison of the complete table maps was equal.
Canonical sorting by table name gives identical before/after SHA-256:
`f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`.
Snapshots exclude pg_catalog/information_schema/pg_toast; legitimate shared
catalog changes from creating the owned database are not application mutations.
The three runtime health checks still passed after the failed restore.

Private local resume ledger:
`.git/sitov-orchestration/SITOV-NIGHT-2026-10-08/S1/epoch18-resume-ledger.json`.
Private remote directory:
`/tmp/sitov-night-20261008-qa-master/S1-epoch18-rehearsal/`.
Owned private directories use 0700 and files 0600. No raw rows, credentials,
archive contents or restore errors were committed or printed publicly.

**Still required:** review the exact private failure and corrected TOC; complete
the owned restore in a fresh lease while preserving the partial state until a
safe resume is approved; verify all production application/auth/storage rows;
capture the complete baseline and effective rights for all 75 production
accounts, ten levels, trainers and actual units. None of those baseline or
production before/after rights checks is claimed complete. No migration
rehearsal, actual QA acceptance or release gate is waived.

No owned restore job remains running. S1 returns WAIT with the partial database,
private evidence and resume ledger preserved for M.
