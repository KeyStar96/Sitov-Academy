# S2 · Epoch 18 · Authorized path sources and existing Nominativ Special

Group `SITOV-NIGHT-2026-10-08`; branch `codex/sitov-night-s2-authorized-recommendation-sources`; verified clean starting HEAD `a7954d4e7735fcc1ed6b1050503120055a3b7675`. START expires 2026-10-09 08:45:01 UTC. Outcome: bounded application repair completed and handed off; no deployment or overall release acceptance.

## Behavior

Both existing learner source lookups now use reviewed RPC108 `sitov_get_learning_recommendation_sources`. The recommendation resolver no longer SELECTs `learning_units`/`path_nodes`; the path-to-topic resolver no longer SELECTs `path_nodes`. A shared server-only loader requests only current available map UUIDs, in batches of at most 200, without caller identity or rights input. It strictly parses the frozen minimal envelope/metadata, checks exact requested level, requested IDs, canonical map parent/path source/kind, actual available same-parent non-Special anchor, and uniqueness. Foreign, duplicate or malformed metadata cannot redirect a link. Current-rights omissions and nonretryable RPC denials yield no sources; transport/retryable failures stay failures. The optional path-to-topic resolver preserves its existing empty-on-failure behavior; the recommendation result preserves its existing retryable error boundary.

The existing Nominativ topic has one internal typed Special source target: A1.1 / P4 / `sitov-special-a11-artikel-nominativ-v1`, anchor P4-N1, goal P4-G1. Runtime IDs come exclusively from RPC108 and the actual map. Selection requires exact Special source, anchor source, both stored goal lists, actual catalog kind `path_special`, matching catalog parent/publication, current `currentUserHasContentAccess({kind:'path_special',id})`, and actual available Special map node/unit/level. RPC108 retains the authoritative current source/publication/anchor/commercial checks. No content is created or activated.

An authorized Special uses the unchanged public `learning_path` result and `/{locale}/dashboard/level/A1.1/path?sitov_target={actualUUID}`, whose existing consumer opens the reviewed Special mode choice. Progress is only the current stored map status. No private Special runs are read or written and no mastery is synthesized.

The only candidate-order adjustment places this topic's optional Special before its anchors/other targets within equal action priority. This lets it appear within the existing limit 3; the existing stable sort still puts all `continue` actions first. Other topics/targets and the individual-only pronunciation prerequisite remain unchanged. Existing vocabulary checkpoints remain read-only.

## Files and contracts

Application files: `lib/learning/sitov-topic-mapping.ts`, new `lib/learning/sitov-learning-recommendation-sources-server.ts`, `lib/learning/sitov-learning-recommendations-server.ts`, `lib/learning/sitov-learning-recommendations-path-server.ts`.

Tests: updated `__tests__/sitov-learning-recommendations.test.ts`, `__tests__/sitov-learning-path-target-server.test.ts`; new `__tests__/sitov-learning-special-recommendations.test.ts`, `__tests__/sitov-learning-recommendation-sources.test.ts`. This handoff is the only documentation change.

Uses M's frozen destination addendum and already integrated typed RPC108. No SQL, public result contract, route/UI/API, RLS, grant, progress store, checkpoint write, account, task/audio content, publication or prerequisite change. No migration in this commit. Deployment dependency: canonical RPC108 must be applied before this application change. Rollback: revert this application commit; RPC108 may remain as an independently reviewed read-only port. Reverting restores the preexisting learner RLS source-lookup defect, so it is not a recommended live fallback.

## Executed verification

- Affected Jest: `./node_modules/.bin/jest --runInBand __tests__/sitov-learning-recommendations.test.ts __tests__/sitov-learning-path-target-server.test.ts __tests__/sitov-learning-special-recommendations.test.ts __tests__/sitov-learning-recommendation-sources.test.ts` — final 4 suites / 66 tests PASS. First run found one accidentally contradictory assertion in the updated path-source test; corrected before the passing run.
- Scoped ESLint on the four application and four test files — PASS.
- Scoped TypeScript API syntactic/semantic diagnostics on those same eight files, using repository compiler options, no emit — 0 diagnostics. This was not a full-project TypeScript check.
- `git diff --check` and staged diff check — PASS before commit.

Tests cover actual-port argument shape and no raw path reads; exact parent/path/kind/level/request-ID matching; duplicates/malformed/transport/rights omissions; 200-ID batching; ordinary stored-node progress and fresh permission revocation; Special source/anchor/goals and current permission/publication/map availability; five locale hrefs; truthful map status; unchanged continue priority/limit; only read RPCs/checkpoint-get; and existing pronunciation without vocabulary/path/verb prerequisites. These are mocked application-port tests, not HTTP/RLS/browser proof. M reported S3's separate native RPC108 seven-test proof before this START; S2 did not rerun or claim authorship of that proof.

No full build, full TypeScript, global tests, native database, QA/HTTP/browser, auth actor, TTS, audio import, production or publication operation ran in this unit. Integration and real user-flow acceptance remain with M/S5. Own status is atomically saved as WAIT; no automatic lease extension or further unit.
