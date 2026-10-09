# S1 epoch 19 — owned restore retry saved at owner-role boundary

Sitov Academy: **NOT_RELEASE_READY**. Base:
`eda2b502cb7782ec9f1fe1c291f960fdc4e96ae4`.
Only the explicitly assigned database
`sitov_night_migration_rehearsal_20261009` was modified. Production and the
existing QA `postgres` database were not restore targets.

The fresh guard confirmed PostgreSQL **15.19**, **2,408 MiB** available host
memory, exact existing scoped images/caps/internal network, no OOM and three
successful health responses. The actual production archive checksum remained
`cffcbc9cc9918ceb9e71e5669ead7b8b93922639fb92990ffa299d6513e9b73e`.
The corrected **22 operational-only** pg_cron/pg_net exclusions were independently
recomputed against that archive and matched the reviewed exact list:
`6bb129cb2da3287ef4af474befd3eade1e7562f24b12807479de8c06e750b8d1`.
No application/auth/storage/private-rights entry was omitted.

The explicitly authorized `pg_restore --clean --if-exists --exit-on-error`
retry used that list and the exact owned partial database. It stopped while
assigning the owner of **`realtime.action`**, because the required owner role is
absent from this test server. The role identity and exact command/error remain
private. Missing-role SHA-256:
`5930d848f7870eaa542a6c66dde6e16454c8fbf11d4757ce72b139e1feb58fe2`.
Raw-error SHA-256:
`86560c3ac2ca810e32f7a2af3a5e64341eb564dd4eb89f8ccbe6e484c5e2d9d4`.
No observed SQLSTATE is claimed: pg_restore's captured error did not provide it.

No global role was created or changed; no owner or ACL was skipped. No second
retry, database drop, timeout/JIT/cap/network change, or migration 93–109 execution
occurred. The partial database is preserved with **one non-system table** and
**no `auth.users` table**. Thus a complete clone, the 75-account row baseline and
all-account effective-rights comparison are **not complete and not claimed**.

All **188 non-system QA tables** retain exactly the same names, row counts and
full row hashes before and after, canonically ordered by table name. Both
aggregate SHA-256 values equal the reviewed epoch 18 baseline:
`f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`.
The three scoped health responses remained successful after the halt. System
catalogs and shared-database statistics are excluded from this application-data
comparison; the owned database's catalog changes are intentional.

Private local ledger:
`.git/sitov-orchestration/SITOV-NIGHT-2026-10-08/S1/epoch19-resume-ledger.json`.
Private remote directory:
`/tmp/sitov-night-20261008-qa-master/S1-epoch19-rehearsal/`.
That directory preserves the exact plan, exclusion list, before/after QA hashes,
runtime metadata, error and partial-state inventory. Owned private directories
use 0700; files use 0600. No raw account data, credentials, source answers, or
restore output was committed or printed publicly. No owned job remains running.

The next rehearsal step needs an explicitly authorized, faithful owner-role
compatibility solution before another restore. Current scope forbids global
role changes and silent owner/ACL omission, so neither was used. Then complete
the production clone, verify all application/auth/storage rows, capture the
full baseline and all 75 accounts' level/trainer/unit rights before any migration
93–109 probe. All existing production, audio, access and release gates remain.

This commit contains documentation only. No app, API, audio synthesis, production
write, deployment, browser or global test/build work occurred. S1 returns WAIT
with the private evidence and owned partial database intact.
