# Sitov Academy · START16 · safe staff publication102

This unit reads readiness and publishes only an existing latest inactive definition with pre-existing independent private review and actual complete imported audio proofs. It cannot create definitions, mint reviews/audio/source proofs, change German wording or accept a client approval switch. Proof provisioning remains a separately controlled import operation. No human approval requirement was added: independent author/reviewer identities are existing policy; native fixture transparently labels S3 vs M agent identities and synthetic metadata.

## API and exact M-owned shared map

Readiness input is strictly `{textId, definitionId, textVersion, testVersion, baseActiveDefinitionId: uuid | null}`. Publication adds `requestId: uuid`. Versions are exact source raw SHA and database JSONB definition SHA. Foreign/missing definition fails `not_found`; stale source/latest definition/current active CAS fails `version_conflict`. The nullable base denotes no current active version, not permission to replace an unexpected version.

Exports in `app/actions/sitov-pronunciation-pretest.ts`: `getSitovPronunciationPretestPublication(input)` and `publishSitovPronunciationPretest(input)`. Cookie DAL equivalents are `loadSitovPronunciationPretestPublicationServer` and `publishSitovPronunciationPretestServer`. Normal verified requestSession/getUser identity is used; no service client. Strict result validation verifies all source/definition/version identities and expected current active identity. No student response carries authoring keys, source/audio URLs or proof details.

M must append exactly these entries to **`supabase/sitov-night.types.ts` → `SitovPronunciationPretestFunctions`**, using its existing `Json` import. This is the actual function map, not a newly invented backend Database type:

```ts
sitov_get_pronunciation_pretest_publication: {
  Args: { p_text_id: string; p_definition_id: string; p_text_version: string;
    p_test_version: string; p_base_active_definition_id: string | null }
  Returns: Json
}
sitov_publish_pronunciation_pretest: {
  Args: { p_text_id: string; p_definition_id: string; p_text_version: string;
    p_test_version: string; p_base_active_definition_id: string | null; p_request_id: string }
  Returns: Json
}
```

The DAL temporarily casts each single literal RPC signature with exact named args and unknown result, then validates the strict envelope. M can replace these bridges with normal client.rpc after integrating the shared map. S3 edited no shared types/canonical snapshot.

Readiness result: `ActionResult<{definitionId,textId,textVersion,testVersion,activeDefinitionId:uuid|null,ready:boolean}>`. Incomplete private review/audio yields `ready:false`. Publish result: `ActionResult<{definitionId,textId,textVersion,testVersion,activeDefinitionId:definitionId,active:true}>`; incomplete proof yields `authoring_not_ready`. Existing symbolic v1 error vocabulary is retained.

## Atomicity and current acknowledgement

102 canonical migration/VPS mirror are byte-identical and replayable. Private receipt table is RLS-protected with zero direct public/authenticated/service privileges. Public invoker wrappers grant authenticated EXECUTE only; private entry rechecks auth.uid/current staff for every operation including receipt retries. Teacher password-only and current admin verified TOTP+AAL2 use the existing predicate. After acquiring the source lock, publication locks the current actor profile and factor rows FOR SHARE and rechecks staff/MFA; another check precedes mutation/receipt acknowledgement. Actual concurrent role revocation while the publisher waits on a source lock returns not_found and preserves the predecessor.

Fresh publication locks the actual source row and relevant definition/current-active rows, checks exact source hash, latest definition and expected active predecessor, and checks complete immutable proof. Existing99 supplies plain metadata SELECT in READ ONLY readiness; publication retains FOR SHARE locks on imported Storage objects through transaction commit. Previous active is cleared and the proven existing inactive definition activated in one transaction; trigger remains an independent publication guard. Any exception rolls back the whole function's changes. No attempt, pass, recording, learning-right or history row is touched. Old immutable definition remains stored, with its original pool/hash; old passes remain historical and do not transfer to the new version.

Actor/request advisory serialization plus private exact payload receipt makes retries stable while the published definition is still active with the same current source and valid proofs. A newer inactive draft alone does not falsify the active acknowledgement. Later publication or changed source yields `version_conflict`, invalidated audio yields `authoring_not_ready`, revoked role/MFA yields `not_found`; an old receipt never silently reactivates a replaced definition. Same request with different input yields `request_conflict`. Fresh different-request calls cannot publish an already active version.

This narrow operation requires an existing valid prepared male Qwen reference plus every public prompt/fragment/option Qwen asset and exact timing proofs, as assigned. Existing human recordings remain untouched and their existing history/reference mechanisms are unchanged; this API does not mint or repurpose their proof.

## Evidence and remaining integration

- Native PostgreSQL17 publication test: **7 PASS / 0 skipped** on checksum-verified immutable integrated96 plus existing97–100 and new102 in an isolated temporary database. True independently-proven inactive→active replacement; missing review/reference/prompt/fragment/option/timings and wrong voice; stale source/base/latest and foreign association; student/anonymous/service/private DML denial; direct private null-mode rejection; read-only readiness; actual two-process concurrent different-request one winner; concurrent same-receipt retries; current source/audio/staff rechecks; admin AAL1 denial/AAL2 success and revoked-AAL retry; later publication invalidates old receipt; immutable old content/attempts/passes/history and no pass transfer. Actual open publication transaction blocks competing source and Storage updates by lock timeout. An isolated fixture activation trigger forces a late exception after predecessor deactivation; the predecessor stays active and no receipt is written, proving whole-function rollback.
- Jest publication+draft+existing DAL: **3 suites / 14 PASS**. Client proof/approval/identity injection rejected before RPC, verified cookie identity, exact args, false readiness, strict current active acknowledgement and symbolic errors.
- Targeted ESLint four changed TypeScript files: PASS. Diff check: PASS. Full project `tsc --noEmit --incremental false`: PASS with the documented temporary literal RPC bridges. Native100 draft regression: 6 PASS / 0 skipped.
- Native fixtures seed synthetic imported metadata and proof rows through isolated owner setup to exercise real guards; this is **not** a claim of actual generated audio bytes, production or HTTP validation.

M owns canonical schema/type integration and QA runtime review. S3 did not edit pools, audio aliases, central schema/types, UI, containers, QA or production and did not cherry-pick new dependencies. Repo authoring coverage remains 6/60 private drafts, 54 pending; this patch publishes nothing in production. M separately reported QA three additional fully imported inactive definitions/266 assets; S3 did not modify or independently validate that QA state. Wait for a fresh START after commit/handoff.

M-Integration: Die echte gemeinsame RPC-Typmap ist erweitert; temporäre RPC-Brücken sind entfernt. Special-Snapshot-Inhalte werden zusätzlich als JSON validiert, bevor die bestehenden fachlichen Inhaltsschemas prüfen. M:8 native PASS/0skip,13 Jest PASS, vollständiges TypeScript und gezieltes ESLint PASS. Keine tatsächliche QA-HTTP-Publikation ist hiermit behauptet.
