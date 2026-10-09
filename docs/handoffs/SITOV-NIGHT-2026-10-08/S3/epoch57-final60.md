# Sitov Academy — S3 Epoch 57: final 60 private drafts

Base: `4b978c696d14f3f06f1d62cbab27abf71143f2a1`. Branch: `codex/sitov-night-s3-final60`.

Three final canonical B1.2 pools (sort 8–10), 72 questions, twelve cores with six distinct assessment units each, 288 new public audio text aliases and three exact source reference texts. Two disjoint twelve-question forms per pool, three items per core. Option identifiers and positions use independently balanced OS-CSPRNG schedules. Current private authoring coverage: 60/60, zero pending, 5,760 aliases; 89 inactive legacy rows retained.

- Ein bewusster Umgang mit Bewertungen — `5dc0cf34-6f7c-5e67-9728-22bbe90c5dc7`; source SHA256 `d550ac12f9b5113443bdf1591b579ef42b00d5012cc387347780aad2db4a2d31`.
- Die Stadt aus einer anderen Perspektive — `8cf76d58-8428-59ef-b449-4301051413ba`; source SHA256 `11b17419c05951456cecfa3a95c9975a856189a34dfcca6d94b900bca0ecab3c`.
- Was Erfolg beim Sprachenlernen bedeutet — `6e667abd-3011-597c-9cf9-0c20c2c30e2d`; source SHA256 `4dadb55d852f8f3d18d93552ecee032215bb3f36ecf5cc7542cb0fcd19457e4a`.

All previous 57 pools, reviews, quality repairs and 5,472 audio aliases are preserved exactly, including M’s correction of b12-07.nominal.q5: unflected jemand is a grammatical Dativ alternative and is not a valid incorrect option. The FULL57 snapshot is frozen before M57 review/task/audio restoration, author56, M54 and all 143 historical proofs. No historical hash rebaseline. New content never marks unflected jemand/niemand as incorrect Dativ or Akkusativ.

Full source bodies and all 72 public prompts/options, protected keys/rationales, independent standalone source spans, assessment units and complete core matrices are in epoch57-pools58-60-author-review.json. Instructions are spoken naturally, without synthetic blanks or ellipses. Real alternative forms and case/number/direction premises distinguish answers. The final check removed answer-copy opportunities from the Gehweg/Besprechung case prompts. Source 8 has indirect questions rather than a relative clause; source 9 has a relative clause; source 10 has no relative clause. All three have actual past constructions and comparison forms: genauer, stärker, nächstes. Source 10’s hätte gemessen is a past counterfactual, not an invented narrative tense. Relative-clause omissions are explicitly source-grounded. Exact same-level lesson mapping remains honestly pending, with no invented targets.

Validation on final saved candidates:

- node --test scripts/sitov-pronunciation-pretests-authoring.test.mjs: 147/147 PASS (143 historical plus four new guards).
- ./node_modules/.bin/jest __tests__/sitov-pretest-author.test.ts --runInBand: 7/7 PASS.
- node scripts/sitov-pronunciation-pretests-authoring.mjs: PASS 60/60, 0 pending, 5760 aliases, 89 inactive legacy.
- git diff --check: PASS.

New tests verify current schema/audio, exact frozen FULL57 hashes and bytes, all audited fields/spans/forms, independently specified 54 grammar keys, genuine comparisons, spoken premises, and rejection of source/rationale/matrix/form/topic/audio/key drift, invented verb forms, missing direction context and blank markers.

New pools remain active=false, humanReview=false, calibrationStatus=pending and author_checked_independent_review_pending. Final private authoring coverage does not imply publication or release readiness. Independent M semantic review, exact-version Qwen/forced-alignment/audio import and publication gates remain pending. No app, SQL, QA, runtime, TTS, database, production or publication actions were performed. Aliases/reference files contain text candidates, not recordings. Existing IDs, German source bodies and previous content are retained. JSON.stringify/editorial byte hashes are not the database JSONB version hash.

Rollback: revert only this inactive authoring commit; no published data changed. After clean commit and atomic status handoff, S3 WAIT until a fresh M START.

Manifest byte SHA256: `18918510d407af0dbdeea00edace9a0bab819f50c62733e44ec4320f8048f062`.
Audio-alias byte SHA256: `1603bbf9e56fb0b7a6e36ee078ecbc62fc32ca576cc7e94cde31be6662121905`.
