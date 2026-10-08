# Sitov Academy – S3 epoch 6

Authoritative target submission retries now lock the exact owned target ticket and return the existing own submission ID. New submissions bind their generated ID to the consumed ticket atomically; the foreign key is deferred to transaction commit because the BEFORE INSERT trigger records the binding before the row exists. Old consumed tickets without this binding require one exact own audio/prompt/path match; ambiguous matches fail closed. Replies and arbitrary/foreign paths cannot be used as target tickets. Historical retry returns an ID only, including after rights or text version changes.

The trigger locks ticket, stored source text and definition before final ticket/current-pass validation. Successful submissions preserve the exact text snapshot. Direct insertion consumes the same ticket once. API roles have no submissions INSERT grant; native owner-with-learner-claims tests exercise the trigger separately.

## Validation

- Native PostgreSQL 17 full current92 + assigned latest93 +94: 10 tests, no skips. Includes two independently passed texts rejecting cross-text ticket use, two real concurrent psql submission clients returning one ID/one row, retry after commercial revocation and content edit, changed definition denying previously uploaded ticket, expiry, foreign caller, separate reply tickets, historical snapshots, and direct trigger use.
- A real text editor transaction holds the text row lock while a concurrent submission executes; the submission is denied after the changed version commits. Definition replacement and rights revocation tests are serial; simultaneous definition/revoke contention is not yet proven. Commercial revocation is checked at authorization time; no general grant-row serialization claim.
- Complete original selected-account history snapshot (checkpoint revision 7, old readiness/access rows, progress, submissions, messages and storage) remains byte-for-byte equal.
- DAL + public DTO Jest: 33 tests/2 suites. Focused three-root TypeScript project passes. No source changes to DAL/UI/shared types this epoch. Canonical94 and VPS94 mirror; migration replay and rollback API denial preserve data.

## Legacy endpoint and UI audit

Current94 replaces `sitov_pronunciation_private.text_allowed` with exact current pass plus separate commercial authorization; `can_record` requires an unconsumed current target or owned-conversation reply ticket. Reading RLS, target creation, submission trigger and storage INSERT use these predicates. Hard/global evidence does not authorize these paths. Old `sitov_get_pronunciation_readiness` / `sitov_set_pronunciation_access` and their historical evidence tables still exist; their old `ready` metadata must not be rendered as current permission. The following consumers remain in this pinned worker checkout, while S4 is actively implementing replacement UI:

- `app/[lang]/dashboard/level/[level]/pronunciation/page.tsx:9,19,25` loads and passes readiness.
- `components/audio/PronunciationStudio.tsx:25,63,166–169,197,242` renders readiness card and locked readings.
- `app/actions/sitov-pronunciation-access.ts:11,20` exposes legacy metadata/set-mode actions.
- `lib/sitov-pronunciation-readiness-server.ts:12` calls old RPC. Preserve its separate title-only historic conversation helper.

M owns the generic audio resolver/Gateway; this worker did not import unassigned shared-audio commits. Baseline generic audio bypass observations cannot establish the current integration Gateway status. HTTP/Auth/PostgREST/Storage object bytes and browser tests remain unverified here.

Rollback94 freezes storage INSERT and pretest APIs but does not revoke the old `create_pronunciation_submission` RPC. Already-uploaded unconsumed valid tickets can still create submissions through its SECURITY DEFINER path after rollback; coordinated rollback must explicitly freeze that RPC/trigger while preserving history. This remaining rollback gap is reported for a fresh assignment, not presented as production-safe rollback.

## Limits

No reviewed real per-text question pools, published definitions, audio preparation/import or full inventory coverage were added. Synthetic pools prove protocol/security only. Optional remediation links and authoring/publication enforcement remain pending. RELEASE_READY=false. Commit handoff then WAIT; no next phase without fresh START.
