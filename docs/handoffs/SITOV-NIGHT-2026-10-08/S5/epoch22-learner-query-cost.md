# Sitov Academy — S5 epoch22 learner query cost

Assigned source `76a667693f92c8c06a214da44c443ab724d9f8f2`; existing isolated QA108. Backend-only, no browser/Next acceptance and no source freeze required. One new ledger-bound disposable learner with existing reviewed Auth/password flow and full A1.1 fixture grant; no existing account adopted and no learning progression or pretest created.

Exactly one authenticated HTTP call for each permitted RPC (last active level, new items A1.1) and one catalog GET each unfiltered/filteredA1.1 with the same select(id,unit_id,level), ordered id and range0–499. Each HTTP measurement has a14s client bound, no retry; public evidence contains status/SQLSTATE/elapsed/count/hash/keys/explicit success booleans only.

Three SQL expressions, each once JITon and once JIToff, in BEGIN READ ONLY with SET LOCAL ROLE authenticated and the same private own ledger UID/JWT subject. Transaction-local statement_timeout8s and JIT only; client14s. Own UID/current role/student-profile/read-only/timeout/JIT proof is captured as booleans/settings, never an identifier. No RLS bypass, forced row security, global JIT change, timeout increase, arbitrary query, or EXPLAIN.

Elapsed values include client/transport/process overhead. Single sequential on/off measurements do not isolate cache/order effects or establish JIT causation. Original M staff measurements are a separate provenance and are not substituted for learner results. Filtered HTTP and SQL catalog expressions use the same columns/order/page cap, enabling result-hash comparison.

| HTTP operation | Elapsed s | Status | Rows | success |
| --- | ---: | ---: | ---: | --- |
| get_last_active_level | 3.62 | 200 | n/a | field absent |
| get_learning_new_items_A1.1 | 0.028 | 200 | n/a | True |
| verb_catalog_unfiltered_range_0_499 | 3.4762 | 200 | 140 | field absent |
| verb_catalog_A1.1_range_0_499 | 0.5965 | 200 | 140 | field absent |

| Own authenticated student SQL | JIT on s | JIT off s | Same result as HTTP |
| --- | ---: | ---: | --- |
| get_last_active_level | 3.1137 | 3.3298 | yes |
| get_learning_new_items_A1.1 | 0.1046 | 0.0951 | yes |
| verb_catalog_A1.1_range_0_499 | 0.5771 | 0.5395 | yes |

All four HTTP and six SQL observations completed without exposed SQLSTATE errors. New-items success=true is now explicitly retained. Last-active response has level/levels/mode/source keys and no success/ok flag. Catalog responses are arrays with no envelope flag. Unfiltered and filtered HTTP results are both140rows with identical SHA256; the student's RLS result must not be substituted by the960row staff result. Filtering was faster in this single sequential comparison. All three SQL on/off pairs and their corresponding HTTP results have identical hashes. JIT-off did not show a material improvement here; causation and sustained latency are unproven. Older application cancellations/UK/TR UI failures are not resolved by these backend-only observations.

Execution: reviewed private own-scope Python driver sent over SSH stdin to QA, successful exit0, followed by exact own-ledger cleanup driver exit0. Public JSON preserves timestamps/settings/counts/hashes, not raw payloads. Runner remains private; no reusable standalone test runner is claimed. Saved JSON operation-count, role/UID/timeout/read-only, hash-equality, cleanup, privacy and whitespace checks passed. No full-suite/build/TypeScript rerun.


Exact own-account cleanup completed11:07:12.979196UTC. No browser logout performed because the unit used no browser. Own captured state remained0attempts/0FAIL/0PASS with complete own-state/progression/rights fingerprints unchanged. Global before/after counts and hashes are identical:2 original users,18definitions/5active,1089assets,1682proofs,0attempts/passes/submissions. Existing-runtime scope/images/private-network/caps, memory≥1984MiB, three health200/noOOM gates passed before fixture and before/after cleanup. Local and remote private ledgers reduced to cleaned summaries. No container/runtime mutation.

Lease11:03:35.817760–11:12:35.817760UTC. Diagnostic measurements ended11:06:14Z; cleanup and final commit/atomic WAIT completed early, without extension. Dropping this QA evidence commit reverses repo changes; disposable fixture is already removed.

No browser login/logout was performed or required. No UI success, deployment or RELEASE_READY claim. Existing broader UK/TR failure and later live commercial-rights comparison remain unresolved gates. No product/API/schema/content/audio/publication changes; only disposable fixture setup/cleanup and QA evidence. M integrates/pushes/deploys.
