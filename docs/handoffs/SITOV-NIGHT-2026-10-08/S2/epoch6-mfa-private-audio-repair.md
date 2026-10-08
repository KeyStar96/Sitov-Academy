# S2 epoch6: MFA expectation and private96 compatibility repair

NOT RELEASE_READY. Repair-only unit; no content, UI, audio generation/import, production activation or deployment. Own b438d96 retained. Only assigned new dependency275ca4be88ffee4ce934059c96c86c98a2adb28d acquired while paused; full source/local SHA, changed-file list and content equality recorded atomically in S2.json. No shared files edited.

## Changes

The immutable audited baseline92 includes the final teacher-password-only policy (schema lines21684ff, superseding earlier80): teachers have sitov_mfa_required forced false; only configured admins require MFA. Epoch5's teacher-AAL1-denial assertion was incorrect, not evidence of a security regression. The native test now proves actual authenticated teacher AAL1 succeeds despite an attempted true MFA flag, then temporarily promotes the same synthetic profile to protected admin with verified TOTP: AAL1 fails closed and AAL2 succeeds. The fixture restores the teacher role afterward. No product MFA policy, fixture baseline, helper or S1 function changed.

95 definition_ready still calls the exact real prepared-German-audio validator before comparing evidence. It accepts only the two exact helper reference formats for the same canonical audio_cache/sitov-qwen-v1/de/<64-lowercase-hex>.mp3 object: the old relative public reference and the new storage:// reference. It derives the object key from the trusted helper return, compares the evidence path against only those two exact strings, then rechecks the same stored audioSha256 and non-archived/non-delete-marker object. Missing metadata now explicitly fails closed. Arbitrary domains, bucket names, query strings, traversal and different objects are not normalized or authorized. Stored old proofs remain immutable and valid after96; no legacy proof, authored ID or asset is rewritten.

Public transport, publication fingerprint/editorial/source/audio requirements, grants/RLS and rollback remain unchanged. 95 must be reviewed with actual96 by M; this unit does not change96.

## Confirmed evidence

- `node --test supabase/tests/sitov-learning-specials.test.mjs`: PASS1 complete native PostgreSQL17 scenario on pinned audited baseline92 + actual assigned93 + own95 + actual96. Disposable database dropped in finally.
- A valid95 definition, learning run and receipt are created before96. After actual96: bucket private; helper yields canonical storage://; stored legacy audio proof unchanged; an equivalent exact private proof validates; arbitrary domain/query/foreign-bucket/traversal evidence fails; existing get and receipt replay succeed. Authenticated direct audio_cache object SELECT is empty.
- Effective trainer/unit rights for every synthetic baseline account compare exactly before/after96. Stored history snapshot for the existing selected fixture account (vocabulary progress, checkpoints, pronunciation access, activity days/sessions, submissions, messages and historical recording object) remains exactly equal as a JSON snapshot through the scenario and95 rollback. This is a synthetic fixture proof, not the required live deployment comparison.
- Archived audio object blocks current operation and receipt replay; changed audio digest blocks get; restoring the object restores replay. Revoked review and inactive trusted source reject current operations, including old receipt replay where exercised.
- All previous native learning/queue/reveal/self-assessment/resume/CAS/idempotence/10-items/4-3-3 balance/disjoint consecutive forms/7-fail/8-pass/private-data/anchor/selected-item-only/empty completion/no-main-progress/rollback assertions complete and pass under96.
- Actual authenticated teacher AAL1 allowed; protected admin AAL1 denied; verified-TOTP admin AAL2 diagnostic access allowed. No MFA baseline policy edits.
- Exact VPS95/migration95 `cmp` and working/staged `git diff --check`: PASS. No TypeScript files changed; no new TypeScript/Jest/build/browser run in this repair unit. Epoch5's6 Jest/scoped ESLint/repository typecheck evidence stays historical, not a new claim.

## Limits and next owner

The Storage prerequisite adapter still explicitly adds archived_at/is_delete_marker to the synthetic fixture; M/S5 must reconcile actual Storage schema. Metadata, digests and word timings in this test are synthetic; there are no real Qwen bytes, imports or Storage/Auth/PostgREST HTTP proofs. No real source registry, approval, pool, asset or activation is seeded. Source coverage, remaining exercise formats, authoring UI, learner UI/five languages/mobile/accessibility/Motion, concurrent-tab stress and full-platform/build/browser QA remain open. The corrected native MFA test closes the epoch5 test-expectation blocker only. M reviews/integrates the repair. WAIT for fresh START.

Rollback95 continues to revoke public API dispatch/diagnostic while retaining private source/review/definition/run/receipt data. No new rollback change needed. No production DB touched.
