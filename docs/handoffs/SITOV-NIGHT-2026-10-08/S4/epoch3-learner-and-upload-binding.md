# Sitov Academy — S4 epoch3 learner/upload binding

COMMIT_AND_HANDOFF; RELEASE_READY=false. Own f465339 remains the pretest UI. No push/deploy/publication/migration.

## Assigned dependencies

Only ordered epoch3 source SHAs were cherry-picked while paused. Every source/local patch ID equality was verified; dependency proof also lives in private S4/dependencies-epoch3.json.
- 6994387bf431623e04374290bf5a64827fb3a347 → 9354ff802a92c950c338f70056ed585ee59661fd (patch ID equal)
- d95f159e22463b8188bd05f498d46e2659b6e9ee → 5e38ecddc3ee9e0c9870128d8a3644786106f1a4 (patch ID equal)
- bb3c7cd6129e03915fedf2c328f908a170d6e5d7 → b4c0c404a43cef41b4e2c839b993d5b12c3fd5b1 (patch ID equal)
- 55ab0671b15a8a80de3177500dc57edbba2d64ea → 8ac1b430ff0561a7b2598869ac2d51aa49dc7cf3 (patch ID equal)
- e22c73883356e61700ed57f3cfeb601f9bf55b32 → 52a9da7a074030ad43399de748a8f38464ec0b27 (patch ID equal)
- 43a81761d551a01ad7cb65fc0859f395e8333a9a → 4f58eeaeec1fe238d0b3fbad45f0d002302dc123 (patch ID equal)
- 13ffbcefa95a4d50a9d7271161f07696a8e36bbf → eaff4e654ea72e2c43f0e9328674bca00fb9a5f2 (patch ID equal)
- cddf7e2ee44e706d49dbb5b2940f5bd0ab7f6192 → 3d12695e3a139c7996f57903ed3c6018823f8d72 (patch ID equal)
- d1342c7879f3427ca8533fac4b765bca56c69176 → ff20b6e6f1e9545b710cda2d53d2e277f0a5d9ff (patch ID equal)
- 275ca4be88ffee4ce934059c96c86c98a2adb28d → 0130a3363ea93163227e1b839810b9cecee19fa6 (patch ID equal)
- 217c901a5a4ce84443c13a16401d39cfb7d2e1c9 → b3f2a1008b5512596b09676db01ad0b6d5510f1e (patch ID equal)
- 0fa5a5cf386ed1afb9a7a5bcab4377a24a340180 → f737537a2cb0621a7f0e500a520eb440ce6d7393 (patch ID equal)
- d101eeee7478dff255b1c6ce9efa2a03df97d660 → 759ca0c4a2cd0fc81798ae6fb3358416d56d16c5 (patch ID equal)

## Concrete binding

The production pronunciation route now loads the sanitized individual catalogue, preserves historical conversations and legacy listening checkpoints separately, and validates sitov_target against the exact catalogue/level. The authenticated account ID keys the mounted session even when checkpoint loading fails. No German-route requirement, global readiness panel, milestones, hard override, vocabulary/path/verb gate or old proof is used by this learner UI. Legacy readiness remains an ignored unknown prop ONLY for the M-owned synthetic preview until its fixture migrates; it cannot render or authorize anything.

The top shared Hero is always present and offers a persisted in-progress test first, otherwise the next available/failed test or passed text, or an honest empty state. It uses actual pronunciation graphics. M explicitly accepted temporary mode=media because the shared Hero has no pronunciation mode yet; M will add the shared mode in a later exact dependency. Catalogue cards retain permitted metadata and native state/action labels. Small reserved shapes change transform/opacity only; body text stays fixed. Full motion redesign/browser screenshots are not proven by this block.

Selecting a pretest starts/resumes the existing typed UI through the actual S3 server-action ports. Selecting a passed text reloads the current catalogue and guarded body query before displaying just that exact text. Stale/failed reauthorization hides the old body. Reference audio uses SolutionAudioButton canonical reading_text/id/reference for BOTH synthetic and human reference recordings, with no direct target Waveform/player or old path prefetch. The body/task/title/focus are German lang/translate=no; outer UI is the chosen locale. Current text/test/account keys isolate sessions. Existing saved listening position remains through the existing checkpoint hook, and old checkpoint IDs cannot authorize new text practice. Draft recordings prevent catalogue switches; failures retain the captured blob. Mailbox remains independently reachable.

uploadPrivatePronunciationRecording now requires purpose-specific target(textId, expected textVersion) or reply(existing submissionId) context. It requests the corresponding actual S3 action ticket, checks strict DTO, owner folder, expiry, extension, target version or exact reply submission, then rechecks live account before Storage. No arbitrary client-generated Storage path. Each immutable blob/account/purpose/target has its own request/ticket; cached Storage uploads are reused only through a fresh account/expiry check. Lost ticket responses retry the same request. An expired/mismatched ticket is discarded. Lost Storage responses are recovered only by downloading the same owned immutable path and verifying every captured byte. Components call this adapter on each submission retry rather than trusting an old uploaded path; resetting/replacing a blob releases its weak ticket association. Backend repeats authorization/consumption. S3 transactional submitretry is being repaired separately and is NOT included in these active dependencies.

LernkastenGuide now requires explicit lang; its sole LeitnerBoxOverview caller passes uiLanguage. No translated-title inference is used. The old unused helper remains in an unassigned file and can be removed by M.

## Evidence and exact limits

- Final bounded Jest batch: audio-upload, pronunciation-pretest-integration, sitov-pronunciation-pretest-ui, audio-recorder-mobile-ux, audio-recorder-lifecycle and sitov-trainer-help: 6 suites /45 tests passed. Lifecycle tests deliberately exercise optional decoder/waveform failures and emit expected console messages while passing.
- ESLint of all 11 assigned changed TypeScript files: exit0 without warnings. Full worktree tsc --noEmit --incremental false --pretty false: exit0. git diff --check: exit0.
- Additional regression: pronunciation-conversation-ui PASSED. pronunciation-save-retry: 1 failure /3 cases, solely old mocked-adapter expectation1call versus secure new2calls; actual Storage remains1upload, verified by new adapter test. The old fixture file is not assigned here; M was notified to assign its adaptation. Do not claim all regression tests passed.
- Action/Storage callbacks in tests are controlled fixtures. No authenticated realflow, database test query, Storage HTTP, full E2E/build/deploy, browser screenshots, 320/390/1440, themes/high contrast, 200% font, touch/keyboard/visual reduced-motion or offscreen-scene acceptance ran. Skill/docs read: Supabase changelog and official Storage upload docs (https://supabase.com/docs/reference/javascript/storage-from-upload), local Next client/server guide. No productive test data or secrets output.

## Remaining work and rollback

M must integrate latest S3 transactional submit/retry dependency, shared pronunciation Hero mode, synthetic preview DTO and old retry/upload fixtures. Teacher authoring window/old hard-override admin replacement, actual authored pools, optional bonus and publication remain separate leases. S2 recommendation query target is supported but its newer DAL commit was not assigned/cherry-picked here. No new content/audio was authored/published; Qwen/local imports and actual audio publication gates remain M-owned. Full motion/layout/accessibility and real authenticated learning/record/review acceptance remain blockers. Live all-account commercial-rights before/after production migration comparison remains an outstanding deployment gate. Existing rights/history/snapshots/progress/streaks are not rewritten. Rollback is code revert of the S4 binding commit; database dependencies have their own M/S3 rollback plans and must not be blindly reverted together.
