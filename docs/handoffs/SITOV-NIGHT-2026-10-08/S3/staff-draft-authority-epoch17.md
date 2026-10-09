# Sitov Academy · START17 · additive draft authority103

103 closes100 draft saves and receipt replies against a current role/MFA revocation committed while the caller waits on a request, source, profile or factor lock. It preserves100 stable receipt, source hash, latest-any-definition CAS, inactive immutable new version and existing active/history semantics. Historical100/102 files and TypeScript/API contracts are unchanged.

## Implementation and integration

New canonical migration `20261009011000_sitov_staff_draft_authority.sql` and VPS103 mirror are byte-identical. Install after100 (and normal97–102 integration). New private `sitov_lock_draft_staff_authority()` takes FOR SHARE on the actual actor profile and their actual MFA factor rows, then reevaluates the existing current staff/MFA predicate. It is SECURITY DEFINER, VOLATILE, empty search_path, with EXECUTE revoked from PUBLIC, anon, authenticated and service_role; only the already checked owner-executed draft function calls it.

A narrowly guarded pg_get_functiondef replacement inserts this check in precisely two100 locations:

1. After the request advisory lock and receipt lookup, inside the receipt-found branch **before both payload-conflict and exact-reply return**.
2. After acquiring the source FOR UPDATE and verifying its existence, **before source-version, latest-definition CAS and insert** for a new draft.

These separate locations matter: locking the profile before a new save waits on its source would block a revocation until after the save. Current authority must be rechecked once that wait ends. The profile/factor SHARE locks then retain the authorization through any subsequent definition wait, insert/receipt reply and transaction end. The existing early staff check still hides unauthorized source/receipt data.

The existing private save_draft OID, owner, EXECUTE ACL, security-definer flag, volatility and search_path are proven unchanged. The migration checks exact old-body anchors and fails on an unexpected contract; replay detects the already patched function. No function-map change or new public RPC is needed. M owns central canonical schema application/integration; S3 edits no central snapshot/types.

An exact receipt remains stable after a later source/base change when current staff authority is valid. Changed payload remains request_conflict for valid staff. After current role/factor revocation, both exact and changed receipt requests return not_found. No new draft/receipt is created by denied requests. Source and latest-any-definition CAS, raw German wording, authoring validation, test hashes and inactive outputs remain the original100 behavior. Existing102 readonly readiness and publication proof/locking behavior are preserved. No review, audio, source or publication proof is minted by103.

## Actual native evidence

`node --test supabase/tests/sitov-staff-draft-authority.test.mjs`: **12 PASS, 0 failures, 0 skips**, isolated temporary PostgreSQL17 database on the dedicated socket-only local instance. The checksum-verified immutable integrated96 fixture receives existing97–100, new103 (replayed), and unchanged102. Source authoring is loaded from the real repository pool; audio metadata/proof setup is explicitly synthetic, not an audio-byte/import claim.

- Teacher password-only, student/anon/service/private helper/DML denial; admin required verified TOTP+AAL2 under the existing MFA policy. JWT role/app_metadata/user_metadata declarations cannot replace the stored role; AAL2 without a verified factor and AAL1 with a verified factor fail.
- Actual independent processes hold source/request locks; the caller blocks, another committed operation revokes the teacher role or admin TOTP. New save, exact receipt and changed-payload receipt all return not_found after the wait. Definitions/receipt counts remain identical.
- Actual profile-row and factor-row update locks hold uncommitted revocation; the caller initially sees the old grant, waits for the row, then rereads the committed revocation and denies.
- Actual successful new-save and existing-receipt transactions hold profile and factor SHARE locks through a subsequent pg_sleep; concurrent profile UPDATE and factor DELETE hit lock_timeout. Those test transactions roll back, leaving counts/history unchanged.
- Original100 raw-source/foreign/span/key/base errors, null-base first save, distinct-request concurrent one-winner CAS, same-request concurrent stable receipt and stable exact reply after source change remain correct with103 installed.
- Unchanged102 readiness succeeds in READ ONLY with ready:false for an unapproved draft; publication denies it without changing the old active. Existing active content, attempts, passes, original current student pass and shared history remain exactly equal; new drafts stay immutable and inactive.

Separate unchanged regression suites: `sitov-pretest-staff-drafts.test.mjs` **6 PASS**, `sitov-pretest-staff-publication.test.mjs` **7 PASS**, zero skips. Those retain their own frozen install paths; the new suite above supplies the actual combined103/102 coverage. No TypeScript changes or new project-wide TS claim are needed for this SQL/native-only unit. Diff check passes.

## Scope and handoff

Only new103 SQL/VPS, new native suite and this S3 handoff are changed. No dependency picks, resets, branch/base change during START, UI, pools, audio aliases, runtime/container, QA, production, historical SQL, shared schema or type edits. No paid API or synthesis. Repo authoring coverage remains 6/60 private drafts, 54 pending; no production publication. No mandatory human gate was introduced. Commit and atomic S3 status go to M for review/integration, then WAIT for a fresh START.
