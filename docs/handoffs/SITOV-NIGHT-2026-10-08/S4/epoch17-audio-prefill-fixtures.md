# S4 · Epoch 17 · Vorbereitete Referenzen und eigene Wörter

Basis: `d73c9207d56e49942caf026305c810644e6dff29`, Branch `codex/sitov-night-s4-audio-prefill-fixtures`.

## Befund und Änderung

Die beiden Full-Jest-Fehler waren veraltete Importgrenzen: Das Sprechstudio importiert neue Server-Actions, die alte Fixture lud dadurch `next/cache` in jsdom. Die Lektionenseite importiert inzwischen den server-only Ziel-Resolver. Beide Fixtures mocken jetzt genau diese aktuellen Ports. Keine Produktdatei, globale Polyfills, Readiness-Flags oder Autorisierungsregeln wurden geändert.

Die Studio-Fixture erstellt schemavalide Katalogeinträge mit UUIDs, aktuellem Text-/Test-Fingerprint, abgeschlossenem Versuch und passendem Nachweis. Erst das explizite Öffnen bzw. der exakte gespeicherte Zieltext löst den aktuellen Katalog-Recheck und danach den privaten Promptabruf aus. Die Tests sichern die Aufrufreihenfolge und die kanonische Referenz `{ kind: reading_text, id, part: reference }` mit exaktem Kursniveau und deutscher Sprache. Das Studio reicht auch für Lehrertexte keine freie Audio-URL weiter; der gemeinsame Adapter löst die kanonische Referenz serverseitig auf. Der frühere separate Waveform-Zweig im Studio existiert nicht mehr.

Der Playback-Port meldet wie bisher einen exakten Wortindex unabhängig von der Fortschrittsfraktion. Der echte Karaoke- und Checkpoint-Code markiert damit das lange zweite Wort und speichert 0,9 mit Prompt-ID, Kursniveau, Nutzer, Revision und keepalive-Anfrage. Ein gespeicherter zweiter Text erhält nach seinem Recheck die Position 0,35, ohne beim Öffnen zu schreiben. Beim Textwechsel erhält der Player ausschließlich die neue Referenz und Position 0. Fehlender Nachweis, widerrufener Zugriff und inzwischen nicht bestandener Katalog verhindern privaten Text, Player, Recorder und Checkpoint-Schreibzugriffe.

Die eigene-Wörter-Fixture gibt am Ziel-Resolver nur für `undefined` (gewöhnlicher Query-Aufruf ohne Empfehlung) `null` zurück; ein unerwartetes Ziel wirft einen Fixturefehler. Array- und überlange Querywerte bleiben verworfen. Ein neuer tatsächlicher Route-zu-Form-Test prüft getrimmte gültige Phrase und Beispiel, die private Vorbelegung und fehlendes automatisches Speichern. Bestehende Aussagen zu manueller Übersetzung, explizitem Submit, `audio_pending` und fehlender privater Lektion bleiben erhalten.

## Verifikation und Grenzen

- Nur zwei zugewiesene Jest-Suites: **15/15 Tests bestanden**, 2/2 Suites; `/tmp/sitov-s4-epoch17-jest.log`.
- ESLint nur auf beiden geänderten Testdateien: **0 Fehler, 0 Warnungen**; `/tmp/sitov-s4-epoch17-eslint.log`.
- `git diff --check` und abschließender Arbeitsbaum: sauber.
- Kein Browser-, Runtime-, Gesamt-Jest-, TypeScript-, Build-, SQL- oder Syntheselauf. Keine neuen Audioinhalte.
- Dies prüft die UI-/Action-/Playback-Port-Verknüpfung. Der Player bleibt ein gezielter Testdouble; reale Qwen-Dateien, Forced Alignment, Audio-Speicher, aktuelle DB-Rechte und die tatsächliche Auswahl einer Lehreraufnahme werden hier nicht als nachgewiesen bezeichnet.

Eigener minimaler Test-Commit; atomarer S4-Status auf WAITING_FOR_NEXT_START. S4 wartet ohne Folgearbeit auf neues START.
