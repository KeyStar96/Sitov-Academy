# S2 epoch3: authorized recommendation DAL

Status: committed server contract/DAL/action. NOT RELEASE_READY; no visible recommendation UI. Mapping is still the explicit seven-topic A1.1/A1.2 sample from45c5. No Special runtime, content seed, bonus, new German utterance, audio change or publication.

Implemented `resolveSitovLearningRecommendations(input:unknown)` in server-only DAL and async `getSitovLearningRecommendations(input)` action. Frozen v1 input rejects unknown topic/competency IDs, duplicates, unsupported locale/limit, client account/rights/progress/URLs. Limit1..3 defaults3. Output is strict Zod DTO and precise canonical relative route; no content text, solutions, media, account ID or private progress-row IDs returned. Read errors yield `retryable_failure`; missing session yields `authentication_required`; malformed caller input `invalid_input`.

Canonical published metadata comes from authenticated `get_sitov_access_catalog` at exact level/trainer. Every candidate also calls S1 `currentUserHasContentAccess`. Vocabulary unit must match the manifest's existing UUID; duplicates, missing/draft/denied/ambiguous targets are omitted. Stored path UUIDs resolve via actual active level+trainer+path_source_id unit and source_id node, reject zero/multiple matches, then verify current map availability. The resolver never generates or substitutes Node IDs. Reading targets require same canonical unit and current S3 metadata; locked/draft entries are omitted. Available/failed reading tests are recommended without any path/vocabulary/verb evidence prerequisite. Passed individual tests yield review; open individual attempts yield continue.

Truthful existing evidence: current user's directional vocabulary boxes, existing vocabulary checkpoint, present-tense sitov_verb_progress and current path API status, S3 current per-text catalog. Vocabulary checkpoint `plan` contains **direction-progress UUIDs**, not vocabulary-card UUIDs; matched only against same account's fetched current card progress rows. Absent rows give null/empty evidence, never fabricated box/attempt counts. A read/schema failure never becomes zero. No evidence or commercial-rights writes. Unfinished persisted work sorts ahead of new practice/pretest, then saved completed review; no synthetic mastery or global percentage.

## Exact target ports still pending

The server generates frozen hrefs; destination consumption is not yet implemented by this unit. Do not show recommendations until verified focus behavior exists and destination reauthorizes each selected item.

| Owner | Required target behavior |
| --- | --- |
| M vocabulary | `/[locale]/dashboard/level/[level]/vocabulary/train?lesson=[canonical unit]&sitov_target=[card]`; resolve selected card within its actual lesson and current rights, use stored native-source locale for de UI, resume account state without overwriting the learning plan. |
| M verbs | `/.../verbs?sitov_target=[sitov-verb-ID]&tense=present`; validate real catalog/unit rights and supported present tense, focus that verb without copying progress or changing boxes. |
| S2 path, next explicit lease | `/.../path?sitov_target=[resolved nodeUUID]`; consume validated current map node, open exact authorized available node or safe localized invalid/unavailable state. Page/client changes were not allowed in epoch3. |
| S4 pronunciation | `/.../pronunciation?sitov_target=[readingUUID]`; focus existing individual catalog entry; available/failed goes to pretest, in-progress resumes, passed opens text; never bypass commercial or current-version test guard. |

S3 remediation links must use only compatible vocabulary/verbs/learning_path entries returned by the action/resolver; no manually guessed hrefs/IDs. Every destination/action must reauthorize stale links. Shared target ports and current de route guards remain outside this unit's changes.

## Validation

- `jest --runInBand __tests__/sitov-learning-recommendations.test.ts`: 17 PASS; mocked Supabase transport/current-user guard, actual Zod/DAL logic; action wrapper typechecked. Covers strict input/session/selected item privacy, wrong/duplicate scope, progress-read failure, all five locale routes, actual checkpoint direction ID, reading pretest without other evidence, level-qualified path/status and access-transport failure.
- `node --test supabase/tests/sitov-learning-recommendations.test.mjs`: 1 native PostgreSQL17 test PASS on newly created disposable own database, canonical normalized snapshot+90/91/92 overlays and assigned93. Exercises actual selected-item commercial catalog, canonical published unit, foreign-account RLS denial, saved directional box and disabled-unit omission. Fixture had initially attempted UPDATE before a commercial row existed; corrected isolated fixture INSERT, then passed. No production DB. This checks SQL adapter shape/permissions, **not end-to-end TypeScript/PostgREST/Auth HTTP**. Own database dropped in finally. No 01–92 historical replay claim.
- Repository `tsc --noEmit --incremental false --pretty false`: PASS after test type correction; no emitted files.
- Scoped ESLint new DAL/contract/action/Jest/native test: PASS.
- `git diff --check` + staged check: PASS before commit.

Browser/mobile/reduced-motion, destination query behavior, full live Auth/PostgREST, build and all-platform regression remain unverified. Native test uses synthetic content; no German audio proof or published-source readiness inferred. Existing import/data IDs and main progress unchanged. No schema migration in this unit; rollback is revert own recommendation commit. Source/local dependency SHAs and exact changed-file/content equality in epoch3-dependencies.json; only M assigned dependencies acquired, no active S1 epoch6 results.

Official Supabase getUser/select docs and changelog fetched; no new CLI/API/schema-version change introduced. Local Next16.3.8 server-actions guide read before action code. Dependency fixtures are from M's approved frozen sequence.
