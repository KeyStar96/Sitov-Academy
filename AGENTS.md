## Branding

Die Schule und Lernplattform heißen ausschließlich **Sitov Academy**. Verwende diesen Namen in Oberflächen, Metadaten und Dokumentation. Neue technische Kennungen verwenden das Präfix `sitov`.

## Motion-Design

**Motion-Design ist eine zentrale Regel für die gesamte Webseite.** Die Oberfläche soll sich lebendig anfühlen und auf Berührung, Pointer, Tastatur und Zustandswechsel unmittelbar und dynamisch reagieren. Neue und überarbeitete Oberflächen verwenden bewusste Auftritte, Druckfeedback, bewegte Auswahl und verständliche Lade-, Erfolgs- und Übergangszustände; wichtige Einstiegskarten dürfen eigenständige Motion-Graphics mit nachvollziehbarer Choreografie erhalten. Gemeinsame Werte und Muster aus `lib/motion.ts`, `components/motion/` und den CSS-Motion-Tokens verwenden; die verbindlichen Gestaltungsregeln stehen in `docs/design/sitov-motion-design.md`. Bewegung darf Text, Fokus und Bedienbarkeit nicht überdecken, Eingaben nicht verzögern und keinen Layoutsprung auslösen. `prefers-reduced-motion` muss eine gleichwertige, ruhige und vollständig bedienbare Darstellung erhalten. Fortlaufende dekorative Bewegung läuft nur im sichtbaren Bereich und bei sichtbarem Browserfenster; Animationen bevorzugen `transform` und `opacity` und räumen Listener, Frames und Timer beim Verlassen auf.

## Lerncharaktere und deutsche Audio-Stimme

Für alle fiktiven Lerncharaktere von Sitov Academy gelten ausschließlich männliche Charaktere. Das umfasst Deutschreise, Tagesaufgaben, Dialoge, Szenenbilder, Avatare und künftige Lernmodule. Namen, Rollen, Bildbeschreibungen und dargestellte Personen müssen dazu passen. Die Regel betrifft fiktive Lerncharaktere; reale Nutzerprofile und fachlich notwendige Beispiele zu grammatischem Geschlecht bleiben sachlich korrekt.

Alle synthetischen deutschen Hörbeispiele verwenden **Qwen3-TTS-12Hz-1.7B-Base** mit dem einheitlichen männlichen Profil `sitov-qwen-male-de-v1`. Modellrevision, männliche Referenzaufnahme, Syntheseparameter und Forced Alignment sind in `lib/audio/models/sitov-qwen-male-de/config.json` festgelegt. **Alle deutschen Audios müssen auf dem Mac lokal vorberechnet und zusammen mit ihren Wortzeitmarken in den Audio-Speicher der Datenbank importiert werden, bevor neue oder geänderte Aufgaben veröffentlicht werden.** Das gilt für Vokabeln, Aussprachetexte, Grammatik, Tagesaufgaben, Deutschreise und künftige Lernmodule. Die Webseite nutzt den gemeinsamen Audio-Adapter ausschließlich zum Abruf vorberechneter deutscher Aufnahmen; der Mac ist im Schülerbetrieb nicht erforderlich. Kein deutscher Piper/Thorsten-Synthesizer, kein weibliches Voice-Profil, keine Browser- oder System-TTS-Ersatzstimme und keine kostenpflichtige Speech-API. Bei neuen Inhalten immer den Ablauf in `docs/audio-authoring.md` verwenden. Tagesaufgaben müssen männliche Charaktere weiterhin im Autorenvertrag und in der Datenbank durchsetzen. Bei Inhaltsumstellungen bestehende Aufgaben-IDs, Antworten, Fortschritt und Streaks erhalten. Reale Schüler- und Lehreraufnahmen sowie deren fachliche Zuordnung bleiben erhalten.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
