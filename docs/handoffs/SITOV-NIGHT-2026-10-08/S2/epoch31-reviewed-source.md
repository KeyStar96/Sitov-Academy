# Sitov Academy – S2 epoch31 reviewed source-only handoff

Base: `52bc52cc1cf7e38513ce39f4c704abc6834ee867`; branch `codex/sitov-night-s2-reviewed-source-31`.

Applied all 43 independently reviewed complete future exercise objects and 14 actual existing practice cards. S7E13F01 first distractor is `Er schminkt ihm.`; correct reflexive key remains unchanged. S7E13F02 actual A2.1/P1/P1-N6/p1_trennbar example is `Ich habe gestern meinen Onkel angerufen.` Optional rucksack wording was not adopted.

All 9,569 exercises across ten seeds were compared and schema validated. IDs, refs, types, goals, parent metadata, order and all exercises outside the exact 43 set remain unchanged. The complete before/after exercise objects and all 14 complete parent/card payloads are in private `S2/epoch31-old-new-full43.json`; its exact SHA-256 and all private artifacts are recorded in `epoch31-validation.json`. The committed scalar patch contains 479 entries; source proof includes all ten before/after file hashes.

`epoch31-canonical-audio.json` is derived from actual final source using SQL71 catalog and the actual prepared player adapter, including fill words and full sentences. It contains 46 exact aliases, 41 changed aliases, raw/canonical utterances and old/new deltas. The reviewed previous 46 aliases match exactly. Practice cards are excluded because actual RuleCard has no audio consumer. No synthesis, alignment, storage import or publication occurred.

Validation: targeted Path/Special/schema Jest 139/139 (five suites), existing Special authoring 23/23; ESLint zero errors, one pre-existing unused `_target` warning. `npm run test:path-seed`: 84 pass, four failures. All ten isolated PGlite runtime fixtures pass import, interface languages, grading, wrong forms and unlock thresholds. The four failures are author-source serialization drift for A1.2/A2.1/A2.2/B1.1; read-only actual-builder comparison proves each already diverged at the assigned base. Authors under path-src are outside the allowlist and unchanged. They require a separately assigned reconciliation; no checks were weakened or suppressed.

M explicitly expanded scope to the two changed tests. Frozen historical answer expectations remain tied to immutable epoch30 old snapshots; new assertions validate current revisions and actual cards. Schema preservation now verifies actual before/after bytes, hash and input data instead of a stale magic file hash; all existing schema/ID/goal/answer/translation guards remain.

Protected task/key/accepted/options/parts changes are source-only unpublished candidates for NEW SQL114 revisions. Ordinary import and historical overwrite are forbidden. M must perform actual CAS/archive revisions with these companions, locally prepare Qwen male German recordings and timings, import audio, verify and publish. No external/shared/production database, application runtime, API, SSH or deployment was touched. PGlite fixtures are isolated existing tests.

This closes only the exact known 43-task/14-card unit. It is not a global male-character audit or release approval. S2 returns WAIT after commit; no automatic next unit.
