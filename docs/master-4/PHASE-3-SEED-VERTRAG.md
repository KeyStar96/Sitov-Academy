# Phase 3 — Seed- und Aufgabenvertrag

Stand: 26.09.2026. Dieser Durchlauf erstellt ausschließlich Infrastruktur. Der vorhandene Inhalt `supabase/seeds/path-a1.1.json` wurde gelesen und validiert, weder verändert noch importiert. Die wenigen Aufgabenformen in Tests sind technische Fixtures.

## Bestehender Inhalt

Dateigröße: 2.813.970 Bytes. SHA256: `d5d954b7579ababef29876eb5321757d722194bd096ae44bf1ab925864c99a0c`.

| Pfad | Lernziele | Übungsknoten | Wiederholungsknoten | Testknoten | Übungsaufgaben | Wiederholungsaufgaben | Testpool | Testgröße |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| P1 | 16 | 9 | 1 | 1 | 61 | 17 | 34 | 16 |
| P2 | 11 | 10 | 1 | 1 | 64 | 12 | 25 | 12 |
| P3 | 11 | 9 | 1 | 1 | 65 | 11 | 25 | 12 |
| P4 | 11 | 11 | 1 | 1 | 76 | 11 | 25 | 12 |
| P5 | 12 | 10 | 1 | 1 | 76 | 12 | 26 | 12 |
| P6 | 13 | 12 | 1 | 1 | 80 | 13 | 26 | 13 |
| P7 | 13 | 10 | 1 | 1 | 68 | 13 | 29 | 13 |
| Gesamt | 87 | 71 | 7 | 7 | 490 | 89 | 190 | — |

Insgesamt **85 Knoten und 769 Aufgaben**: 407 `fill_in_blank`, 317 `multiple_choice`, 45 `sentence_building`. Der Seed enthält keine der sechs weiteren Formen und keine Spezial-Zweige. Alle neun Formen werden trotzdem durch die Infrastruktur abgedeckt. Alle 769 Aufgaben durchlaufen den neuen Zod-Vertrag ohne Typfilter.

Alle 71 Übungsknoten besitzen eine Merkkarte. Wiederholungs- und Testknoten enthalten im vorhandenen Seed keine Merkkarten; dies ist zulässig. Deutsch steht jeweils in den ursprünglichen Feldern, `en`, `ru`, `uk`, `tr` in `translations`. Das ergibt vollständig fünf Sprachen, ohne den deutschen Sprachschutz zu umgehen.

## Befehle und RPC-Grenze

```sh
node scripts/path-seed.mjs
node scripts/path-seed.mjs /absoluter/pfad/zum/seed.json
```

Beide Befehle prüfen nur. Sie schreiben keine Dateien und stellen keine Datenbankverbindung her. Die Voreinstellung prüft den bestehenden A1.1-Seed. Fehler führen zu Exit-Code 1 und einem Feldpfad zur fehlerhaften Stelle.

Der spätere Importbefehl lautet:

```sh
node scripts/path-seed.mjs supabase/seeds/path-a1.1.json --import
```

Er verlangt ausdrücklich `--import` und die Umgebungsvariablen `PATH_SEED_SUPABASE_URL`, `PATH_SEED_ANON_KEY` und `PATH_SEED_STAFF_ACCESS_TOKEN`. Der Endpunkt muss lokal sein (`localhost`, `127.0.0.1` oder `::1`). Der Access-Token muss eine authentifizierte Lehrkraft oder einen Admin repräsentieren; die RPC prüft `business_private.is_staff()`. Geheimnisse werden nicht ausgegeben. Vor der ersten Anfrage wird die gesamte Datei validiert. **Dieser Import wurde in Phase 3 nicht ausgeführt.**

`public.import_learning_path(p_path jsonb)` nimmt genau ein Element des Seed-Arrays entgegen. Jeder Pfadimport ist eine Transaktion. `path_private.valid_seed_shape` überprüft den Quellvertrag auch in PostgreSQL, einschließlich aller Übersetzungen und Quellkennungen. `public.export_learning_path(p_unit_id uuid)` liefert einen einzelnen Pfad im selben Quellformat; für eine Seed-Datei wird er in ein Array gelegt. Der Export ergänzt den Aktivstatus des Pfads und ordnet Lernziele nach ihrer ID. Quelle und Datenbank werden über die ursprünglichen IDs verknüpft, damit wiederholte Importe dieselben Datensätze treffen. Aus einem späteren Import ausgelassene Knoten werden archiviert; Wiederaufnahme derselben Quellkennung stellt ihre Datenbankidentität wieder her.

## Format des Seeds

Die Datei ist ein Array von Pfaden, ohne zusätzlichen Container. Die folgende Notation beschreibt Feldtypen, keine neu erstellten Lerninhalte.

| Ebene | Felder |
| --- | --- |
| Pfad | `id: string`, `level: AccessLevel`, `path: positive integer`, `slug: string`, `title: string`, `translations: TitleTranslations`, `unit`, `objectives[]`, `nodes[]`, optional `is_active: boolean` |
| Unit | `level: AccessLevel`, `trainer: "exercises"`, `label: string`, `sort_order: positive integer`; Niveau und Reihenfolge entsprechen dem Pfad |
| Lernziel | `id: string`, `area: "grammar" \| "communication" \| "can_do" \| "vocabulary"`, `description: string` |
| Knoten | `id: string`, `kind: "practice" \| "review" \| "test" \| "special"`, `sort_order: positive integer`, `topic: string`, `title: string`, `translations: TitleTranslations`, `goals: string[]`, `exercises[]`; optional `is_active: boolean`, `merkkarte`, `test_size`, `anchor_node_id` nach Knotenart |
| Merkkarte | `card: string`, `rule: string`, `examples: string[]`, `highlight: "article" \| "verb" \| null`, `translations: {en,ru,uk,tr: {rule: string}}` |
| Aufgabe | `id: uuid`, `ref: string`, `goal: string`, `exercise_type`, `content`, `hint: string`, `explanation: string`, `explanation_card: string`, `translations: {en,ru,uk,tr: {instruction,hint,explanation,prompt?}}`; optional `accepted_answers: string[]` als identische Kopie des gleichnamigen Content-Felds |
| TitleTranslations | `{en,ru,uk,tr: {title: string}}` |

`id` auf Pfad- und Knotenebene sowie `ref`, `goal`, `card` und `explanation_card` bleiben die vorhandenen Quellkennungen. Aufgaben behalten ihre ursprüngliche UUID. Datenbank-UUIDs für Units und Knoten sind davon getrennt. `anchor_node_id` eines Spezial-Zweigs bezeichnet im Quellformat die Knoten-Quellkennung innerhalb desselben Pfads; der Import löst sie zur Datenbank-UUID auf.

`lib/learning-path-schema.ts` prüft den vollständigen Vertrag. Unbekannte Objektschlüssel werden zurückgewiesen, Eingabewerte werden beim Prüfen weder gekürzt noch normalisiert. Die Normalisierung für Eindeutigkeitsprüfungen verändert keine gespeicherten Texte. Es gibt keine clientseitige Bewertung.

## Aufgabenformen

Jeder `content` enthält `target_form: string[]` und kann `instruction: string` enthalten. Beide Felder sind deutsch. Die folgenden Felder kommen zusätzlich hinzu. Pflichtfelder stehen ohne `?`.

| Typ | Inhalt zusätzlich zu `target_form` und optional `instruction` | Eingereichte Antwort |
| --- | --- | --- |
| `multiple_choice` | `question`, `options: string[]`, `correct_answer`, `accepted_answers: [correct_answer]` | `{index: number}`; nullbasierter Index |
| `fill_in_blank` | `text_before`, `text_after`, `correct_answer`, `accepted_answers: string[]`, `options?: string[]`, `needs_article?: boolean` | `{text: string}` |
| `sentence_building` | `parts: string[]`, `correct_answer`, `accepted_answers: string[]` | `{indices: number[]}`; vollständige Permutation der nullbasierten Kachelindizes |
| `multi_blank` | `text`, `blanks: [{id, label?, accepted_answers: string[], needs_article?: boolean}]` | `{values: {blankId: string}}` |
| `matching` | `pairs: [{id, left, right}]` | `{pairs: {leftId: rightToken}}`; rechte Tokens kommen aus der Start-RPC |
| `categorize` | `categories: [{id, label}]`, `items: [{id, text, category_id}]` | `{assignments: {itemId: categoryId}}` |
| `dialogue` | `turns: [{id, speaker, prompt, type: "multiple_choice", options, correct_answer} \| {id, speaker, prompt, type: "fill_in_blank", accepted_answers, needs_article?}]` | `{replies: {turnId: number \| string}}`; Auswahlindex oder Text nach Repliktyp |
| `listening` | `transcript`, `audio: {normal, slow}`, `exercise: {type: "multiple_choice" \| "fill_in_blank", content: passender vollständiger Inhalt}` | Antwort des inneren Typs |
| `transform` | `source`, `accepted_answers: string[]`, `needs_article?: boolean` | `{text: string}` |

Bei `matching` liefert die Start-RPC zwei getrennte Listen. Die rechte Seite bekommt einen stabilen Token aus `md5(right)` und eine unabhängige Reihenfolge. Sie erhält nie die zugehörige linke Paar-ID. Der Client verwendet ausschließlich die gelieferten Tokens; er rekonstruiert keine Bewertung.

`listening.audio.normal` und `.slow` sind lokale absolute URL-Pfade, beispielsweise unter `/storage/v1/object/…`. Externe URLs, netzwerkrelative URLs, Backslashes, Pfad-Traversierung und entsprechende Prozentkodierung sind unzulässig. `transcript` bleibt in den geschützten Autorendaten. Die Übungs-RPC gibt nur die vorbereiteten Audioreferenzen und den lösungsfreien inneren Aufgabentyp aus. Die Dateierzeugung erfolgt vor dem Lernen über das getrennte lokale Piper-Werkzeug.

Die Start-RPCs verwenden eine Feld-Allowlist. Insbesondere bleiben `correct_answer`, `accepted_answers`, `category_id` an Karten, Dialoglösungen, `transcript`, `target_form`, Hinweise und Erklärungen verborgen. Deutsche Textantworten bewertet `learning_private.grade_answer`; `SOFT_ERROR` zählt als richtig. Die vollständige Aufgabe ist richtig, wenn alle bewerteten Teile richtig sind. Testantworten geben vor dem Abschluss keine Bewertung aus.

## Strukturelle Prüfungen

- Quellkennungen sind nicht leer, maximal 100 Zeichen lang; Aufgaben-UUIDs sind im gesamten Seed eindeutig. Pfadkennung, Reihenfolge und Slug sind je Niveau eindeutig. Knotenkennungen und Reihenfolgen sind je Pfad eindeutig.
- Übliche Texte haben maximal 4.000 Zeichen, Hörtranskripte wegen des lokalen Piper-Vertrags maximal 3.000 Zeichen. Arrays in Aufgaben haben maximal 128 Elemente. Die drei bestehenden Typen behalten für `accepted_answers` die bisherige Grenze von 21 Antworten mit jeweils maximal 1.000 Zeichen. Auswahllisten besitzen mindestens zwei unterschiedliche Einträge.
- Richtige Antworten müssen in `accepted_answers` und gegebenenfalls den Auswahloptionen vorkommen. Auswahloptionen und akzeptierte Antworten sind nach Vereinheitlichung von Leerraum und Groß-/Kleinschreibung eindeutig. Wiederholte Wortkacheln sind erlaubt.
- Feld-, Paar-, Gruppen-, Karten- und Replik-IDs sind innerhalb ihrer jeweiligen Liste eindeutig. Paarseiten sind eindeutig. Jede Kategorisierung verweist auf eine existierende Gruppe.
- Jeder Hauptpfad besteht aus mindestens einem Übungsknoten, genau einem Wiederholungs- und einem abschließenden Testknoten. Spezial-Zweige hängen an Übung oder Wiederholung desselben Pfads und verändern die Hauptreihenfolge nicht.
- Jeder Übungsknoten hat eine vollständig übersetzte Merkkarte. Testknoten besitzen keine Merkkarte. Nur Testknoten haben eine `test_size`; nur Spezial-Zweige haben einen Anker.
- Jedes Aufgabenziel gehört zu den Zielen seines Knotens und zu den Lernzielen seines Pfads. Jedes Knotenziel hat mindestens eine Aufgabe.
- Der Testpool enthält mindestens doppelt so viele Aufgaben wie die Testgröße. Jedes Lernziel ist im Pool vertreten; die Testgröße ist mindestens die Anzahl der Lernziele. SQL zieht aus jeder Zielgruppe und ergänzt die Auswahl, bis die Testgröße erreicht ist. Der nächste Versuch erhält eine andere Auswahl.

Die vorhandene Datei erfüllt diese Bedingungen unverändert. Die Tests prüfen außerdem Ablehnung fehlender Übersetzungen, widersprüchlicher Antworten, unbekannter Ziele, doppelter IDs, unvollständiger Testpools und ungültiger Spezial-Anker. Der PostgreSQL-Import-/Exporttest verwendet ausschließlich einen künstlichen Pfad mit allen neun Aufgabenformen und einem Spezial-Zweig. Seine Daten und `highlight: null` überstehen den Hin- und Rückweg unverändert. Die echte Datei wird auch in SQL nur als Argument der lesenden Validierungsfunktion geprüft; dabei werden keine Lerninhalte in Tabellen importiert.
