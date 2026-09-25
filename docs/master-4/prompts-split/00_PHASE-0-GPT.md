> **Lies `00_CODEX-4-RULES.md` und diese Datei. Führe ausschließlich Phase 0 aus.**

## PHASE 0 — BESTANDSAUFNAHME UND DESIGN-RICHTLINIE

**Ziel:** Eine gesicherte Ausgangslage, damit jede spätere Phase auf geprüften Fakten aufsetzt. **Keine Codeänderung in dieser Phase**, nur Dokumente.

#### 0.1 Status-Datei
* [ ] `docs/master-4/STATUS.md` nach der Vorlage in Anhang B anlegen.
* [ ] Aktuelle Revision, letzte Migration, nächste freie Nummer und laufendes Release (`/api/health`, aktive Revision auf dem VPS) eintragen.

#### 0.2 Prüfbericht (S2) über alle Befunde
* [ ] Für jede Datei, Funktion, Tabelle und Spalte, die dieser Prompt nennt, eine Zeile `Ort | Erwartet | Gefunden | Delta`. Grundlage sind die Befunde in `docs/master-4/ZWISCHENBERICHT.md` Abschnitt 3.
* [ ] Auf dem VPS nur lesend prüfen:
  * Wie viele Vokabel-Lektionen hat A1.1, und passen sie der Reihe nach zu den sieben Lehrbuch-Lektionen? (Wichtig für die Wortschatz-Zuordnung in Phase 4.)
  * Wie viele Grammatik-Units und Aufgaben gibt es je Niveau, wie viele sind `incomplete`?
  * Welche Werte hat `public.exercise_type`?
  * Wie ist `learning_exercises.content` heute eingeschränkt (Constraint aus 2.6)?
  * Welche Spalten haben `private.mail_outbox`, `profiles`, `learning_units`, `learning_vocabulary_cards`?
  * Liefert der heutige Grammatik-Trainer die Lösungen (`accepted_answers`) vor der Antwort an den Browser aus? (Maßgeblich für R5 im Lernpfad.)
* [ ] Abweichungen oben im Bericht zusammenfassen und den betroffenen Phasen zuordnen.

#### 0.3 Test-Baseline
* [ ] Vollständige Läufe von Jest, DB-Tests, Python-Tests, `tsc`, Build und `e2e/accessibility.spec.ts`. Zahlen (bestanden, fehlgeschlagen, übersprungen) in `STATUS.md`.
* [ ] Bereits rote Tests mit Ursache dokumentieren. Sie werden nicht versteckt (R6), aber auch nicht dieser Phase angelastet.

#### 0.4 Design-Richtlinie
* [ ] `docs/design/lernraum-designrichtlinie.md` aus D1–D13 anlegen, ergänzt um: vorhandene Tokens und Klassen mit Dateiort, die neuen Modus-Tokens als Vorschlag mit gemessenem Kontrast, je ein kurzes Code-Beispiel für Druck, wandernde Pille und reduzierte Bewegung.
* [ ] Bildschirmfotos des Ist-Zustands (Home, Niveau-Seite, Vokabeln, Grammatik, Aussprache, Mediathek; Handy und Desktop) unter `docs/master-4/ist/` ablegen. Sie dienen später als Vorher-Vergleich. Keine echten Personendaten auf den Bildern.

**Abnahme Phase 0:** `STATUS.md`, Prüfbericht und Richtlinie liegen im Repo und sind gepusht; `git diff --stat` enthält außer diesen Dokumenten und Bildern nichts.

**Übergabe:** Abweichungen, Baseline-Zahlen, Anzahl der Vokabel-Lektionen in A1.1 und die Antwort zur Lösungsauslieferung stehen in `STATUS.md`.

---