# S2 · Epoch 20 · Canonical stored catalog unit UUID parsing

Group `SITOV-NIGHT-2026-10-08`; branch `codex/sitov-night-s2-catalog-unit-guid`; verified clean base `cb39a4b92e83dbcf4eca3de4c2aaf02baaf4d354`. START expires2026-10-09 09:23:01 UTC. Fresh ordinary weekly budget19%. Outcome: narrowly assigned parser repair completed; no release acceptance or new real user-flow proof.

## Change and boundary

Exactly one production parser field changed: `accessCatalog.units[].id` in `lib/learning/sitov-learning-recommendations-server.ts` now uses installed `z.guid()` instead of `z.uuid()`. M's frozen destination-contract `stored_unit_uuid_validation` addendum expressly defines these authoritative stored PostgreSQL unit IDs as canonical128bit hexadecimal8-4-4-4-12 strings without an RFC version/variant requirement.

Epoch19 actual QA transport contained113 unit IDs rejected by the former validator, including `01da78e3-726f-a505-a9d6-fbb907ccb31f` (version nibble a). Another captured canonical unit, `ddcf712d-060d-0e2c-9469-1139b39bb87f`, belongs to existing `sitov-verb-kommen` and uses version nibble0. Previously parsing the verbs catalog threw and the outer retryable failure discarded even an available mapped path recommendation. The new field accepts the stored representation while rejecting malformed hex, hyphens and length.

All other validators and current auth/catalog/publication/parent/level/selected-rights checks remain unchanged. No input/actor/attempt/node/target validator, identity, mapping, SQL, public DTO, grants, progress, audio or content changed. The absent11 QA vocabulary references remain absent; no substitute IDs or content were added. S1 separately owns the identical canonical metadata issue in shared `currentUserHasContentAccess`; this commit does not replace that guard or establish its integration result.

## Verification executed

- Red regression before the one-field change: exact captured version-a/version-0 catalog unit/item shapes caused the resolver to drop valid path/verb recommendations. One targeted regression failed as expected.
- Final `./node_modules/.bin/jest --runInBand __tests__/sitov-learning-recommendations.test.ts __tests__/sitov-learning-special-recommendations.test.ts __tests__/sitov-pronunciation-pretest-learning-links.test.ts` — **3 suites /60 tests PASS**.
- Scoped ESLint: `lib/learning/sitov-learning-recommendations-server.ts` and `__tests__/sitov-learning-recommendations.test.ts` — PASS.
- Local replay of the saved sanitized epoch19 actual verbs-catalog response through the unchanged extracted parser expression: old validator113 unit-ID issues; new validator parses the complete captured response. This reuses existing transport evidence and is not a new QA/HTTP run.
- `git diff --check` and staged diff check — PASS.

New regression assertions retain an authorized existing path and verb together, preserve real zero-evidence null progress, use exact destination hrefs, keep all calls read-only, reject invalid hex/bad hyphen/truncated IDs, and omit the verb after current guard or catalog-publication revocation while retaining the valid path. These are application-port tests with captured response shapes; shared access is mocked and needs S1/M integration plus later actual authenticated and visible destination acceptance.

No QA/SSH/actor/browser/native/fullTS/build/global test/TTS/publishing/production operation ran in epoch20. No migration; rollback is revert this commit, restoring the documented parser failure. Changed files: the one DAL file, its existing test file and this handoff.

## Epoch19 timing correction

M verified the final epoch19 documentation/status save at09:13:55 UTC,19seconds after its09:13:36 deadline. The previous broad within-lease save statement was inaccurate. The actual QA cleanup completed at09:12:17 UTC, before expiry; no QA operation ran after the lease. This epoch20 handoff records the correction without editing the prior frozen handoff. Epoch20 saves its own commit and atomic WAIT status before its own deadline; no extension or next unit is inferred.
