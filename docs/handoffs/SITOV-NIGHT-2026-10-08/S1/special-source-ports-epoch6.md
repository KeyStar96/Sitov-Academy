# S1 epoch 6: canonical Specials and limited source ports

Status: DRAFT_PARTIALLY_ENFORCED. No deployment, production DB writes, backfill, UI, new audio or authored publication.

Assigned frozen Specials contract source `0fa5a5cf386ed1afb9a7a5bcab4377a24a340180` cherry-picked as `65252c2`; prior own source `97bfa7e9bda47827691fec555ffd718ef665da62` retained, no duplicate M integration cherry-pick.

Added `path_special` and `path_special_item` to strict TS/SQL catalog/ref validation and canonical server metadata mapping. Special nodes require a same-unit anchor and active node/unit; tasks require a same-unit parent Special, active path task and generated ready content status. An exact node grant does not authorize sibling task kinds/IDs. Existing path_node/path_task semantics remain unchanged.

Ported existing private verb level/item predicates and media folder/published-video/exact-storage-path predicates to independent VIP/purchase/trial sources. Existing public verb selection and answer RPCs already check the exact verb predicate before writes and before receipt replay; their bodies are unchanged. Uploaded video trial folder access supplies navigation metadata only; each actual video/presentation/path has an exact predicate. Student writes remain denied. Presentation SELECT now has a restrictive exact-item policy. Rollback captures/restores all five additional original private predicates.

Actual current92 evidence corrects the shorthand lease wording: uploaded-media/presentation legacy access ignores unit selection but respects disabled videos trainer. Native disabled uploaded row is absent both before and after. Both SQL and pure TS predicate now preserve that exact behavior; enabled videos with selected empty units still retains level-only uploaded media. VIP/purchase remain independent sources.

Validation: native current92+93 nine tests pass; slice eight tests pass; Jest fourteen tests pass; tsc exit0; ESLint exit0 with the same three existing unused catch-binding warnings; migration/VPS copies equal and diff checks pass. Native Special fixtures deliberately disable author/FK triggers only while inserting synthetic malformed rows, then restore origin before assertions; no content is published. Native tests prove malformed/inactive Special denial, exact task sibling isolation, permitted verb selection and sibling/revoked denial, exact uploaded media RLS and path read/write scope, legacy grants/own privacy/history/replay/guarded rollback.

Remaining gates: actual verb scoring/receipt replay regression and full private storage HTTP delivery; presentation/VIP/purchase port matrices; selected-item path/vocabulary scoring remain closed until exact RPC porting; S2 Special runtime/pedagogy; teacher dashboard; shared source locale/routes/UI; M private audio/S3 per-text pass and tickets; combined93/94+, browser, concurrent real connections and final all-account release proof. No RELEASE_READY claim.
