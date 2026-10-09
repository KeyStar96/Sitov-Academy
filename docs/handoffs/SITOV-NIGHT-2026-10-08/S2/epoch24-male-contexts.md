# S2 epoch24: further bounded fictional-character repair

Sitov Academy. Exact new branch `codex/sitov-night-s2-male-contexts-24`, start/base `591764272f2bec635a2514cb557d6352894edb56` (assigned59176427), old d5b branch retained. Lease ends2026-10-09 21:33:45.540438UTC (23:33:45.540438 Europe/Berlin); last two minutes SAVE. No epoch23 edits replayed.

31 of the prior153 named contexts receive male names in unbound content plus all en/ru/uk/tr task translations. Male reflexive, married/born, sibling and possessive translations and Turkish name suffixes were reviewed/corrected after the name changes. Seven of the original19 heuristic answer-bound cases genuinely assess feminine job, family or pronoun morphology: Köchin, Enkelin, ihre/ihrer, ihr and sie. Their prompts now ask the actual grammatical relation without a named fictional female person. Correct/accepted answers, options/order and target_form are identical. This is factual grammatical gender, not relabeling a named female learning character as an exemption.

B1.1 P5-N1/P5-N7/P5-N9: Okafor is addressed as Herrn Okafor/Er, with matching four task translations; Köchin→Koch, Lehrerin→Lehrer, Pilotin→Pilot, Friseurin→Friseur and Elektrikerin→Elektriker in safe job contexts. Russian/Ukrainian profession/past agreement is corrected. The hairdresser rule and its repeated explanatory translations are synchronized. Necessary feminine salutation P5-N8-E07 remains intact. P5-N9-E04 Chefin/Frau Sommer is still bound in the correct answer and remains a version gap.

Exact full old/new JSON-pointer patch: `epoch24-content-patch.json` (280 leaves). 55 exercise records changed, including44 with changed content and11 with only explanatory prose;44 exact new played strings. Every object-key set/array length and all exercise IDs/ref/goals/type, correct_answer/accepted_answers (both locations), target_form/options/parts were checked identical across the complete five seeds. No progress/history/recording/profile data changes. Existing optional sidequests and access/prerequisite contracts are untouched.

## Remaining review and immutable version gaps

`epoch24-semantic-review.json` accounts for all153 prior contexts but explicitly does not claim semantic completion:31 safe edits,7 genuine grammar reframings,13 actual fictional-character version gaps,102 not yet semantically reviewed. The additional B1.1 Frau Sommer case makes14 proposed version gaps. All19 original heuristic bound cases were inspected:7 grammar targets,12 names in correct answers; the additional Mia/weil-sie full-clause answer was missed by that heuristic and is now a13th prior-list version gap.

Each of the14 gaps lists exact UUID/ref/current correct answer and proposed male correct-answer delta. This is a proposal only. A valid next change must preserve the old task/content/answer snapshot and historic attempts/results, introduce a separately reviewed immutable revision with coherent new prompt/options/key and locally prepared audio, and resolve actual canonical IDs/parent/version bindings. Never overwrite historical keys, transfer old passes or silently rename correct answers. These are open editorial/data-version decisions, not implemented migration logic. Other named/role/explanation contexts also remain outside this bounded repair. No claim all five seeds are male-character compliant.

The two optional partial mapping additions are deferred to prioritize characters and on-time saving. The mapping is not changed in this commit; neither berufseinstieg nor zusammenarbeit gains fake goal coverage. Their uncovered subskills remain pending.

## Existing production snapshot and audio handoff

Approved existing export: `master/sitov-catalog-export-20261009-1723.json`, SHA256 `620ab313d6f0f7e77c8944ae914dd2fa458a9915b345a494f401c080f61a2fab`. All55 affected exercise UUIDs exist, and their content equals the old seed content.44 new content values therefore require a separately guarded data update.11 are prose-only and do not change this export's content. Memory-card/explanation/translation fields are absent from this export and need a separately authorized exact read before updating. No new live query was run; no production state was changed.

Private `S2/epoch24-production-id-match.json` contains exact IDs/old-new played strings/source-match results. Private `S2/epoch24-authored-audio-texts.json` is the44-entry Record<Audio-ID,string> for M's existing authored-text audio workflow. These are candidates, not generated/imported assets. They use the exact existing player extraction formula (fill before+answer+after, MC question+answer, sentence-building correct answer). No new player is introduced for prose-only memory cards. M must independently review the44 strings, produce local Qwen3-TTS-12Hz-1.7B-Base/sitov-qwen-male-de-v1 audio with measured timings, import/audit, recheck current DB rows, then publish guarded content. Never relabel an old recording for a changed string.

No DB/API write, SQL, runtime, QA actor, TTS/audio job, storage or deployment was performed. M's separate generation of the earlier seven texts was not touched.

## Verification and handoff

- Three targeted Jest suites (topic-mapping, recommendations, Special recommendations): PASS74 tests after adding three semantic/B1 regressions; earlier same-unit71 test run also passed.
- `node --test scripts/sitov-learning-specials-authoring.test.mjs`: PASS23 tests.
- Scoped ESLint: PASS. Source/protected-field/approved-export comparisons: PASS with snapshot limits above.
- `git diff --check` and staged check: PASS before commit.

No full TypeScript/build/global/browser/native/runtime checks. Broader102-context review,14 immutable-version cases, actual DB guarded synchronization, independent review and44 audio/import proofs remain open; NOT_RELEASE_READY. Revert this commit for source rollback; no database migration exists. Atomic WAIT after commit, no open jobs/no lease extension.
