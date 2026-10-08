# S2 epoch4: private Special runtime proposal

NOT RELEASE_READY. This unit delivers a tested private engine on an empty unpublished authoring base. No learner/teacher UI, navigation, active seed, new German utterance, audio synthesis/import or deployment. Full source coverage, actual audio-import validation and publication authoring are still missing.

New assigned dependency d101eeee7478dff255b1c6ce9efa2a03df97d660 cherry-picked as62eee86 (exact SHA/equality in S2.json). Existing own mapping45c5 and recommendation3bb preserved. No unassigned feature integration.

## SQL core

95 migration/VPS identical. Private immutable definitions contain exact existing Special-node/item UUIDs, source ref, version, blueprint and full stored private path snapshots; insert trigger verifies every pool item belongs to the Special, snapshot equals actual stored exercise, no duplicate IDs, blueprint positive quotas, active pool>=20 and >=twice each quota. Immutable content versions and separate activation pointer preserve history; source snapshot change/current activation mismatch fails closed with version conflict. Runs and receipts are account-bound private RLS-enabled tables with zero authenticated direct DML/reads.

Every operation checks current session, reset write lock, actual Special/node/unit publication, active completed anchor, S1 `path_special` and each `path_special_item`. Denied/missing targets return not_found. The runtime never writes main path progress, stars, points, vocabulary/verb boxes, pronunciation proof or streaks.

Learning persists exact queue, intentional reveal, right removes current item, wrong appends it, empty queue completes as self-assessed learning only. Reveal/right/wrong require CAS revision and request receipt; duplicate request returns original persisted response, changed payload conflicts. Resume returns same queue. Test uses exact10 eligible IDs, private per-stratum blueprint, >=20 allowed items, excludes immediately previous completed10, no Pro limit. Insufficient authorized pool/quota returns typed `scope_insufficient_for_test` while selected learning stays usable. Answers are validated by existing typed `path_private.grade`, saved incrementally, only submitted complete10 graded server-side. 7 fails,8 passes. Solutions returned only after deliberate learning reveal or completed test; task DTO strips keys before grading. Rechecks rights/current source before receipt return and every get/save/grade.

A staff diagnostic backend proposal `sitov_special_staff_catalog` explicitly requires S1 role+current staff MFA and exposes private definition/results only to staff. Students receive not_found. No student/account parameter is accepted by learner RPC/action. Read/create/edit author UI is not implemented.

**Publication gap:** there is deliberately no public definition-create/publish RPC. Private definitions default unpublished. Privileged inserted active definitions require non-null editorial/audio proof fields, but those JSON proofs are **not yet verified against actual Qwen/storage/word timing records**. M must supply and test audited authoring/import activation adapter before any real definition activation. Synthetic native test directly inserts private owner fixture proofs; this is not a publication proof. Therefore95 must not be described as complete publication enforcement or full commercial product readiness. New source formats beyond current MC/gap/sentence DTO also need implementation/editorial approval; no generic-card substitution has occurred.

## Proposed signatures for M freeze

Learner RPC `sitov_special_operation(p_operation text,p_node_id uuid DEFAULT NULL,p_run_id uuid DEFAULT NULL,p_mode text DEFAULT NULL,p_revision integer DEFAULT NULL,p_request_id uuid DEFAULT NULL,p_answers jsonb DEFAULT NULL,p_locale text DEFAULT 'de') RETURNS jsonb`. Allowed operations start/get/reveal/right/wrong/save/submit. Start needs node/mode/request; get needs run; every mutation needs run/revision/request; save/submit answers keyed by selected item UUID. Session identity only.

Staff RPC `sitov_special_staff_catalog(p_node_id uuid) RETURNS jsonb` is a separate proposed staff-only diagnostic port; learner DTO intentionally does not parse staff/private definition bodies.

Action `runSitovLearningSpecial(input:unknown)` delegates to server-only `performSitovSpecialOperation`. Strict Zod input/response in `lib/learning/sitov-learning-specials-contract.ts`. Public run fields: runId/nodeId/definitionVersion/mode/status/revision/selected/queue/revealed/own answers/keyless tasks/learningSolution|null/result|null. LearningSolution only reveal, result only completed test; result correct/total10/passed/feedback. Separate machine errors are untranslated data; UI translations and helpful retry/empty states pending. Server authentication and parsed SQL response; transport/schema exceptions return retryable_failure, no client score or access assertion.

M-owned `supabase/database.types.ts` proposed Functions additions (do not expose private tables):

```ts
sitov_special_operation: {
 Args: { p_operation: string; p_node_id?: string; p_run_id?: string; p_mode?: string;
   p_revision?: number; p_request_id?: string; p_answers?: Json; p_locale?: string };
 Returns: Json
}
sitov_special_staff_catalog: { Args: { p_node_id: string }; Returns: Json }
```

Local narrow typed RPC cast keeps shared types untouched until M freezes. Client binding should await M signature review. Requires next separately allocated source/editorial/data/audio/publication unit and UI/mobile/accessibility verification. Shared schema snapshot/migration runner registration belongs to M; this lease changes only assigned95 files.

## Evidence and limits

Native isolated PostgreSQL17 canonical normalized snapshot+90/91/92 overlays+assigned93+95:1 test PASS. Covers anchor closed/open, hidden keys before reveal/grade, right before reveal rejection, exact wrong-to-end and right-removal, reload queue, CAS failure, duplicate reveal/save/submit receipts, incomplete submit, balanced4/3/3 with two disjoint10 forms,7fail8pass, no extra main path progress, private-key/direct read denial, cross-account denial, selected singleton learning without siblings, insufficient test scope, empty-stack truthful learning completion, rollback preserving rows and disabling API. Only synthetic owner test definitions; no real content/Audio/PostgREST/AuthHTTP/browser proof. Each own disposable fixture database removed in finally. Initial fixture generated-column assignment and SQL trigger variable ambiguity were repaired before successful test; no production DB touched.

Jest2 contract tests PASS: caller account/score/publication injection and missing CAS identity rejected; self-assessed completion cannot become test passage; unrevealed solution rejected. Repository tsc PASS, scoped ESLint PASS. VPS/migration cmp PASS. Native SQL invokes actual grade/RLS/S1 commercial predicates, not mocked scoring. No parallel-tab race stress, UI/deep-link/e2e, source editorial audit, full-platform regression or build claimed.

Rollback95 revokes learner/private dispatcher and staff RPC only; keeps definitions, activation, runs and receipts recoverable. Apply again to re-enable reviewed API. Definition activation/version lifecycle and full staff authoring permission tests require further review. Empty production definitions yield authoring_not_ready and no new source publication. Feature remains draft.
