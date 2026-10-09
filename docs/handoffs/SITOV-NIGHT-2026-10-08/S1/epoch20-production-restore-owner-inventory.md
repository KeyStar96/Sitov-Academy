# S1 epoch 20 — restore halted, complete static owner inventory saved

Sitov Academy: **NOT_RELEASE_READY**. Existing branch/HEAD were retained from
epoch 19; no reset, new worktree, production write or migration execution.

The fresh guard verified PostgreSQL **15.19**, **2,282 MiB** available host
memory, the exact owned QA images/caps/internal network, no OOM and three
successful health responses. M's previously added Realtime owner role was
independently checked: all seven privilege/login/inheritance flags are false.
The exact production archive checksum and reviewed 22 operational-only
pg_cron/pg_net exclusions matched before the single authorized restore attempt.

Restore used `--clean --if-exists --exit-on-error`, original owners/ACLs and the
corrected TOC, targeting only `sitov_night_migration_rehearsal_20261009`.
It stopped at ownership assignment for **`supabase_functions.http_request`**:
the standard technical role **`supabase_functions_admin`** is absent. Exact
command and error remain private. Error SHA-256:
`a58445405cc97465a6705ed1d363cd8f3f888fca32f59b901874a8679f6e897f`.
No observed SQLSTATE is claimed. No further restore attempt, owner/ACL omission,
global role change, database drop, timeout/JIT/cap/network change, or migration
93–109 execution occurred.

Read-only extraction of the actual archive's schema saved a private ownership
inventory covering **7 distinct owner roles**, **11 explicit GRANT/REVOKE target
roles** and **671 concrete ownership references**. Their union has exactly one
missing test-server role: `supabase_functions_admin`, referenced by **4 objects**
of types FUNCTION and TABLE. No additional owner or explicit ACL-target role
is missing. Procedural/dynamic grants were not executed or claimed analyzed.
The actual schema-only DDL remains private, SHA-256:
`a06beb42166c795e76749ab3dd85365087ae3293921be0f3efd1464433e237c7`.
Current inventory SHA-256:
`4f2bdf8b5f951404e14e405606bd9735d0ea28990fb1b52ed8561c17ef9f0b2e`.

Production flags for the newly identified missing role have not yet been
compared by S1. M was asked for the exact approved read-only invocation or
production-source proof. No inertness, membership, ownership compatibility or
privilege equivalence is inferred from the role's name.

All **188 non-system QA tables** retain identical names, row counts and full row
hashes before/after, with the same canonical aggregate SHA-256:
`f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`.
All three health checks passed after the halt. The partial owned database is
retained with **one non-system table** and **no `auth.users` table**. The full
clone, full row baseline and 75-account effective-rights baseline remain
incomplete and are not claimed.

Private local ledger:
`.git/sitov-orchestration/SITOV-NIGHT-2026-10-08/S1/epoch20-resume-ledger.json`.
Private remote directory:
`/tmp/sitov-night-20261008-qa-master/S1-epoch20-rehearsal/`.
That directory contains the actual private schema, complete owner/explicit-ACL
role inventory and references, exact error, reviewed TOC, before/after QA hashes
and runtime proof. Owned directories/files use 0700/0600. No raw account data,
credentials, answers or error output was printed publicly or committed. No job
remains running.

Next: M must review the complete role compatibility set against actual
production read-only flags, authorize a faithful solution, then grant a fresh
restore unit. No role or ownership workaround was attempted. All previous
production, access, audio, per-text and release gates remain. This commit
contains documentation only; S1 returns WAIT with the partial state intact.
