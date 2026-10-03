# Deutschreise · Beim Bäcker

First interactive design pilot for Sitov Academy. The scene combines vocabulary,
sentence building and a short scripted conversation, ending with a travel stamp.

- Local preview: `npm run dev -- --port 3002`, then
  `http://localhost:3002/de/reise/beim-baecker`.
- Editable Figma design and speech-bubble timeline:
  https://www.figma.com/design/KbqXmrZJOdSSjPyRVJps7v?node-id=3-41
- Asset provenance, final image prompt, audio transcripts and motion values:
  [`deutschreise-assets.json`](./deutschreise-assets.json).

## Archived pilot access

The server page calls `notFound()` whenever `NODE_ENV !== 'development'`, before
reading route parameters. There is no production opt-in flag. Keep this guard:
the archived `/[lang]/reise/beim-baecker` pilot must remain development-only.
Its original local acceptance did not deploy it or add navigation/sitemap links.

On 2026-10-02 the user explicitly authorized production activation of the new,
integrated Daily Quest feature at `/[lang]/dashboard/daily-quest` and its protected
teacher preview at `/[lang]/admin/daily-quest`. That authorization applies to the
new integration; the archived pilot guard stays intact. See
[`daily-quests.md`](./daily-quests.md) for architecture and the rollout record.
At this documentation checkpoint the new rollout is still in preparation;
its release SHA, activation time and final production HTTP evidence are pending.

The pilot uses only local React state. It does not write learning records, call AI
services, record a microphone, change database access or implement payments.
Hearing examples plays seven local MP3 files on explicit user interaction. These
were regenerated on 2026-10-03 with the canonical male German Qwen3-TTS voice,
`sitov-qwen-male-de-v1`, revision `sitov-qwen-base-bf16-v1`. The pinned model,
generation settings, original CC0 Thorsten speaker reference and output contract
are in [`lib/audio/models/sitov-qwen-male-de/config.json`](../../lib/audio/models/sitov-qwen-male-de/config.json).
The seven transcripts and existing audio URLs are unchanged. Per-file audio and
text SHA-256 values are recorded in `deutschreise-assets.json`.
The scene now depicts Martin, matching the global male learning-character rule in
`AGENTS.md`.
Restarting or reloading clears the round.

## Offline audio authoring

Run `node scripts/sitov-deutschreise-audio.mjs` to validate the seven transcripts
without writing. To regenerate, configure `SITOV_QWEN_PYTHON`,
`SITOV_QWEN_MODEL_PATH`, `SITOV_QWEN_ALIGNER_PATH` and, where needed,
`PATH_AUDIO_FFMPEG`; pass `--generate --output <staging-directory>`. The script
invokes the pinned local Qwen batch CLI once, using the shared generation lock.
Review the staging audio, then use `--install --output <staging-directory>` to
validate all seven provider, model, reference, text and file fingerprints before
replacing the static assets. A stale or mismatched file rejects the entire bundle
before public files are changed.

The MP3 files are mono, 24 kHz and 48 kbit/s, with the canonical 0.35-second lead-in
and loudness/peak limits. The pilot only plays these checked-in files; learner
playback needs no running model, Mac or local synthesis service. The learning-path
authoring command `scripts/path-listening-audio.mjs` uses the same canonical Qwen
batch CLI for future listening exercises and derives slow playback from the same
normal recording. Its manifest fingerprints include the model and speaker
reference, so earlier engine manifests cannot authorize Qwen uploads.

The 2026-10-03 asset check verified canonical metadata and complete forced lexical
alignment for all seven clips. Independent German Whisper-small ASR reproduced
all seven authored phrases, including “einen Kaffee”; six matched within the real
WAV duration. For “Möchten Sie eine Tüte?” the recognizer assigned an impossible
segment end beyond the short recording, although the recognized words matched.
Raw ASR output and its invented tails were retained in the local authoring
artifacts. These automated checks support transcript review; they do not establish
a human listening-quality rating.

## Validation

- Production build succeeded. A local `next start` served HTTP 404 without pilot
  content for `/de`, `/en` and `/tr` versions of the route.
- Six access tests pass, covering development, other languages, production, test
  and rejection before route parameters are resolved.
- Targeted ESLint, full TypeScript checking and whitespace checks pass.
- Browser verified the complete flow, word gating, wrong-answer feedback, retry,
  restart, audio playback/cleanup and focus on station changes/dialogue completion.
- Responsive checks at 390px and 320px found no horizontal control/text overflow.
- The current high-contrast preference is respected. Reduced-motion behavior was
  reviewed and the existing Framer/React hydration contract checked for both
  motion preferences; fresh browser verification had no console errors.

The existing global `/_next/static` immutable cache header can retain old dev
chunks during iteration. Port 3002 was used for the final fresh-origin browser
check, so the preview uses the current component and audio logic.

The illustrated scene and Figma layout form the design reference. The web version
adapts to the user's contrast/theme and screen width. Motion follows the Figma
speech-bubble timing once per dialogue state rather than looping its preview.
