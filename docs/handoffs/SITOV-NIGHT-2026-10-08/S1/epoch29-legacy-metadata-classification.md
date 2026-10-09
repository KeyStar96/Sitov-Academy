# Sitov Academy — S1, Epoch 29: actual legacy metadata classification and 112 proposal

The 140 added IDs are confirmed from the actual owned-clone unit rows: **140 active, unowned `verbs` units, all A1.1; zero removals**. These are metadata-list additions, not evidence of a change in the first account's individual unit/verb booleans. In the 208 already measured actual RLS targets, **25 IDs became visible, zero became hidden, and all 25 belong to those 140 verb IDs**. The clone has zero pronunciation-pretest pass rows, so none of these observed additions is attributed to a newly passed pretest.

The authoritative source is the clone's **24 actual `sitov_access_private.guard_backups` rows**, not a guess from repository history. Its backed-up `learning_private.allowed_unit_ids()` explicitly limits the shared student-unit branch to vocabulary/exercises/pronunciation/videos. Its backed-up trainer guard delegates verbs separately to `sitov_verb_private.level_allowed`, and the backed-up single-unit guard delegates to that trainer guard. Consequently, a legacy learner can have true verb-unit booleans while the older generic metadata list intentionally omits verb units. Migration 93 replaced the metadata list with all units satisfying the commercial single-unit predicate; equating these two distinct sets caused the observed expansion.

The original metadata body also gates legacy students with `ui_language <> 'de'`. Actual profiles are 73 students (64 ru, three tr, three en, three uk) and two de teachers; **zero actual de students**. The native result therefore cannot prove behavior for hypothetical de students. The proposal retains that exact predicate in the legacy branch and leaves teacher/own-unit/active/selected-grant rules as stored. No interface-language or exam-content change is proposed.

## Exact proposed 112 bodies — review only

`epoch29-allowed-unit-ids-candidate.sql` contains the complete SELECT body. Its `legacy` CTE is copied from the actual backed-up body, including its four-trainer whitelist, language condition, private-owner handling, selected-unit logic and inactive-own-unit behavior. It preserves the original legacy array, then appends only distinct newly authorized IDs absent from that array. It does **not** call the current `legacy_unit_allowed` or use the current single-unit predicate as a shortcut for legacy metadata.

A materialized commercial CTE resolves the current actor once and admits only students authorized by `actor_allowed`. It resolves VIP and exact active, paid, provider-confirmed purchase levels once. Expanded units retain the current commercial ownership, active-or-own, ten-level and C1-verb exclusion rules. Full-unit trial admission copies migration 93's exact level/trainer/unit/bucket rules. Commercially authorized verb metadata remains available through new VIP/purchase/full-unit-trial rights; pure legacy verb authorization alone cannot enter this appended set.

`epoch29-vocabulary-unit-visible-candidate.sql` preserves the epoch-28 source-backed set-based optimization proposal: resolve a real unit/profile/trainer grant once, require a real card, factor common authorization outside the per-card resolver, and retain the exact per-card trial check. This body was **not executed or installed** in this lease. Combine it with the metadata repair only after M reviews sources and authorizes a new implementation lease. No migration 112 file, function, policy, index, setting or ACL was changed here.

| Case | Required candidate behavior | Evidence in this lease |
| --- | --- | --- |
| Pure legacy learner | Exact original metadata list; no added verb IDs | Actual 75-list comparison |
| Legacy selected/disabled grants, private owner, teacher | Exact backed-up legacy CASE and joins remain | Actual source plus 75 lists; no invented cases |
| Legacy student with de UI | Preserve original metadata predicate | Source analysis; zero such actual students |
| VIP or active paid/provider-confirmed purchase | Append current commercial full-unit metadata, subject to ownership/publication/level guards | Source equivalence only; no such actual rows |
| Pending/canceled/unverified/inactive purchase | Cannot create new commercial metadata | Exact paid/verified/active predicate; not live-positive-tested |
| Full-unit trial | Exact stored level/trainer/unit and null-refs bucket admission | Source equivalence only; zero actual trial rules |
| Partial item trial | Does not become a blanket full-unit/scoring grant; existing per-item vocabulary metadata policy remains | Source analysis only; zero actual trial rules |
| Individually passed pronunciation text | Existing pretest-specific unit policy and current-pass helper remain unchanged; no additional paid gate | Actual function/policy source; zero current pass rows |
| Foreign private unit / empty vocabulary unit | Preserve foreign-owner denial and actual-card existence | Source analysis; dedicated counterexamples remain required |

## Bounded SELECT validation and final gates

The exact allowed-ID SELECT body (SHA-256 `5d360dbd32ef4b1c1b67ad5489c8c5eee025bf0004bb357b137043e7864eabcf`) was evaluated in 75 separate native-claim READ ONLY transactions, each with server `statement_timeout='8s'` and rollback. Every candidate list, sorted with multiplicity retained, equals its SHA-verified epoch-24 before list: **75/75 match, maximum 0.146583 seconds**. This is **owner-reference SELECT evidence for a proposed SECURITY DEFINER body**, not an installed authenticated function or HTTP/session/AAL test. The actual new-entitlement shape is zero VIP students, zero trial rules and zero active paid verified purchases; positive commercial branches remain untested against real populated data.

All 100 epoch-28 private artifact hashes were verified before work. Current full QA188 precheck passes. Final original-column preservation of the 185 old tables retains hash `cfeb746a211c54255d8c4d519f92efe05637482f3f2ca34194f894ce32ef8814`, with only the previously accepted canonical-96 bucket privacy exception. Final full QA188 remains `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1` at 20:09:46 UTC. Final runtime verification after evidence classification at **20:10:27 UTC** verifies all five container constraints, three HTTP 200s, no current OOM and zero active owned-clone queries, before the hard 20:11:14 UTC boundary. Final measured available memory is 2,467 MiB. Ordinary work stopped at 20:10:27 UTC.

Private evidence contains 245 files with the actual backups, actual 140-unit classification, 208-RLS delta classification, new-entitlement shape, exact candidate SQL/claim queries, 75 result/receipt hashes, cursor, original185/QA188 snapshots and health. Files are 0600 in existing 0700 directories; the manifest and resume ledger retain exact hashes.

The after-rights matrix is still **0/75 complete accounts**: candidate list equality does not substitute for installed-function, complete actual RLS, content, Storage or release gates. M must review the source/candidate cases before authorizing implementation, then verify all protected function metadata/ACLs, actual new entitlement/counterexample semantics, native Storage and all-account rights. No production/shared-QA write, migration replay, deployment, publication or payment enablement occurred.
