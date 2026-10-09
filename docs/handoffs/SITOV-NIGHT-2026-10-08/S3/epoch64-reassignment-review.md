# Sitov Academy — S3 epoch64

Base `e5911c1d37b8065e3053f1b20cf52ba8b59ee92a`. Test-only lease; canonical/VPS SQL unchanged.

The assigned PostgreSQL 15.19 clone passed 54 assertions in one BEGIN/ROLLBACK; all previous 42 assertions remain. Added protected ID reassignment/collision, both OLD/NEW translation targets, same-unit node and cross-unit/node moves, parent node/unit boundaries, exact synthetic rows and old snapshot checks. Existing FK/unique constraints reject some statements before the revision guard: observed SQLSTATEs 23503/23505; translation and exercise boundary guards return 40001. The captured-history equality assertion compares the prior before/after captures, rather than refreshing history after these new cases.

The explicit opt-in two-session harness had two bounded failed attempts: each reached the row-lock observation phase, then `marker_timeout:A:ROW_WAIT`. It is retained as an incomplete reproducible probe; it does not establish cross-session 114 CAS/replay behavior or a passing concurrency matrix. The first attempt had newline handling corrected; the persisted final harness adds failure diagnostics, which were not rerun. No third attempt. Private stderr retains the failed evidence.

114 and fixtures existed only in connection A's transaction and were rolled back. Connection B used the currently installed importer and existing visible catalog rows; uncommitted 114 cannot be observed by B. No schema persistence, new container/database, production/sharedQA content write, model/audio work, or release claim. SharedQA baseline identity is outside this unit during S1's temporary asset window. Full 185/188 data streams were not run.

The companion JSON records bounded clone metadata hashes. Runtime closure evidence is private `S3/epoch64-runtime-after.stdout`; handoff/status contain exact post-run health, memory and scoped session result. Further concurrency proof requires a fresh M assignment.
