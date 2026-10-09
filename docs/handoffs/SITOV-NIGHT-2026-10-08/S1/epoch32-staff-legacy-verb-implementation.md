# Sitov Academy — S1, Epoch 32: implementation-only migration 113

Migration 113 contains exactly the two SELECT bodies reviewed and approved from epoch 31. Canonical and VPS alias are byte-identical, SHA-256 `b6ad3ebc3a520be0ff6408dcd146dfc01e894c4f99b9486d4fb80d3e883d8b85`; extracted bodies match their reviewed sources exactly. Only `legacy_unit_allowed(uuid,uuid)` and `item_allowed(uuid,text,text)` are replaced. No GRANT, REVOKE, ALTER, DROP, policy, owner or configuration change is included. The actual runner registers 113 after 112.

The legacy staff unit arm restores the exact eight canonical verb-level cap while preserving inactive canonical unit metadata access. The staff verb-item arm additionally restores active-unit, trainer and catalog-to-unit-level equality checks. Current actor/MFA enforcement, non-verb kinds and all student branches remain intact; the verb wrapper and migration 112 are unchanged.

Validation:

- **18 process tests pass**, including the new actual-migrator transaction/alias/order contract. M explicitly added the existing runner-test file to the allowlist before its historical-last-entry assertion was updated.
- **Two Node tests pass without skips**: source/alias/order contract, and isolated native PostgreSQL 17 rollback fixture with **24 assertions**.
- Native checks cover staff canonical B2.1/B2.2 allowance; raw B2/raw C1/canonical C1 denial; inactive canonical unit allowance with verb denial; catalog-level and trainer mismatches; unknown IDs; foreign owner isolation; non-verb staff access; exact before/after rights for seven synthetic students; explicit positive VIP, verified purchase, full trial, item-scoped partial trial and foreign-actor denial; teacher MFA exemption; admin MFA denial and verified-factor canonical allowance with noncanonical denial.
- Native metadata checks require exactly the two intended definition changes and preserve every sampled function's other catalog fields, including owner/ACL/config. The second application is metadata-identical; all policies remain equal.
- ESLint and diff checks pass. All native counterexample changes and both migration applications are inside a transaction ending in **ROLLBACK**. The fresh owned fixture database is removed in `finally`; zero `sitov_night_s1_staff113_*` databases remain.

The native test uses the existing socket-only PostgreSQL 17 harness, normalized baseline92 plus migration93, synthetic male QA accounts and synthetic native claims/factors. It is not a production-account, real MFA, Auth/Storage HTTP or deployed PostgreSQL 15 proof. No clone, shared QA or production SQL was executed in this lease, and no remote database was changed. M's running full75 comparison and clone write freeze were preserved.

The new native files are `supabase/tests/sitov-staff-legacy-verb-native.sql` and `.test.mjs`. Run with `SITOV_NIGHT_NATIVE=1 node --test supabase/tests/sitov-staff-legacy-verb-native.test.mjs`; the SQL markers receive the exact migration body twice through the wrapper. Private validation/body hashes are saved in the S1 orchestration directory.

Required next gate: M authorizes and performs a separate PostgreSQL 15 owned-clone installation/idempotence/metadata/ACL/protected185/QA188/runtime rehearsal, then verifies both actual teachers and the full actual75 matrix. This implementation-only handoff does not authorize clone installation, deployment or release readiness.
