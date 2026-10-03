# Sitov Academy: B1-Prüfungsvorbereitung

Dieser Bestand ist ein eigener, versionierter Pilot nach dem Konzept vom
3. Oktober 2026. Das geschützte Lehrbuch wurde nicht als Generierungsquelle
verwendet. Die Aufgaben bleiben vollständig auf Deutsch.

- `sitov-b1-pilot.json`: ein Modul mit zehn Einheiten und 66 Aufgaben im
  Hauptweg. Zwei zusätzliche neue Lerncheckvarianten ergeben insgesamt 90
  unterschiedliche Aufgaben. Jede Checkgruppe enthält genau fünf Hör- und
  fünf Leseentscheidungen sowie eine eigene Schreib- und Sprechprobe.
- `sitov-b1-planned-modules.json`: sieben weitere Module mit 70 geplanten,
  ausdrücklich unveröffentlichten Einheiten. Die Briefings sind keine
  fertigen Aufgaben und zählen nicht als erfüllte Prüfungsformatabdeckung.
- `sitov-b1-workshops.json`: fünf Werkstätten mit jeweils sechs progressiven
  Einheiten und insgesamt 90 eigenen Strategie- und Produktionsaufgaben.
  Sie trainieren Bildbeschreibung, Kurzpräsentation, Interaktion, Schreiben
  und integrierte Fertigkeiten. Geführte Soloantworten beweisen keinen freien
  Dialog.
- `sitov-b1-recording-orders.json`: acht vollständige menschliche
  Aufnahmeaufträge mit 36 zugehörigen mediengesperrten Aufgaben. `script` enthält
  Sprecherlabels für die Anzeige. Nur `spokenText` enthält den vollständigen
  gesprochenen Wortlaut für Prüfsumme und tatsächlich gemessenes Alignment.
- `sitov-b1-recording-sessions.json`: drei konkrete Aufnahmesitzungen.

Der Index liegt in `lib/exam-preparation/content.ts` und ist serverseitig.
Geschlossene Lösungen und Lehrkraftbriefings dürfen nicht in den allgemeinen
Client-Bundle gelangen. Lernenden wird nur der jeweils freigegebene Auftrag
ohne vorweggenommene Lösung übergeben.

Die elf exakten Pilot-Hörtexte stehen in
`scripts/sitov-exam-audio-manifest.json`. Synthetische Aufnahmen entstehen
ausschließlich lokal auf dem Mac mit `sitov-qwen-male-de-v1`, werden mit echten
Forced-Alignment-Wortmarken geprüft und vor Freigabe in Audio-Storage importiert.
`awaiting_recording` beziehungsweise `awaiting_media` sind tatsächliche
Produktionszustände. Die statischen Inhaltsdateien behaupten kein vorbereitetes
Audio. Die 36 menschlichen Höraufgaben sind im separaten Hörstudio mit acht
freiwilligen Einheiten erreichbar, sobald die echte Aufnahme technisch und
fachlich freigegeben ist. Diese Einheiten zählen nicht zum 80+30-Lernwegplan.

Fiktive Personen sind Männer. Anastasia wird ausschließlich als reale
Lehrkraft beziehungsweise reale Interviewerin im Produktionsbriefing genannt.
Die Bildreferenzen zeigen eigene SVG-Szenen. Drei gesonderte Checkbilder bleiben
für neue Sprechproben reserviert; bekannte Medien dürfen nicht als unbekannter
Nachweis gelten.

Dies ist keine vollständige Vorbereitung auf sechs Prüfungsabläufe. Es enthält
keine freigegebene vollständige Prüfungssimulation. Die sieben weiteren Module,
die vollständige Teilformatabdeckung mit Transfer-Sets sowie geprüfte
Simulationssätze gehören zum nächsten Ausbau. Technische Datenvalidierung
ersetzt weder die didaktische Pilotprüfung noch eine offizielle Prüfung.

Bei einer inhaltlichen Änderung eine neue Task-Version beziehungsweise eine
neue Medienversion anlegen. Antworten und Ergebnisse zur früheren Version
bleiben unverändert nachvollziehbar.

## Prüfung der Profilstruktur am 3. Oktober 2026

Die sechs Anbieterübersichten bestätigen die Modulzeiten und die grundsätzlichen
Teilformate: [DTZ](https://www.gast.de/de/forschung-entwicklung/entwicklung/auftraege/deutsch-test-fuer-zuwanderer-dtz/der-dtz-auf-einen-blick),
[telc Deutsch B1](https://www.telc.net/sprachpruefungen/deutsch/zertifikat-deutsch-telc-deutsch-b1/),
[Goethe B1](https://www.goethe.de/ins/de/de/m/prf/prf/gzb1/inf.html),
[ÖSD ZB1](https://osd.at/portfolio-item/osd-zertifikat-b1-zb1/),
[telc Deutsch A2–B1](https://www.telc.net/sprachpruefungen/zertifikatspruefung/deutsch/telc-deutsch-a2b1/)
und [ÖSD ZDÖ B1](https://osd.at/portfolio-item/osd-zertifikat-deutsch-osterreich-b1-zdo-b1/).

Gezielt ergänzt beziehungsweise berichtigt wurden:

- Der [offizielle telc-A2–B1-Modelltest, Seite 7](https://shop.telc.net/media/catalog/product/file/5/0/5060-b00-020101_bib.pdf)
  trennt Sprachbausteine, E-Mail-Verstehen und Antwort-E-Mail. Sprechen enthält
  Vorstellung mit Anschlussfragen, dann Planung und anschließend Meinung.
- Die [verlinkten ÖSD-ZDÖ-Durchführungsbestimmungen, Seiten 5 und 8](https://www.osd.at/wp-content/uploads/2023/09/ZDO-B1-Durchfuhrungsbestimmungen_10_2023.pdf)
  bestätigen zehn Minuten Sprechvorbereitung. ZDÖ wird deshalb getrennt vom ZB1
  mit dessen fünfzehn Minuten geführt.
- Der [offizielle DTZ-Modellsatz, Seite 6](https://www.gast.de/fileadmin/gast.de/GAST/5_DTZ/PDF/gast_DTZ_UEbungssatz_1.pdf)
  bestätigt vier Hörteile mit 20 Entscheidungen und fünf Leseteile mit 25
  Entscheidungen. Bildimpuls und Erfahrung gehören zur Sprechaufgabe 2A;
  Rückfragen sind gesondert als 2B erfasst.

Diese Prüfung der Struktur veröffentlicht keine Simulation. Ungeprüfte
Wiedergaberegeln und sonstige Teilbedingungen bleiben sichtbar ungeprüft.
Anbieteraufgaben und Medien wurden ausschließlich zur Formatanalyse gelesen;
sie werden nicht in den eigenen Aufgabenbestand übernommen.
