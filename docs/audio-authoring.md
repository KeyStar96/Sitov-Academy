# Sitov Academy: deutsche Audios vorberechnen

Alle synthetischen deutschen Hörbeispiele verwenden das männliche Profil
`sitov-qwen-male-de-v1` mit **Qwen3-TTS-12Hz-1.7B-Base**, unverändertem BF16-Modell
und der im Hörvergleich gewählten Referenz. Die vollständige Konfiguration steht
in `lib/audio/models/sitov-qwen-male-de/config.json`. Änderungen an Modell,
Referenz, Parametern, Alignment oder Encoding ändern den Profil-Fingerabdruck
und damit die unveränderlichen Cache-Pfade.

**Auch künftig werden neue Vokabeln, Texte und Aufgaben immer lokal auf dem Mac
vorberechnet und mitsamt Wortzeitmarken in Storage gespeichert.** Der VPS lädt
kein deutsches Sprachmodell. Schüler benötigen keinen eingeschalteten Mac.
Deutsche Cache-Lücken lösen weder Live-Synthese noch Piper-, Browser- oder
Systemstimmen aus. Es gibt keine Speech-API-Gebühren.

Fremdsprachige Übersetzungen verwenden bei Cache-Lücken den serverseitigen
Adapter `lib/audio/sitov-foreign-language-tts.ts`, der ausschließlich den lokalen
Sprachdienst aufruft. Der Adapter lehnt deutsche Syntheseanfragen vor jedem
Netzwerkaufruf ab; deutsche Aufnahmen folgen immer dem Vorbereitungsablauf unten.

## Lokale Umgebung

Der Autor benötigt einen Apple-Silicon-Mac, ausreichend freien Speicher und
Python 3.12. Die isolierte Umgebung liegt außerhalb des Repositorys. Modelle,
Rohaufnahmen, Exportdateien und private Metadaten gehören nicht in Git.

```sh
python3.12 -m venv /absolute/authoring/sitov-qwen-venv
/absolute/authoring/sitov-qwen-venv/bin/pip install -r scripts/sitov-qwen-requirements.txt
/absolute/authoring/sitov-qwen-venv/bin/python scripts/sitov-qwen-prepare.py --help
```

Das Vorbereitungsskript lädt ausschließlich die festgelegten Modellrevisionen.
Referenzaufnahme, Transkript, Herkunft und CC0-Lizenz liegen im Repository.
Modell- und Paketlizenzen stehen in `deploy/vps/TTS_LICENSES.md`.

## Katalog und neue Inhalte

Der schreibgeschützte SQL-Export erfasst Vokabeln, Chunks auf derselben Karte, deutsche Kontextsätze,
Aussprachetexte, tatsächlich abgespielte Grammatiklösungen sowie alle zulässigen
Wortvarianten der Tagesaufgaben. Bestehende Tagesaufgaben-Snapshots werden für ihre
Audio-Texte berücksichtigt, ohne Accounts, Schülerantworten oder Fortschritte zu
exportieren. Zusätzlich exportiert er offene Audio-Vormerkungen aus
`sitov_audio_preparation_requests`. Der lokale Plan ergänzt die sieben statischen
Deutschreise-Texte, normalisiert Unicode und Leerzeichen und entfernt identische
Hörtexte. Auch vorgemerkte Wörter, für die noch keine Vokabelkarte existiert,
werden dadurch beim nächsten frisch exportierten Kataloglauf aufgenommen.

```sh
ssh -o BatchMode=yes sitov-academy \
  'docker exec -i supabase-db-eknmzxvqilojjicinatnllbt psql -X -qAt -U supabase_admin -d postgres -v ON_ERROR_STOP=1' \
  < deploy/vps/export-sitov-audio-catalog.sql > /absolute/private/sitov-catalog-export.json
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/sitov-audio-catalog.ts --export /absolute/private/sitov-catalog-export.json \
  --output /absolute/private/sitov-audio-catalog.json
```

Wenn der CMS-Bereich inaktive Entwürfe unterstützt, neue oder geänderte Inhalte
zuerst inaktiv speichern. Ein inaktiver Entwurf kann vor der Audio-Vorbereitung
gespeichert werden. Aktive Inhalte und die Aktivierung eines Entwurfs werden vor
dem Schreibvorgang auf ihre Aufnahmen und Wortzeitmarken geprüft. Fehlt eine
Aufnahme, wird der normalisierte deutsche Hörtext zur lokalen Vorbereitung
vorgemerkt und die Veröffentlichung mit `prepared_audio_required` beziehungsweise
`missing_audio` abgelehnt. Der bestehende aktive Inhalt bleibt gespeichert; die
Eingaben bleiben im geöffneten Formular. Bereiche ohne Entwurfsfunktion verwenden
denselben blockierten Speicherversuch, um fehlende Texte vorzumerken.

Beim Eintragen eines eigenen Wortes gilt derselbe Ablauf: Ohne vorbereitetes
Audio meldet die Oberfläche `audio_pending` und behält Wort und Übersetzung im
Formular. Es wird noch keine Vokabelkarte und kein Lernstand angelegt. Nur der
deutsche Hörtext wird ohne Benutzer- oder Profilkennung vorgemerkt. Nach lokalem
Erzeugen und geprüftem Import muss das Wort erneut hinzugefügt werden. Erst dann
speichert die Datenbank die Karte mitsamt Audio-URL und gegebenenfalls aktiviertem
Lernstand atomar. Auch direkte RPC-Aufrufe können die Audio-Voraussetzung nicht
umgehen. Ein bereits vorhandenes Hörbeispiel für denselben Text wird wiederverwendet.

Für einen Folgelauf den SQL-Export erneut erstellen und den Katalog damit neu
planen. Ein älterer Export enthält später vorgemerkte Texte noch nicht. Auch
außerhalb des CMS verfasste SQL-Seeds müssen vor ihrer Veröffentlichung den
vollständigen Vorbereitungs- und Importablauf durchlaufen; direkte SQL-Schreibrechte
sind kein Ersatz für diese Autorenregel.

### Zusätzliche eingefrorene Hörtexte

Mit `--authored-texts` lassen sich weitere JSON-Dateien vor der Veröffentlichung
in denselben Gesamtplan aufnehmen. Das Argument ist wiederholbar. Jede Datei
enthält ausschließlich ein nichtleeres Objekt `Record<Audio-ID,string>`, also
stabile Audio-IDs als Schlüssel und die endgültigen gesprochenen Texte als Werte.
Beispielsweise enthält `scripts/sitov-exam-audio-manifest.json` die elf eingefrorenen
B1-Hörtexte. Die Datei wird beim Planen gelesen und bleibt unverändert.

```sh
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/sitov-audio-catalog.ts --export /absolute/private/sitov-catalog-export.json \
  --authored-texts scripts/sitov-exam-audio-manifest.json \
  --authored-texts /absolute/private/sitov-additional-audio.json \
  --missing-only --output /absolute/private/sitov-missing-audio.json \
  --full-output /absolute/private/sitov-complete-catalog.json
```

Für jedes Objekt gelten dieselbe NFC- und Leerzeichen-Normalisierung, Längen- und
Platzhalterprüfung sowie dieselben kanonischen Qwen-Pfade. Identische Hörtexte
werden über alle Dateien und Inhaltsarten hinweg einmal vorbereitet. Ihre
Quellen bleiben als `authored-file:<Dateiname>:<Audio-ID>` erhalten. Audio-IDs
erzeugen keine eigenen Karten oder Player; die veröffentlichende Inhaltsfunktion
muss weiterhin den gemeinsamen Storage-Proof für den tatsächlichen Text erfüllen.
Beim späteren Bündeln dieselben `--authored-texts`-Dateien erneut angeben, damit
Plan und Veröffentlichung dieselben eingefrorenen Texte enthalten.

### Vokabeln und Chunks vor dem Import vorbereiten

`--vocabulary-seed` nimmt denselben Payload entgegen, der anschließend
an den bestehenden Vokabelimport übergeben wird: `{version: 1, units: [...]}`.
Eine Unit enthält `id`, `level`, `label`, `sort_order` und `cards`. Jede Karte hat
eine eindeutige `source_id`, `id`, `content_kind` (`vocabulary` oder `chunk`),
`word_de`, gegebenenfalls `article` und `chunk_de` sowie ein `translations`-Objekt
mit dem fertigen deutschen `de.context_sentence`. Die Audio-Extraktion prüft nur
diesen gesprochenen deutschen Vertrag und die stabilen eindeutigen IDs.
Anderssprachige Felder dürfen zu diesem Zeitpunkt noch fehlen oder unfertig sein;
sie werden vollständig ignoriert. Ihre Vollständigkeit, `sentence_practice` und
die übrigen Inhalts- und Datenbankregeln prüft der echte Importer vor Veröffentlichung.
Die Audio-Extraktion ist keine vollständige Importvalidierung und kein zweites Seedformat.

Wie der tatsächliche Importer normalisiert die Extraktion Vokabeltexte,
`source_id` und Unit-Labels zuerst mit NFC und vereinheitlichten Leerzeichen.
Eindeutigkeit wird erst danach geprüft. Sortierungen von `0` bis `1000000` sind
zulässig. Die Grenzen gelten auf den normalisierten Werten: Wort und Chunk jeweils
500 Zeichen, deutscher Kontext 1000, Quellen-ID 160 und Unit-Label 200. Alle drei
gesprochenen deutschen Felder erfüllen zusätzlich den gemeinsamen deutschen
Quelltext-Guard, einschließlich der gesperrten kyrillischen Unicode-Bereiche.
Diese Regeln werden nicht auf die ignorierten anderssprachigen Felder angewandt.

Der Audioplan verwendet exakt `vocabularyAudioText` für das Wort mit Artikel,
den optionalen `chunk_de` und `translations.de.context_sentence`. Ein Chunk auf
einer Vokabelkarte bleibt Bestandteil derselben Karte und behält deren
`source_id`; nur eine ausdrücklich als `content_kind: "chunk"` verfasste Karte
ist eine eigenständige Chunk-Karte. Plural, Zielformen, alternative Antworten und
anderssprachige Kontexte erzeugen keine zusätzlichen deutschen Aufnahmen.

```sh
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/sitov-audio-catalog.ts --export /absolute/private/sitov-catalog-export.json \
  --vocabulary-seed /absolute/private/sitov-importable-vocabulary.json \
  --missing-only --output /absolute/private/sitov-missing-audio.json \
  --full-output /absolute/private/sitov-complete-catalog.json
```

Auch hier erfolgt die Vorbereitung vor dem Import: den deutschen Teil der Datei
einfrieren, frischen Export ergänzen, fehlende Aufnahmen auf dem Mac erzeugen,
mit denselben Seed-Optionen bündeln, Storage importieren und auditieren, danach
erst den vollständig validierten Seed mit demselben eingefrorenen deutschen Teil
veröffentlichen. Das Ergänzen anderssprachiger Felder ändert Audio-Pfade und Quellen
nicht; jede Änderung an einem gesprochenen deutschen Text erfordert neue Vorbereitung.
Der aktuelle Export enthält
zusätzlich vorhandene deutsche Texte, die der Importer für bestehende Karten
beibehält. Quellen-IDs im Plan lauten
`vocabulary-seed:<Dateiname>:<source_id>:word`, `:chunk` oder `:sentence`.

`content/vocabulary/teacher-source.json` ist eine rohe Autoren-Vorstufe und darf
nicht unmittelbar synthetisiert werden. Wort/Artikel/Chunk und den fertigen
deutschen Übersetzungskontext muss der zuständige Builder zuerst in den tatsächlichen
Importvertrag überführen.
Das abweichende Format `schema_version/locales/levels/lessons` wird nicht als
zweiter Importvertrag angenommen. Ein alleiniger Teacher-Wert `sentence_de`
ersetzt den maßgeblichen gespeicherten deutschen Kontext nicht. Für unabhängig
fertige Hörtexte kann bis zur finalen Seed-Datei ein ausdrückliches
`--authored-texts`-Objekt verwendet werden.

### Folgeläufe und ein anderer Mac

Der frische Export enthält zusätzlich ein schreibgeschütztes Inventar der aktiven
deutschen Storage-Dateien, getrennt nach `user_metadata` und Systemmetadaten.
Archivierte Versionen und Löschmarkierungen zählen nicht als vorhandene Aufnahmen.
Mit `--missing-only` lässt der Plan vorhandene Dateien nur dann aus, wenn Profil,
Stimme, Revision, Text- und Audio-Prüfsumme, vollständige gültige Wortmarkierungen,
MIME-Typ und Größe zum aktuellen Cache-Vertrag passen. `--full-output` erhält
zusätzlich den vollständigen Plan zur Kontrolle.

```sh
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/sitov-audio-catalog.ts --export /absolute/private/sitov-catalog-export.json \
  --missing-only --output /absolute/private/sitov-missing-audio.json \
  --full-output /absolute/private/sitov-complete-catalog.json
```

Anschließend nur `sitov-missing-audio.json` lokal erzeugen und mit demselben frischen
Export und `--missing-only` bündeln. Hat der Plan null Zeilen, entfallen Generierung
und neues Bündel. Die vorhandenen Objekte werden nicht auf einem anderen Mac neu
synthetisiert: Selbst bei gleichem Text und Profil kann eine andere Batch-Zusammensetzung
andere Audiodateien ergeben. `reusedStorageRows` dokumentiert die unverändert
weiterverwendeten Objekte. Ungültige vorhandene Objekte stehen unter
`inventoryCoverage.invalidExistingPaths`; sie brauchen eine kontrollierte Reparatur,
weil der unveränderliche Import abweichende Bytes nicht überschreibt. Vor Veröffentlichung
die Abdeckung des vollständigen aktuellen Katalogs erneut prüfen.

### Neue Lernpfade vor dem Seed-Import vorbereiten

Für einen noch nicht importierten Lernpfad ergänzt `--path-seed` den vorhandenen
`LearningPathSeed`-JSON-Plan. Die bestehende Seed-Validierung prüft das komplette
Array. Für Pfade mit `is_active` ungleich `false` werden alle Fill- und
Multiple-Choice-Übungen aufgenommen, auch aus Knoten mit `is_active: false`:
Der bestehende Import schreibt diese Übungen trotzdem, und die bestehenden
Grammatiksteuerungen filtern die Knotenaktivität nicht. Der Import übernimmt die
Aktivität der Ziel-Unit aus dem oberen `path.is_active`; inaktive Pfade dürfen
weiterhin als Entwurf gespeichert werden. Die Hörtexte entsprechen exakt den
Audiosteuerungen. Andere Übungstypen bekommen dadurch keine neuen Player. Der
Seed und seine IDs bleiben unverändert.

```sh
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/sitov-audio-catalog.ts --export /absolute/private/sitov-catalog-export.json \
  --path-seed /absolute/private/sitov-new-path.json --missing-only \
  --output /absolute/private/sitov-missing-audio.json \
  --full-output /absolute/private/sitov-complete-catalog.json
```

Die Reihenfolge ist: frischer VPS-Export und prospektiver Seed, fehlende Audios auf
dem Mac erzeugen, mit denselben Optionen bündeln, Storage importieren und auditieren,
danach erst den Seed über `scripts/import_learning_path.ts` beziehungsweise
`npm run seed:learning-path -- ... --import --backup-dir ...` importieren. Der
Seed-Import verlangt weiterhin das vorhandene frische Datenbankbackup und prüft
seine Audio-Voraussetzungen. So lässt sich ein neuer aktiver Pfad vollständig
vorbereiten, bevor die geschlossene Seed-RPC ihn veröffentlichen darf.

## Erzeugen und prüfen

```sh
/absolute/authoring/sitov-qwen-venv/bin/python scripts/sitov-qwen-generate.py \
  --catalog /absolute/private/sitov-audio-catalog.json \
  --model-path /absolute/authoring/qwen-model \
  --aligner-path /absolute/authoring/qwen-aligner-model \
  --output-dir /absolute/private/sitov-prepared-audio \
  --lock /absolute/authoring/sitov-generation.lock
```

Die CLI lädt die Modelle nur lokal. Jede fertige Aufnahme wird im Fortschrittsjournal
dauerhaft protokolliert; das Manifest wird regelmäßig und zum Abschluss atomar
gespeichert. Derselbe Aufruf setzt unterbrochene Läufe fort. Synthese und Forced Alignment laufen in getrennten Phasen,
damit beide großen Modelle nicht gleichzeitig den Arbeitsspeicher belegen.
Für größere Kataloge hält `--batch-size 16` das Modell während einer Phase geladen.
Mit `--continue-on-error` werden einzelne Fehler protokolliert und die übrigen
Texte vorbereitet; verbleibende Fehler liefern trotzdem einen Fehlerstatus und
sperren das vollständige Bündel. Nach Änderungen am Katalog `--stage all` verwenden:
eine reine Finalisierung erzeugt keine Rohdateien für neu hinzugefügte Texte.

Der Aligner misst Wortgrenzen aus der erzeugten Aufnahme. Geschätzte, gleichmäßig
verteilte Wortzeiten sind unzulässig. Sichtbare Satzzeichen und vom Aligner
gemessene Intervalle ohne Länge bekommen keinen erfundenen gesprochenen Zeitraum.
Jede Datei enthält 0,35 Sekunden Vorlauf und wird auf ungefähr −18 LUFS mit dem
Zielwert −1 dBTP sowie 24 kHz, Mono und 48 kbit/s MP3 mit seekbaren Xing-Metadaten gebracht.
Metadaten enthalten Profil, Text- und Audio-Prüfsummen sowie die Wortzeitmarken.
Eine fehlgeschlagene oder unvollständig ausgerichtete Aufnahme sperrt den Import.

Stichproben müssen die tatsächliche Aussprache, vollständige Sätze, kurze Wörter,
Artikel, Zahlen, Umlaute und Wortmarkierung prüfen. ASR ergänzt die Hörprüfung;
ein erkanntes Transkript ist keine Bewertung der Natürlichkeit. ASR-Zeitmarken
außerhalb der realen Aufnahmedauer sind kein Beleg für zusätzlichen gesprochenen
Inhalt.

### Bereits importierte Pilotdateien bytegleich übernehmen

Ein vollständiger neuer Batch kann dieselben Texte anders synthetisieren als ein
zuvor geprüfter und bereits unveränderlich importierter Pilot. Dafür übernimmt
`scripts/sitov-qwen-reuse.py` dessen Raw-WAVs und MP3s unverändert in die lokalen
Produktionspfade. Wortzeiten und Modellprovenienz bleiben erhalten; lokale
Metadatenpfade und die Quellen-IDs entsprechen danach dem endgültigen Katalog.
Dies ist eine lokale Dateitransaktion ohne Modell und ohne VPS-Schreibzugriff.

```sh
python3 scripts/sitov-qwen-reuse.py \
  --source-manifest /absolute/private/sitov-pilot/sitov-qwen-manifest.json \
  --target-manifest /absolute/private/sitov-prepared-audio/sitov-qwen-manifest.json \
  --catalog /absolute/private/sitov-complete-catalog.json \
  --lock /absolute/authoring/sitov-generation.lock
```

Der Standardaufruf prüft nur. Erst nach Abschluss des laufenden Generators, bei
freiem gemeinsamem Lock und vollständig fertiggestelltem Zielkatalog denselben
Aufruf mit `--apply` ausführen. Vor jeder Ersetzung werden sämtliche Ziel- und
Quelldateien, Profil, Referenz, Prüfsummen und aus dem Aligner übernommene Wortzeiten
geprüft. Der vollständige Katalog muss exakt dieselben IDs wie das gesamte
Zielmanifest enthalten; zusätzliche unfertige Einträge sperren die Übernahme.
Ein `missing-only`-Plan oder ein unbekannter Vorbereitungsumfang ist für diesen
initialen Reuse unzulässig. Die Pilot-IDs dürfen eine Teilmenge des vollständigen
Zielbestands sein. Beide Metadatensätze müssen `rate: 1` haben; langsamere private Hördateien
dürfen nicht unter einem `qwen-native-1`-Webcache-Pfad veröffentlicht werden.
Sicherungen bleiben lokal unter `.sitov-qwen-reuse-backups`. Ein normaler Fehler
setzt die Ersetzungen zurück; nach einem harten Prozessabbruch stellt
`--recover --target-manifest ... --lock ...` die geprüfte Sicherung wieder her.
Solange die Transaktionsmarkierung existiert, sperren auch Generator-Resume und
Bündel ihre Eingänge, selbst wenn das letzte Manifest schon ersetzt wurde.
Danach verwenden Resume und Bündel dieselben zuerst veröffentlichten Audiodateien.

## Bündeln und in die Datenbank importieren

```sh
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/sitov-audio-catalog.ts --export /absolute/private/sitov-catalog-export.json \
  --manifest /absolute/private/sitov-prepared-audio/sitov-qwen-manifest.json \
  --bundle /absolute/private/sitov-audio-bundle
```

Das Bündeln verlangt jede ausgewählte Katalogdatei, native Geschwindigkeit `rate: 1`
in Manifest und Metadaten, den aktuellen Fingerabdruck, gültiges MP3,
identische Text- und Datei-Prüfsummen und genau eine Wortzeitmarke pro sichtbarem
Token. Roh-WAVs, Modellgewichte und lokale Dateipfade werden nicht in Storage
übertragen. Das geprüfte Bündel wird in ein privates Verzeichnis auf dem VPS
kopiert; der Import läuft dort mit dem vorhandenen internen Storage-Zugang.

```sh
python3 deploy/vps/import-sitov-qwen-audio.py /absolute/private/sitov-audio-bundle
python3 deploy/vps/import-sitov-qwen-audio.py /absolute/private/sitov-audio-bundle \
  --upload --audit --link-recordings
```

Der erste Aufruf validiert nur. Der zweite lädt neue Dateien unveränderlich in
`audio_cache/sitov-qwen-v1/de/`, liest Bytes und Metadaten wieder zurück und
verknüpft anschließend Vokabel- und Ausspracheaufnahmen. Existierende Dateien mit
abweichenden Prüfsummen werden nicht überschrieben. Reale Lehreraufnahmen bleiben
erhalten. Aufgaben-IDs, Inhalt, Antworten, Lernfortschritt und Streaks werden nicht
verändert. Der private Service-Schlüssel verbleibt auf dem VPS und wird nicht
ausgegeben.

Erst nach erfolgreicher Prüfung des gesamten Bündels markiert dieser Import
passende offene Audio-Vormerkungen anhand ihres Cache-Pfads als vorbereitet.
Danach den CMS-Inhalt erneut veröffentlichen beziehungsweise das eigene Wort
erneut hinzufügen. Das Hochladen einer Aufnahme allein veröffentlicht keine
vorgemerkte Karte oder Aufgabe.

Die erstmalige Aktivierung verwendet den vollständigen Katalog und einen strengen
Audit aller Objekte, auch der schon vorhandenen Pilotdateien. `--missing-only`
ersetzt diese Erstprüfung nicht.

Vor der erstmaligen Aktivierung erneut exportieren, damit während der Erzeugung
hinzugekommene oder bearbeitete Texte erkannt werden. Der aktuelle Katalog muss
vollständig vorbereitet und im Audio-Speicher überprüft sein. Erst danach die
Anwendung mit dem neuen Cache und den ausschließlich für Übersetzungssprachen
zuständigen VPS-Dienst gemeinsam aktivieren. Während einer laufenden Migration
darf ein paralleles Redesign-Release die Audio-Änderungen nicht vorzeitig ausrollen.

Die statischen Deutschreise-Aufnahmen nutzen denselben lokalen Generator:
`node scripts/sitov-deutschreise-audio.mjs --help`. Hörverstehen-Autoren verwenden
`node scripts/path-listening-audio.mjs --help`; dessen Generierung ist ebenfalls
rein lokal. Aktuell sind keine privaten Lernpfad-Hördateien im Seed hinterlegt.
