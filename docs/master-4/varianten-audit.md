# Phase 1.4 – Varianten-Audit der Vokabel-Satzkarten

Stand der lesenden Bestandsaufnahme: `2026-09-25T20:30:08.145036+00:00`. Erfasst wurden **alle 26 aktiven gemeinsamen Satzkarten** (`sentence_practice=true`) aus **512 aktiven gemeinsamen Karten**, aktuell ausschließlich A1.1. Die 486 übrigen Karten besitzen deutsche Kontextsätze, werden aber nicht als Satz-Schreibaufgabe ausgeliefert. Private eigene Wörter, Konten und Lernstände wurden nicht abgefragt.

Das Skript [`scripts/audit-vocabulary-variants.mjs`](../../scripts/audit-vocabulary-variants.mjs) prüft du/Sie einschließlich Possessivformen, verschiebbare Zeit-/Ortsangaben, Tschüs/Tschüss, geht’s/geht es, Ich heiße/Mein Name ist, Ziffern/Zahlwörter und Preise. Es meldete **15 Karten: 7 Anrede- und 8 Satzstellungsfälle**. Die fünf übrigen Kategorien kommen im aktuellen Satzbestand nicht vor und werden durch gezielte Skripttests geprüft. Die Heuristik ist ein redaktioneller Hinweis; sie setzt niemals Inhalte global gleich. Neu aktivierte oder bearbeitete Satzkarten müssen erneut geprüft werden.

Vorher-Snapshot: [`vocabulary-sentence-audit.json`](../../scripts/fixtures/vocabulary-sentence-audit.json), SHA256 `6f69bc6e21ceb56c56ecfb599453b2230f7d466e5ece9d91be3ebe4345d41450`. Die maschinenlesbare Entscheidungsliste liegt in [`vocabulary-variant-decisions.json`](../../scripts/fixtures/vocabulary-variant-decisions.json).

## Entscheidungen für jeden gemeldeten Satz

Die Höflichkeitsform bleibt ausdrücklich Lernziel: du und Sie werden nicht als gleichwertig akzeptiert. Bei den acht Stellungsvarianten bleiben Person, Zeit, Ort und Aussage gleich; nur die Stellung der Zeit-/Ortsangabe ändert sich. Alle bestehenden Antworten bleiben erhalten.

| Karten-ID | Lektion | Deutscher Satz | Entscheidung | Begründung |
|---|---|---|---|---|
| `0e418b9e-c02d-4148-b262-a608d369cadb` | Lektion 1 | Wie ist Ihre Telefonnummer? | Zielform `[Ihre]` | Formelle Anrede ist Lernziel; du wird nicht gleichgesetzt. |
| `3d4ea48d-5efe-460b-bdfe-3e14f5f2bb21` | Lektion 1 | Ich wohne in Deutschland. | Zusätzliche Antwort: „In Deutschland wohne ich.“ | Gleiche Aussage mit veränderter Stellung der Zeit-/Ortsangabe. |
| `48c57bb9-a03c-4a4d-b386-28b95975d66b` | Lektion 1 | Welche Sprache sprechen Sie? | Zielform `[Sie]` | Formelle Anrede ist Lernziel; du wird nicht gleichgesetzt. |
| `59ffe0cf-f9c7-455a-b086-54153690cbce` | Lektion 1 | Woher kommen Sie? | Zielform `[Sie]` | Formelle Anrede ist Lernziel; du wird nicht gleichgesetzt. |
| `70d12be8-01c9-48a2-b2ca-cac05066412d` | Lektion 1 | Wie ist Ihr Name? | Zielform `[Ihr, Name]` | Formelle Anrede ist Lernziel; du wird nicht gleichgesetzt. |
| `b15bfa51-740c-4eac-813b-6fca868eabbd` | Lektion 1 | Danke für Ihre Hilfe! | Zielform `[Ihre]` | Formelle Anrede ist Lernziel; du wird nicht gleichgesetzt. |
| `e9871cab-6f5b-4a30-9cd1-f6bd2406bfda` | Lektion 1 | Wie ist Ihre Adresse? | Zielform `[Ihre]` | Formelle Anrede ist Lernziel; du wird nicht gleichgesetzt. |
| `69d845b3-4310-4919-986a-80bf913822b0` | Lektion 2 | Ich wohne in Hannover. | Zusätzliche Antwort: „In Hannover wohne ich.“ | Gleiche Aussage mit veränderter Stellung der Zeit-/Ortsangabe. |
| `770b2edb-43a1-4935-adbd-9570c39b46e5` | Lektion 2 | Meine Familie lebt in Deutschland. | Zusätzliche Antwort: „In Deutschland lebt meine Familie.“ | Gleiche Aussage mit veränderter Stellung der Zeit-/Ortsangabe. |
| `fc3f909e-d640-4664-a559-d971861e0613` | Lektion 3 | Ich trinke morgens Kaffee. | Zusätzliche Antwort: „Morgens trinke ich Kaffee.“ | Gleiche Aussage mit veränderter Stellung der Zeit-/Ortsangabe. |
| `d280c958-b4fe-4b4f-97ff-b75f8fb7a899` | Lektion 4 | Ich koche in der Küche. | Zusätzliche Antwort: „In der Küche koche ich.“ | Gleiche Aussage mit veränderter Stellung der Zeit-/Ortsangabe. |
| `2ad0f4dc-7dbc-423d-87b8-aa67f2c94114` | Lektion 5 | Ich arbeite von Montag bis Freitag. | Zusätzliche Antwort: „Von Montag bis Freitag arbeite ich.“ | Gleiche Aussage mit veränderter Stellung der Zeit-/Ortsangabe. |
| `b957a819-1077-4bdb-8de8-a7e770d2642f` | Lektion 5 | Ich bin heute sehr müde. | Zusätzliche Antwort: „Heute bin ich sehr müde.“ | Gleiche Aussage mit veränderter Stellung der Zeit-/Ortsangabe. |
| `e0fe2ac8-8518-48f8-862d-02fdf4cdf44c` | Lektion 6 | Wie ist das Wetter heute? | Zusätzliche Antwort: „Wie ist heute das Wetter?“ | Gleiche Aussage mit veränderter Stellung der Zeit-/Ortsangabe. |
| `f125e23c-f5c1-4604-b418-8937982aca06` | Lektion 7 | Woher kommen Sie? | Zielform `[Sie]` | Formelle Anrede ist Lernziel; du wird nicht gleichgesetzt. |

## Vollständigkeit: weitere elf Satzkarten

Diese Karten wurden ebenfalls geprüft; keine der geforderten typischen Mehrdeutigkeiten wurde gefunden. Ihr Inhalt und ihre Antworten bleiben erhalten.

| Karten-ID | Lektion | Deutscher Satz |
|---|---|---|
| `5ab5409a-2d71-4e95-a0d2-7a9864a76688` | Lektion 1 | Ich spreche Deutsch und Russisch. |
| `8c1aa2cd-bf20-49fe-ab40-402a0d29f22e` | Lektion 1 | Mein Vorname ist Anna. |
| `8dc37b6a-6cf4-4bb9-93ae-870d4ba16187` | Lektion 1 | Entschuldigung, wo ist der Bahnhof? |
| `af776643-126c-4cdf-8bff-b32ac63f78fa` | Lektion 1 | Ich lerne Deutsch. |
| `b2030cf8-16e1-4d25-91a8-63a8853cc21b` | Lektion 1 | Mein Nachname ist Müller. |
| `1a03578f-3e9b-42a1-a45f-a60c4152df15` | Lektion 2 | Wir lernen zusammen Deutsch. |
| `a2f81e78-789c-4017-b53f-c4217fdbc7e4` | Lektion 2 | Ich verstehe die Frage nicht. |
| `e183c8a4-e15a-40ad-b97d-1dccd79f5cc5` | Lektion 3 | Ich kaufe ein Brot. |
| `73affc2d-5aba-4b26-a66d-d2562a7db202` | Lektion 4 | Ich suche eine Wohnung. |
| `20dd2336-d1c6-4bdd-b858-285f42c4b702` | Lektion 7 | Wir lernen zusammen Deutsch. |
| `58c08d0e-43f9-447e-9ca9-afd6fffeeb53` | Lektion 7 | Ich schreibe eine E-Mail. |

## Übernahme, Rückweg und Nachprüfung

[`31_vocabulary_target_forms.sql`](../../supabase/vps/31_vocabulary_target_forms.sql) ergänzt die optionale Spalte `learning_vocabulary_cards.target_form text[]`, erweitert ausschließlich den Vokabelzweig der bestehenden CMS-RPC und übernimmt die 15 Entscheidungen. Jede Datenänderung verlangt die konkrete Karten-ID, den unveränderten deutschen Satz, eine aktive gemeinsame Unit und aktivierte Satzübung. Abweichende Inhalte werden nicht blind geändert; der abschließende Audit meldet verbleibende Fälle.

`learning_private.vocabulary_variant_backups` bewahrt die vorherigen und angewendeten Arrays ohne Browserzugriff. Erneutes Ausführen überschreibt weder die erste Sicherung noch spätere CMS-Änderungen. Der [Rückweg](../../supabase/vps/rollback/31_vocabulary_target_forms.sql) stellt unangetastete Entscheidungen wieder her und entfernt den CMS-Funktionszusatz. Nachträglich bearbeitete Karten, optionale Spalte und Archiv bleiben erhalten, damit keine neuen Inhalte verloren gehen. Ein erneutes Einspielen nach dem Rückweg wird ebenfalls geprüft. Backup und Ausführung auf dem produktiven Klon/Release werden im Phase-1-Prüfbericht dokumentiert.

Reproduzierbare Befehle:

```bash
node scripts/audit-vocabulary-variants.mjs --snapshot scripts/fixtures/vocabulary-sentence-audit.json
node scripts/audit-vocabulary-variants.mjs --ssh-host sitov-academy --check
node --test supabase/tests/vocabulary-variants.test.mjs
npx jest __tests__/admin-vocab-editor.test.tsx __tests__/vocabulary-admin-validation.test.ts --runInBand
```

`--ssh-host` führt ausschließlich `REPEATABLE READ READ ONLY` mit 30 Sekunden Statement-Limit und anschließendem `ROLLBACK` aus. `--check` beendet sich mit Fehlerstatus, sobald eine gemeldete Satzkarte weder Zielform noch alternative Antwort besitzt. Die gespeicherte Vorher-Datei hat erwartungsgemäß 15 offene Fälle; der DB-Test importiert alle 26 echten Satzkarten in die aktuelle isolierte Datenbank, führt Migration 31 aus und verlangt danach **15 von 15 aufgelöste Meldungen**.

Geprüft: **6 DB-/Skripttests bestanden**, einschließlich doppelter Migration, doppeltem Rückweg, Wiederanwendung, vollständig erhaltenem Bestand, unveränderten RPC-Berechtigungen, gesperrtem Archivzugriff sowie CMS-Speichern/Erhalten/Leeren/Fehlern. **12 Jest-Tests in zwei Suites bestanden**, einschließlich neuer Zielformen/Alternativen, Erhalt bei anderen Änderungen und Knopfreihenfolge. Der erste neue CMS-Test deckte eine unpräzise Formularbeschriftung auf; die Hilfetexte stehen nun außerhalb des Labels und sind per `aria-describedby` zugeordnet. Kein Test wurde gelöscht oder übersprungen.

Die abschließende Prüfung ergänzte einen Regressionstest für ältere CMS-Payloads: Weggelassene Zielformen und Alternativen bleiben auch durch Zod-Validierung und RPC-Abbildung weg. Nur explizite leere Arrays löschen die entsprechenden Werte. Die DB-RPC übernimmt ausgelassene Felder weiterhin aus der bestehenden Karte; Migration 31 bleibt unverändert.
