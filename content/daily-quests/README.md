# Sitov Academy Daily Quest authoring contract

This is the reviewed source for 100 **additional** daily journeys per CEFR family
A1, A2, B1 and B2. Existing starter keys and learner records stay intact.

Each JSON file contains 100 rows: five distinct situations for every setting in
`scripts/lib/sitov-daily-quest-settings.mjs`. Rows have stable `slug`, German
`title`, actionable `goal`, `setting`, contextual `intro`, three `words`, ordered
`pieces`, a dialogue `question`, three `options`, `explanation` and `focus`. Directions and explanations are translated into the selected interface language; German exercises remain German.
`options[0]` is the reviewed correct response **in this server-side source only**.
The generator shuffles public options and writes the key into the private schema.
Students receive neither this authoring source nor correctness flags.

- Every fictional learning character is male. Names, roles, dialogue references,
  scene descriptions and depicted people must match this rule. Use the approved
  male scene hosts; grammatical gender examples and real profiles remain factual.
- All German audio uses the male Qwen3-TTS profile `sitov-qwen-male-de-v1` through
  the shared adapter. Every rendered scene, personalized discovery word, sentence
  and question must be precomputed locally on the Mac and imported with measured
  word timings before publication. Follow `docs/audio-authoring.md`, including all
  permitted noun-slot variants and frozen assignment texts. The website only
  serves prepared recordings; no live Mac dependency, alternate persona, Piper,
  browser voice or system-TTS fallback. The DTO contract and migration 64 continue
  to enforce male character voices in PostgreSQL.
- `words[0]` is a singular noun with `der`, `die` or `das`. Personalization uses
  only that template's reviewed form. Every option must be distinct and the
  dialogue must have exactly one appropriate answer given its context.
- Sentence parts bind freely movable phrases. If another order is equally valid,
  add `alternativeOrders`: arrays of zero-based piece indices, each containing
  every index exactly once. The maximum is eleven alternatives plus the default.
- Keep slugs and derived word/piece/option IDs stable after publication. Do not
  reorder source pieces/options for a correction to a published template without
  a new editorial version and matching private keys. Existing assignments freeze
  their content and keys and must never be re-rendered by a catalogue correction.
- New technical names use the `sitov` prefix. UI and documentation use
  **Sitov Academy**. Medical and banking scenes teach communication and logistics.

Rebuild with `node scripts/build-sitov-daily-quests.mjs`, verify with the same
command plus `--check`, and run
`node --test supabase/tests/sitov-daily-quest-catalog.test.mjs supabase/tests/daily-quests-concurrency.test.mjs`.
The generated migration is insert-only for existing editorial content. Future
published corrections require a new migration/version; rebuilding version 1
alone intentionally cannot replace an existing editorial row or private key.

Scene artwork is generated individually with the built-in Imagegen tool, using
`public/Bilder/deutschreise/sitov-bakery-male.png` as the binding style and quality
reference. Match its realistic people, rich environments, natural lighting and
subtle painterly texture. Simple vector illustrations, cartoons and placeholders
are not acceptable. Every new scene requires visual review, a recorded prompt and
an asset checksum in `sitov-scenes-provenance.json`. Verify the shipped artwork
with `node scripts/check-sitov-daily-quest-scenes.mjs`; this only checks files and
never regenerates or overwrites them. Preserve the PNGs during application rollback.

## Interface-language presentation

Provide goal, explanation, focus and question translations for `en`, `ru`, `uk`
and `tr` in `locales/sitov-<locale>.json`, keyed by the unchanged template key.
German lexical examples in explanations must remain German. Review the question
role in `sitov-question-roles.json`: `instruction` renders in the UI language;
`german` denotes an actual character utterance or a German comprehension question.
Include every condition of a contextual instruction in its translation.

These sidecars are server-only because correct-answer explanations may reveal
solutions. The student receives the relevant explanation only after grading.
Never import authoring JSON or locale sidecars into a client component. General
UI copy belongs in `lib/sitov-daily-quest-presentation.ts`. The server overlays
validated display fields; no frozen assignment or audio transcript is rewritten.
Run the localization coverage/privacy suite after any authoring change.
