# S2 epoch10 · Sitov Academy inactive first Special author port

NOT RELEASE_READY. CREATE-only source-bound draft API, no staff UI, approval, source activation, publication, prepared-audio proof minting, runtime deployment or real database mutation. New branch codex/sitov-night-s2-author101 at exact assigned52169f502336025ec4cb27759a613d042a76204e; original S2 branch preserved. Allocation101 /20261009005000_sitov_special_authoring.sql; migration/VPS bytes equal. CLI migration new created file first, renamed to M's unique allocated timestamp. Existing frozen v1 contracts unchanged.

The migration registers only the exact inactive source descriptor for sitov.source.a11.wohnung.artikel.pdf.v1, SHA d59dd2bb1f019e6f9945347e69320245a18881ac53769de9a6a7328a38a8d507, A1.1 PDF/Obsidian evidence URI. This descriptor is not an editorial approval. ON CONFLICT preserves existing source metadata; changed trusted SHA/level/evidence URI fails closed. Exact101 DDL retry uses IF NOT EXISTS/OR REPLACE/DROP TRIGGER IF EXISTS; native applies101 twice before authoring and again after persisted draft/receipt, proving exact replay response and immutable history remain unchanged. The bounded source route requires actual active path unit A1.1/P4 and active practice anchor P4-N1 with P4-G1. M's independent live READONLY evidence identifies unit f72f211a-9d44-41a2-af18-87976effe62d and anchor9f92ad82-cb5c-40cf-86d3-87b17b75c5bb. The bounded context also requires these two actual verified UUIDs and an unowned shared unit; another unit with copied P4 source names cannot bind this source. No existing Special node ID is invented. Each request receives freshly authenticated cookie identity, current DB staff role and the existing actual staff MFA policy. Admin AAL1 denies; verified TOTP/AAL2 permits. Teacher password-only policy from91 remains unchanged.

The DB generates the new node and definition UUIDs, append order and95 canonical definitionVersion itself. Node is_active=false. Twenty or more supplied supported MC/gap/sentence snapshots, exact source evidence, five explanations, goal/IDs, unique task bodies/IDs/source refs and two-balanced-form capacity are validated. Exercises use their stable sitov task IDs as unique learning_exercises.source_ref (the existing unit/source_ref unique index requires individual refs); the source PDF reference/SHA and individual source evidence are retained in immutable private authored_drafts. Exercise path_is_active=true/content_status=ready are95 private snapshot prerequisites, while the enclosing node stays inactive. Stored private snapshots come from actual path_private.snapshot, not client-reported reconstructed DB objects. Definition published=false, editorial_proof=NULL, audio_import_proof=NULL; no activation row. No old path seed reimport or UPDATE of old units/nodes/exercises/answers/progress/streaks.

CREATE-only means existing Special source IDs return already_exists. This unit does not implement editing/version replacement/history migration. Immutable95 definitions and append-only author receipt/audit rows remain retained. A future explicitly assigned edit port must preserve previous definitions/runs and task identities. Source-semantic review remains separate: page/span checks and trusted SHA are authoring evidence, not proof that arbitrary new authored text has received independent review.

## Exact ports for M shared types

Add these two entries only to supabase/sitov-night.types.ts; returns use the existing Json type. That shared file is deliberately untouched here. Until M updates it the DAL uses a narrowly typed bound RPC bridge (no any, service_role or dynamic endpoint).

```ts
sitov_special_author_context: {
 Args: { p_unit_id: string; p_anchor_id: string; p_source_ref: string }
 Returns: Json
}
sitov_special_author_create: {
 Args: { p_input: Json }
 Returns: Json
}
```

Context action getSitovLearningSpecialAuthorContext takes strict {unitId,anchorNodeId,sourceRef}; success data {unitId,anchorNodeId,sourceRef,sourceSha256,anchorVersion,specialExists}. READONLY native context succeeds and takes no row locks. Only the bounded known source/P4/P4-N1/G1 binding returns data.

Create action createSitovLearningSpecialDraft takes strict {requestId,unitId,anchorNodeId,sourceRef,sourceSha256,expectedAnchorVersion,specialSourceId,title,topic,goalId,blueprint,items}. items contain only {id,stableId,stratum,snapshot,sourceEvidence}; snapshot is exact95 {id,type,content,goal_id,translations}. Use buildInactiveSpecialAuthorInput(draft,context.data,requestUUID) from scripts/sitov-learning-specials-authoring.mjs after fresh context; it preserves new authored item UUIDs and supplies no Special node/definition ID or publication fields. It does not call any API or write any DB.

Create success data {nodeId,unitId,anchorNodeId,definitionId,definitionVersion,sourceRef,sourceSha256,itemIds,active:false,published:false}. DAL checks every parent/source/item identity and exact item order. No author/reviewer/client account override accepted. Failures {ok:false,error,retryable} use authentication_required,invalid_input,not_found,source_conflict,stale_revision,request_conflict,already_exists,item_conflict,retryable_failure; retryable=true only for retryable_failure. Transport/invalid server payload fails closed as retryable; same exact requestID/payload can retry after uncertain response, never silently replace it.

Actor/request advisory lock plus parent unit/anchor/source/profile locks serialize writes. Current role/MFA is checked again after waiting. Source SHA and DB-generated anchorVersion compare under those locks, before receipt reuse. Exact same actor/request/payload returns persisted receipt; changed payload conflicts. Competing new requests on the same unit/source create exactly one node; loser returns already_exists. Receipt reuse rechecks current identity/role/MFA/source/base; changed source/anchor or revoked role cannot reuse an old receipt.

## Validation

- Native PostgreSQL17 socket-only synthetic database: pinned baseline92 + actual93 + actual95 +101. One comprehensive protocol PASS: anonymous execute denied, student/forged JWT/current revoked role denied, actual Admin AAL1 deny/TOTP AAL2 allow, wrong anchor/source/actual changed anchor CAS/duplicates/invalid answer/missing source page/injected publication rejected; READONLY context passes; two actual parallel authenticated sessions yield one draft + one already_exists; exact retry equality/payload conflict; DB95 fingerprint equality20/no proofs/no activation; immutable/publication trigger enforcement; inactive node invisible to learner; private audit table inaccessible; existing rights/history/streak/storage unchanged. Own fresh database dropped in finally.
- Jest11 PASS across author8 + prior staff diagnostic3. Session/input validation, exact RPC payload, actual draft/schema/identity, SQL failures, malformed/foreign/active/reordered acknowledgements, transport retry covered.
- Offline author tests23 PASS including unchanged-source/real schema/source evidence and fresh-context request generation; native +offline node test total24 PASS.
- Full npx tsc --noEmit PASS; scoped ESLint zero warnings PASS; git diff checks PASS; migration/VPS byte equality checked.

No full current93–101 integrated fixture, Auth/PostgREST HTTP, Storage or browser/mobile proof claimed. Those are M/S5 integration gates. No audio synthesis/import ran in this unit; M reported all80 offline assets verified but not imported. All80 aliases/import/word timing and actual independent editorial review plus95 publication proof remain prerequisites. Initial source task draft still explicitly UNBOUND_DRAFT in its source seed; this API only binds it when a real authorized request is executed. No such real request ran here. Other A1.1/A1.2 pools remain pending.

Security review: private tables RLS enabled and no anon/authenticated grants; append-only audit; privileged helper execution revoked; only named public RPCs authenticated, each auth.uid/current DBrole/MFA guard, empty search_path and qualified objects, no user_metadata authority. No advisors against real/QA DB requested or run. Additive migration removing its new API/tables/descriptor before use is sufficient; after actual draft creation, retain immutable history and use an explicit reviewed rollback rather than delete learner-owned data. WAIT for fresh START after own commit/handoff.

M-Integration: Die echte gemeinsame RPC-Typmap ist erweitert; temporäre RPC-Brücken sind entfernt. Special-Snapshot-Inhalte werden zusätzlich als JSON validiert, bevor die bestehenden fachlichen Inhaltsschemas prüfen. M:8 native PASS/0skip,13 Jest PASS, vollständiges TypeScript und gezieltes ESLint PASS. Keine tatsächliche QA-HTTP-Publikation ist hiermit behauptet.
