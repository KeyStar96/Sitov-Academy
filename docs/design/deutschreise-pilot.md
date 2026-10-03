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
were synthesized by the same `de_DE-thorsten-high` VPS model used in the trainers.
The scene now depicts Martin, matching the global male learning-character rule in
`AGENTS.md`. The previous macOS Anna recordings are no longer referenced.
Restarting or reloading clears the round.

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
