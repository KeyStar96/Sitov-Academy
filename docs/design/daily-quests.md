# Sitov Academy Daily Quests

The Deutschreise turns a short everyday scene into a daily learning entry.
Production activation was explicitly authorized on 2026-10-02. The detailed
Obsidian release receipt records the deployed commit, activation time, database
backup and final HTTP evidence; this document describes the release design.

## Experience and entry points

- Students use `/[lang]/dashboard/daily-quest`; the dashboard shows today's
  status and the database streak. Profile settings can disable the daily entry.
- First successful password or OTP/PKCE login claims the Berlin calendar day.
  A later login opens the dashboard; recovery and explicit learning links retain
  their destinations. Claim failures fall back to the dashboard.
- Intro, word discovery, sentence building and dialogue lead to a travel stamp.
  The three exercise stations are checked by PostgreSQL, in order. Wrong answers
  stay retryable; only a confirmed completion increases the streak.
- “Do it later” transitions to the dashboard through the client router without
  a server mutation. Today's journey stays available, and verified stations
  resume when the learner returns. Migration 60 restores current-day legacy
  skips without changing their progress or historical assignments.
- Home shows the journey card below the greeting and today's learning plan,
  with a persistent entry action until completion.
- Mobile controls, focus changes, reduced motion, theme and high contrast use
  the existing UI infrastructure. UI labels cover de, en, ru, uk and tr;
  authored learning content stays German. No microphone or scoring AI is used.

## Six authored starter templates

| CEFR | Template key | Learning situation |
|---|---|---|
| A1 | `sitov-bakery-breakfast` | Beim Bäcker: a polite breakfast order |
| A2 | `sitov-picnic-plan` | Ein Picknick planen: explain a need with `weil` |
| B1 | `sitov-order-change` | Eine Bestellung ändern: polite Konjunktiv II |
| B2 | `sitov-catering-alternative` | Eine Alternative aushandeln: a conditional proposal |
| C1 | `sitov-local-sourcing` | Regional einkaufen: weigh origin and additional cost |
| C2 | `sitov-menu-deliberation` | Ein Konzept präzisieren: a diplomatic qualification |

These are six real scenes, one per CEFR family, sharing the bakery illustration.
They are starter content, not a claim that hundreds of scenes already exist.
The CEFR labels guide authored difficulty; they do not certify a full curriculum.
The final A1/B1/B2/C1 starters are version 2: A1 avoids Konjunktiv II, and the
private keys accept the reviewed B1/B2/C1 word-order alternatives.
The image provenance remains in `docs/design/deutschreise-assets.json`.

## Authoring more scenes

Create a versioned `public.daily_quests` row with a unique `sitov` template key,
CEFR family, category, full safe content JSON and a reviewed fallback word.
The engine renders `discover`, `sentence_build` and `dialogue_choice` generically.
Stable step, word, piece, choice and character IDs connect payload and grading;
each spoken sentence identifies its character through `speakerId`.

Keep accepted piece-ID orders, the correct option ID and grading feedback in
`daily_quest_private.template_keys`. Never put correctness flags in public
content. `accepted` is an array of valid ID orders, not the displayed token order.
Discovery checks the exact word-ID set; public choice positions and token banks
must not reveal the answer. Add rows through a trusted migration/editorial server
workflow; no new browser-based content editor is part of this release.

`daily_quest_private.slot_forms` stores reviewed category/word/article matches,
`nominative` and `accusative`. Only `{{nominative}}` and `{{accusative}}` are
substituted recursively in JSON strings. For example, `der Apfel` becomes
`einen Apfel` in a request. Unreviewed card labels use the template fallback.
Today's assignment freezes rendered content and private keys; later edits affect
new assignments. Daily rotation hashes template key and Berlin date.

## Level and word selection

The target combines the last active CEFR family with the next family after
mastery, capped at C2, then falls back to an actually published template level.
Mastery requires both `.1` and `.2` sublevels, access to both and every active
published path test completed with at least 80 percent. Missing tests or one
successful test alone cannot advance a whole family. No course grant is changed.

Personalization considers permitted vocabulary with an error in the past
30 days, from focus-word error timestamps, answered lapses or false answer
receipts. It prioritizes box 1, then recent error activity, and requires a
category match in `slot_forms`; otherwise the reviewed fallback is used.

## Database boundaries and RPCs

Canonical migration `supabase/vps/59_daily_quests.sql` adds the public catalog and own-row
assignments plus private template keys, assignment keys, slot forms and login
claims. Unique user/date constraints and profile-then-assignment row locks make
claim and completion safe across tabs. The date comes from `Europe/Berlin`.
The CLI migration symlinks to that canonical VPS file; its frozen SHA-256 is
`357d906245c207987c05fecc133f537a41fe701589834d5edbb3e0d09f607d1e`.

| RPC | Purpose |
|---|---|
| `claim_daily_quest_login()` | Atomic once-per-day login decision |
| `get_daily_quest()` | Load or create today's assignment without claiming login |
| `get_daily_quest_status()` | Read preference, today's status and streak |
| `set_daily_quest_enabled(boolean)` | Change the authenticated student's preference |
| `submit_daily_quest_step(uuid,text,jsonb)` | Validate an ordered station answer |
| `skip_daily_quest(uuid)` | Compatibility no-op for older clients; returns current assignment |
| `complete_daily_quest(uuid)` | Complete all verified stations idempotently |
| `get_daily_quest_preview(text)` | Read-only teacher/admin template and answer keys |

RLS allows authenticated reads of active public templates and only one's own
assignments. Browser roles cannot write assignments, private tables or streak
columns directly. Public RPCs invoke narrowly granted helpers with empty
`search_path`; live role and `auth.uid()` checks protect every operation.
The cookie-bound DAL repeats verified Auth/role checks and validates input/output
with Zod. Student DTOs strip authoring keys. No service key is sent to clients.

Completion awards at most one day. Consecutive completions increment the current
streak; a gap starts it at one. Status displays zero once the last completion is
older than yesterday, preserving the longest streak. Leaving does not affect it.
Staff preview at `/[lang]/admin/daily-quest` exposes keys only after staff checks;
its injected callbacks grade locally, create no assignment and award no streak.

## Speech and rollout

Scene, selected word and exercise audio use independent sources. All German
learning characters now use `de_DE-thorsten-high` through the same canonical
request and immutable audio-cache identity as the vocabulary and pronunciation
trainers. The engine does not select a persona from authored character data.
The DTO contract and PostgreSQL constraints require `voice: "male"` for every
character. Names, roles and illustrated people must be male, as defined globally
in `AGENTS.md`. The bakery host is Martin; the generated scene is
`/Bilder/deutschreise/sitov-bakery-male.png`. All six starter levels use it.

On 2026-10-03 the user selected an immediate male-character fallback if no
concrete female-quality repair was available. The former female source was
`de_DE-mls-medium-speaker2`, a separate 22,050 Hz audiobook model. A previously
shipped phoneme-context/cropping correction fixed garbled short phrases and
passed ASR intelligibility checks, but those checks did not establish natural
voice quality comparable to Thorsten. The fallback therefore avoids further
speculative tuning and gives the lessons the established trainer voice.
Historical female synthesis support and attribution remain in the local speech
service; learning scenes no longer request it. Thorsten is CC0; preserve Piper
GPL-3.0 and ONNX Apache-2.0 attribution in `deploy/vps/TTS_LICENSES.md`.

Migration `64_daily_quest_male_characters.sql` updates template content and all
existing assignment snapshots, including completed or skipped assignments. It
changes only character metadata, the bakery illustration/alt text and the
incorrect self-introduction option from Anna to Lukas. Assignment IDs, step IDs,
option IDs, private grading keys, completion state, personalization and streaks
are preserved. Male-only constraints reject new female character payloads.
Historical seed 59 uses the same current metadata so reapplying the complete
migration sequence remains safe. The archived pilot uses seven new Thorsten MP3
assets; old macOS Anna recordings are no longer referenced.

Passed preparation checks include 19 DB cases, eight concurrent login and eight
completion sessions on native PostgreSQL 17, and a full 17-schema VPS clone on
PostgreSQL 15.8 with real production ACLs. The complete Jest run passed 192 suites
and 2,404 tests (one suite/test skipped); TypeScript and three Python persona
tests passed. At 320px the real engine's three stations, wrong/right answers,
stamp and soft navigation passed with isolated QA callbacks; at 390px the actual
word-to-scene audio source switch passed. These are separate from SQL checks and
production application HTTP checks recorded in the release receipt.
The final SQL was reapplied twice on the PostgreSQL 15.8 clone; ACL/RLS and three
new accepted sentence orders passed again, as did all 19 DB cases.
Deploy the matching application, migration 59 and pinned local voice model;
record release SHA and Berlin activation time only after readiness succeeds.
`supabase/vps/rollback/59_daily_quests.sql` revokes feature access without deleting
assignments, preferences or earned streaks. Pair it with the matching application
rollback; reapplying 59 restores access to the preserved records. The archived
`/[lang]/reise/beim-baecker` route remains development-only.

For the shared VPS, select the tested bounded Webpack preparation with
`SITOV_BUILD_BUNDLER=webpack`, memory cap 2560 MiB, heap 1536 MiB, reserve
1024 MiB and one worker. Only Studio and Analytics may be paused temporarily
for preparation and must be restored. The compiler choice does not disable
TypeScript, artifact verification, memory guards or rollback protections.
Thirteen deployment contract tests cover both compiler choices and early
rejection of invalid values. Default preparation continues to use Turbopack.
