# S2 epoch23: bounded character and nominative-anchor repair

Sitov Academy. Exact start/base `0f92bf03fa50f13ec89fd32f235367e6876c2642` verified clean; new branch `codex/sitov-night-s2-male-anchors-mapping`, previous branch/commit preserved. START23 lease ends 2026-10-09 20:38:48.328796 UTC (22:38:48.328796 Europe/Berlin). No new authorization, schema, progression, audio binding or database changes.

The existing `sitov.topic.nominativ` loses only its incorrect P4/P4-N7 anchor, whose actual lesson is Hier, dort und Rückfragen. P4/P4-N1 Der, das, die and the existing optional Special's P4-N1/P4-G1 binding remain unchanged. Assignment's nominativ-a11 label refers to this existing topic; no renamed/new topic was created.

All seven explicitly assigned card/rule examples are repaired: Selin→Selim with Er; Olena→Oleh with seinen Vater in the separable-verb example; Oleh in the time-inversion rule/example and Dresden sentence; Kasia→Kamil in reading/meeting examples; Lena→Leon in the fever and Berlin/weil examples, with er. Seven directly linked exercise content records are updated coherently, including their actual en/ru/uk/tr task translations. Both audited A2.2 exercises now use Milan and einem Freund; Russian/Ukrainian friend agreement is updated, English/Turkish already gender-neutral. Repeated exact inversion-rule prose in eight other exercises/translations is synchronized.

Exact old/new source leaf patch is committed in `epoch23-content-patch.json`: 87 leaves across four seeds, including full strings and JSON pointers. Only the mapping anchor deletion is outside that seed patch. Recursive before/after structural checks confirmed identical object keys and array lengths; every exercise ID/ref/goal/type, correct_answer, accepted_answers (both locations), target_form, options and sentence-building parts remains identical across all four complete seeds. All grammatical-gender examples, answer identities, formats and unrelated content are retained. No user/profile/history/streak/recording source is touched.

## Production export comparison and required guarded updates

Read-only approved artifact: `master/sitov-catalog-export-20261009-1723.json`, SHA256 `620ab313d6f0f7e77c8944ae914dd2fa458a9915b345a494f401c080f61a2fab`. Every one of the 15 changed exercise records is present by exact UUID; all 15 stored `content` values equal the old seed content. Seven differ from the new content and therefore need a later guarded data update after exact old-state recheck and audio preparation. Eight have only explanatory/translated-rule changes, and their stored `content` remains identical; this export does not expose explanations/translations or path-node memory cards. Those fields require a separate authorized exact source comparison before update. No claim they were inspected in production.

The comparison is an existing snapshot, not a new live read. Detailed private result: `S2/epoch23-production-id-audio-match.json`. It records export timestamp/hash, exact UUIDs, old/new match flags and old/new audible text. No database, API, SQL, migration, runtime, TTS, storage, production or deploy writes were performed.

## Private audio preparation handoff

`S2/epoch23-authored-audio-texts.json` is a nonempty Record<Audio-ID,string> accepted by the existing authored-text catalog format. Seven exact changed player strings are listed below. Extraction follows `sitovExerciseAudioTexts` in `scripts/sitov-audio-catalog.ts`: fill = before + unchanged answer + after; MC = question + unchanged answer. Unchanged standalone answers and unchanged prose-only records add no new played string. Memory cards currently add no player target. These are candidates, not prepared/imported audio proofs.

- `sitov-epoch23:37a6e297-df03-52c7-a7eb-51335b24d9f6:0`: Das ist Selim. Er kommt aus der Türkei.
- `sitov-epoch23:7c42c6a7-ff31-553c-a374-872dbb72049c:0`: Oleh ruft am Abend seinen Vater an.
- `sitov-epoch23:b831156c-98e9-59c1-a580-235315123e01:0`: Kamil liest jeden Abend.
- `sitov-epoch23:1d8236b2-76ec-5933-a03f-7dbc733e856b:0`: Triffst du heute Kamil?
- `sitov-epoch23:cb8f65c6-df87-5cb8-a5aa-7d715d54e4af:0`: Oleh fährt am Wochenende nach Dresden.
- `sitov-epoch23:95531a50-2eec-52c8-ab16-8e229333270e:0`: Milan macht einen Vorschlag für den Abend. Wir könnten zusammen einen Film sehen.
- `sitov-epoch23:2ca07843-9514-548c-a9ab-5039e54f2b2c:0`: Du möchtest am Samstag mit einem Freund ins Museum gehen. Wie machst du einen Vorschlag? Wir könnten am Samstag ins Museum gehen. Hast du Lust?

M must generate locally with Qwen3-TTS-12Hz-1.7B-Base / sitov-qwen-male-de-v1, measure real word timings, import and audit bytes/provenance, recheck actual current record content, then apply guarded source changes. Until then these changes are source-only and must not publish or replace existing playback. No old audio is relabeled or reused for changed text.

## Deliberately unresolved contexts

This is not a full four-seed male-character cleanup. Recursive inspection found 1324 original matching name leaves, many repeated translations/explanations. After this bounded repair 1241 matching leaves remain (A1.1 586, A1.2 165, A2.1 397, A2.2 93). The private `S2/epoch23-residual-contexts.json` lists 153 still-named exercise contexts with exact IDs/source refs/text; 19 are heuristically flagged answer-bound, not semantically approved exemptions. The other residuals also require editorial review, not blanket permission to leave female fictional characters.

Concrete conflicts with the preserved-answer requirement:

- A1.1 P5-N6 exercise `d4fa715e-799f-58cf-a0e1-c1798e8b08ea`: sentence-building solution/accepted answers/parts contain Olena. The card/rule now uses Oleh, while this exercise remains unchanged. Changing its name requires an explicitly reviewed answer-preservation/version policy; do not silently rewrite historic keys or claim coherent completion.
- A2.1 P1-N4 exercise `948fdca0-e443-5184-a1bb-8bd02b9a4bfe`: Mia and the correct answer `weil sie müde ist.` bind a feminine pronoun. It remains unchanged; renaming only the subject would invalidate the stored answer.
- Other same-name possessive/dative/profession and name-in-answer contexts are catalogued privately. Remaining grammar necessity versus fictional-character scope needs case-by-case review. No blind feminine noun purge was applied.

These residuals, additional guarded data synchronization and audio/import proof block a claim that all assigned linked fictional contexts are finished. M received the bounded-scope limitation during the lease. No UI redesign or motion behavior changed; existing motion rules were read and remain in force.

## Verification and rollback

- Targeted Jest: `__tests__/sitov-learning-topic-mapping.test.ts`, `__tests__/sitov-learning-recommendations.test.ts`, `__tests__/sitov-learning-special-recommendations.test.ts`: PASS 3 suites /71 tests. Includes full schema parsing of all four seeds, explicit male/grammatical agreement, four translation locales, preserved solution values, and actual nominative anchor/Special binding.
- `node --test scripts/sitov-learning-specials-authoring.test.mjs`: PASS 23 tests, including source fingerprints, inactive authoring, stable IDs, two disjoint balanced forms, malformed keys and male fictional-role rejection.
- Scoped ESLint on the mapping and new test: PASS.
- Full protected-field before/after comparison and exact approved-export ID/content matching: PASS with limitations above.
- `git diff --check` and staged check: PASS before commit.

No full TypeScript/build/global suite/browser/native/actual runtime checks. No release-ready or deployment claim. Revert this commit to undo source changes; there is no database migration/rollback. Private original export remains untouched. WAIT after commit/atomic status save for a fresh START; no automatic lease extension.
