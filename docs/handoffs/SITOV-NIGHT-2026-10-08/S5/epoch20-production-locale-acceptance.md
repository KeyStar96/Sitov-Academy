# Sitov Academy — S5 epoch20 built QA acceptance

Result: FAIL_GATE / NOT_RELEASE_READY. Tested product source `5d665d1cd9598523f2e9df89acc6bcedef732af1` through M-owned built production Next on port3143, QA108. No product fixes or runtime changes by S5.

| Actual 390px learner flow | DE | UK | TR |
| --- | --- | --- | --- |
| Persisted real 0/12 FAIL, localized result, two authorized learning links | PASS | PASS | PASS |
| Visible heißen recommendation click reaches exact target/present URL | PASS | PASS | PASS |
| Selected heißen card and unchecked Add, no automatic add or retake | PASS | FAIL: generic loader error | FAIL: generic loader error |

Normal visible login and profile language changes DE→UK→TR used one own disposable learner. German content titles retained lang=de/translate=no; outer language matched each selected locale. Help Return/Space toggles retained focus in each locale; this is a bounded keyboard observation, not a full accessibility audit. DE selected card bottom737.82 and Add bottom696.56 were above sticky navigation top760.81 after actual scroll and keyboard focus. No Add action or new retake was taken.

UK displayed “Не вдалося. Спробуй ще раз.” and TR displayed “Bir sorun oluştu. Lütfen tekrar dene.” after actual recommendation clicks. Both had no selected card or Add control. The page renders this localized generic alert when loadSitovVerbTrainer returns state.error; the underlying reason is unresolved. The observed locale sequence does not prove a locale-specific cause. Browser error/warning logs were empty; absence of production overlays does not establish absence of server errors.

Exactly one authenticated own-learner HTTP call per approved diagnostic: get_learning_new_items(A1.1) returned200 with keys items/lessons/level/success; get_last_active_level() returned200 with keys level/levels/mode/source. Neither captured response exposed code/error/message/details/hint. The first response success boolean was not separately retained. These transport observations do not resolve the older browser RPC errors or establish semantic success of the first envelope.

RU/EN were not rerun against current5d. Their prior epoch19 source072 evidence remains separate. No current all-five-locale PASS, microphone, reduced-motion, full accessibility matrix, build, TypeScript, or full test-suite claim by S5. M's build/test results are external provenance only. Later live comparison of existing commercial rights remains mandatory.

Normal visible Turkish logout confirmed logout_success. Exact own-account cleanup completed at10:39:13UTC before the10:41:01 lease deadline. Own state remained1attempt/1FAIL/0PASS; complete own-state fingerprint and navigation/progression/rights were unchanged. Global before/after snapshots and hashes are identical:2 original users,18definitions/5active,1089assets,1682proofs,0attempts/passes/submissions. Fresh existing-runtime maintenance gates before fixture and cleanup confirmed memory≥1984MiB, exact960MiB/2CPU caps, no OOM, and three health200 responses. The initial namespace creation3072MiB rule was not invoked. Private local and remote ledgers were replaced by cleaned summaries after successful cleanup.

Evidence: e2e/sitov-night-real-transport/epoch20-* includes six screenshots, flow/HTTP/logout/runtime proof. DE target and UK error screenshots were visually inspected. Broad-selector ancestor/BODY text containing scripts was omitted from JSON; short content titles and control/geometry evidence remain. No standalone reproducible runner is claimed. Saved evidence invariants, private-value absence scan and git whitespace checks passed.

SAVE_ONLY: no further product probes after the lease. Context compaction delayed final proof saving beyond10:41:01UTC; cleanup itself completed before deadline. Final save time is recorded in atomic S5.json. Handoff to M; WAIT, no lease extension.
