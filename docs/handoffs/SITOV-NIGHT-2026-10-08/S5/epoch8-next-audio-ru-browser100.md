# S5 epoch8: protected Next audio and RU browser smoke100

Frozen source `708068f83e75403a4bd2c348122acece24b01d15`; own clean QA100 branch, integrated own01fcc present. M launcher AST confirms all three Supabase URLs are loopback19483, both anon vars use fresh QA anon and service-role var fresh QA service. Its integration checkout HEAD matches708. Actual remote QA100 proof matches708/through100/migration SHA ebe50eedbeeb3506ddbd0ab7a2105488f3b5362905ddd2c1834490edb217cb7c and productionWrite=false; previous99 proof8b preserved. Actual runtime network/image/label/limits/nohostports+HTTPhealth checked before own fixtures. No M app/server/SQL/schema/container/asset changes.

## Actual Next HTTP:10PASS

Real GoTrue-created synthetic student and password sessions supplied the documented SSR cookie to a separate HTTP client. No browser cookies were read or injected. Before individual pass protected `/api/sitov-audio` returned404; current persisted test pass returned200; afterpass actual MP3 returned200 and SHA matched prepared Storage metadata. Prepared wordTimings exist. Headers are private/no-store, Vary includesCookie, Content-Type audio/mpeg. Real authorized Range0–127 returned206 with exact expected bytes. Anonymous401, foreign404, commercially revoked404 and revoked Range404. No service key sent to Next cookie endpoint.

Three bounded API attempts used separate still-unpassed first3 texts on the same own student. First3 assertions passed then the QA script looked for the wrong timing field; second4 assertions passed then header-name casing caused a QA failure. Corrected QA field wordTimings and case-insensitive headers; final10PASS exit0. These are harness failures, not product defects. All three actual MP3 reference requests matched prepared hashes; detailed final protected access sequence covers one text.

## Actual CUA browser smoke

New fourth synthetic account signed in via the actual RU email/password form, with visible pending state and authenticated dashboard. Navigated to RU A1.1 pronunciation; loading state settled into the three real text choices. Started Guten Tag, das bin ich individual test, opened Russian contextual help, closed help with Enter. German question/options remained German; actual question ancestor had lang=de/translate=no, outer documentlang=ru.

Selected one answer and saved/continued. The UI reached question2/12 with saved state. After actual reload, Continue test resumed at question2; Back showed question1 with its saved selected radio answer intact. This is one-answer/resume smoke, not a complete browser graded submission or microphone proof.

Documented viewport capability actually set320×760,390×844,1440×1000; each document scrollWidth equals innerWidth. Screenshots: epoch8-ru-test-320.jpg, epoch8-ru-help-390.jpg, epoch8-ru-resume-1440.jpg. The viewport override was reset. Current screenshots show light appearance. No all-theme accessibility claim. Browser offered onlyviewport/visibility capabilities; reduced-motion/offscreen/hiddenpause was not emulated.

## Cleanup and own QA artifacts

Four newly created .invalid accounts were removed using guarded own UUID/email SQL and actual GoTrue DELETE200; zero uploads/recordings were created in this unit. Own private ledger now contains only cleaned summary. Own HTTP session cookies were held privately and never emitted; fixture browser credentials are external prepare-only env inputs in committed runner. No account IDs, credentials or emails in evidence/screenshots.

Changed only own next-cookie-protocol.py, JSON proofs/screenshots and this handoff. No product migration/rollback/deployment required. Verification: actual final API10PASS; actual CUA observations/screenshots as listed; Python AST/JSON10PASS+resume/viewport/cleanup invariants+credential/actor absence scan PASS; git diff --cached --check PASS.

## Remaining gates

UNTESTED: remaining four interface languages, dark/highcontrast,200% text, complete keyboard focus/axe/screenreader, reduced-motion/animation pause, actual microphone/browser full submit, broad existing-platform/payment/access and allocated TypeScript/build checks. Prepared word-time metadata exists and route accepted it, but no audible word-highlight playback was reviewed in browser. Live before/after all existing accounts' rights remains a later mandatory deployment gate; no production migration was run. No overall RELEASE_READY. Own commit to M and WAIT before00:38:50Z.
