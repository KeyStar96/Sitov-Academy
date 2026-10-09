# Sitov Academy — S1, Epoch 31: teacher verb expansion and proposed 113

No database mutation occurred. M's full-after75 readonly driver and exclusive clone write freeze remained intact. All S1 statements used application name `sitov_S1_epoch31`, READ ONLY transactions, server statement timeout eight seconds and rollback.

## Actual source and both teachers

The actual original `guard_backups` show that `sitov_verb_private.level_allowed(uuid,text)` places this whitelist **outside** its teacher/admin branch: A1.1, A1.2, A2.1, A2.2, B1.1, B1.2, B2.1, B2.2. The old trainer guard delegates verb units to it. The old single-unit guard therefore admits only those canonical verb-unit levels for teachers. The old verb guard additionally requires a real catalog-to-unit link, active unit, `u.level=c.level` and trainer `verbs`.

Current migration-93 `legacy_unit_allowed` places its staff shortcut before level constraints. Current `item_allowed` similarly admits staff before student-only publication/level/trainer guards, and `resolve_item('verb',...)` returns the linked unit's metadata without enforcing catalog/unit level equality. The current verb wrapper delegates to this broader item predicate. This is a learning-data permission expansion; new authoring capabilities do not by themselves authorize it.

| Actual teacher index | Unit booleans before → current | Verb booleans before → current | Added / removed |
| --- | --- | --- | --- |
| 7 | 905 → 1279 | 586 → 960 | 374 / 0 in each matrix |
| 73 | 904 → 1278 | 586 → 960 | 374 / 0 in each matrix |

For both teachers every added unit/verb is classified from the actual catalogs: **187 with the exact stored level label `B2`, 187 with `C1`**. These are not canonical `B2.1` or `B2.2`. No label normalization, content rewrite, grant backfill or ID change is proposed. Original before receipts were SHA-verified; M's original failed index-7 evidence remains preserved and independently hashed.

## Precise proposed new 113 — not installed

`epoch31-legacy-unit-allowed-candidate.sql` changes only the staff arm of `sitov_access_private.legacy_unit_allowed(uuid,uuid)`: staff can retain the existing non-verb-unit behavior, while a verb unit must have one of the exact eight old canonical levels. Do not add active/catalog requirements here: the original teacher single-unit guard permits inactive canonical units independently of the stricter verb-item guard.

`epoch31-item-allowed-candidate.sql` changes only the staff arm for **kind `verb`**. It requires the original eight-level cap, a published/active verb unit, trainer `verbs` and the exact catalog ID/unit/level match. All non-verb kinds and the complete student branch remain textually unchanged. The existing actor predicate remains outside this arm, preserving current staff/MFA enforcement rather than copying an old bypass. The current verb wrapper can remain unchanged because it delegates to this repaired item predicate.

Canonical B2.1/B2.2 learning remains allowed as before. Raw B2, raw C1 and canonical C1.1/C1.2 verb learning remain outside the old staff cap. Student legacy/VIP/paid/trial branches, pretest reading-text authorization, vocabulary optimization 112 and the exact metadata list 112 are unchanged. Separate `staff()` and authoring entry points are not modified. Actual callers of the item/verb guards were saved privately for M to review before accepting any authoring impact; no blanket claim of authoring coverage is made.

## Bounded candidate evidence

Owner-reference SELECTs project the proposed staff predicates over all 1,280 actual units and 960 actual verbs for **both teachers**. Each full result exactly equals that teacher's original SHA-verified before matrix, with query times 0.164–0.206 seconds. Two actual representative students' current, unchanged unit/verb paths also equal their complete before matrices; query times 2.820–7.116 seconds. No query exceeded the eight-second server bound.

These are selected-account, source-backed predicate results. The full proposed bodies have not been installed, the entire 75-account matrix is owned by M, and there is no new HTTP/session/AAL proof. Future implementation must verify the exact bodies, owner/ACL/config/policy invariants and counterexamples for canonical/noncanonical levels, inactive units, catalog-level mismatches, student commercial/trial paths and current admin MFA. Do not accept a staff-all shortcut or remove current actor/MFA enforcement.

Final runtime checks completed at **20:43:36 UTC**, before the 20:44:43 work boundary: all five container constraints, three HTTP 200 responses, no current OOM, **2,487 MiB** available memory and zero active **S1-named** statements. M's other readonly statements were expected and neither canceled nor required to be zero. Full185/QA188 snapshots were intentionally not duplicated, as instructed by M. Ordinary work stopped at that time.

Seventeen private remote artifacts plus local bounded-query runners and a SHA manifest preserve original/current sources, catalogs, both actual teacher deltas, candidate results, M007 evidence hashes, actual callers and health. All remain in existing 0700 directories with 0600 files. No production/shared-QA write, schema/function/policy/ACL/index/resource change, deployment or detached S1 job occurred. Release readiness remains false; M must review and authorize implementation of proposed 113.
