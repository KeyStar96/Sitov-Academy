# Phase 5 — Prüfbericht: Wörter mitnehmen

Stand vor Änderungen: 26.09.2026, Revision `b7dc0c7781e75afc3c7aa34d827276f3d583d996`, sauberer Arbeitsbaum, Branch `codex/vps-self-hosted`.

`00_CODEX-4-RULES.md`, `05_PHASE-5-GPT.md` und `STATUS.md` gelesen. Ausschließlich Phase 5 ist beauftragt.

| Ort | Ist | Soll / Phase-5-Änderung |
| --- | --- | --- |
| `app/actions/vocabulary.ts` | Katalog, Lernbox und Sitzungen filtern unmittelbar nach dem Niveau. | Offene, begonnene Karten früherer Niveaus bei aktiviertem persönlichem Zielniveau-Schalter zusätzlich lesen; Originalfortschritt erhalten. |
| `lib/vocabulary-box.ts` | Ein Wort steht im Fach seiner schwächeren Richtung; gelernt bedeutet beide Richtungen auf 7. | Berechnung weiterverwenden; mitgenommene Karten nicht zum eigenen Niveaufortschritt zählen. |
| `supabase/vps/23_vocabulary_own_words.sql`, `25_vocabulary_lesson_switch.sql` | Private eigene Wörter und persönliche Lektionspausen existieren. | Eigentumsprüfung und Pausen auch für Mitnahme durchsetzen. |
| Bewertung | Letzte Definitionen: `submit_answer` / `check_retry_answer` in 30, `submit_self_rating` in 23; zusätzliche idempotente Wrapper. | Zielniveau explizit und in PostgreSQL prüfen, einschließlich Wrapper und gespeicherter Antworten. Keine Lösungen vor Wertung ergänzen. |
| `components/vocabulary/VocabularyLessons.tsx` | Lektionen und eigene Wörter mit Schaltern. | Zusätzliche Station, Herkunftsniveau, Anzahl und Fachverteilung; einmalige Entscheidung beim ersten Lernen/Einstufen. |
| Niveau-/Gesamtreset | Lernpfad-Erweiterung in Migration 35; Browserinvalidierung vorhanden. | Zielentscheidung löschen; Herkunftsfortschritt bei Zielreset erhalten; Herkunftsreset entfernt Mitnahme. |
| Migrationen | 36 ist belegt; 37 nach Dateiinventar frei. | Idempotente Migration 37, Rückweg, Runner-Reihenfolge, echter Schema-/Typenexport. |
| Betrieb | Laut Status Produktion auf Migration 31; 32–36 nur lokal geprüft. | Zuerst lokale Abnahme und konkrete Aktivierungsabhängigkeiten prüfen; keine stillschweigende Erledigung älterer offener Phasen behaupten. |

## Prüfplan

- DB-Regressionen für unveränderte Fach-/Termin-/Kartenidentität, alle früheren Niveaus und eigene Wörter, Schalter, Pausen, nie begonnene und fremde Karten, gesperrtes Zielniveau, Reset und getrennten Fortschritt.
- Reale lokale PostgreSQL-Migration über den Backup-Adapter von `deploy/vps/migrate-local.py`: zweimal anwenden, Rückweg und Wiederanwendung; Schema und öffentliche Typen abgleichen.
- Server-/Komponententests, TypeScript, Build und Playwright-Ablauf A1.1 → A1.2 mit Frage und Wertung derselben Karte im richtigen Fach.
- Ergebnisse, Grenzen, Tabellen-/RPC-Vertrag und Betriebsstand anschließend in diesem Bericht und `STATUS.md` dokumentieren; gemeinsamer Abschlusscommit.

## Umsetzung und lokale Abnahme

Die ursprünglichen Karten-/Richtungszeilen werden weiterverwendet. Getrennte Herkunftsmetadaten steuern Anzeige und Sitzungszuordnung; keinerlei Kopie in das Zielniveau. Der Schalter gilt je Person/Zielniveau, und die Auswahl folgt `learning_levels.sort_order`. Pausen, eigene Wörter, niemals begonnene und vollständig gelernte Wörter werden auf der Datenbankseite berücksichtigt. Der Niveaufortschritt verwendet `ownBox`, die sichtbare Lernbox enthält zusätzlich die eingeschalteten Kandidaten.

Die neuen Bewertungsüberladungen prüfen ein ausdrücklich übergebenes Zielniveau. Der bisherige Herkunftszugriff wird dadurch nicht als Ersatzberechtigung verwendet. Auch ein bereits gespeicherter Antwortbeleg ist nach Schalter-Aus, Pause oder Entzug der Ziel-Freigabe nicht mehr über das Ziel abrufbar. Gleiche Request-ID in einem anderen Ziel erzeugt einen Konflikt. Ein vollständig gelernter letzter Versuch kann dagegen identisch wiederholt werden, solange die Berechtigung weiter besteht; es entsteht keine zweite Wertung.

Die erste Frage wird erst vor einer tatsächlichen Lernrunde/Einstufung geöffnet; ein leerer Direktaufruf verbraucht sie nicht. Entscheidung und Beginn werden in PostgreSQL gespeichert, nicht nur im Browser. Nach Annahme lädt die erste Sitzung die neu aufgenommenen Karten. Alte, belegte Lernaktivität wird beim ersten Migrationslauf berücksichtigt: beantwortete Richtungen, bereits höher eingestufte Wörter oder ein abgeschlossener Onboarding-Datensatz verhindern eine nachträgliche Erstfrage. Eine historische Einstufung ausschließlich neuer Wörter ist im Altmodell nicht von bloßer Lektionsinitialisierung unterscheidbar; diese unklaren Fälle werden nicht anhand erfundener Aktivitätsdaten unterdrückt.

Station und Frage stehen in `de`, `en`, `ru`, `uk` und `tr` bereit, mit Singularformen, bestehenden Farb-Tokens, zugänglichen Schaltern und mindestens 48px großen Aktionen. Herkunftsniveaus stehen in Lernbox, Fachansicht und Sitzung. Der bestehende Browser-Invalidierungskanal verwirft Sitzungen anderer Tabs nach Schalteränderungen; ein Niveau-/Gesamtreset verwirft alle davon betroffenen Warteschlangen.

### Nachweise

| Prüfung | Bestanden | Fehlgeschlagen | Übersprungen |
| --- | ---: | ---: | ---: |
| Jest, vollständiger Bestand einschließlich echtem lokalen DB-Smoke | 1.896 / 147 Suites | 0 | 0 |
| DB-/Node-Tests, vollständiger bisheriger Aufruf einschließlich Phase 5 | 503 | 0 | 0 |
| Python VPS / TTS | 61 / 3 | 0 | 0 |
| Playwright mit fünf vollständigen Axe-Scans | 6 | 0 | 0 |
| TypeScript | Exit 0 | 0 | 0 |
| Produktionsbuild | Exit 0, 157 statische Seiten | 0 | 0 |

Die 21 Phase-5-DB-Fälle prüfen Fach, Termin und Identität, alle früheren Niveaus, Privatheit, Pausen, nie begonnene und gelernte Wörter, Ziel-/Herkunftsfreigaben, direkte Tabellenrechte, alle Bewertungswege samt Antwortbelegen, Erstentscheidung und historische Aktivität, getrennten Fortschritt, beide Niveau-Resetrichtungen, Gesamtreset, Schreibsperre während laufender Resets sowie Rückweg und Wiederanwendung.

Die Browserabnahme umfasst Annahme und echte PostgreSQL-Wertung einer A1.1-Karte in A1.2, Ablehnung bei der ersten Einstufung mit späterer Aktivierung, zwei gleichzeitig offene Tabs, leeren Direktaufruf und mobile Station/Frage in beiden Themes. Screenshot-, Browser- und Backupzahlen stehen in [phase-5-nachweise.json](phase-5-nachweise.json); Bilder in [phase-5-bilder/README.md](phase-5-bilder/README.md).

### Backup, Idempotenz und Rückweg

Echtes PostgreSQL **17.11** und PostgREST **16.4**, synthetische Personen und Inhalte, ausschließlich Loopback. Migration 37 zweimal über den Backup-Adapter des Produktionsrunners ausgeführt; Rückweg und erneute Migration haben exakt denselben Schemaauszug ergeben. Eine zweite frische Instanz bestätigt das gleiche Schema. Ursprüngliche Fortschrittszeilen bleiben bytegleich, einschließlich IDs/Fächern/Terminen. Backup-Manifeste und SHA256 stehen im Nachweis; keine Sicherungen oder Zugangsdaten im Repository.

`supabase/schema.sql` wurde vollständig aus dem abschließenden realen Klon exportiert; `database.types.ts` stammt aus dessen öffentlichem Katalog. Exporter unterstützt die neuen Tabelle/RPCs und die zusätzliche Zielniveau-Überladung. Nächste freie Migration ist **38**.

### Behobene Erstlaufbefunde und Grenzen

- Ein bestehender synchroner UI-Test musste auf das nun asynchrone Start-Gate warten; die Produktanforderung und Assertion bleiben erhalten.
- Die unabhängigen Reviews fanden fehlenden Schreibschutz der Entscheidung während eines Gesamtresets und einen dadurch blockierbaren Rückweg. Beides korrigiert und separat geprüft.
- Ein Browserselektor erwartete zunächst das Sitzungsetikett in der Lernbox; korrigiert auf die tatsächliche zugängliche Herkunftsliste. Ein zusätzlicher Pausentest legte anschließend einen nicht zurückgesetzten Fixture-Zustand offen; der lokale Testreset stellt nun auch die persönlichen Pausen vollständig wieder her. Kein Test oder Axe-Befund wurde herausgefiltert.
- Der erste Python-Lauf zeigte das bekannte fehlende PyYAML; der vollständige Lauf mit vorhandener Testumgebung besteht ohne Skip. Der TTS-Aufruf wurde aus dem erforderlichen Modulverzeichnis wiederholt.
- Unvollständige historische Richtungsdaten werden nicht verändert: vorhandene einzelne Richtungen behalten ihren Lernstand, fehlende Richtungen werden nicht als fällige Datenbankzeilen erfunden. Rein lesender Produktions-Aggregatcheck: **0** Wörter mit einer statt zwei Richtungszeilen. Eine eventuell extern beschädigte Ein-Richtungs-Karte ist kein mit Phase 5 reparierter Altbestand.
- Keine PostgreSQL-15.8-Produktivabnahme und kein Deployment. Die reale Produktionskontrolle liest ausschließlich Release, Health und einen anonymen Konsistenzzähler.

## Produktivgrenze und Übergabe

Die lokale Phase-5-Implementierung ist fertig. Die geforderte **produktive Aktivierung ist ausdrücklich offen**, weil der bisher nur lokal freigegebene Stand 32–36 dabei ebenfalls aktiviert werden müsste, um den geprüften geordneten Ablauf einzuhalten. Der konkrete Aktivierungs-/Rückweg und die Folgen für die alten Grammatik-Units/769 Aufgaben sind in [phase-5-betrieb.md](phase-5-betrieb.md) vorbereitet. Keine Phase 6–8 umgesetzt.

Die offiziellen [RLS-Regeln](https://supabase.com/docs/guides/database/postgres/row-level-security) und der aktuelle Supabase-Changelog wurden für Grants/Policies geprüft; es waren keine neuen Dienste oder Paketaktualisierungen nötig. Die projektspezifischen Regeln für nummerierte VPS-Migrationen und Backup-Runner haben Vorrang vor dem allgemeinen Supabase-CLI-Workflow.
