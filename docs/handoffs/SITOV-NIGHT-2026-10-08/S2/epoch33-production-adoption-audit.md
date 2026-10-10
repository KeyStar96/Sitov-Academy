# Sitov Academy – vollständiger Offline-Übernahmevergleich (S2 epoch33)

Auf Basis von `0ca33ef741af24d319739da186d4c645f62a6e17` wurden alle **9.569 Aufgaben, 856 Elternknoten und 66 Pfad-Units** des von M gelieferten Produktionsabzugs eindeutig den zehn finalen Seeds zugeordnet. Die drei Dump-Dateien wurden vollständig gegen die von M gespeicherten Byte-Längen und SHA-256 geprüft. Es wurden weder Produktquellen noch Tests, Datenbank oder Audios verändert.

**Offen sind 320 Aufgaben und 48 Merkkarten/Elternknoten.** 9.249 Aufgaben, 808 Knoten und sämtliche 66 gelieferten Unit-Businesszeilen stimmen bereits überein. Die zuletzt geprüften 43 Aufgaben und 14 Karten sind vollständig enthalten; zusätzlich fehlen die Übernahmen von 277 früheren Aufgaben und 34 früheren Karten. Der frühere Source-Stand der neuesten 43 ist deshalb kein vollständiges Produktions-Before-Image.

| Niveau | Geprüfte Aufgaben | Geänderte Aufgaben |
|---|---:|---:|
| A1.1 | 769 | 117 |
| A1.2 | 922 | 88 |
| A2.1 | 1.061 | 51 |
| A2.2 | 1.087 | 47 |
| B1.1 | 1.056 | 17 |
| B1.2 | 1.050 | 0 |
| B2.1 | 906 | 0 |
| B2.2 | 906 | 0 |
| C1.1 | 906 | 0 |
| C1.2 | 906 | 0 |

175 Aufgaben ändern Content, 145 ausschließlich Übersetzungstexte oder den Merkkarten-Verweis. 38 Aufgaben ändern Antwort-/Konzeptfelder (Schlüssel, akzeptierte Antworten, Optionen, Satzteile oder Ziel-Form). Vier tatsächliche Verweise werden korrigiert. IDs, Typen, Unit-/Node-Zuordnung, Aufgabenreferenzen, Ziele, Reihenfolge und Topic bleiben in sämtlichen Aufgaben gleich. Alle Aufgaben- und Knotenübersetzungen haben fünf eindeutige, korrekt zugeordnete Sprachzeilen.

Alle 320 Produktions-Businesspayloads stimmen exakt mit einem geprüften historischen Source-Stand vor den integrierten Reparaturen überein. Jede geänderte Aufgabe und jeder geänderte Elternknoten besitzt konkrete Repair-Commit-Lineage im privaten Inventar. Das belegt die Herkunft der Deltas; es ersetzt keine unabhängige Freigabe des gesamten Produktions-Before/After-Pakets.

Der Vergleich bildet ausschließlich die tatsächliche Importer-Repräsentation aus SQL44 mit SQL72 ab: deutsche Hinweise/Erklärungen/Anweisungen in der de-Übersetzungszeile, vier weitere Sprachzeilen, explizite NULL-Felder, `btrim` ausschließlich für task/gap_hint, Merkkartenübersetzungen in path_node_translations sowie bestehende IDs und Positionen. Created-/Updated-Zeitstempel werden als echte Originalzeilen privat aufbewahrt, aber nicht als Inhaltsdeltas gezählt. Arrays, Antwortvarianten und Text werden nicht umsortiert oder sprachlich normalisiert. Vom Importer nicht gesetzte bestehende Felder bleiben erhalten; keine der 320 geänderten Aufgaben besitzt eine bestehende solution_audio_url. Global vorhandene URLs werden nicht angefasst.

## Audio-Inventar

Die tatsächlichen gemeinsamen Funktionen `sitovExerciseAudioTexts`, `normalizeAudioText` und `preparedLearningAudioTexts` wurden für alle 9.569 finalen Aufgaben ausgeführt und stimmen exakt überein. Das finale Gesamtinventar enthält **12.605 Aliasvorkommen / 11.185 eindeutige Hörtexte**. 174 geänderte Aufgaben ändern hörbaren Inhalt; daraus entstehen **175 geänderte Aliase und 175 neue eindeutige Hörtexte gegenüber dem vollständigen Produktionskatalog**. Lückenwort und vollständiger Lückensatz bleiben getrennt erhalten. Keine Distraktoren, isolierten Präfixe oder erfundenen flüssigeren Satzfassungen wurden ergänzt. Merkkarten sind im tatsächlichen RuleCard kein Audiokonsument. Verfügbarkeit, männliches Qwen-Profil und Wortzeiten der Assets wurden in dieser Offline-Einheit nicht geprüft.

## Reihenfolge und Schutz vor Übernahme

Sämtliche realen Aufgabendifferenzen liegen innerhalb der SQL114-Felder `content`, `translations`, `explanation_card`. SQL114 kann Elternkarten, deren Übersetzungen, Unit-Titelübersetzungen und Lernziele nicht übernehmen. Die 48 Elternkarten betreffen 390 angehängte Aufgaben; 160 davon haben zusätzlich eigene Aufgabendifferenzen. Alle 48 vollständigen Karten samt Übersetzungen müssen vor dem ersten Archivierungsschritt unabhängig geprüft und durch M in der richtigen Reihenfolge übernommen werden. Danach muss M tatsächliche Projektionen/CAS-Hashes erneut auslesen. Das private Inventar enthält die Offline-Projektionen sowohl mit aktuellen Produktionseltern als auch nach geplanter Elternadoption. Seine strukturellen JSON-/Datei-SHAs sind ausdrücklich **keine PostgreSQL-CAS-Hashes**.

SQL114 bindet deutsche Parent-Karte/-Metadaten in die aktuelle Projektion ein; eine nachträgliche Elternänderung kann die Archivschutz-Trigger verletzen. Node-Übersetzungszeilen sind nicht Teil dieser Parent-Projektion und bleiben separat zu prüfen. Special-Definitionen, Revisionstabellen und Lernhistorie fehlen im Abzug: tatsächliche Abhängigkeiten, bestehende Archive und Historienerhalt sind deshalb weiterhin M-Prüfgates. Keine gewöhnliche Seed-Übernahme und kein historisches Überschreiben aus diesem Inventar freigegeben.

## Explizite Abdeckungslücke

Die Unit-Datei enthält ausschließlich learning_units. **330 path_unit_translations und 746 path_objectives in 66 Pfaden sind nicht enthalten und damit nicht gegen Produktion geprüft.** Ein bekannter Source-Reparaturdelta betrifft A1.2/P7/P7-G4; dessen tatsächlicher Produktionszustand bleibt unbekannt. Alle zu prüfenden Source-Titel/Lernziele und die historische Änderung liegen im privaten `epoch33-unobserved-parent-coverage.json`. Die gelieferten Aufgaben-/Knoten-/Unit-Zeilen sind vollständig untersucht; verbleibende ungeprüfte Aufgaben-IDs: null. Fehlende andere Tabellen werden dadurch nicht als unverändert erklärt.

## Nachweise und Übergabe

`epoch33-production-adoption-audit.json` enthält aggregierte Zahlen, Dump-/Seed-SHAs, Repair-Commit-Liste, Audio-Extraktor-SHAs und den privaten Artefaktindex. `S2/epoch33-full-adoption-inventory.json` enthält alle 320 vollständigen tatsächlichen Before-Zeilen, finale vollständige Source-Aufgaben, Importer-Business-After, genaue Felddeltas und SQL114-Projektionen sowie die 48 vollständigen Eltern-Before/After-Pakete. `S2/epoch33-full-final-canonical-audio.json` enthält sämtliche finalen Aliase, eindeutige Texte, Herkunfts-IDs und echte Alt/Neu-Audiodifferenzen. Vollständige Produktionszeilen verbleiben ausschließlich privat.

Keine zusätzlichen Tests oder Authoring-Rebuilds wurden gestartet. Die Beweise sind vollständige Offline-Vergleiche, tatsächliche Schema-/Adapter-Ausführung und Inhalts-/Hashwächter. M prüft das Gesamtpaket unabhängig vor Übernahme, erzeugt bzw. verifiziert lokale Audios und Wortzeiten und führt allein Revisionen, Import und Veröffentlichung aus. S2 sichert den eigenen Commit und geht auf WAIT, ohne automatische Folgeeinheit.
