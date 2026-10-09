# Sitov Academy — S3 epoch41: standalone Paket source evidence

Base: `81b05d9476f691bfde020fcb3ed1ecd802942422`.
Branch: `codex/sitov-night-s3-package-source-span`.

Only two source spans change in pool23 (`2c6b8ac4-28e2-556d-950e-9937d7da0da9`): `sitov.pretest.a21-03.words.q1.sourceSpans[0]` and `sitov.pretest.a21-03.words.sourceSpans[0]`. Both move from46–51 (`Paket` inside `Paketbote`) to102–107 (standalone `Paket` in `sein Paket`); quotes remain `Paket`. The second matrix span still correctly covers46–55 `Paketbote`.

Previous definition hash: `4d96fff912e14e5fdf845c0d316fcdfc9cdd0b97d14659b69e7277f3b637cb4d`.
Current definition hash: `93b930144b0e449d4f3093cec759be8a3032b522b718eeadf1f8fe0891b4c987`.
The S3 review stays honestly pending with the new hash. Exact old/new spans, complete reviews, raw source, manifest content/byte hashes, unchanged audio byte hash and other23-draft content hash are recorded in `epoch41-package-source-span-delta.json`.

All public questions/options, correct keys, IDs, assessment units, source text/version, mappings, forms and all other23 drafts remain exact. The audio alias file is unchanged byte-for-byte. No existing epoch39 audit is rewritten.

The test script restores the exact pre-epoch41 spans/review BEFORE the existing M4-review normalization and every frozen21/epoch38/historical projection. All previous66 tests remain active, including M4 exact provenance. Two new tests validate the actual repaired24/2304 state and exact conservation/byte reconstruction, plus Unicode-aware source word boundaries. The old embedded prefix, an internal truncated token and a wrong end offset fail the standalone predicate; the full existing Paketbote span passes.

Validation:68/68 offline tests PASS; authoring CLI PASS (24/60 private drafts,36 pending,2304 public aliases,89 inactive legacy); `git diff --check` PASS. No QA/native/browser, SQL/database, runtime, TTS, audio generation/import, new pools, publication, full build or deployment ran. Independent M approval of the new hash, calibration and prepared-audio gates remain pending; NOT_RELEASE_READY. S3 returns WAIT within the separate four-minute epoch41 lease.
