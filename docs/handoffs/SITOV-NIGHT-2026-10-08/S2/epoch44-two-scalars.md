# Sitov Academy – S2 epoch44

Base: `6aae253d678bd825db68d02d05fe226f8354234c`. Exact bounded source candidate; publication remains M-owned.

## Two authorized values

- A2.1 `P2-N1-E03`, UUID `786e931e-5782-5fbb-aacc-c04cdb662120`: only `content.question` removes **dafür** from “und die dafür Miete bekommt”. The existing curriculum gate introduces pronominal adverbs at path5. The generic feminine vocabulary contrast and the landlord meaning remain intact. Native `path-src/a2.1/p2.mjs` and its generated seed agree byte for byte.
- A1.1 path7 objective `P7-K4`, area `communication`: only the quoted example changes “Ich sage es der Lehrerin” to “Ich sage es dem Lehrer”. ID, area and every other objective value remain intact. A1.1 uses its JSON seed as canonical source; no `path-src/a1.1/p7.mjs` exists and no builder was introduced.

Full comparison across **9,569 tasks, 856 nodes and 66 paths** finds exactly **one task scalar and one objective scalar**, with **zero parent, answer-key or accepted-variant changes**. All remaining fields, translations, references, option ranks, cardinalities and order remain exact. Eight other seed files are byte-identical. Full old/new task, its five-language context, parent snapshot, objective and source SHA proofs are private.

## Validation

- Existing complete Jest level-seed suite: **99/99 PASS**, 1 suite, no skipped tests.
- Nine native authoring levels: **9/9 byte parity PASS**; schema validates all **9,569 tasks**.
- ESLint: **0 errors / 0 warnings**. `git diff --check`: PASS. No tests added or edited.
- Both actual canonical audio extractors compared all 9,569 old/new tasks: **one final alias, one changed payload**. The objective does not enter the exercise audio extractor. `humanHearing=false`.

Changed alias: `sitov-path-adoption-33:786e931e-5782-5fbb-aacc-c04cdb662120:0`.

Final canonical audio: “Wie heißt eine Frau, der ein vermietetes Haus gehört und die Miete bekommt? Sie ist die Vermieterin”.

## M handoff

M owns integration, independent final content review, existing archive114 adoption, local male Qwen preparation, verified word timings and database audio import before publication. This unit changes no historical learner answers or progress and requires no answer-key revision. No DB, SSH, runtime, synthesis, audio assets, import, publication, push or deploy actions performed.

Private evidence (coordination root):

- `S2/epoch44-old-new-full.json`: 139094 bytes; SHA256 `527d6128f5454189d6ad8f1b1398fabb3ce8b81bc56e2f2aef580b7fffc4ecb0`.

- `S2/epoch44-final-canonical-audio.json`: 2520 bytes; SHA256 `7f2cc0b6fed9cc9469470681c7c056bebbf408ec2d9d0633203c0879bd580310`.

- `S2/epoch44-source-byte-proof.json`: 1712 bytes; SHA256 `16b2b984cc3c9e63c8abebf8abe77be94410284c3d259915539a77c2052a615f`.

Complete validation and all evidence hashes: `epoch44-two-scalars-proof.json`.
