# Sitov Academy: Vokabeln und Chunks

Die vollständige Inhaltsvorlage steht in `sitov-vocabulary-seed.json`: 42 Lektionen für A1.1–B1.2 mit 3.027 Karten, vollständigen deutschen Beispielen und gespeicherten Übersetzungen in Englisch, Russisch, Ukrainisch und Türkisch. B2 und C1 wurden zur Konzepterfassung gelesen und inventarisiert, bleiben aber außerhalb dieses Seeds.

| Niveau | Wortkarten | Eigenständige Chunks | Gesamt |
| --- | ---: | ---: | ---: |
| A1.1 | 512 | 14 | 526 |
| A1.2 | 410 | 66 | 476 |
| A2.1 | 514 | 164 | 678 |
| A2.2 | 388 | 43 | 431 |
| B1.1 | 457 | 57 | 514 |
| B1.2 | 330 | 72 | 402 |
| Gesamt | 2.611 | 416 | 3.027 |

Eine Wortkarte enthält **Wort + Chunk + Beispiel auf derselben Karte**. Nur ausdrücklich angelegte Chunk-Objekte ergeben zusätzliche Karten. Neue Karten üben zunächst das Wort beziehungsweise die feste Wendung in beiden Richtungen; das ergänzende Beispiel muss dabei nicht vollständig eingetippt werden. Der bestehende A1.1-Modus `sentence_practice` bleibt erhalten.

## Quellen und Redaktion

`teacher-source.json` erhält alle 2.135 Lehrerinnen-Karten des einbezogenen Materials. `source-inventory.json` dokumentiert die gelesenen Dateien samt Prüfsummen und Zuordnung von Quell- zu App-Lektionen. Die Arbeitsmappen enthalten dieselben Lerninhalte; der vollständige Zellvergleich steht in `workbook-audit.json`. A1.2 enthielt nur die erste Lektion. Die sechs fehlenden Lektionen wurden in `a1.2-expansion.json` passend zu den bestehenden Themen neu verfasst.

`a1.1-baseline.json` ist eine bereinigte, nicht personenbezogene Vorlage der 512 bestehenden Lehrkarten. Sie enthält ausschließlich Inhalts- und Zuordnungs-IDs, Niveau/Lektion, Lernwörter, Artikel/Plural, Sortierung, Antwortformen, Übungsmodus und Übersetzungszeilen. Sie enthält keine Nutzer, Owner, Authentifizierung, Profile, Lernfortschritte, Tokens oder Audio-URLs. Vollständige Datenbankexporte und Transport-Caches bleiben außerhalb des Repositorys.

Die Dateien `a2.2-editorial.txt`, `b1.1-editorial.txt` und `b1.2-editorial.txt` ersetzen Platzhalter und fehlerhafte Kollokationen durch ausformulierte Beispiele. `teacher-editorial-overrides.json`, `chunk-editorial.json`, `a1.1-editorial-overrides.json` und `a1.1-chunks.json` enthalten gezielte deutsche Korrekturen und Ergänzungen. Fiktive Personen sind männlich; weibliche Wörter und sachlich notwendige grammatische Geschlechtsbeispiele bleiben erhalten. Ursprüngliche Quellformen bleiben als Provenienz nachvollziehbar.

Die stabilen `source_id`-Kennungen tragen das Präfix `sitov`. Neue UUIDs werden mit UUID5 im Namespace `c9d7d060-5b39-5619-9d85-460e43d8d6de` erzeugt. Alle 512 A1.1-Karten behalten ihre ursprünglichen Karten- und Lektions-IDs. Die 55 notwendigen Änderungen an alten Lernwörtern oder Beispielen enthalten eine exakte `legacy_revision`-Vorlage; der kontrollierte Import erhält bestehende Antworten, Fortschritt und Lehreraufnahmen und bewahrt alte zulässige Antworten intern.

## Reproduzieren und prüfen

Aus dem Repository-Verzeichnis:

```sh
# Deutscher Seed aus den eingecheckten Quellen und der bereinigten A1.1-Vorlage.
python3 scripts/sitov-vocabulary-content-build.py --assemble

# Vorhandenen privaten Übersetzungscache verwenden; fehlende Werte sind ein Fehler.
python3 scripts/sitov-vocabulary-content-translate.py \
  --cache /absolute/private/sitov-vocabulary-translation-cache.json --offline

# Struktur, vollständige Sprachfelder, IDs, Kartenkonzept und Audio-Freeze prüfen.
node scripts/sitov-vocabulary-import.mjs content/vocabulary/sitov-vocabulary-seed.json
node --test scripts/sitov-vocabulary-content.test.mjs
```

Für einen erneuten Import aus dem Vault zuerst `python3 scripts/sitov-vocabulary-content-build.py --import-sources --vault '/absolute/path/Teacher/Vokabeltrainer '` verwenden. Das Leerzeichen am Ende des ursprünglichen Verzeichnisnamens gehört zum Pfad. Redaktionelle Änderungen an den Quellen müssen anschließend erneut geprüft werden.

Der optionale Übersetzungslauf ohne `--offline` erzeugt ausschließlich beim Verfassen maschinelle Entwürfe für öffentliche, nicht personenbezogene Unterrichtstexte. Er speichert einen Cache nach Sprache und normalisiertem deutschem Text, prüft die zeilenweise Zuordnung und übernimmt keine leeren oder deutschen Ersatzwerte. `translation-overrides.json` enthält das redaktionelle Glossar und gezielte Korrekturen; `native-editorial-audit.json` und `ru-editorial-audit.json` ergänzen Prüfungen von Mehrdeutigkeiten, Wortformen, Uhrzeiten und männlichen Rollen. Die englischen Kopfwortübersetzungen der neu verfassten Niveaus wurden vollständig gegen Chunk und Beispiel gelesen. Russische und ukrainische Problemstellen wurden zusätzlich manuell geprüft. Die übrigen maschinellen Übersetzungsentwürfe können bei fachlichem Lehrerfeedback gezielt weiter verbessert werden. Die Webseite führt keine Übersetzungsaufrufe aus.

## Deutsche Audios vor Veröffentlichung

`german-audio-texts.json` friert die 7.518 eindeutigen Hörtexte des Seeds samt SHA256 des sortierten Textarrays und separatem Hash aller deutschen Kartenfelder ein. Der Inhaltstest verhindert versehentliche Änderungen nach der Audioplanung. Der letzte deutsche Redaktionsschritt korrigierte vier fiktive Personen zu „Er“: `sitov-A1.2-L01-V064`, `sitov-A2.1-L04-V021`, `sitov-A2.1-L05-V023`, `sitov-A2.1-L06-V017`.

Vor `--publish` müssen **alle** deutschen Lernwörter mit Artikel, eingebetteten Chunks und Beispiele auf dem Mac mit Qwen3-TTS-12Hz-1.7B-Base, Profil `sitov-qwen-male-de-v1`, und Wortzeitmarken vorbereitet und geprüft in den Audio-Speicher importiert sein. Der Ablauf steht in [docs/audio-authoring.md](../../docs/audio-authoring.md). Der Importer prüft die exakten vorbereiteten Aufnahmen und blockiert eine aktive Veröffentlichung bei Lücken. Ein eingefrorener Seed allein bestätigt noch keine erfolgte Veröffentlichung.
