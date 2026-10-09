# S2 · Epoch 17 · Special recommendation repair blocked by learner metadata port

Group: `SITOV-NIGHT-2026-10-08`. Assigned branch: `codex/sitov-night-s2-special-recommendation-repair`. Verified clean starting HEAD: `efe6a54f7f3c5ff583cf13c9beb33063b35f47e1`. Lease: 2026-10-09 08:16:42–08:24:42 UTC. Outcome: documentation-only handoff; recommendation repair remains incomplete. No release acceptance.

## Concrete blocker

The required exact source-to-runtime-ID binding cannot be established through the existing authenticated learner ports inspected at this HEAD:

- `supabase/vps/35_path_learning.sql:409–420` enables RLS on `public.path_nodes`, grants authenticated SELECT, and creates `path_staff_read` guarded by `business_private.is_staff()`. The separate own-row read policy is only created for progress/runs/attempts/interventions, not nodes. `supabase/schema.sql:11178` contains the staff-only node SELECT policy. Searching the later VPS migrations found no learner node SELECT policy replacing this boundary.
- `lib/learning/sitov-learning-recommendations-server.ts:52` currently resolves node source IDs by querying `path_nodes` with the cookie client. `lib/learning/sitov-learning-recommendations-path-server.ts:12` uses the same table to map available node UUIDs back to topics. Under the inspected learner policy, these queries cannot expose the source metadata needed for exact binding. This also warrants M reviewing the existing ordinary-path recommendation/topic flow.
- `supabase/vps/45_path_test_review.sql:17–33`, the inspected `get_learning_path` implementation, exposes each parent path's `source_id` and each node's runtime ID, kind, availability, status and anchor UUID. It does not expose node `source_id` or `goals`. `lib/learning-path-contract.ts:32–41` also omits anchor metadata from its parsed node DTO. A title, sort order or the mere presence of a Special is insufficient evidence of its identity.
- `supabase/vps/93_sitov_commercial_access.sql:321–341` returns catalog items with kind, runtime ID, label, publication flag and parent unit. It does not expose the Special or anchor source IDs/goals. Its `path_special` rights remain necessary but cannot establish the requested source binding alone.
- The authoring binding in `supabase/vps/101_sitov_special_authoring.sql:34–42,116–119` is exact: A1.1/P4, practice anchor P4-N1 with P4-G1, and Special source `sitov-special-a11-artikel-nominativ-v1`. The staff target index is a staff-authorized operation and cannot substitute for a learner metadata port.

These are repository source findings, not a new runtime RLS/HTTP proof. No database was queried in this unit. Existing mocked positive table reads do not validate the actual learner RLS boundary.

## Required interface before implementation

M must allocate and review an authenticated, read-only port that resolves stored source identity into the actual runtime unit/node IDs. A narrow source-to-target RPC or an explicitly reviewed existing RPC metadata extension can provide this without exposing raw task rows or solutions. It must enforce the exact level/path/source/kind and same-unit anchor/source/goal binding; preserve current publication, anchor availability and commercial authorization; reject ambiguous/foreign/inactive/revoked targets; and distinguish omission from transport failure. No static runtime UUID, privileged-client workaround or broad learner table policy is proposed.

After that port exists, a fresh bounded S2 START can add the internal Nominativ Special target and tests. It must still cross-check actual catalog `path_special`, `currentUserHasContentAccess`, and the current exact available map node/unit/level; use the existing `learning_path` result and locale path with `sitov_target`; preserve continue priority and limit 3; and derive progress only from stored map state. No Special operation may write during recommendation resolution. No added pronunciation prerequisite.

## Changes and verification

Only this handoff document changed. No application code, mapping, tests, SQL, public contract, schema, content, audio, publication state or progress changed. Migration/rollback: none; the documentation commit is independently reversible.

Source inspection and clean starting branch/HEAD verification completed. `git diff --check` is the sole executable verification for this documentation change. Jest and lint were not run because no code was changed and the blocked interface would only be simulated by mocks. No build, native DB, QA, HTTP, browser, TTS, publishing or production operation ran. Existing test results are not claimed as new evidence.

M was notified of this blocker through the authorized coordination chat. S2 returns to WAIT after its own commit and atomic status update; no lease extension or next unit is inferred.
