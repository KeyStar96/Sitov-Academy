# S2 epoch22: partial A2/B1 curriculum mapping

Sitov Academy. Assigned base `966a380f7a6118654f19750a9d62200795feb8c2`; M-prepared dependency/start HEAD `5d665d1cd9598523f2e9df89acc6bcedef732af1`, verified clean on `codex/sitov-night-s2-curriculum-breadth`. Lease ends 2026-10-09 10:42:17.924498 UTC (12:42:17.924498 Europe/Berlin). Only the assigned mapping, existing test and this handoff are changed.

Four source-evidenced partial topics extend mapping v1 from 16 to 20. No schema/version change. `SitovMappedLevel` now aliases the existing central `AccessLevel`. Its ten supported values already govern the recommendation result contract and path source/map contracts. Search found no external narrowed-type consumers. The existing server resolver retains exact current published catalog, unique same-parent source resolution, availability, current item rights and account progress checks. No authorization, prerequisite, database, task, audio or persistence changes.

The first sixteen topic objects remain structurally identical to the start HEAD (canonical sorted-JSON SHA256 `03c39420e841cd24c12566983887305ad54d9852ad3ef0612f633fa4c001e4d1`). Existing IDs, metadata, answers and Special bindings are preserved.

| Level | Topic | Actual path/node source anchors | Actual concrete targets |
|---|---|---|---|
| A2.1 | `sitov.topic.begruenden-a21` | P1/P1-N4, P1/P1-N5 | vocabulary_card `7c843d2c-122c-59d8-be9b-872e6a633d5d` in `b323bbf3-b8af-5972-91c1-cb60d513f4f6`; reading_text `b2ae5915-20dd-5018-8921-6afe5be0f1fd` |
| A2.2 | `sitov.topic.vorschlaege-a22` | P1/P1-N6, P1/P1-N7, P1/P1-N8 | vocabulary_card `769fbe06-623b-5208-9255-4bc3146b34d6` in `81278222-33e1-5bcf-aeee-8b01a16606c1`; verb `sitov-verb-vorschlagen`; reading_text `3243b764-4bfc-5fc6-8c24-1a49962988ff` |
| B1.1 | `sitov.topic.berufseinstieg-b11` | P5/P5-N1, P5/P5-N7, P5/P5-N8, P5/P5-N9 | vocabulary_card `09279424-00ac-5fbb-9776-fe430b731dbf` in `2a531c0b-bd97-54b9-9913-4327386e5038`; vocabulary_card `7cdbce00-8fc5-5e41-8952-2624b7025daf` in `2a531c0b-bd97-54b9-9913-4327386e5038`; reading_text `19846618-a6c3-5001-84d5-06b21b99dff5` |
| B1.2 | `sitov.topic.zusammenarbeit-b12` | P1/P1-N1, P1/P1-N9 | vocabulary_card `04b04190-54df-5325-931b-bf3ccdbde9b5` in `d812aefe-f72d-5524-b2b9-08fbd59bdaf2`; verb `sitov-verb-beschliessen`; reading_text `cacb3a6d-e789-5abc-9e94-f6eecfb36bdb` |

Sources checked: `supabase/seeds/path-a2.1.json`, `path-a2.2.json`, `path-b1.1.json`, `path-b1.2.json`; `content/vocabulary/sitov-vocabulary-seed.json`; `lib/verbs/catalog-data.json`; `supabase/seeds/pronunciation-reading-2026.json`. Target UUIDs are the canonical content/card IDs, not guessed runtime path UUIDs. Runtime path UUIDs remain resolved by the existing authorized port. Repository existence/level evidence is not a live publication or account-access proof.

Partial scope: A2.1 links weil reasons; A2.2 links making suggestions, with the present-tense verb target covering only the lexeme, not Konjunktiv II; B1.1 links application documents and career changes; B1.2 links team alternatives/decisions, with present beschließen not claiming past-tense mastery. Reading references supply contextual practice, never a pass/competency claim or a replacement for a missing independent learning target. Pronunciation still requires its individual current pretest; the existing failed-pretest enrichment projects vocabulary/verbs/path only. Nothing here changes private core mappings or gives a text its own practice link as purported remediation.

## Four exact coverage gaps

All ten authoritative path seeds are now included in catalog validation. B2.1, B2.2, C1.1 and C1.2 have path stations but each has zero same-level vocabulary-card, verb and regular-reading targets in the three supported canonical target catalogs. Each therefore remains unmapped in this unit. `lib/verbs/types.ts` explicitly makes B2.1/B2.2 review contexts for verbs up to B1.2 and excludes C1.1/C1.2 verb trainers. Lower-level review verbs, coarse B2/C1 entries, inactive legacy reading inventory and exam-reading artifacts cannot be substituted as same-level published trainer targets. Completing those levels requires a separately authorized content/catalog workflow or a separately reviewed contract extension; neither is performed here.

## Exact proposal for M/S3 integration

Read-only inspection of pending S3 commit `c8682dbe3defeb24c22d14b71769d5814c02477d` confirms `scripts/sitov-pronunciation-pretests-authoring.mjs`, `sitovReadAuthoringSources`, currently rejects every mapping topic whose level is outside `['A1.1','A1.2']`, before validating drafts. Thus combining that commit with this mapping without a repair makes the offline source reader throw `Invalid canonical topic-level evidence` even for unchanged A1 drafts.

Replace only that A1-only mapping-level allowlist with the existing ten central access levels:

```js
['A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2']
```

The offline implementation should verify this list against `ACCESS_LEVELS` in `lib/access/levels.ts` (or safely read that canonical literal without evaluating TypeScript). Retain unique topic IDs, exact topic-to-target/anchor/special level equality, and the S3 same-level `topicLevels.get(topicId) === draft.level` check. Do not broaden the active 60-text authoring inventory, change the 12 definitions, hashes, answer keys, pools, mappings, pending reasons or publication requirements merely to accept metadata. The JSON-literal extraction of `SITOV_TOPIC_MAPPING` still works with the new type-only import and alias; no parser format change is needed.

Suggested narrowly scoped S3 tests: source reader accepts the combined 20 topics/central ten-level registry while retaining the unchanged 60 active texts; malformed/unknown levels and duplicate topic IDs still throw; the existing cross-level private-core rejection remains; an existing same-level A2/B1 topic is accepted by level validation without authoring/activating a new draft. This is a proposal, not an applied or tested S3 repair. S3 commit was not cherry-picked, depended upon for our tests or edited. M must repair/review this integration conflict after S5's frozen QA is idle.

## Validation and release limits

Commands run:

- `jest --runInBand __tests__/sitov-learning-recommendations.test.ts __tests__/sitov-learning-special-recommendations.test.ts __tests__/sitov-pronunciation-pretest-learning-links.test.ts __tests__/sitov-learning-path-target-server.test.ts`: PASS, 4 suites / 75 tests.
- Scoped ESLint on mapping and the changed existing test: PASS.
- Original-sixteen structural comparison against start HEAD: PASS.
- `git diff --check` and staged diff check: PASS before commit.

Tests cover all ten path source catalogs, same-level concrete target/unit membership, foreign nodes, duplicate target/topic/competency references, per-level exact authorized vocabulary resolution, stored account progress, locale/level-preserving exact URLs and revocation. These are repository evidence and mocked secured-port proofs. No full TypeScript, build, global tests, actual SQL/QA, browser/native, production, audio generation/import or publication operations ran. Existing eleven absent actual-QA A1 vocabulary references are untouched. Live availability/destination acceptance, content review, audio proofs where content changes, private-core owner review and M release decision remain separate gates. No release-ready claim.

Rollback: revert this commit; no database migration or rollback. WAIT for a fresh START after handoff; no lease extension or next-unit work.
