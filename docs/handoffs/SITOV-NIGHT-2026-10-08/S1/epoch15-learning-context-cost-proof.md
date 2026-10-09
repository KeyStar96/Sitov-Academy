# S1 epoch 15 — learning context cost evidence

Sitov Academy: **DRAFT_PARTIALLY_ENFORCED / NOT_RELEASE_READY**.

This unit delivers native cost evidence only. No product SQL, migration 109,
rights guard, role, timeout, JIT setting, application code, QA runtime, audio or
production data was changed. The observed application SQLSTATE 57014 was **not
reproduced** in this synthetic fixture; these measurements do not establish its
production or QA cause.

Base: `50fa9c67f210ea2200a69dea3ca4fafc8e18897e`.
Branch: `codex/sitov-night-s1-learning-context-cost`.
The assigned branch did not initially exist; S1 created it from that exact
authorized base while retaining the previous clean branch and notified M.

## Evidence

`scripts/sitov-learning-context-cost.test.mjs` installs the immutable normalized
baseline 92 plus migration 93 in its own disposable database on the existing
socket-only PostgreSQL 17 instance. It applies an 8,000 ms statement timeout and
8,500 ms client bound after installation. It never modifies the shared server.

The final native run passed **6 tests in 10.36 seconds**. All three original RPCs
returned complete successful JSON for legacy-all, selected and no-grant student
fixtures. The stored `de`, `en`, `ru`, `uk`, `tr` UI languages produced identical
complete JSON hashes for the fixed legacy-all student, including the actual
nonempty new-content collections and lesson labels.

Final run client timings include psql startup; individual EXPLAIN execution
times below do not. These are diagnostic measurements, not performance gates:

| Original RPC | Legacy all | Selected | No grant |
| --- | ---: | ---: | ---: |
| `get_last_active_level` | 212.87 ms | 14.93 ms | 726.50 ms |
| `get_learning_new_counts` | 209.92 ms | 201.95 ms | 224.20 ms |
| `get_learning_new_items('A1.1')` | 420.06 ms | 388.29 ms | 424.79 ms |

The actual last-active activity CTE was extracted without removing any access
predicate, using the fixture's SECURITY DEFINER owner and authenticated actor
claims. The empty-activity legacy-all plan executed in 0.261 ms. For the no-grant
actor, the original started-level fallback executed in **418.331 ms** and the
unlocked-level fallback in **424.132 ms**. Their plans retain the existing
`sitov_verb_private.level_allowed` predicates. This local result isolates costly
fallback work; it does not justify skipping commercial/item-parent checks.

For that same no-grant actor, `learning_private.allowed_unit_ids()` executed in
**242.580 ms**, `media_private.published_video_unit_ids()` in **1.293 ms**, and
`learning_private.new_objects()` in **298.310 ms**, despite returning zero
objects. The installed `new_objects` body computes allowed units before its
level-derived result set. The original items RPC calls `new_objects()` twice,
once for item keys and again for lesson labels. These are concrete further
investigation targets. No equivalent optimization is claimed or shipped.

The full original JSON, hashes, function-definition hashes and nested plans are
saved in `epoch15-native-cost-evidence.json`. Top-level component EXPLAIN outputs
have no JIT field; this does **not** prove absence of nested JIT activity. No JIT
setting was altered. Selected-student activity includes a fixture-generated
checkpoint timestamp, so its hash may differ between separately installed runs.

## Verification and limits

- `SITOV_NIGHT_NATIVE=1 node --test scripts/sitov-learning-context-cost.test.mjs`: 6 PASS, no skipped tests.
- `npx eslint scripts/sitov-learning-context-cost.test.mjs`: PASS, no findings.
- `git diff --check`: PASS.
- The test's `finally` drops only its own `sitov_night_learning_cost_<pid>` database.
- Source inspection of VPS 94–108 found no direct definitions/references of the
  four measured RPC/new-object functions or `learning_private.allowed_unit_ids`.
  The runtime proof remains explicitly baseline 92 plus 93, not a claim that all
  later migrations or actual application data were exercised.

No candidate function was installed and no old/new equivalence was claimed.
Before a product optimization, M still needs full JSON equality across manual
null/all, empty and selected grants; trial null/empty/selected item buckets;
VIP, verified purchase and revocation; legacy history; canonical catalog/parent
mismatches; five stored interface languages; and staff MFA. Concurrent snapshot
semantics, first-visit writes and existing per-text S3 gates must also remain
intact. The epoch 14 parent-mismatch counterexample remains binding.

No full build, full TypeScript check, browser, live QA, synthesis, publication,
production write or deployment was run by S1 in this unit.
