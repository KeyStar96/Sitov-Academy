# Sitov Academy: B1-Prüfungsvorbereitung

Implementierungsstand: 3. Oktober 2026, Inhaltsversion 1, **Pilot**. Diese Datei
beschreibt den implementierten Bestand und seine Freigaberegeln. Sie bestätigt
weder einen erfolgten Audioimport noch eine Datenbankmigration oder ein Deployment.

**Oberflächenupdate am 4. Oktober 2026:** Der folgende Pilotbestand bleibt
erhalten. Die aktuelle lokale Navigation wird im Abschnitt
[Trennung der Prüfungsbereiche](#trennung-der-prüfungsbereiche-4-oktober-2026)
beschrieben; die frühere Fünf-Bereiche-Navigation ist damit historisch.

## Einstieg und Oberfläche

Der globale Trainer liegt unter `/{lang}/dashboard/exam-preparation`. Die
Prüfungsniveauauswahl zeigt A1 bis C2; ausschließlich B1 ist verfügbar. Bestehende
B1.1- oder B1.2-Berechtigungen öffnen den gemeinsamen B1-Trainer. Die Kursseiten
verweisen darauf, führen aber keinen eigenen Prüfungstrainer pro Teilniveau.
Aufgaben, Hilfen und Traineroberfläche bleiben Deutsch, unabhängig von `{lang}`;
eine Übersetzung in die Interfacesprache ist nicht vorgesehen.

Die fünf Bereiche heißen „Mein Lernweg“, „Gezielt üben“, „Sprechen & Abgeben“,
„Prüfung üben“ und „Mein Fortschritt“. Eine Aufgabe wird jeweils einzeln geöffnet.
Die Oberfläche verwendet die vorhandenen Sitov-Komponenten `PressableCard` und
`SitovMotionStage`, ergänzende Motion-Grafiken und das mobile Layout in
`components/exam-preparation/`. Zusätzliche Übungen erscheinen in kleinen Gruppen;
Modullisten und Details lassen sich aufklappen. Der Fortschritt ist auch in
„View Progress“ eingebunden; der direkte Einstieg lautet
`/{lang}/dashboard/exam-preparation?level=B1&area=progress`.

## Tatsächlicher Inhaltsumfang

| Bestand | Datei | Umfang und Status |
| --- | --- | --- |
| Gemeinsamer Lernweg | `content/exam-preparation/sitov-b1-pilot.json` | Ein vollständiges Modul „Ankommen und Kontakte“, zehn reguläre Einheiten, 66 Aufgaben im Hauptweg. |
| Neue Lernchecks | dieselbe Datei | Drei feste, voneinander getrennte Gruppen: jeweils fünf Hör- und fünf Leseentscheidungen sowie eine Schreib- und Sprechprobe. Zwei zusätzliche Varianten erhöhen den Bestand auf 90 unterschiedliche Aufgaben. |
| Förderweg | dieselbe Datei, `fallbackUnits` | Zwei zusätzliche Einheiten mit fünf neuen Aufgaben; drei Förderentscheidungen und ein neuer Transfer mit Leseentscheidung und Schreibauftrag. Sie ersetzen keine reguläre Einheit. |
| Weitere Lernwegmodule | `content/exam-preparation/sitov-b1-planned-modules.json` | Sieben Module mit 70 strukturierten Einheitenbriefings, ausdrücklich `draft`; keine fertigen Aufgaben. |
| Formatwerkstätten | `content/exam-preparation/sitov-b1-workshops.json` | Fünf Werkstätten mit je sechs Einheiten und insgesamt 90 eigenen Aufgaben zu Bildbeschreibung, Präsentation/Rückfragen, Interaktion/Planung, Schreiben und integrierten Fertigkeiten. |
| Weitere Hörübungen | `content/exam-preparation/sitov-b1-recording-orders.json` | Acht echte Aufnahmeaufträge mit 36 Aufgaben. Separate freiwillige Hörstudio-Einheiten; erst mit veröffentlichtem, geprüftem Medium zugänglich. |

Die Werkstätten sind abgestufte Vorübungen, keine vollständigen Sätze für jedes
offizielle Prüfungsteilformat. Einige Höraufgaben benötigen noch das vorbereitete
Qwen-Medium. Die acht Hörstudio-Einheiten zählen zusätzlich und verfälschen nicht
den Konzeptplan von 80 Lernweg- und 30 Werkstatteinheiten.

Alle Texte und Szenen sind eigene Inhalte; das geschützte Lehrbuch wurde nicht als
Generierungsquelle verwendet. Fiktive Personen sind ausschließlich Männer. Sechs
eigene Werkstattbilder und drei gesonderte, erstmals im Lerncheck verwendete
fotorealistische WebP-Szenen liegen unter `public/Bilder/exam-preparation/`.
Die neun früheren SVG-Szenen sind im lokalen Arbeitsstand vom 4. Oktober 2026
tatsächlich gelöscht; alte Bild-URLs werden nicht als Archiv weitergeführt.
Die drei neuen Checkbilder zeigen Radioreparatur, gemeinsames Sortieren und
Lernen mit Buch/Notizen. Aufgaben-IDs und Lösungen bleiben erhalten.

## Inhaltsvertrag und serverseitige Bewertung

`lib/exam-preparation/content.ts` ist `server-only` und exportiert `EXAM_MODULES`,
`EXAM_WORKSHOPS`, `EXAM_PRACTICE_MODULES`, `EXAM_TASKS`, `EXAM_AUDIO_ORDERS` und
`EXAM_RECORDING_SESSIONS` sowie die ID-Resolver. Gemeinsame Typen liegen in
`lib/exam-preparation/types.ts`. Das Hörstudio trägt die Kennung
`sitov-exam-b1-human-studio`; seine Aufgaben haben vor Medienfreigabe
`releaseStatus: 'awaiting_media'`.

`lib/exam-preparation/server.ts` erzeugt den Schülerkatalog. Lösungsschlüssel,
Belegstellen, Erklärungen, noch nicht angeforderte Hilfen, Hörskripte und
Produktionsnotizen werden entfernt. Ein fehlendes Medium wird serverseitig
gesperrt. Menschliche Hörstudio-Einheiten bleiben im öffentlichen Katalog in
Vorbereitung, solange ihre Aufnahme nicht freigegeben ist.

`app/actions/exam-preparation.ts` prüft Zugriff, Inhaltsversion, Aufgaben-/Einheits-
zuordnung und Medienvoraussetzungen erneut. Geschlossene Antworten werden gegen
den festen Schlüssel bewertet, einschließlich ausdrücklich hinterlegter Varianten
bei kurzen Textantworten. Offene Texte und Aufnahmen erhalten keine automatische
Richtig/Falsch-Bewertung. Idempotente Request-IDs verhindern doppelte gespeicherte
Antworten und Abgaben bei Wiederholungsversuchen.

Aufgaben-IDs und Versionen bestimmen die Bedeutung gespeicherter Versuche. Bei
einer fachlichen Inhaltsänderung eine neue Version, bei geändertem gesprochenem
Wortlaut eine neue Medienversion vorbereiten. Alte Versuche werden nicht nach dem
neuen Schlüssel umbewertet.

## Feedback, Fortschritt und Förderweg

Im Üben folgen Rückmeldung, Erklärung und genaue Text-/Hörbelegstelle auf die
Antwort. Hilfen werden als eigene Aktion dauerhaft protokolliert; ein Transcript
ist erst nach der eigenen Hörantwort verfügbar. Im Lerncheck gibt es keine
Hilfen, und die Auswertung erscheint erst nach allen zehn geschlossenen
Entscheidungen derselben festen Variante.

Die Regeln in `lib/exam-preparation/progression.ts` unterscheiden „bearbeitet“
und „selbstständig“. Eine geschlossene Aufgabe zählt nach gelesener Rückmeldung
als bearbeitet; selbstständig zählt nur ein richtiger erster Versuch ohne Hilfe.
Bei offenen Aufgaben zählt eine inhaltliche Überarbeitung beziehungsweise
Reflexion nach erhaltenem Feedback als Bearbeitung. Selbstständigkeit verlangt
eine substanzielle Abgabe ohne Hilfe und die entsprechende Lehrkraftbewertung.

Für den normalen nächsten Modulschritt sind mindestens acht von zehn Einheiten,
Nachweise in Hören, Lesen, Schreiben, Sprechen und Lerncheck sowie mindestens
70 Prozent in einem neuen, vollständigen Lerncheck erforderlich. Der Nachweis
„selbstständig“ verlangt zusätzlich mindestens 80 Prozent und acht selbstständig
bearbeitete Einheiten. Checkvarianten werden nicht zu einem Ergebnis aus ihren
jeweils leichtesten Aufgaben vermischt.

Nach zwei nicht bestandenen Varianten öffnen sich die reservierten Einheiten
`sitov-exam-b1-m01-f01` und `sitov-exam-b1-m01-f02`. Drei unterschiedliche
Förderaufgaben und ein erstmals nach dem zweiten Fehlversuch bearbeiteter Transfer
ermöglichen anschließend die bewusste Bestätigung „Ich möchte weiterlernen“.
Dieser Weg bleibt zum Wiederholen markiert und behauptet keine selbstständige
Beherrschung. Eine begründete Lehrkraftfreischaltung ist ebenfalls möglich;
Entwurfsmodule werden dadurch nicht veröffentlicht.

Die Statistik zeigt Bearbeitungen, selbstständige Aufgaben, Einheiten,
Fertigkeiten, Formatfamilien, ausstehendes Feedback und erfasste Aufgabenzeit.
Entwurfsmodule ergeben keinen erreichten Fortschritt. Der Zielprofilwechsel
erhält gemeinsame Lernleistungen. Es gibt keine Bestehensprognose und kein
Prüfungszertifikat. Wörter und Chunks verweisen über `ExamWordBox` auf die
bestehende zugängliche B1-Lernbox; es entsteht keine zweite Vokabeldatenbank.

## Private Abgaben und Lehrkraftarbeit

Das Feedbackpanel liegt unter `/{lang}/admin/exam-preparation`. Administratoren
ordnen reale Lernende einer Lehrkraft zu und hinterlegen die erwartete
Antwortfrist. Lehrkräfte sehen ihre zugeordneten Abgaben, Administratoren den
gesamten Bestand. Feedback enthält eine konkrete Stärke, höchstens zwei
Verbesserungsprioritäten, eine kleine Überarbeitungsaufgabe und eine Bewertung.
Überarbeitungen behalten die Verbindung zur ursprünglichen Abgabe.

Lernende können Texte, Audio oder ein Foto der schriftlichen Arbeit zunächst
als Entwurf speichern. Erst bewusstes Senden an eine zugewiesene Lehrkraft
erzeugt eine eingereichte Abgabe. Die Aufnahmeoberfläche bietet Anhören und
Ersetzen und stoppt nach fünf Minuten; alternativ sind Audiodateien bis 20 MiB
zulässig. Fotos unterstützen JPEG, PNG und WebP. MIME-Typ, tatsächliche Größe,
Besitz und gültiges Uploadticket werden serverseitig geprüft. Eine automatische
Transkription, OCR, Sprechdiagnose oder KI-Korrektur findet nicht statt.

Der Bucket `sitov-exam-submissions` ist privat. Zugriffe erfolgen über RLS und
befristete URLs; Schülerdateien werden nicht zu öffentlich abspielbaren
Unterrichtsmedien. Die Migration
`supabase/migrations/20261003205830_sitov_exam_preparation.sql` umfasst die
Prüfungstabellen, Zugriffsregeln und Uploadtickets. Sie bindet die Abgaben in den
bestehenden Lernstandreset und die Kontolöschung ein. Beim Reset bleiben das
Zielprofil und die reale Lehrkraftzuordnung als Einstellungen erhalten;
verspätete alte Uploadtickets können den Reset nicht rückgängig machen.

## Audio vor Veröffentlichung

### Elf lokale Qwen-Texte

`scripts/sitov-exam-audio-manifest.json` enthält elf eingefrorene exakte Hörtexte
als `Record<Audio-ID,string>`: acht Modul-/Checktexte einschließlich Orientierung
und drei Werkstatttexte. IDs oder Sprecherlabels sind keine Synthesetexte.
Die gemeinsame Anleitung ist [audio-authoring.md](audio-authoring.md); der
Gesamtkatalog nimmt das Manifest mit
`--authored-texts scripts/sitov-exam-audio-manifest.json` auf.

Vor Freigabe ist diese Reihenfolge erforderlich:

1. Einen frischen Datenbankkatalog exportieren und die elf Texte in denselben
   vollständigen Audioplan aufnehmen; identische Texte werden gemeinsam dedupliziert.
2. Fehlende Aufnahmen ausschließlich lokal auf dem Mac mit
   Qwen3-TTS-12Hz-1.7B-Base und `sitov-qwen-male-de-v1` erzeugen. Referenz,
   Modellrevision und Parameter folgen
   `lib/audio/models/sitov-qwen-male-de/config.json`.
3. Die tatsächliche fertige Aufnahme mit Forced Alignment abgleichen und die
   Wortzeitmarken messen; Wortlaut, entscheidende Zahlen/Informationen, Ton und
   Aufgabe gegenhören.
4. Dieselben eingefrorenen Manifesttexte beim Bündeln verwenden, Audio und
   gemessene Wortzeitmarken importieren und den gemeinsamen Storage-Nachweis prüfen.
5. Erst danach die betreffenden Inhalte veröffentlichen. Der Schülerbetrieb ruft
   vorberechnete Aufnahmen über den gemeinsamen Audioadapter ab.

Die Anwendung erzeugt keinen deutschen Ton während einer Schüleranfrage und
bietet keine Ersatzstimme. Eine JSON-Kennung allein beweist keine vorhandene
Aufnahme; `requirePreparedGermanAudio` prüft das tatsächliche Medium.

### Menschliche Aufnahmeaufträge A01–A08

Die vollständigen Skripte, Rollen, Aufgaben, Lösungen und Aufnahmehinweise stehen
in `sitov-b1-recording-orders.json`; die drei Sitzungen stehen in
`sitov-b1-recording-sessions.json`. `script` enthält lesbare Sprecherkennungen,
`spokenText` ausschließlich den gesprochenen Wortlaut. `task.audio.script` muss
diesem `spokenText` exakt entsprechen. Prüfsumme und Alignment beziehen sich
auf den gesprochenen Text der fertigen Schnittfassung.

| Auftrag | Inhalt | Ziellänge | Sitzung |
| --- | --- | --- | --- |
| A01 | Termin im Repair-Café | 30–45 Sekunden | 1 |
| A02 | Interview über ein Ehrenamt | 2–3 Minuten | 2 |
| A03 | Drei Meinungen zum Einkaufen | je 20–30 Sekunden | 3 |
| A04 | Gemeinsam einen Kursausflug planen | 2–3 Minuten | 2 |
| A05 | Kurzvortrag „Zu Fuß im Alltag“ | 90–120 Sekunden | 3 |
| A06 | Eine Reklamation klären | 60–90 Sekunden | 2 |
| A07 | Drei kurze Sprachnachrichten | je 20–35 Sekunden | 1 |
| A08 | Zwei Ankündigungen im Stadtteil | je 30–45 Sekunden | 1 |

Sitzung 1 benötigt 35–50 Minuten einschließlich Tonprobe, Sitzung 2 etwa
45–60 Minuten, Sitzung 3 etwa 30–45 Minuten plus Termin der dritten realen
männlichen Stimme für A03. Anastasia ist bei A02 die reale Interviewerin;
sämtliche fiktiven Rollen bleiben männlich. Fehlende Stimmen werden aufgenommen,
nicht durch behauptete Mehrsprecheraufnahmen ersetzt.

Unter `/{lang}/admin/exam-preparation?view=audio` bearbeiten Lehrkräfte die
Aufträge: zunächst Rohaufnahme, anschließend lokal vorbereitete Schnittfassung
mit tatsächlich gemessenen Wortzeitmarken, dann fachliche Prüfung und explizite
Veröffentlichung. Der private Bucket heißt `sitov-exam-productions`.
Die technische Prüfung verlangt den aktuellen Skripthash, vollständige Marken
für dessen gesprochene Wörter und die echte Datei. Die fachliche Freigabe
bestätigt sechs Prüfpunkte zu Wortlaut, Verständlichkeit, Lösungen/Belegen,
Ton/Schnitt, Alignment und dokumentierter Stimmennutzung plus Prüfnotiz.
Eine neue Rohaufnahme setzt Schnittfassung und Freigabe zurück. Geänderter
Wortlaut macht eine alte Freigabe ungültig. Lernende erhalten ausschließlich die
veröffentlichte Schnittfassung, keine Rohaufnahme oder Produktionslösung.

## Prüfungsprofile und bewusste Grenzen

`lib/exam-preparation/profiles.ts` führt die allgemeine B1-Vorbereitung und sechs
getrennte Zielprofile: DTZ A2–B1, telc Deutsch B1, Goethe-Zertifikat B1, ÖSD ZB1,
telc Deutsch A2–B1 und ÖSD ZDÖ B1. Anbieterlinks, Prüfzeiten und Sprechvorbereitung
wurden anhand offizieller Quellen geprüft; Detailnachweise und Korrekturen stehen
in [der Inhaltsdokumentation](../content/exam-preparation/README.md).
Noch ungeprüfte Teilbedingungen bleiben `verified: false`, unbekannte Zahlen
`null`. Insbesondere dürfen DTZ, telc A2–B1 und die beiden ÖSD-Formate nicht
gegenseitig als Regelvorlage verwendet werden.

Alle Profile behalten `simulationReleased: false`. Die frühere Pilotoberfläche
zeigte pro Teilformat **0/3 vollständige eigene Transfer-Sets**. Allgemeine Übungsergebnisse
gelten nicht als geprüfte Teilformatabdeckung. Weitere österreichische und
berufliche Prüfungen sind angekündigt, aber noch keine fertigen Profile.

## Trennung der Prüfungsbereiche, 4. Oktober 2026

Der Lernraum bietet jetzt zwei getrennte Einstiege: **Simulierte Prüfung**
unter `/{lang}/dashboard/exam-simulation` und **Prüfungsvorbereitung** unter
`/{lang}/dashboard/exam-preparation`. Der bestehende B1-Pilot bleibt die
Prüfungsvorbereitung und wird nicht mit einer vollständigen Prüfung verwechselt.
Die spätere Digitalisierung des Lehrbuchs gehört in diesen Lernbereich; sie
wurde durch dieses Update nicht vorgenommen.

Die Vorbereitung öffnet unmittelbar B1, ohne sechs überwiegend gesperrte
Niveaukarten. Drei verständliche Bereiche ersetzen die fünf ständig sichtbaren
Reiter: **Lernen**, **Meine Beiträge**, **Fortschritt**. „Weiterlernen“ führt zur
passenden nächsten Einheit; „Eine Fertigkeit üben“ öffnet die gezielte Auswahl
mit einem sichtbaren Rückweg. Weitere Aufgabenformen sind eingeklappt. Ein
Prüfungsanbieter muss nicht gewählt werden; der frühere Zielprüfungswähler und
seine Erklärung sind entfernt. Bestehende Zielprofilpräferenzen bleiben intern
erhalten.

„Prüfung üben“ und die wiederholten 0/3-Detailzählungen erscheinen nicht mehr
als eigener Reiter. Ein direkter Link führt zur simulierten Prüfung. Alte
`area=practice`- und `area=exam`-Links bleiben verständlich nutzbar; die
Aufgaben-, Einheiten- und Bereichskennungen, Antworten, Lernchecks, Förderregeln
und gespeicherten Lernleistungen werden nicht geändert.

Beide Prüfungsrouten verwenden Deutsch auch für Brotkrumen, Schülernavigation,
Profilaktionen und Darstellungsoptionen. Der Sprachumschalter ist dort
ausgeblendet; ein Profil mit russischer oder anderer Interfacesprache behält
seine Sprache und die ursprünglichen Routenlinks für den übrigen Lernraum.
Der falsche Brotkrumen-Fallback „Video“ wurde durch eindeutige Prüfungslabels
ersetzt. Vorhandene `PressableCard`- und `SitovMotionStage`-Komponenten begleiten
den Einstieg und die Bereichswechsel; reduzierte Bewegung bleibt berücksichtigt.

Gezielte Navigation-/Vorbereitungstests: **74 Tests in vier Jest-Suites**
bestanden; ESLint der geänderten Dateien ohne Befunde. Die neue lokale
universelle Vollsimulation, tatsächliche Aufgabenpools und Audiofreigabeschritte
stehen in [exam-simulation.md](exam-simulation.md). Diese Notiz bestätigt kein
neues Deployment und keinen neuen Audioimport.

Im schrittweisen Vorbereitungsbereich fehlen weiterhin sieben fertig
ausformulierte Module und vollständige drei neue Transfersätze je Teilformat.
Die separate universelle Prüfung hat eigene vollständige Pflichtfamilien,
Zeiten und Bewertungsregeln; ihr aktueller Audio-/Betriebsnachweis steht in
der verlinkten Simulationsdokumentation. Die ursprünglichen Konzeptziele
der Vorbereitung von 700–900 Aufgaben, 50–70 Hörskripten und
18 Szenenbildern sind mit diesem Pilot nicht erreicht. Geführte Soloantworten
ersetzen keinen freien Partnerdialog. Die Fünf-Minuten-Aufnahme unterstützt
kurze Produktionen; ein längerer Dialogablauf ist noch auszubauen.

Die nächste redaktionelle Arbeit ist die fachliche Pilotprüfung mit realen
Lernenden, die verbindliche Organisation des Lehrkraftfeedbacks, Aufnahme und
Freigabe der acht Hörpakete sowie die Ausarbeitung überprüfbarer eigener
Teilformat-Sets. Technische Tests ersetzen diese Arbeit nicht. Inhalt,
Progression, Backend, Lehreroberfläche, Schüleroberfläche und Audioproduktion
haben eigene Tests unter `__tests__/exam-*.test.*`; die Datenbankregeln werden
in `supabase/tests/exam-preparation.test.mjs` geprüft. Die endgültige gemeinsame
Abnahme, Migration und Veröffentlichung erfolgen im koordinierten Release.


Die separate simulierte Prüfung benötigt unabhängig vom Niveau eine persönliche
Lehrkraftfreigabe. Vollständige Simulationsfortschritte können nur zugeordnete
Lehrkräfte oder Administration zurücksetzen; die Schüleroberfläche enthält
keinen solchen Reset. Die bestehende B1-Vorbereitung und andere Trainer bleiben
davon getrennt. Details: [exam-simulation.md](exam-simulation.md).

Die vorhandenen neun Bildsituationen der Vorbereitung verwenden nun neu
generierte fotorealistische WebP-Dateien mit jeweils zwei männlichen Personen.
Sie gehören zum tatsächlich nachgewiesenen Bestand von 18 neuen Dateien für
beide Prüfungsbereiche; Bildpfade und sachliche Alttexte sind aktualisiert.
Die Aufgaben-IDs, Lösungen, Hörskripte und Lernstände bleiben erhalten.
