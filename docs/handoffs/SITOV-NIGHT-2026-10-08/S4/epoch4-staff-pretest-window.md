# Sitov Academy — S4 epoch4 staff pretest inspection

COMMIT_AND_HANDOFF; RELEASE_READY=false. Existing S4 f465/3da retained; no M duplicate feature commit acquired. No push/deploy/publication/schema/backend/audio/navigation edits.

## Assigned dependency proof

- 8d01116c24570f10a2704d74cea72a95ae16d839 → b34e26c6feed5fc8cd99da8801e9dba473777ff5 (stable patch ID equality verified)
- 486da1636ae841e31505f80eaf5933233687bf18 → 74f1180970798ebde45c1c92b812e36e73e86af4 (stable patch ID equality verified)
- 841c4b4780bbdc2400de96bf594c2810975a7650 → 436d4a2e1152b3d8eb1c0a2f16f8a068b93e8bfe (stable patch ID equality verified)

## Changes and real data contract

SitovPronunciationPretestStaff is a reusable read-only staff window, now embedded in the existing student-detail pronunciation tab and admin/content/pronunciation page. The student tab removes getSitovPronunciationReadiness/SitovPronunciationAccess and their Hard/Readiness controls. Existing TeacherStudentPronunciation conversation/history panels remain. Existing reading-text CMS is unchanged; no new pretest authoring/publish/reset/recalculate actions were created. The new window visibly states that pretest definition editing/publication is not yet available.

Props contain target metadata {textId, level, title, textVersion}, levels, selected interface language, authenticated accountId, optional specific studentId and optional initialLevel. Both server Pages use the guarded existing admin reading query and derive the actual exact German body SHA256 on the server solely for version labeling; bodies are not sent through these new metadata props. Student view narrows targets to the existing allowed-level context without claiming this is a per-item commercial authorization decision. The Staff action remains the sole role/MFA/target/student authorization source. No client proof grants access.

The client imports actual getSitovPronunciationPretestStaff({textId,studentId:null|uuid}). It validates definitions [{id,text_id,text_version,test_version,definition,active,created_at}] and actual persisted AttemptResponse entries ({attempt,tasks}|{attempt,result}), text scope and unique IDs. Private unknown definition fields are selectively projected: only known task/prompt/fragment/options and correctOptionId membership plus structural pool/competency coverage enter the teacher preview. No raw JSON, privateEvidence, arbitrary extra strings, private row IDs, service keys or exceptions are rendered/logged. Invalid drafts cannot masquerade as a valid preview; valid historical results can still be inspected.

Definition selection shows actual active/current, inactive draft or earlier-text-version state; exact full hashes are behind native Versions disclosure. Competencies currently have only server IDs/itemsPerAttempt and no human-readable names, so the UI uses neutral localized ordinal headings grouped by actual ID, never invented semantic labels. A later authored label contract is a concrete remaining improvement. Actual stored task wording/options remain German lang=de/translate=no; solution badges and surrounding UI use de/en/ru/uk/tr. Solutions are confined to this authorized staff component; the learner component/data contract is unchanged.

Results display actual saved pass/fail/in-progress state, server correct/total or saved answered/total count, last update and current/earlier-version qualifier. Older passes remain historical results and never become current-version authorization. Up to the 20 most recently updated attempts are rendered with honest total count/limit notice. The all-students content view cannot attach names to results: existing Staff DTO does not include owner identity. The student-detail view is specifically bound by server action studentId.

Account/student changes remount the session. Level/text/content-version changes remount the request pane; request generation retirement ignores late completions. Loading, explicit failed/retry, no-text/no-definition/no-attempt and invalid-definition states are live. Shared native closed Help, MotionStage and PressableCard preserve existing motion/focus/reduced-motion contracts; selects/buttons/summaries reserve48px, text wraps and theme tokens/forced-colors remain. There are no new loops.

Changed files: components/admin/SitovPronunciationPretestStaff.tsx and .module.css; lib/sitov-pronunciation-pretest-staff-i18n.ts; existing app/[lang]/admin/students/[id]/page.tsx and app/[lang]/admin/content/pronunciation/page.tsx; __tests__/sitov-pronunciation-pretest-staff-ui.test.tsx; this handoff.

## Evidence and limits

- Jest focused batch: Staff UI14, existing pronunciation save-retry2, learner integration4 and S3 server DAL5 tests passed; 25 passing tests across4 suites. The extra pronunciation-private-upload suite FAILED TO LOAD because its old fixture imports server-only through the newly real S3 action adapter instead of mocking the ticket actions; it is not an assigned file here. M notified for specific fixture adaptation. Do not report the entire batch green.
- New Staff tests cover all5locales, real-content language boundaries, unknown/private-key isolation, per-student call scope, stored older-version pass, invalid definition with preserved result, empty/loading/retry states, no fake score for in-progress, rapid selection and late student/account results, native Enter Help and Reduced Motion.
- ESLint five assigned TypeScript files: exit0 without warnings. Full-worktree tsc --noEmit --incremental false --pretty false: exit0. git diff --check: exit0. Local Next use-server guide read before route edits.
- All these are unit/Action-fixture evidence. No authenticated staff/MFA/DB query/Storage HTTP/role revocation/real browser/320/390/1440px/200%/contrast/screenshots/visual motion/full build/E2E/deploy acceptance ran. No synthetic demo adapter or invented score was added to production.

## Remaining gates and rollback

M/S5 must update the old private-upload fixture and finish full combined regression. Actual authoring pools, meaningful competency labels, publication proof, teacher authoring mutation backend and broader staff identity context remain S3/M contracts, not hidden TODO controls. Protected real recordings, snapshots, checkpoints, progress/streaks and commercial rights are not rewritten. Authenticated real learning/staff/record/review acceptance, visual/mobile/a11y/motion screenshots and live all-account rights comparison around any later production migration remain outstanding gates. No new audio/content publication or migration occurred. Revert only this S4 UI commit for rollback; prior SQL dependency rollback/freeze plans remain M/S3-owned. S4 waits for a fresh valid START.
