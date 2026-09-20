# Inhaltslektorat — Phase 3.4/3.5

Stand: **2026-09-20T13:02:59.086284+00:00** · Datenbank `postgres` · konsistenter Snapshot (`REPEATABLE READ`, `READ ONLY`).
Der Audit liest ausschließlich Inhaltsdaten. Er ändert weder Datenbank noch Dienste; die Dateien dokumentieren den Prüfzeitpunkt.

## Übersetzungen

| Tabelle | Locale | Soll / vorhanden | Fehlende Zeilen | Alle Texte leer | Leere Felder | Pflichtfelder leer | DE-Quelltext ohne Übersetzung | Ohne Kyrillisch | DE-Kopie Zeilen / Felder |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|
| `vocabulary_translations` | de | 512 / 512 | 0 | 0 | translation: 512, context_sentence: 0 | 0 | 0 | 0 | 0 / 0 |
| `vocabulary_translations` | en | 512 / 512 | 0 | 0 | translation: 0, context_sentence: 486 | 0 | 486 | 0 | 0 / 0 |
| `vocabulary_translations` | ru | 512 / 512 | 0 | 0 | translation: 0, context_sentence: 486 | 0 | 486 | 0 | 0 / 0 |
| `vocabulary_translations` | uk | 512 / 512 | 0 | 0 | translation: 0, context_sentence: 486 | 0 | 486 | 0 | 0 / 0 |
| `vocabulary_translations` | tr | 512 / 512 | 0 | 0 | translation: 0, context_sentence: 486 | 0 | 486 | 0 | 0 / 0 |
| `grammar_translations` | de | 604 / 600 | 4 | 0 | hint: 600, smart_hint: 120, explanation: 480; prompt: N/A (Spalte fehlt) | 0 | 0 | 0 | 0 / 0 |
| `grammar_translations` | en | 604 / 99 | 505 | 0 | hint: 99, smart_hint: 19, explanation: 80; prompt: N/A (Spalte fehlt) | 0 | 501 | 0 | 0 / 0 |
| `grammar_translations` | ru | 604 / 103 | 501 | 2 | hint: 101, smart_hint: 23, explanation: 84; prompt: N/A (Spalte fehlt) | 0 | 501 | 2 | 0 / 0 |
| `grammar_translations` | uk | 604 / 99 | 505 | 0 | hint: 99, smart_hint: 19, explanation: 80; prompt: N/A (Spalte fehlt) | 0 | 501 | 0 | 0 / 0 |
| `grammar_translations` | tr | 604 / 103 | 501 | 2 | hint: 101, smart_hint: 23, explanation: 84; prompt: N/A (Spalte fehlt) | 0 | 501 | 0 | 0 / 0 |
| `course_translations` | de | 9 / 0 | 9 | 0 | title: 0, description: 0 | 0 | 0 | 0 | 0 / 0 |
| `course_translations` | en | 9 / 9 | 0 | 0 | title: 0, description: 0 | 0 | 0 | 0 | 0 / 0 |
| `course_translations` | ru | 9 / 9 | 0 | 0 | title: 0, description: 0 | 0 | 0 | 0 | 0 / 0 |
| `course_translations` | uk | 9 / 9 | 0 | 0 | title: 0, description: 0 | 0 | 0 | 0 | 0 / 0 |
| `course_translations` | tr | 9 / 9 | 0 | 0 | title: 0, description: 0 | 0 | 0 | 0 | 0 / 0 |

Zähllogik: Soll = sämtliche Basisdatensätze × fünf Locales, einschließlich archivierter Kurse. Leere Felder betreffen vorhandene Zeilen; fehlende Zeilen werden separat gezählt. „Pflichtfelder“ umfasst nichtdeutsche Vokabelübersetzung, Satzkontext aktivierter Satzkarten und Kurstitel. Grammatik-Hinweise, Erklärungen, Prompts und Kursbeschreibungen sind optional.

Deutsche Vokabeln stehen kanonisch in `learning_vocabulary_cards.word_de`, deutsche Kurstexte in `courses.title/description`. Fehlende redundante de-Übersetzungen sind daher kein Inhaltsverlust; der Audit zählt sie transparent und nutzt die kanonischen Basisfelder für den Sprachvergleich.

„DE-Quelltext ohne Übersetzung“ zählt leere Zielfelder oder fehlende Zielzeilen bei nichtleerer deutscher Quelle. „Ohne Kyrillisch“ betrifft nur nichtleere ru/uk-Zeilen. „DE-Kopie“ vergleicht nichtleere ru/uk/tr-Felder bytegenau mit der deutschen Quelle. `grammar_translations.prompt` wird nach Einführung geprüft, zuvor als N/A ausgewiesen.

**Diese Sprachprüfungen sind Lektorats-Hinweise:** Eigennamen, internationale Wörter und zitierte deutsche Beispiele können korrekt sein. Fehlende optionale Hilfen sind nicht pauschal Fehler. Die Prüfungen erkennen weder jede falsche Übersetzung noch englische Texte zuverlässig.

## Konkrete Sprachhinweise

| Tabelle / ID | Locale | Feld | Befund / Auszug |
|---|---|---|---|
| `grammar_translations` / `18417b2e-d20c-4317-ac54-9a2e85fdea80` | ru | `hint` | `no_cyrillic_in_nonblank_row`: Im Gegensatz zum Russischen (wo das Verb "sein" im Präsens oft weggelassen wird), muss im Deutschen immer ein Verb stehen: "Ich BIN Nico." |
| `grammar_translations` / `7b937f2b-40e0-403b-b7e4-533ac092fc33` | ru | `hint` | `no_cyrillic_in_nonblank_row`: Im Deutschen ist "Mädchen" sächlich (das), da es ein Diminutiv (-chen) ist, unabhängig vom natürlichen Geschlecht. |

2 Hinweise insgesamt; alle Einzelfunde stehen in der JSON-Datei. Keine automatische Übersetzung oder Korrektur vorgenommen.

## Deutsche Lerninhalte

| Tabelle | Zeilen | Geprüfte Felder | Auffällige Zeilen / Felder |
|---|---:|---|---:|
| `learning_exercises` | 604 | topic, content.instruction, content.text_before, content.text_after, content.question, content.correct_answer, content.gap_hint, content.options, content.accepted_answers, content.parts, content.target_form | 0 / 0 |
| `learning_reading_texts` | 149 | sentence_de, focus | 0 / 0 |

Geprüft werden die String-Blätter der angegebenen deutschen Felder nach NFC-Normalisierung auf kyrillische Unicode-Blöcke (einschließlich Extended-D und Modifikatorbuchstaben) sowie `ı ğ ş İ Ğ Ş`. Der Befund beweist keine vollständige Sprachkorrektheit. Lokalisierte Hinweise, Erklärungen und Übersetzungsaufforderungen sind vom deutschen Textfilter ausgenommen; der Prüfbereich entspricht Migration 07.

## Bestand `target_form`

Insgesamt **604** Aufgaben; Zustände: `missing`: **604**.

| Niveau | Gültig | Fehlend | Ungültig |
|---|---:|---:|---:|
| A1.1 | 0 | 102 | 0 |
| A1.2 | 0 | 101 | 0 |
| A2.1 | 0 | 101 | 0 |
| A2.2 | 0 | 100 | 0 |
| B1.1 | 0 | 100 | 0 |
| B1.2 | 0 | 100 | 0 |

Gültig bedeutet: nichtleeres Array ausschließlich nichtleerer Strings. Zielwerte werden nicht aus Lösungen erfunden. Fehlende Zielwerte sind redaktionell zu ergänzen; eine Freigabesperre für solche Aufgaben hat entsprechend Auswirkungen auf den Schülerkatalog.

## Reproduktion und Einzelfunde

```sh
python3 deploy/vps/audit-content.py --ssh-host sitov-academy --container supabase-db-eknmzxvqilojjicinatnllbt --database postgres --output-dir docs/audit
```

Maschinenlesbar: [content-lektorat.json](content-lektorat.json). Enthält alle betroffenen IDs, Locales, Prüfarten und Feldpfade sowie Werte bei Sprachauffälligkeiten, Schemainventar und Zähldefinitionen.

Snapshot-SHA256: `061ec025da7dd1ab1faa73a173952e788afc42cb9e870c10111b552f75193572`. Die Prüfsumme bezieht sich auf den vollständig gelesenen Inhaltssnapshot; der Bericht enthält nur Auditbefunde, keine Lernenden- oder Kontodaten.
