# Sitov Academy · S3 START15 · immutable staff draft save

The authenticated cookie DAL and Server Action save a new inactive, source-bound private definition. They never activate a test or write approvals, audio imports, attempts, passes, or historical student data. New authoring contract uses existing German wording unchanged. Interface consumers receive existing symbolic error codes.

## API and required shared typing (M-owned)

`saveSitovPronunciationPretestDraft(input)` / `saveSitovPronunciationPretestDraftServer(input)` accept exactly `{ textId, textVersion, baseDefinitionId: null | uuid, definition, requestId }`. `textVersion` is SHA256 of actual raw `learning_reading_texts.sentence_de`. `baseDefinitionId` is the latest definition for the source, including inactive drafts; null is valid only without any definition.

Append this public RPC entry to the existing `Database.public.Functions` in `lib/types/backend.ts`, importing/using the existing `Json` type:

```ts
sitov_save_pronunciation_pretest_draft: {
  Args: {
    p_text_id: string
    p_text_version: string
    p_base_definition_id: string | null
    p_definition: Json
    p_request_id: string
  }
  Returns: Json
}
```

No shared type was edited under S3 lease. The DAL temporarily casts only this literal function signature, with exact named arguments and unknown result, before strict Zod result validation. M can remove that bridge after integrating the shared RPC entry. This handoff makes no full-project TypeScript claim.

Successful output uses the existing private `staffDefinition` transport shape: `{ ok: true, data: { id, text_id, text_version, test_version, definition, active: false, created_at } }`. The old staff-read shape remains compatible. Output must match the submitted source and definition; injected active flags, identity, approval or publishing fields are rejected. No student DTO gains answer keys.

## Database guarantees

100 migration and VPS mirror are byte-identical and replayable. Authenticated staff only: teachers retain password-only access; admins require current verified TOTP and AAL2 through the existing staff predicate. Anonymous and service-role EXECUTE and all authenticated direct private DML are revoked.

Source row lock serializes changes/saves; latest-definition CAS prevents overwrite. `valid_authoring` verifies actual source spans, private keys, balance, mapping and source-specific prerequisites. Additional strict key whitelist rejects hidden approval/activation fields even through direct RPC. Immutable new definition computes the database JSONB test hash and remains inactive. Existing publication guard still requires independent review plus reference and all question audio proofs.

Private receipts bind actual actor, request ID, source version, base and full definition. A per-actor/request advisory lock yields one stable acknowledgement for concurrent identical retries. Exact retries return the original receipt even after subsequent source/base changes, after a fresh staff check. Changed payload with the same request yields `request_conflict`; other stale source/base requests yield `version_conflict`. An already-existing definition hash is rejected, never reactivated or reused as a newly saved draft.

## Validation and limits

- Native PostgreSQL17 test: 6 PASS, zero skips, isolated temporary database installed from checksum-verified immutable integrated96 fixture plus owned97–100. Covers teacher/admin/student/anonymous/service permissions, missing-source and null-base first draft, real source/span/key validation, stale CAS, two actual concurrent processes, same-request receipts, changed-source replay, immutable inactive draft, preserved active definition/attempt/pass/history and original student pass.
- Jest author contract plus existing pretest server: 2 suites, 9 PASS. Covers real authored input, identity/activation injection, cookie identity, exact RPC args, private output matching and error preservation.
- Targeted ESLint: PASS for author contract, DAL, action and author tests.
- No HTTP/UI claim, production write, deployment, publication, new content, audio synthesis/import, shared schema/type edit or QA container change. Native audio metadata is synthetic proof fixture data, not evidence of generated audio bytes.

Content coverage remains 6 private drafts of 60 active repository source texts, 54 pending; no production publication. Independent quality review and actual locally prepared male Qwen audio proof remain required before publication. This API does not introduce a separate mandatory human approval requirement. M owns central canonical schema/types and integration. S3 waits for a fresh START after this unit.
