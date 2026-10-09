# S1 epoch 16 — compute new items once

Sitov Academy: **DRAFT_PARTIALLY_ENFORCED / NOT_RELEASE_READY**.
Base: `81b05d9476f691bfde020fcb3ed1ecd802942422`.
Branch: `codex/sitov-night-s1-new-items-single-evaluation`.

## Change

Only `public.get_learning_new_items(text)` changes. Its original two calls of
`learning_private.new_objects()` become one explicitly MATERIALIZED CTE in one
SQL statement. The original ordered arrays of item keys and the matching lesson
labels consume that same result. The function's signature, outer VOLATILE
classification, SECURITY DEFINER, empty search_path, owner and existing ACL are
preserved. Authentication, input-length guards, error JSON/SQLSTATE and success
JSON shape remain unchanged. The migration performs CREATE OR REPLACE only and
contains no grants, cache, role, timeout, JIT, RLS, history, receipt or visit edits.

The timestamped migration and VPS 109 are byte-identical. The exact filename and
previously unused 109 allocation were explicitly assigned by M. The branch was
created by S1 from the assigned exact base because it was not yet present; the
previous clean branch remains available and M was notified.

## Intentional snapshot behavior

The outer RPC remains VOLATILE. Previously its two internal SQL statements could
observe different committed data under READ COMMITTED, so items and lesson labels
could describe different moments. They now intentionally share **one statement
snapshot**. This is coherent response behavior, not a claim that concurrent
old two-snapshot semantics are identical. Every later RPC call evaluates the
private access function again. Source-local revocations are tested on the next
call, while another independent source continues to grant its original scope.
No cross-request cache is introduced.

PostgreSQL documents both [CTE materialization](https://www.postgresql.org/docs/17/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION)
and [function snapshot behavior](https://www.postgresql.org/docs/17/xfunc-volatility.html).
The native plan separately verifies the actual single Function Scan and its two
CTE consumers. This unit does not run a live concurrent-writer test.

## Native verification

The test installs immutable normalized baseline 92 plus commercial migration 93
in its own disposable database on the existing socket-only PostgreSQL 17
instance. It preserves the original function as a private fixture oracle, applies
109 to the public RPC, and compares complete JSON plus SHA-256 under REPEATABLE
READ per comparison. Each statement is bounded at 8,000 ms and its client at
8,500 ms. Synthetic native fixtures only; no actual QA data, API, browser, app
runtime, production data or audio is accessed.

Coverage includes manual absent/default-all, explicit-all, selected-empty,
selected-single-unit and disabled grants; nonempty actual lesson labels and
ordered item keys; null/empty/selected trial units and null/empty/selected item
buckets; VIP and verified purchase with next-call revocation; independent manual
and trial source union with retention after trial revoke; existing selected
student history; DB-valid independent verb catalog/parent-level mismatch; all
five stored UI languages; admin MFA with real AAL1 denial and verified AAL2
permission; missing authentication, invalid lengths and unknown levels; seen
lesson exclusion from both collections; no room visit; and a native helper
exception preserving the error boundary. The exception stub exists only in the
disposable fixture and is restored exactly immediately afterward.

Before/after checks retain owner, ACL, VOLATILE, SECURITY DEFINER and search_path,
plus exact definitions of new_objects, counts, last-active and three access guards.
Full existing selected-student history, messages and storage snapshot plus all
first-visit and seen-receipt rows remain unchanged by the calls. Fixture source
setups change only the synthetic access inputs required for comparison.

Final native run: **9 PASS, 0 skipped in 19.76 seconds**, including **41 complete
JSON/hash comparisons**. The native plan has one new_objects Function Scan with
Actual Loops = 1 and two CTE consumers. Diagnostic client time (including psql
startup) was **355.24 ms original → 186.42 ms candidate**, with identical response
hashes. Full results and plan are saved in `epoch16-native-evidence.json`. Performance measurements are diagnostic, not machine-specific acceptance
thresholds. This duplication optimization does not establish or claim to fix
the actual application's SQLSTATE 57014 cause.

## Validation and handoff

`SITOV_NIGHT_NATIVE=1 node --test scripts/sitov-new-items-single-evaluation.test.mjs`
passed all nine checks. Scoped ESLint and diff checks passed. Own database cleanup
was verified separately; no shared server process or settings were changed.
These checks are also recorded in S1.json. M owns integration, canonical schema/type updates,
actual QA and release validation. No deployment or full global checks were run.
All previous release and S3 per-text test gates remain in force.
