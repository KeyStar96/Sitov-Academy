# Sitov Academy: Simulierte Prüfung und Prüfungsvorbereitung

Stand: **4. Oktober 2026, produktiv veröffentlicht**. Release
**`fb8df5491a91`** ist aktiv; der Produktionsnachweis wurde um **15:03 Uhr CEST**
bestätigt. Implementiert ist eine eigene,
umfassende Sitov-Prüfung je Niveau **A1 bis C2**. Die Simulation verlangt alle
Pflichtgebiete und nachgewiesene vorberechnete Hörmedien; bei fehlenden Medien
startet kein verkürzter Durchgang. Alle 144 Hörquellen sind lokal vollständig
vorbereitet; eine Quelle wurde nach verweigerter echter Alignment-Validierung
erfolgreich neu erzeugt. Alle 144 Quellen sind in den Datenbank-Audiospeicher
importiert und gegen Storage zurückgelesen. **Migrationen 75–77 sind produktiv
angewandt. Alle Schüler sind zunächst gesperrt**, bis die zugeordnete Lehrkraft
oder Administration einzeln freigibt.

## Zwei klare Einstiege

| Angebot | Zweck | Route |
| --- | --- | --- |
| Simulierte Prüfung | Niveau wählen, eine vollständige Sitov-Prüfung bearbeiten und Stärken sowie Übungsbedarf erkennen. | `/{lang}/dashboard/exam-simulation` |
| Prüfungsvorbereitung | Schrittweise lernen, gezielt üben, eigene Beiträge und Fortschritt verfolgen. Bestehender B1-Pilot; späterer Bereich für das digitalisierte Lehrbuch. | `/{lang}/dashboard/exam-preparation` |

Nach persönlicher Lehrkraftfreigabe führt die Simulation über
**Niveau → Start → Aufgaben → Auswertung**. Zunächst sind alle Schülerprofile
für diesen Prüfungsbereich gesperrt, unabhängig von vorhandenen Niveaurechten. Eine
Prüfungsinstitut-Auswahl entfällt. Ein Durchgang zeigt jeweils eine Aufgabe,
Bearbeitungsstand und Restzeit in einer kompakten Kopfzeile. Der sichtbare
Hauptknopf heißt „Weiter“ und speichert die Antwort; „Zurück“ und die bei Bedarf
geöffnete Aufgabenübersicht bilden den Rückweg. Listen und Kriterien öffnen bei
Bedarf; lange Quelltexte benötigen weiterhin sinnvolles Scrollen.

Die Vorbereitung öffnet B1 direkt mit **Lernen · Meine Beiträge · Fortschritt**.
„Weiterlernen“ führt zur nächsten Einheit, „Eine Fertigkeit üben“ zur gezielten
Auswahl mit sichtbarem Rückweg. Zielprüfungswähler und früherer „Prüfung üben“-
Reiter mit 0/3-Detailseiten entfallen. Ein direkter Link führt zur Simulation.
Alte `area=practice`-/`area=exam`-Links, gespeicherte Präferenzen, Aufgaben-IDs,
Antworten und Lernregeln bleiben erhalten. Details:
[exam-preparation.md](exam-preparation.md).

Alle Lernenden-Texte beider Prüfungsbereiche bleiben Deutsch, einschließlich
Schülernavigation, Brotkrumen, Skip-Link, Kontoaktionen und Darstellungsoptionen.
Der UI-Sprachumschalter ist ausgeblendet. Profil und Links des übrigen Lernraums
behalten ihre bisherige Sprache. Brotkrumen heißen „Prüfungsvorbereitung“
beziehungsweise „Simulierte Prüfung“; der frühere Fallback „Video“ entfällt.

Vorhandene Sitov-Motion-Komponenten, kurze Bereichs-/Aufgabenwechsel,
Fertigkeitssymbole, Fortschrittsbalken und ein animierter Ergebnisring begleiten
die Bedienung. Große Bedienflächen und reduzierte Bewegung sind berücksichtigt.
Die Bildimpulse verwenden **18 neue fotorealistische WebP-Szenen** mit jeweils
zwei fiktiven männlichen Personen: neun für die Vorbereitung und neun zusätzliche
Simulationsbilder. Drei Vorbereitungsbilder werden auch in der Simulation
verwendet, sodass deren zwölf Themen eigene passende Bildsituationen erhalten.
Alle Dateien haben 1.536 × 1.024 Pixel; zusammen belegen sie 4,11 MB. Die
Autorenprovenienz in `content/exam-preparation/sitov-photo-scenes-provenance.json`
hält Prompt, tatsächliche Datei, Abmessungen und SHA fest. Ein unabhängiger
Dateicheck bestätigt sämtliche 18 Byte-/Hashnachweise. Bildpfade und sachliche
Alttexte sind aktualisiert; vorhandene Aufgaben-IDs, Lösungen und gesprochene
Texte bleiben erhalten.
Ein unscharfes Gruppenmotiv auf dem Hintergrundblatt der Ehrenamtsszene wurde
mit dem Bildwerkzeug gezielt entfernt und anschließend in Originalauflösung
visuell geprüft; die finale Datei und ihr Hash sind in der Provenienz festgehalten.
Die neun alten Vorbereitungs-SVGs sind auf ausdrücklichen Nutzerwunsch aus
`public/Bilder/exam-preparation/` gelöscht. Alte Bild-URLs werden nicht als
Archiv oder Kompatibilitätsbestand weitergeführt; das Update verwendet die
18 neuen WebP-Dateien.
Die Entwicklungsrouten `/{lang}/sitov-preview/exam-preparation` und
`/{lang}/sitov-preview/exam-simulation` verwenden den echten Lernraumrahmen mit
sicheren Vorschauinhalten; außerhalb von Development antworten sie mit 404.

## Eigene vollständige Prüfungen A1–C2

Der aktive Katalog enthält sechs universelle Profile `sitov_a1` bis `sitov_c2`.
Neue Starts verwenden ausschließlich `provider: 'sitov'` und `mode: 'exam'`.
Frühere Anbieterprofile bleiben intern zum Lesen gespeicherter Durchgänge
erhalten. Die neue Oberfläche verlangt keinen Zielanbieter.

Die eigene Prüfung verbindet wichtige Aufgabenformen verschiedener deutscher
Sprachprüfungen. Umfang, Zeit und Bewertungsraster stammen von Sitov Academy.
Sie ist kein kopierter telc-/Goethe-/ÖSD-/DTZ-Modellsatz und gibt keine
Prüfungsbescheinigung eines Instituts aus.

| Niveau | Aufgabengruppen je Prüfung | Eigene Gesamtzeit | Automatisch bewertete Einzelentscheidungen | Leistungen für die Lehrkraft |
| --- | ---: | ---: | ---: | ---: |
| A1 | 20 | 80 Minuten | 21 | 4 |
| A2 | 23 | 100 Minuten | 21 | 4 |
| B1 | 29 | 150 Minuten | 23 | 8 |
| B2 | 31 | 180 Minuten | 27 | 9 |
| C1 | 32 | 210 Minuten | 28 | 10 |
| C2 | 33 | 240 Minuten | 30 | 11 |

Eine Zuordnung enthält drei Entscheidungen; das A1-Formular vier Felder.
Aufgabengruppen, Einzelentscheidungen und Punkte sind unterschiedliche Zahlen.
Das Formular wird anhand verlangter Angaben automatisch bewertet; es ist kein
offener Schreibtext für die Lehrkraft. Reihenfolgeaufgaben ab B2 enthalten
vier, fünf beziehungsweise sieben logisch verkettete Schritte. Richtig/falsch
gehört je Niveau zum Lesen und zusätzlich A1–B2 zum Hören.

Jedes Niveau enthält globales, detailliertes und selektives Lesen sowie Regeln,
vier Hörgenres und schriftliche/mündliche Produktion. Ab A2 kommen Sprachgebrauch
und Textlücken hinzu. Ab B1 werden Standpunkte, Bildimpulse, Präsentation und
Diskussion geprüft; ab B2 zusätzlich geordnete Berichte. C1 ergänzt schriftliche
Vermittlung gehörter Informationen, C2 zusätzlich Bedeutungs- und
Registerübertragung. Die vier Hörgenres sind Ansage/Nachricht, Detailverstehen,
Gespräch und Meinungsunterscheidung; je Quelle folgen zwei Fragen. Die genauen
Pflichtfamilien stehen in `lib/exam-simulation/catalogue.ts`.

Der Prüfungsbereich benötigt zuerst eine eigene persönliche **Featurefreigabe**
durch die aktuell zugeordnete Lehrkraft oder Administration. Ohne Eintrag in
`sitov_simulation_feature_grants` bleibt jedes Schülerprofil A1–C2 gesperrt.
Der kompakte Sperrbildschirm zeigt die Begründung und den Verweis auf die
Lehrkraft, keine irreführende Niveauauswahl oder Startschaltfläche.

Erst danach gelten die Niveaurechte: A1–B1 verwenden vorhandene Trainerrechte,
B2/C1/C2 eigene zusätzliche Simulationsrechte. Niveaurechte allein öffnen den
Prüfungsbereich nicht. Beide Freigaben öffnen keine anderen Trainer. Ein Entzug
sperrt Schülerzugriffe und weitere Änderungen; die zugeordnete Lehrkraft kann
gespeicherte abgeschlossene Durchgänge weiterhin fachlich prüfen.

## Inhalte und neue Durchgänge

Zwölf Alltagsszenarien besitzen eigene A1–C2-Quelltexte. Für C1 und C2 ersetzen
24 ausführliche Texte die kurzen oberen Ausgangstexte:
`content/exam-simulation/sitov-universal-long-reading.json`. C1 umfasst
353–397 Wörter, C2 500–545 Wörter je Text. Konkurrierende Positionen, implizite
Voraussetzungen, Reichweite von Belegen und Registerunterschiede gehören zu den
Aufgaben; die Niveauzuordnung beruht nicht nur auf geänderten Etiketten.
Differenzierte Angebote und Bedingungen ergänzen die Zuordnungen. Eigene
Argumentationsketten in `sitov-upper-coherence.json` und
`sitov-b2-coherence.json` machen jede benachbarte Stufe einer Reihenfolgeaufgabe
durch konkrete Rückverweise nachvollziehbar. Sie übernehmen keine willkürlich
angeordneten Absatzanfänge der Artikel.

Der Compiler enthält **1.519 Aufgabenvarianten**: 936 Szenariovarianten,
144 Sprachbausteine, 288 neue Hörentscheidungen, 108 zusätzliche Formular-,
Sprech-, Berichts-, Reformulierungs- und Reihenfolgeaufträge, zwölf Hör-/Schreibaufträge und
31 alte B1-Hörentscheidungen für gespeicherte Altbestände. Die universelle
Prüfung verwendet die neue Hörbank. Je Niveau enthält der Gesamtpool
A1 252, A2 228, B1 259, B2 252, C1 258 und C2 270 Varianten. Mehrere Aufgaben
verwenden denselben Text; diese Zahlen bezeichnen weder ebenso viele
unabhängige Geschichten noch offizielle Prüfungssätze.

Die neue Hörbank enthält **144 Skripte**: vier Genres × sechs Quellenvarianten
× sechs Niveaus. Der Wortlaut ist in `sitov-universal-audio-manifest.json`
eingefroren, die Fragen in `sitov-universal-listening.json`. Die 48 C1-/C2-
Hörskripte umfassen jeweils 300–334 Wörter und höchstens 2.573 Zeichen. Sie
erhalten die Faktenanker und ergänzen abgewogene Argumente; die verbindliche
Qwen-Grenze von 3.000 Zeichen je Text bleibt erhalten. Lange Leseartikel und
Hörfassungen sind getrennte Medien. Alle fiktiven Lerncharaktere sind männlich.
Das Lehrbuch wurde nicht digitalisiert oder als Generierungsquelle verwendet.

Je Niveau gibt es **sechs vollständige Variantenpakete**. Der Server wählt
zufällig ein bisher unbenutztes Paket und mischt die Antwortpositionen.
Aufgaben-IDs sämtlicher bisheriger Durchgänge werden ausgeschlossen. Die Pakete
sind so zusammengesetzt, dass gehörte Geschichten nicht bereits als gedruckte
Lese-, Zuordnungs-, Sprach- oder Berichtsquelle vorliegen. Die vier Hörgenres
verwenden innerhalb einer Prüfung verschiedene Geschichten.

Ein Paket enthält sämtliche Pflichtfamilien in der vorgesehenen Anzahl. Fehlt
eine Familie oder der verifizierte Audio-/Wortmarkennachweis, verhindert der
Server den Start. Nach sechs frischen Paketen verlangt ein erschöpfter Pool eine
redaktionelle Erweiterung und recycelt keinen alten Satz unbemerkt.
Zufallsauswahl liefert somit verschiedene vollständige Durchgänge aus einem
endlichen Bestand, keine unbegrenzt neuen Wörter. Das zugeteilte Set und sein
Bewertungsraster bleiben nach Start eingefroren.

## Auswertung und echte Leistungen

Nach Abschluss sehen Lernende ihre Antworten, passende Lösungen, Erklärungen
und Belegstellen. Richtig/falsch-Antworten erscheinen als „Richtig“ oder „Falsch“;
69,5 Prozent werden nicht auf die 70-Prozent-Schwelle aufgerundet. Filter trennen
richtige Antworten, Übungsbedarf und offene
Lehrkraftbewertungen. Fertigkeitsbalken ergänzen die Einzelrückmeldung. Der
Ergebnisring für automatische Entscheidungen schließt offene Schreib- und
Sprechleistungen aus; die Gesamtprognose wartet auf deren Bewertung.

Lösungsschlüssel, Autorenhinweise und Hörskripte bleiben serverseitig. Aktive
Durchgänge liefern nur ausdrücklich erlaubte öffentliche Aufgabenfelder.
Geschlossene Fragen werden anhand der eingefrorenen Lösung bewertet;
Zuordnungen und Formularfelder können Teilpunkte erhalten. Fehlende Antworten
ergeben null Punkte.

Schreiben und Sprechen erhalten keine Qualitätsbewertung aus Wortzahl,
Textlänge oder Aufnahmedauer. Sprechen benötigt eine reale Aufnahme, ein
getippter Vorbereitungstext genügt nicht. Reine Sprech-Notizen bleiben auch in
der Fortschrittsanzeige offen; beim bewussten Überspringen werden sie erhalten.
Positive Punkte für Partneraufgaben
verlangen außerdem eine Bestätigung der Lehrkraft, dass ein echtes Gespräch mit
Partnerantworten und Rückfragen stattgefunden hat. Soloaufnahmen ersetzen diese
Interaktion nicht.

Das Lehrer-Dashboard enthält einen eigenen Einstieg **Simulierte Prüfung** und
eine Navigationsgruppe **Prüfungen**. Unter `/{lang}/admin/exam-simulation`
stehen **Freigaben · Antworten bewerten · Ergebnisse** getrennt bereit. Die
Standardansicht öffnet die persönliche Freigabe für einen ausgewählten Lernenden;
zusätzliche B2-/C1-/C2-Rechte folgen erst danach.

Die Lehrkraft bewertet abgeschlossene produktive Leistungen mit Punkten und
konkreter schriftlicher Rückmeldung. Die Ergebnisansicht zeigt alle abgeschlossenen
Prüfungen mit geschlossenen Antworten, Lösungen und Lehrkraft-Rückmeldungen.
Offene produktive Fertigkeiten heißen „Bewertung offen“ und zeigen keine
irreführenden vorläufigen 100-Prozent-Werte oder Bestehensbalken.
Lehrkräfte sehen aktuell zugeordnete Lernende, Administratoren den gesamten
Bestand. Eingereichte, noch unbewertete Leistungen bleiben als offen sichtbar;
fehlende Leistungen erhalten null Punkte und keinen irreführenden Auftrag.

Die eingefrorene eigene **Sitov-Rubrik** verlangt:

- mindestens **70 % in jeder enthaltenen Fertigkeit**, einschließlich
  Sprachbausteinen ab A2;
- mindestens **50 % in jeder einzelnen Schreib- und Sprechaufgabe**;
- sämtliche produktiven Nachweise und die Bestätigung echter Partnergespräche.

Ein bereits feststehender Pflichtfehler ergibt `examPass: false`, auch wenn
andere Leistungen noch bewertet werden. Ein ausreichendes Endresultat kann
durch offene Bewertungen nicht vorweggenommen werden: Ohne feststehenden
Pflichtfehler bleibt `examPass: null`, bis die erforderlichen Bewertungen
vorliegen. Fertigkeitsbalken bleiben für offene Leistungen neutral. Das eigene
Raster ist standardmäßig eingeklappt; kurze Sprechaufträge und die deutsch
ausgeschriebene Richtig/falsch- sowie Uhrzeitrückmeldung erleichtern die Auswertung.
Nach vollständiger Bewertung meldet die eigene Simulation bestanden oder noch üben. Diese Einschätzung ist eine strenge Lernorientierung; sie garantiert kein
Bestehen einer realen Zertifikatsprüfung und übernimmt keine institutsgebundenen
Originalgrenzen.

## Speicherung und private Aufnahmen

Die additive Migration
`supabase/migrations/20261004090459_sitov_exam_simulation.sql` ist identisch mit
`supabase/vps/75_sitov_exam_simulation.sql` und im VPS-Migrationsrunner registriert.
Sie ergänzt `sitov_simulation_runs` mit privatem Lösungssnapshot und Fristen,
`sitov_simulation_receipts` für idempotente Änderungen und
`sitov_simulation_level_grants` für fortgeschrittene Niveaurechte.
`sitov_store_simulation_change` ist ein ausschließlich serverseitiger atomarer
Schreibweg mit Zeilensperre, Revisionskontrolle und Fristprüfung.

Direkte öffentliche/authentifizierte Tabellenrechte sind entzogen. Aktionen
prüfen Anmeldung, aktuellen Besitzer, Niveauzugriff und Lehrkraftzuordnung
erneut. Gleichzeitige Geräte verwenden optimistische Revisionsprüfung und
Zeilensperren. Aufgaben und Raster bleiben nach Start unveränderlich,
Schülerantworten nach Abschluss ebenfalls; die Frist wird auch auf
Datenbankebene durchgesetzt. Migration 76
(`supabase/migrations/20261004120453_sitov_simulation_feature_access.sql`,
identisch mit `supabase/vps/76_sitov_simulation_feature_access.sql`) ergänzt die
separate persönliche Featurefreigabe; fehlende Einträge sind gesperrt. Direkte
Tabellenrechte bleiben entzogen, Grant-/Revoke-Aktionen prüfen aktuelle
Lehrkraftzuordnung und echte Schülerprofile erneut.

Sprechdateien verwenden den bestehenden privaten Bucket
`sitov-exam-submissions`. Uploadtickets, Besitzprüfung und befristete
Download-URLs schützen Aufnahmen. Die Simulation kann reale Schüleraufnahmen
gezielt als 24-kHz-Mono-WAV speichern: fünf Minuten belegen 14,4 MB und bleiben
unter der Grenze von 20 MiB. Ohne verfügbaren Konverter bleibt die ursprüngliche
komprimierte Aufnahme erhalten; andere Trainer sind unverändert. Dies betrifft
keine synthetischen Qwen-Hörmedien. Alte Vorbereitungsaktionen dürfen Dateien,
die ein eingefrorener Simulationsdurchgang verwendet, nicht unbemerkt löschen.
Der vollständige **Prüfungsfortschrittsreset ist ausschließlich der aktuell
zugeordneten Lehrkraft oder Administration vorbehalten**. Er entfernt aktive
und abgeschlossene Simulationsdurchgänge, Antworten, Ergebnisse, Bewertungen,
Quittungen, Prüfungshistorie und zugehörige private Sprechaufnahmen. Die
bisher verbrauchten Aufgabenpakete stehen danach wieder zur Auswahl.

Im Lehrerbereich wird zuerst die konkrete Löschliste für den ausgewählten
Lernenden angezeigt; anschließend muss dessen Name eingegeben und die
endgültige Löschung bestätigt werden. Ein Fehler behält dieselbe Request-UUID
für die sichere Fortsetzung; Erfolg wird erst nach vollständiger Bereinigung
gemeldet und die autorisierten Daten werden neu geladen. Persönliche
Prüfungsfreigabe, Niveau-Freigaben und andere Trainer bleiben erhalten.
Eine bereits als reale Vorbereitungsabgabe verwendete gemeinsame Aufnahme und
ihr ursprüngliches Uploadticket bleiben für diese Abgabe erhalten; der Reset
entfernt deren Simulationsverknüpfung.
Migration 77 (`supabase/migrations/20261004122137_sitov_simulation_staff_reset.sql`,
identisch mit `supabase/vps/77_sitov_simulation_staff_reset.sql`) speichert
Resetquittungen und die noch zu bereinigenden Mediendateien dauerhaft in einem
privaten Schema. Eine fortlaufende Generation verhindert, dass alte Seiten,
bereits begonnene Starts oder Uploadtickets Daten nach dem Reset zurückschreiben.
Eine angefangene Bereinigung kann die aktuell zugeordnete Lehrkraft auch mit
neuer Request-UUID fortsetzen; diese wird dauerhaft mit dem bestehenden Auftrag
verbunden und löst bei Wiederholung keinen zweiten Reset aus.

Schüler erhalten keinen Prüfungsreset; ihr allgemeiner Lernstandreset schützt
den Simulationsbestand einschließlich Poolhistorie, verknüpfter und aus der
Vorbereitung geliehener Aufnahmen sowie Uploadtickets. „Neuer Durchgang“ und
„Niveau ändern“ erhalten die Prüfungshistorie. Die Löschung eines Kontos entfernt
weiterhin dessen gesamte Daten. Niveaurechte entfallen bei Profillöschung.
Migrationen 75–77 sind im VPS-Runner registriert und produktiv angewandt.
Bestehende B1-Vorbereitungs-IDs,
Antworten und reale Aufnahmen bleiben erhalten.

## Deutsches Audio und Betriebsfreigabe

Neue deutsche Hörmedien durchlaufen vor Veröffentlichung
[audio-authoring.md](audio-authoring.md): lokale Mac-Vorberechnung mit
**Qwen3-TTS-12Hz-1.7B-Base** und `sitov-qwen-male-de-v1`, Gegenhören, tatsächliches
Forced Alignment, Audio-/Wortmarkenimport und Storage-Prüfung. Browser-/System-TTS
und Ersatzstimmen werden nicht angeboten. Im Schülerbetrieb ruft der gemeinsame
Audio-Adapter ausschließlich gespeicherte Medien ab.

Die lokale Produktion kann unabhängig synthetisierte lange Textteile in
korrekter Reihenfolge zusammensetzen. Eine dauerhafte Zwischenquittung bindet
Teile an exakten Text und SHA; unterbrochene Läufe können fertige Teile
wiederverwenden. Alignment und Encoding erfolgen weiterhin an der gesamten
tatsächlichen Aufnahme. Dies ersetzt weder Storage-Import noch finales Audit.

Der lokale Endlauf hat einschließlich gezielter Reparatur alle 144 Quellen
vollständig erstellt. Bei der ersten Aufnahme von `C1 / conversation / v4`
lag die letzte tatsächliche Wortendmarke bei 115,92 Sekunden, die Rohaufnahme
endete bei 115,381 Sekunden. Die Validierung hat diese Aufnahme verweigert. Roh- und Zwischenaufnahmen bleiben
privat isoliert. Dieselbe Quelle wurde mit eingefrorener Stimme und Parametern
erneut erzeugt und echt ausgerichtet: 308 Wörter, Rohdauer 114,087 Sekunden,
CLI Exit 0 und null fehlgeschlagene Einträge. Zeitmarken wurden weder geklemmt
noch erfunden. Der neue Import ist mit tatsächlichem Storage-Readback abgeschlossen.

Die reine Eingangsprüfung bestätigt alle 144 vollständigen Quellen und
25 tatsächlich geprüfte MP3-Dateien. Der private lokale ASR-QC-Lauf dieser
25 Quellen ist mit Exit 0 abgeschlossen; die zusätzlich geprüfte Reparaturquelle
hat keine Flags. Zwölf Quellen erhielten zunächst diagnostische ASR-Hinweise.
Das Skript respektiert die globale Synthesesperre,
prüft 24 repräsentative Dateien (je Niveau und Hörgenre) plus den ausdrücklich
gewählten Reparaturfall und sichert vollständige lokale ASR-Segmente. Die
Zusatzwahl wird an Provenienz und Wiederaufnahme gebunden; vor vollständiger
Vorbereitung aller 144 Quellen wird kein ASR-Modell geladen. Vergleiche
verwenden ausschließlich Text innerhalb der
tatsächlichen Aufnahmedauer; Halluzinationen nach Dateiende bleiben als solche
getrennt. NFC-/Whitespace-Normalisierung entspricht dem gemeinsamen Audiovertrag,
während die rohe Manifestdatei zusätzlich über ihren SHA eingefroren bleibt.
Eine unabhängige zeitliche Nachprüfung erhält die vollständigen ursprünglichen
ASR-Resultate. Wörter ohne positive Zeitspanne und Segmente ohne angeforderte
Wortzeitmarken bleiben getrennt quarantänisiert. Sie belegen keinen tatsächlich
gesprochenen Zusatz; echte positive Spannen an internen Decodergrenzen bleiben
erhalten. Sieben unabhängig erkannte Ausschnitte derselben echten Dateien
bestätigen die zuvor als ausgelassen oder zusätzlich vermuteten Aussagen,
unter anderem „Dann halten wir“, „Die organisatorische Anpassung“ und
„Leon betrachtet die sofortige Rücksendung“. Originalbericht und MP3-Hashes der
25 geprüften Quellen blieben unverändert. Der technische Review identifiziert keinen
bestätigten materiellen Audiofehler. Menschliches Gegenhören und ein
Natürlichkeitsurteil werden daraus nicht behauptet.

Das strikte 144-Quellen-Bundle ist auf dem VPS validiert (Exit 0). Import
und tatsächlicher Storage-Readback sind mit Exit 0 abgeschlossen:
**144 verifiziert, 144 hochgeladen, null wiederverwendet**, keine zusätzlichen
Verknüpfungen (`links: []`). Ein frischer SQL-Katalogexport und die CLI bestätigen
**144 vollständige, null fehlende Texte, 144 nutzbare Cachetreffer und null
ungültige Storagepfade**. Das fixierte männliche Profil bleibt identisch. ASR-Faktenhinweise und Energiepausen bleiben Anlass zum tatsächlichen
Gegenhören, keine behauptete fachliche Hörabnahme.

Die Runtime-Bereitschaft verlangt sechs tatsächlich importierte, wortlautgenaue
Quellen pro Hörgenre und Niveau mit gemessenen Wortzeitmarken.
`fullExamReleased` im statischen Autorenkatalog ist kein Freigabeschalter; der
Server ermittelt die Startbereitschaft anhand dieser Nachweise und sämtlicher
Pflichtfamilien. Die 144 neuen Quellen erfüllten diesen Audiovertrag bereits vor
dem Deployment; Migrationen und Webveröffentlichung sind inzwischen abgeschlossen.

## Fachliche Referenzen und Prüfung

Die redaktionelle Auswahl gemeinsamer Aufgabenformen berücksichtigt am
4. Oktober 2026 geprüfte Primärquellen:
[Goethe-Prüfungen](https://www.goethe.de/de/spr/prf.html),
[Goethe-C1-Handbuch](https://www.goethe.de/pro/relaunch/prf/ar/Handbuch_Pruefungsziele_Testbeschreibung_C1.pdf),
[telc-Übungssätze](https://www.telc.net/fileadmin/user_upload/mock_exams/Deutsch/),
[ÖSD-Prüfungen](https://www.osd.at/pruefungen/oesd-pruefungen/) und
[g.a.s.t., DTZ](https://www.gast.de/de/forschung-entwicklung/entwicklung/auftraege/deutsch-test-fuer-zuwanderer-dtz/der-dtz-auf-einen-blick).
Diese Quellen belegen keine identischen Originalumfänge oder eine allgemeine
Garantie für alle Erwachsenen-, Berufs-, Hochschul- und Jugendprüfungen.

Navigation und bestehende Vorbereitung: **74/74 Tests in vier Jest-Suites**;
gezieltes ESLint der dort geänderten Dateien ohne Befunde. Die lokale
Bildschirmprüfung der Vorbereitung bei **360 × 800 Pixeln** mit russischem
Profil zeigt den vollständigen Titel und beide Hauptaktionen oberhalb der
unteren Navigation. „Weiterlernen“ öffnet Aufgabe 1/6 mit sichtbarem Rückweg;
die UI bleibt Deutsch. Vorschauverweise führen zwischen den Entwicklungsrouten,
während produktive Links ihre Dashboardziele behalten. Der verdichtete
Simulationsstart zeigt bei **360 × 800 Pixeln** alle sechs A1–C2-Schaltflächen
vollständig oberhalb der unteren Navigation; die Niveauwahl benötigt weder
vertikales noch horizontales Scrollen. Desktop **1280 × 720 Pixel** ist ebenfalls
geprüft. Der bisherige Schüler-UI-Stand besteht separat mit **16/16 Tests**, die
Aufnahmeoberfläche mit **9/9 Tests**. Der neue Regressionsfall bestätigt, dass
Notizen ohne Aufnahme keine beantwortete Sprechaufgabe ergeben. TypeScript ist
erneut geprüft. Die finalen
Engine-/Inhaltstests bestehen mit **19/19** einschließlich aller sechs Pakete
je Niveau und der Reihenfolge-/Richtig-falsch-Auswertung. Ein früherer gemeinsamer
relevanter Jest-Lauf umfasst **15 Suites / 180 bestandene Tests**. Der vorherige
gemeinsame Simulationslauf bestätigt **5 Suites / 65 bestandene Tests**:
UI 16, Engine 19, Backend 16, Aufnahme 9 und Lehrkraft 5. Diese Läufe
überschneiden sich und werden nicht als zusätzliche unabhängige Gesamttests addiert. Neue isolierte
Datenbanktests bestehen mit **10/10**, bestehende Vorbereitungs-/Resetregressionen
mit **14/14**; der erneute gemeinsame Datenbanklauf bestätigt **24/24**.
Gezieltes ESLint von 44 geänderten Dateien meldet null Fehler;
die generierte `database.types.ts` erzeugt lediglich den erwarteten Ignore-Hinweis.

Der abschließende gemeinsame lokale Produktionsbuild endet mit **Exit 0**:
Kompilierung 4,2 Sekunden, TypeScript 9,6 Sekunden und **278/278 statische Seiten**
in 762 Millisekunden. Er enthält persönliche Featurefreigaben,
Lehrkraftreset, die neuen Bilddateien, die korrekte Fortschrittsanzeige für
Sprech-Notizen ohne Aufnahme und die reale 24-kHz-Aufnahmespeicherung.
Dashboard- und Adminrouten der Simulation sind enthalten; die
Entwicklungsvorschau ist außerhalb von Development mit 404 gesperrt.
Das gemeinsame Release ist produktiv ausgeliefert. Technisches Audio-QC ist abgeschlossen;
der vollständig verifizierte Import der 144 Quellen ist bestätigt.
Migrationen 75–77 und Webdeployment sind abgeschlossen. Technische Tests
ersetzen keine fachliche Abnahme mit realen Lernenden und kein menschliches
Gegenhören.


### Nachträge: persönliche Freigaben und vollständiger Lehrkraftreset

Teacher-UI, Navigation, Dictionaryvollständigkeit und bestehendes Dashboard bestehen
lokal mit **48/48 Tests in vier Suites**, darunter Lehrkraft **15/15** und
Prüfungsnavigation **2/2**. Gezieltes ESLint und die erneute vollständige
TypeScript-Prüfung sind sauber. Die sichere zusätzliche Entwicklungsroute
`/{lang}/sitov-preview/exam-simulation/teacher` zeigt fiktive männliche Lernende
im Lehrerrahmen; alle Freigabe-, Bewertungs- und Resetaktionen sind deaktiviert.
Die persönliche Sperransicht ist auf **360 × 800 Pixeln** auf Deutsch unter
russischem URL-Präfix geprüft; sie zeigt keine Niveauwahl oder Startaktion.
Die Lehrer-Vorschau mit den drei Bereichen ist bei 360 Pixeln ohne horizontale
Überbreite visuell geprüft. Singularwerte erscheinen als „1 offene Bewertung“,
„1 Leistung wartet“ und „1 Bewertung offen“.
Der gemeinsame isolierte Datenbanklauf für Simulation,
Lehrkraftreset und bestehende Prüfungsreset-Regeln besteht mit **29/29**.
Der anschließend verbreiterte Lauf einschließlich allgemeinem Lernstandreset
besteht mit **43/43**: Staffreset 8, Simulation 14, Prüfungsreset 7 und
Lernstandreset 14;
die Backend-/Lehrkraft-/Aufnahme-/Recorder-Suites des Serveragents bestehen mit
**55/55**. Die Läufe überschneiden sich mit den zuvor genannten Tests.
Der abschließende fokussierte Jest-Lauf bestätigt **12 Suites / 137 Tests**
für Simulation, Vorbereitung, Lehrkraftbereich und Resetregressionen.
Gezieltes ESLint und der oben beschriebene gemeinsame Produktionsbuild sind
sauber. Diese Zahlen überlappen die Einzel-/Zwischenläufe.
Der vollständige sichere B1-Browserdurchlauf erreichte alle 29 Aufgabengruppen
und die Auswertung: 24 Antworten, fünf bewusst ausgelassene Sprechaufgaben ohne
private Aufnahme. Alle acht Hörfragen spielten vier echte importierte MP3s ohne
Medienfehler. Bekannte Pflichtfehler ergaben korrekt „noch gezielt üben“, trotz
drei offener Schreibbewertungen. Es wurden keine echten Schülerleistungen verändert.

## Produktiver Abschluss

Codecommit: `fb8df5491a9125b9cda241463b512feaa7dcbee8`. VPS-Vorbereitung und
Aktivierung endeten mit Exit 0. Der Webpack-Build mit einem Worker kompilierte
in 52 Sekunden; TypeScript 37,1 Sekunden und 278/278 Seiten in 6,8 Sekunden.
App und Mail sind aktiv; Studio und Analytics wurden wieder aufgenommen.
Vor Migrationen 75–77 wurde ein vollständiges Backup unter
`/root/backups/sitov-migration-20261004T125429402922Z` mit **16.948 Storageobjekten**
erstellt. Eine reine Produktionsabfrage bestätigt null persönliche
Prüfungsfreigaben, null Durchgänge und null Resetaufträge; keine echten
Schülerresets wurden durchgeführt.

Öffentlich bestätigt: Health **200 / ready**, Homepage und Login unter `/ru`
**200**, geschützte Schüler-/Lehrkraftrouten führen ohne Anmeldung zum Login.
Das neue Ehrenamtsfoto liefert **200 / WebP**, das gelöschte Kontakt-SVG **404**.
Es wurden nach dem ausdrücklichen Ende der automatisierten Tests keine neuen
Tests ausgeführt; die Produktionsnachweise sind Status- und Leseprüfungen.
