# Sitov Academy — S1, Epoch 28: bounded native rights diagnosis

The first post-111 account timeout is isolated to the complete authenticated RLS `SELECT id FROM public.learning_units`: it reaches the server's eight-second statement timeout. The current data contains 1,280 units and 3,043 vocabulary cards. Each diagnostic phase runs in a native actual-account READ ONLY transaction with `SET LOCAL statement_timeout='8s'`, `lock_timeout='2s'`, and ROLLBACK; no signed HTTP/session/AAL claim is made.

Measured first-account phases (seconds include docker/psql overhead):

| Phase | Seconds | Result |
| --- | ---: | --- |
| Native identity | 0.084 | PASS |
| Owner-reference 50 level/trainer decisions | 0.188 | PASS; owner reference only |
| All 1,280 authenticated `unit_allowed` calls | 3.472 | PASS |
| `allowed_unit_ids()` | 2.029 | PASS |
| Complete authenticated RLS visible-unit list | 8.156 | Server statement timeout |
| All 960 authenticated `verb_allowed` calls | 5.694 | PASS |
| Ten verb-level decisions | 2.612 | PASS |
| Four real Storage target queries | 0.115 | PASS; query returned |
| Published media unit IDs | 0.101 | PASS |
| One vocabulary-unit visibility helper | 0.594 | PASS |
| One pronunciation-current-pass helper | 0.096 | PASS |
| Actual RLS membership for first 16 units | 2.067 | PASS |
| Actual RLS membership for one vocabulary unit | 2.565 | PASS |

The exact native RLS EXPLAIN uses four InitPlans for staff MFA, profile role, allowed unit IDs and published-media IDs. Its remaining per-row predicates include vocabulary-unit visibility and pronunciation current-pass visibility. EXPLAIN was executed without ANALYZE under the same eight-second bound. No unbounded plan execution, database setting, role, index, policy or function change occurred.

Actual function definitions establish that `vocabulary_unit_visible(uuid)` scans cards in a unit and invokes `item_allowed` per card. Each invocation resolves the same unit again and repeats actor/profile/ownership, publication, VIP, purchase and legacy-grant checks before its item-specific trial check. The measurements and source identify this as a concrete optimization candidate; they do not prove that it is the only cost in all users' RLS queries.

## Proposed new migration 112 — review only, not implemented

Replace only the body of `sitov_access_private.vocabulary_unit_visible(uuid)` with a set-based equivalent of its vocabulary-card `item_allowed` path: resolve the unit/profile/trainer grant once, retain `EXISTS` of a real card, retain actor/ownership/publication/level/trainer guards, and evaluate shared teacher/VIP/purchase/legacy authorization once. Only the partial-trial branch must enumerate the real cards and invoke `trial_item_allowed` with each stored card ID. The vocabulary-card resolver always marks `legacy_media=false`; no video/presentation shortcut belongs in this helper.

The following is a review draft body, not executable migration work performed in this lease:

```sql
SELECT sitov_access_private.actor_allowed(auth.uid()) AND EXISTS (
 SELECT 1 FROM public.learning_units u
 JOIN public.profiles p ON p.id=auth.uid()
 LEFT JOIN public.learning_trainer_grants g
  ON g.auth_user_id=p.id AND g.level=u.level AND g.trainer::text=u.trainer::text
 WHERE u.id=p_unit
 AND EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
 AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=p.id)
 AND (p.role IN('teacher','admin') OR (p.role='student'
  AND (u.is_active OR u.owner_auth_user_id=p.id)
  AND u.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
  AND NOT(u.trainer='verbs' AND u.level IN('C1.1','C1.2'))
  AND (
   EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=p.id AND s.vip_enabled)
   OR sitov_access_private.purchased(p.id,u.level)
   OR (EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.auth_user_id=p.id AND l.level=u.level)
    AND coalesce(g.enabled,true)
    AND (u.owner_auth_user_id=p.id OR g.unit_mode IS DISTINCT FROM 'selected'
     OR EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=p.id
      AND x.level=u.level AND x.trainer::text=u.trainer::text AND x.unit_id=u.id)))
   OR (u.owner_auth_user_id IS NULL AND EXISTS(
    SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id
    AND sitov_access_private.trial_item_allowed(p.id,'vocabulary_card',c.id::text,u.id,u.level,u.trainer::text)))
  )))
)
```

A new M lease is required before implementation. Preserve owner, ACL, SECURITY DEFINER, STABLE and empty search_path; do not reorder or broaden policies. Before accepting 112, compare the old helper's actual boolean against the candidate for all 75 actual actors and all 1,280 units, and add meaningful counterexamples for empty units, foreign owners, teacher/admin MFA, disabled/selected grants, paid-confirmed purchases, VIP and partial item trials. Do not infer item-trial rights from `unit_allowed`, and do not report untested synthetic scenarios as actual production evidence.

The first actual account's complete 50 owner-reference decisions, all 1,280 authenticated unit booleans, all 960 verb booleans and ten verb-level booleans equal its SHA-verified before receipt. However, `allowed_unit_ids()` changes from 24 to 164 actual IDs: **140 added, zero removed**. The exact ID delta is retained privately. This is an observed rights/list behavior change requiring source and authorization review; it is not accepted as harmless merely because individual unit booleans match.

Seven successful authenticated RLS chunks cover actual target indices 0–207, **208 genuine membership decisions**. Six of those seven chunks differ from their before visibility set; indices 112–143 match. All chunks and their exact targets/results have independent SHA receipts. The full RLS list still timed out, so **0/75 complete account comparisons** are claimed. Future work resumes the first account at RLS target index 208 and retains the completed phases; it must classify the allowed-ID/RLS changes before asserting preservation or release readiness. Do not manufacture a full list from owner decisions or individual helper results.

All final checks finished at **19:59:42 UTC**, before the hard 20:00:08 UTC boundary: qualified original-185-column hash `cfeb746a211c54255d8c4d519f92efe05637482f3f2ca34194f894ce32ef8814`, full shared QA188 hash `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`, unchanged canonical-96 bucket privacy exception, all five runtime container constraints, three HTTP 200 responses, no current OOM, **zero active owned-clone queries**, and 2,473 MiB available memory. No late ordinary processing was needed. The final QA gate that remained incomplete in epoch 27 is now complete.

Private evidence contains 100 files, including exact bounded statements, actual phase results, the server-timeout stderr, non-ANALYZE plans, source definitions, before75 manifest verification, partial comparisons, original185/QA188 hashes and final health. `epoch28-private-artifact-manifest.json` and `epoch28-resume-ledger.json` record hashes and cursor state.

Private phase query/result/error receipts and an atomic phase cursor permit resuming exact successful chunks without re-executing them. The 75 epoch-24 receipt SHA values and current actual-account metadata were verified equal; the private source manifest remains `ae3e7ea4eb907bd6d76c1bcf7a8b47f15825007828db8b90246695b6ada9ab01`. Existing Storage ERROR rows are not boolean visibility baselines. No production/shared-QA write, migration replay, deployment, publication or payment enablement occurred.
