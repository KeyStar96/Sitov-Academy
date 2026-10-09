# S5 epoch17 · Current App/DAL108 recommendation browser gate

Result: **FAIL / exact destination not reached** on frozen App `ba0042bca830fc1cbd91c2f968c1048d5a067a00`, Next 3143, isolated QA through108. No product, schema, runtime or source changes.

Normal visible RU login used exactly one own disposable example.invalid learner with A1.1 level access. A genuine terminal FAIL for the original current first text was prepared through GoTrue and actual PostgREST start/submit RPCs; valid wrong answers were derived only from that own attempt. No progress prerequisites or synthetic mainpath completion were inserted. Private credentials and actor/attempt IDs remained in the own private ledger, then were removed after successful cleanup.

## Findings

1. Opening the exact pronunciation text with an existing failed attempt immediately starts a new retake instead of displaying the stored result. The browser showed task1/12; final own-state inspection confirms two failed attempts. Source supports this: `SitovPronunciationPretest.tsx:63` automatically clicks the start action, while `:160` resumes only in_progress and starts otherwise. The required stored failed-result resume proof is therefore absent. An explicit Retry remains visible.
2. To test the actual app completion path as well, all12 visible tasks were answered through native UI controls (first visible option), with11 save/continue operations and the real final submit. The actual response eventually displayed **7/12, not passed**, with **zero recommendation links**. Visible DOM contained only the ordinary level navigation; none had an exact sitov_target recommendation href. Screenshot and JSON document the state. Thus nonempty authorized learningLinks, actual link click, exact UUID landing and landing action are **not proven**. No ordinary navigation link was substituted. The underlying cause of empty suggestions is unresolved; no claim that SQL108 or the resolver alone is defective.

The submit briefly remained in “Сохранение …” before producing the actual failed result. Two Next development issue badges were visible but not opened or attributed. No console diagnosis is claimed.

RU outer document language and visible German titles with lang=de/translate=no were verified. No second locale or microphone test was run in this lease. Prior five-locale tests and raw107 tests remain separate evidence.

## Runtime and cleanup

Fresh exact scope/image/network/caps gate passed: 960MiB/2CPU (320/128/256/64/192), MemAvailable2767.73MiB before actor work, three health200, noOOM. Maintenance threshold1984 was used; initial empty-namespace3072 creation guard was unchanged. Final gateway peak121552896 bytes, OOM/kill/max counters0. This is a bounded serial browser check, not durability/load proof.

Normal UI logout was confirmed at `/ru/login?status=logout_success`. Own auth fixture deleted through the exact ledger-bound admin API only; original2M actors retained. Before/after counts and profile/definition/asset hashes match exactly:18definitions/5active/1682proofs/1089assets,0attempts/passes/submissions. Own vocabulary/verb/path progress and level/trainer/unit rights hashes did not change during browser work. No uploads were created.

## Evidence and reproduction

- `e2e/sitov-night-real-transport/epoch17-browser-evidence.json`: current visible links/language, UI FAIL7/12, no destination click, logout.
- `e2e/sitov-night-real-transport/epoch17-runtime-cleanup-evidence.json`: three exact scope/health/cgroup observations, own2FAIL/0PASS before deletion, baseline hashes.
- `e2e/sitov-night-real-transport/epoch17-failed-result.png`: actual result.

Reproduction requires M-owned isolated QA108 and frozen app; never use production keys. One own learner with currentA1.1 rights; actual start/submit wrong answers; normal form login; open exact first pronunciation text. Observe automatic retake, complete its12UI tasks, observe failed result and absent learning nav. The SSH wrapper reused reviewed epoch16 helper functions with Mac-supplied108proof/bindings and exact own cleanup; no raw10728-case rerun or standalone runner is claimed.

M/S2 follow-up: expose stored failed result without automatic retake, and diagnose why this genuine UI FAIL yields no authorized suggestions before retrying visible exact-destination proof. Later live commercial-rights comparison remains a mandatory separate release gate. S5 WAIT; no release approval.
