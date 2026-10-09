# Sitov Academy — S1 epoch35: PG15 rollback counterexamples

Exact assigned base `8281cf95`, owned branch `codex/sitov-night-s1-pg15-counterexamples`. All database commands targeted container `sitov-night-20261008-qa-db` and owned clone `sitov_night_migration_rehearsal_20261009` as actual migrator `supabase_admin`. The shared QA `postgres` database was only read for its final hash. No production-container SQL, resource/global-role changes, model/audio jobs, audio adoption or import occurred. No scratch database was created. Tracked implementation SQL/tests required no changes; this commit contains only this report.

## Completed fixtures

| Fixture | Outcome | SQL SHA256 |
| --- | --- | --- |
| Corrected commercial metadata fixture | PASS; explicit ROLLBACK | `e0882048ecefa1075446454fd7a0eac9e454e76f4f48700e3b04b54b58f3f145` |
| Storage definer execution fixture | PASS; read-only transaction and ROLLBACK | `15eb9e5ed802d4eab70cbebdb8bb74b632273710714789299dc1e1cd0c6895c5` |
| Private native113 adaptation | **28 assertions PASS, seven synthetic students**; explicit ROLLBACK | `b6c1e0edd83f7320bacc067a954bb2e6e44daf8798bf0510c99718508b72ac5a` |

The commercial fixture exercises VIP, verified paid access, inactive/unverified purchases, full/partial trials, foreign actor/owner, empty vocabulary, disabled/selected grants and the corrected teacher exemption/admin MFA behavior. It uses existing actual accounts and temporary changes that all roll back. The Storage fixture checks internal postgres definer execution, sealed API/PUBLIC execution, actual object SELECT-policy evaluation, private audio and direct authenticated/anon/service-role denial. Commercial/native113 server statement bounds are eight seconds; the unchanged Storage source uses 30 seconds, with a 45-second client bound. All succeeded within their bounds.

The native113 adaptation creates eight synthetic auth users (seven students and one teacher), synthetic units/cards and nine synthetic catalog entries entirely within its owned rollback transaction. It rejects synthetic-ID collisions and scopes before/after student loops to these seven accounts. Existing actual75 accounts/catalog rows are not used as mutable native113 subjects. Exact pre113 definitions of only `legacy_unit_allowed` and `item_allowed`, preserved in epoch33, are restored **inside** the rollback before applying the current migration twice. The fixture therefore truly checks two changed definitions, preserved function metadata/ACL/config, idempotence of the second application and unchanged policies. Rollback restores the already installed113 definitions.

The original24 checks cover canonical B2.1/B2.2, coarse B2/C1 and C1.1 denial, inactive unit versus item behavior, catalog/unit level and trainer mismatches, seven student paths, VIP/paid/full/partial trials, foreign actor/owner, unknown IDs, nonverb staff behavior and teacher/admin synthetic MFA branches. Four additional checks cover hidden empty vocabulary with retained legacy VIP metadata IDs, disabled trainer, empty selected set and explicitly granted selected unit. An additional `SET LOCAL ROLE authenticated` block checks the public unit/verb wrappers with synthetic claims. The actual PG15 MFA table requires explicit factor ID and creation/update timestamps; the rollback-only synthetic verified factor supplies those fields.

Native claims, a synthetic verified factor and owner-context helper assertions are database counterexamples, not signed HTTP sessions, real-user MFA or listening/publication proof. M's completed actual75 comparison remains independent evidence; S1 did not repeat it.

## Adaptation corrections

The first private adaptation attempt omitted semicolons after `pg_get_functiondef` output; PostgreSQL rejected it and rolled back. A second attempt exposed an incorrect extra fixture expectation that VIP metadata lists should exclude empty vocabulary units. Exact112 source intentionally retains those metadata IDs while `vocabulary_unit_visible` returns false. The corrected assertion checks both behaviors. Neither issue required a product SQL change. Initial diagnostics and exact final SQL are preserved privately.

## Final preservation and runtime

The final sequential streaming checks started at 22:04 UTC, well before the 22:06:41.138943 UTC ordinary-work boundary, and completed at **22:04:47.051338 UTC**. No whole large table was materialized as a JSON aggregate.

- Original185 column projection: exact expected `cfeb746a211c54255d8c4d519f92efe05637482f3f2ca34194f894ce32ef8814`, including M's already-qualified historical storage-bucket exception.
- Shared QA188: exact expected `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`.
- Final complete function definitions/owners/ACL/config/API effective execution, schemas and policies equal the fresh pre-fixture metadata.
- Zero remaining synthetic users; zero other active queries in the owned clone.
- Five correct isolated containers, expected pinned images/resource limits, no OOM; auth/rest/storage health each HTTP200. Available memory: 2434 MiB initially, **2334 MiB finally**, above the required1984 MiB.

All SSH wrappers ended; no detached jobs. Private SQL, output, metadata, hashes and health evidence reside in `/tmp/sitov-night-20261008-qa-master/S1-epoch35-rehearsal` and the local orchestration `S1/epoch35-*` files (0700/0600), with `epoch35-private-artifact-manifest.json` and resume ledger. Sensitive account data was not committed. S1 returns to WAIT after a clean report commit. These gates do not constitute a deployment/release authorization.
