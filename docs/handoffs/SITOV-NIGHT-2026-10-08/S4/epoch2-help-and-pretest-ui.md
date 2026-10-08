# Sitov Academy — S4 epoch 2

Status: COMMIT_AND_HANDOFF, RELEASE_READY=false. This is a reusable component and Help integration, not a published or authenticated pronunciation flow.

Assigned dependency commits only: d67a5d602d9b7bb5cd43d6290f93224cd6d93510 → d6a5a81cc448a03fded1ba0c8cdb557ab8d8d860; 38fb09f2756cab433a2e97955059c1efbe3fe8f9 → 9358ce3eb7a7ede3e7047f1eab7788780476d909. Frozen base 966a380f7a6118654f19750a9d62200795feb8c2, branch codex/sitov-night-s4.

## Changes and public interface

The assigned vocabulary and verb learning-box disclosures use the existing unchanged SitovTrainerHelp, short Help labels in de/en/ru/uk/tr and named context sections/headings. Existing learning rules, callbacks and profile logic remain intact. Vocabulary currently receives a translated title rather than lang: sitovVocabularyHelpCopy bridges the exact current dictionary headings. A future owner-approved caller change should pass lang explicitly; no dictionaries/shared motion files were changed here.

SitovPronunciationPretest accepts the frozen CatalogEntry and lang plus typed onStart(StartInput), onResume(attemptId), onSave(AnswersInput), onSubmit(AnswersInput), onOpenText(textId) and onRefresh callbacks. It does not import actions or implement a server. onOpenText must reauthorize the current exact text before loading body/reference/recording. Parent integration must isolate mounted UI by authenticated account and clear it on account changes. No client proof grants server authorization.

German title, prompt, fragment and options carry lang=de/translate=no; instructions, status, progress, errors, score, buttons and Help have five-language copy. Selection gives immediate unsaved feedback; Save and continue advances only after validated current-scope server confirmation. Saves use revision CAS. Start/save/submit retry the same immutable request ID/payload after connection errors. Nonretryable attempt conflicts offer a persisted reload; stale versions and authoring-locked entries offer catalogue refresh. Resume restores answers at the first unanswered task. Terminal results/proofs are DTO-validated and scoped to text/test versions; a pass offers the exact text, a failure up to three validated existing learning links and immediate retake. No keys/solutions/body/audio/self-assessment/client scoring or old readiness gating are present. Request cleanup retires updates after unmount; text/test version changes remount answers. Components reuse PressableCard, SitovMotionStage, motion CSS tokens, native radios/48px actions, focus and reduced-motion styles; no new loops.

Changed files: lib/sitov-trainer-help-copy.ts; lib/sitov-pronunciation-pretest-i18n.ts; components/vocabulary/LernkastenGuide.tsx; components/verbs/VerbLearningBox.tsx; components/audio/SitovPronunciationPretest.tsx and .module.css; __tests__/sitov-pronunciation-pretest-ui.test.tsx; this handoff.

## Verification

- ./node_modules/.bin/jest --runInBand __tests__/sitov-pronunciation-pretest-ui.test.tsx __tests__/sitov-pronunciation-pretest-contract.test.ts __tests__/sitov-trainer-help.test.tsx — 3 suites, 48 tests passed (15 new UI/callback-fixture cases, 28 frozen DTO tests, 5 existing Help tests). Fixture UUID uses Node crypto because JSDOM lacks randomUUID. Callback fixtures are unit evidence, not a fake production adapter or authenticated server proof.
- ./node_modules/.bin/eslint [six assigned TypeScript files] — exit 0.
- ./node_modules/.bin/tsc --noEmit --incremental false --pretty false — exit 0 for this worktree.
- git diff --check — exit 0.

## Remaining acceptance and rollback

Next authorization must wire actual S3 actions, catalogue/morphing cards and always-visible Hero into PronunciationStudio; remove old readiness/override UI; repair locale route with S1/M; build staff window against a frozen staff DTO; preserve recording/mailbox/snapshot/checkpoint/playback integration. Shared profile/navigation/audio stay M/assigned-owner responsibilities. S2 mapping proposal 45c5f9 was received but NOT assigned/cherry-picked, and no new links were fabricated.

No browser, screenshots, 320/390/1440, 200% font, touch, theme/high-contrast, accessibility audit, account switch, authenticated database/Storage, full E2E, build or deployment verification ran. Those remain release gates. Help keyboard/reduced-motion unit behavior is covered by the existing Help suite; actual visual layout/motion is not proven. Existing trainer logic beyond the Help component is not fully regression-tested here. No audio/content publication, new synthetic audio, migration or persistent data change; protected reference authorization is still M/S3 work. Existing rights/recordings/streaks were not altered. The all-account live commercial-rights comparison before/after a future production migration remains an outstanding deployment gate owned by M. Rollback is ordinary revert of the S4 UI commit; no data rollback is needed. No push/deploy.
