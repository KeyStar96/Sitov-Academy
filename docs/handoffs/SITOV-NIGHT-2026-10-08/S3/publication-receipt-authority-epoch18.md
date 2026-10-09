# Sitov Academy · START18 · publication receipt authority105

105 closes the102 early changed-payload receipt return against current role/MFA revocation committed while publication waits on its per-actor/request advisory lock. A revoked caller receives not_found; an authorized changed-payload caller retains request_conflict. No publication API, current-proof acknowledgement, source/latest/current-active CAS, historical version or review/audio policy changes.

## Narrow additive implementation

New `20261009013000_sitov_pretest_publication_authority.sql` and VPS105 mirror are byte-identical. Apply after100/102/103; M owns central canonical integration. An exact guarded pg_get_functiondef replacement modifies only the `FOUND AND saved IS DISTINCT FROM payload` return branch of private `staff_publication(boolean,uuid,uuid,text,text,uuid,uuid)`:

```sql
IF FOUND AND saved IS DISTINCT FROM payload THEN
 IF NOT sitov_pronunciation_private.sitov_lock_draft_staff_authority()
 THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 RETURN sitov_pronunciation_private.pretest_error('request_conflict');
END IF;
```

The existing103 helper takes FOR SHARE on the actual actor profile and factor rows, then freshly reevaluates the existing current role/MFA policy. It remains inaccessible to direct PUBLIC/anon/authenticated/service EXECUTE; no new helper/grant/public RPC/type is introduced.105 verifies that dependency exists and checks the exact old body anchor. Replay detects the patched branch. Function OID, owner, ACL, security-definer flag, volatility and empty search_path are proven unchanged.

This authority lock happens **after** the request advisory wait and receipt lookup, only for the early conflict return. Fresh publication and exact receipt requests retain102's later profile/factor locks and fresh check **after acquiring the source lock**. They do not acquire the helper lock early, so a role revocation during their source wait can still win and be rejected. Proof/storage SHARE locks, immutable definitions, atomic activation/rollback, current-active acknowledgement after later replacement and source/proof rechecks are unchanged.

## Native evidence

`node --test supabase/tests/sitov-pretest-publication-authority.test.mjs`: **9 PASS / 0 failures / 0 skips**. Isolated temporary PostgreSQL17 database installs checksum-verified immutable integrated96, existing97–100/102/103, then105 (replayed); old historical migration files are unchanged. Full102 publication test path is retained in the new suite.

- Actual separately spawned process holds the existing teacher receipt advisory key; the changed-payload publication blocks, another operation commits teacher role revocation, then the caller returns not_found. Full definitions/active flags/receipt/attempt/pass/shared-history snapshots stay equal.
- Actual admin changed-payload receipt waits on the held advisory key while verified TOTP becomes unverified and commits. AAL2 alone cannot retain authority: reply is not_found and all snapshots remain equal. Restored current authority yields request_conflict for changed input and the exact truthful current acknowledgement for identical input; AAL1 remains denied.
- An actual identical teacher receipt waits on the source lock while role revocation commits. It still returns not_found without changing state, demonstrating that105 did not move exact-retry authorization locks before that source wait.
- Existing102 teacher/admin/student/anon/service denial, strict source/latest/current-active CAS, foreign association, current READ ONLY readiness, missing independent review/reference/prompt/fragment/option/timings, actual concurrent one-winner publication and identical retries, wrong-audio/source/role rechecks, Storage/source lock timeouts, late exception atomic rollback, later-publication old-receipt invalidation, immutable historical content/attempts/passes/history and no automatic pass transfer all remain covered with105 installed.

Fixtures provision synthetic imported metadata and private proof rows through isolated owner setup; this is not an actual generated-audio-byte, HTTP, QA or production import claim. Initial own test fixture needed explicit owner context before the following admin setup; that fixture error was corrected before the final passing run. No failure remains.

## Handoff scope

Exactly new105 SQL/VPS, this new native suite and S3 handoff are changed. No historical102/103 edits, TS/type/UI/pool/source/audio alias changes, new dependency picks, runtime/container, QA or production mutation, audio synthesis/import or proof minting by the API. No human approval gate is introduced. Repository coverage stays 6/60 private authored source drafts,54 pending; no production publication. M reviews/integrates canonical105; S3 commits and waits for a fresh START. Diff check passes; no TypeScript change or new project-wide TS claim is needed.
