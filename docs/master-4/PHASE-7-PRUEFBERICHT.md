# Phase 7 — Prüfbericht: Lehrer-Dashboard

Stand vor Änderungen: 26.09.2026, Revision `09e66e9`, sauberer Arbeitsbaum, Branch `codex/vps-self-hosted`.

`00_CODEX-4-RULES.md`, `07_PHASE-7-GPT.md` und `STATUS.md` gelesen. Phase 6 wird ausdrücklich übersprungen. Ausschließlich lokale Phase-7-Arbeiten; keine Produktionsmigration, kein Deployment und kein Zugriff auf Produktionsdaten vorgesehen.

| Ort | Ist | Soll / Phase-7-Änderung |
| --- | --- | --- |
| Schülerliste / Detailmodal | Kontakt, Rollen, Freigaben, Prozentfortschritt und Tafelnotiz; keine eigene Schülerseite. | Geschützte Detailroute mit sechs Tabs; erweiterte sortier-/filterbare Liste und mobile Karten. Bestehende Freigaben erhalten. |
| Lernpfad | Pfade, Sterne, Tests und `manage_learning_path` seit Phase 3 vorhanden. | Lehrkraft-Lesevertrag, Antworten/Versuche, bestätigte und protokollierte Notfallaktionen; Parallelität, Wiederholung und alte Sitzungen prüfen. |
| Vokabeln | Richtungsfortschritt, Antwortbelege, Pausen und Mitnahme aus Phase 5 vorhanden. | Aggregationen je Niveau/Lektion, schwierige/halb gewusste Wörter, letzte 50 Antworten. Eigene Wörter ausschließlich als Anzahl. |
| Aktivität | `learning_activity_days` enthält Lerntage; keine vollständigen Sitzungszeiten. | Nur Sitzungen mit Beginn/Ende, Modus, Niveau und Antwortanzahl; Tagesaggregate bleiben, Rohdaten maximal 180 Tage. Keine Klickpfade. |
| Rechte / Performance | Bestehende Staff-Prüfungen und RLS; bisherige Analytics-RPC. | Neue Abfragen mit Datenbankprüfung und expliziten Grants, gezielte Indizes und p95-Messung mit 200 synthetischen Lernenden. |
| Migrationen | 37 letzter lokaler Stand; 38 nach Inventar frei. | Nummerierte idempotente lokale Migrationen mit Rückwegen, Backup-Runner, echtem Schema-/Typenexport. |
| Datenschutz | Bestehende mehrsprachige Datenschutzerklärung und Profil. | Lernfortschrittszweck, Lehrkraftsicht und Aufbewahrung in fünf Sprachen; Profilhinweis mit Link. |

## Prüfplan

- DB-Tests für neue Leseverträge, Rechte, Privatheit, Aufmerksamkeit, Retention und Notfallaktionen einschließlich Nebenläufigkeit und veralteter Testversuche.
- Isoliertes echtes PostgreSQL mit synthetischen Daten, Backups über den Adapter von `migrate-local.py`, doppelte Anwendung, Rückweg und Wiederanwendung.
- Playwright für Liste und alle Detailtabs, Bestätigung/Abbruch und reale Notfallaktionen; vollständige Axe-Scans ohne Ausschlüsse, Desktop und Mobil.
- Performancebericht mit 200 Testpersonen und p95 unter 800 ms; TypeScript, Build und passende Regressionstests.
- Abschließend Ergebnisse, neue Routen/RPCs/Löschregel in `STATUS.md` dokumentieren und lokalen Abschlusscommit erstellen.


## Ergebnis der Implementierung

Die Detailroute `/{lang}/admin/students/[id]` ersetzt den Modal-Einstieg und enthält Überblick, Vokabeln, Lernpfad, Aussprache, Aktivität und datierte Notizen. Die Liste lädt ihre Lerndaten über eine mengenbasierte RPC; jede Lernspalte kann sortiert und gefiltert werden, mobile Ansichten verwenden Karten. Mehrfach- und Komplettfreigaben der sechs Niveaus sowie bisherige Zugriffs- und Rollenaktionen bleiben erreichbar. Das alte Detailmodal bleibt gemäß R4 im Repository.

Migration 38 erfasst ausschließlich gespeicherte Lernereignisse. Eine Sitzung enthält Beginn, Ende, Modus, Niveau und Antwortanzahl. Die Lernzeit addiert Antwortabstände innerhalb derselben Sitzung bis höchstens fünf Minuten; Modus-/Niveauwechsel trennen Sitzungen. Mitternacht wird in Europe/Berlin einschließlich Sommerzeitwechsel aufgeteilt. Für erste Antworten, Leerlauf, passives Video und historische Daten wird keine Zeit erfunden. Frühere Aktivität bleibt, soweit vorhanden, für „zuletzt aktiv“ nutzbar. Rohe Sitzungen werden beim nächsten Lernschreiben global nach 180 Tagen entfernt; Tagesaggregate bleiben dauerhaft. Profil und Datenschutzerklärung erläutern dies in fünf Sprachen.

Migration 39 stellt `get_teacher_dashboard_students()` und `get_teacher_student_detail(p_student_id, p_tab, p_locale)` bereit. Rechte werden in PostgreSQL geprüft. Eigene Wörter erscheinen nur als Anzahl: weder Inhalte noch getippte Antworten, Rückfallranglisten oder Fächerfortschritt gelangen in den Lehrkraftvertrag. Aufmerksamkeit berechnet die Datenbank: sieben Tage inaktiv, zuletzt zweimal derselbe Test nicht bestanden, mehr als 150 fällige Karten oder unter 50 Prozent Treffern innerhalb sieben Tagen.

### Notfallaktionen

`manage_learning_path(p_student_id, p_unit_id, p_action, p_node_id, p_request_id)` prüft Lehrkraftrechte, Zielperson, Pfad und Voraussetzungen, bevor es schreibt. Die bestehende Vier-Argument-Signatur bleibt kompatibel. Die Oberfläche zeigt eine Bestätigung mit Abbrechen links und Bestätigen rechts; Abbrechen schreibt keinen Audit-Eintrag. Identische Wiederholungen derselben Request-ID liefern dasselbe Ergebnis, eine abweichende Aktion damit liefert `request_conflict`.

Reset und Lernschreiben verwenden denselben transaktionalen Advisory Lock. Zurücksetzen archiviert Versuche, Antworten und Fortschritt; der Verlauf und das Interventionsprotokoll bleiben lesbar. Alte Übungs- und Testaufrufe können nach einem Reset keinen Fortschritt wiederherstellen. Vier echte parallele PostgreSQL-Szenarien prüfen beide Commit-Reihenfolgen von Antwort/Reset und Testabschluss/Reset; `pg_stat_activity` bestätigt das tatsächliche Warten auf den gemeinsamen Lock. Alle vier sind bestanden.

### Migration und Rückweg

Auf einem isolierten PostgreSQL 17.11 mit PostgREST 16.4 wurden 38 und 39 jeweils zweimal angewendet, anschließend 39 und 38 zurückgenommen und beide erneut angewendet. Bestehender Fortschritt bleibt erhalten; Schema vor Rückweg und nach Wiederanwendung ist identisch. Geprüfte Backups entstehen vor Migrationen, Import und Fixture-Aufbau, die Migrationsausführung erfolgt über den lokalen Adapter von `migrate-local.py`. Schema und TypeScript-Vertrag wurden aus der echten lokalen Datenbank exportiert.

Rollback 39 entfernt die Dashboard-RPCs und die neue Notfall-Signatur, behält aber archivbewusste Lernpfad-Leser und -Schreiber: archivierte Versuche dürfen auch mit dem früheren UI nicht wieder aktiv werden. Rollback 38 archiviert Sitzungen und erhält einen Lösch-Fallback bei neuen Tagesaktivitäten. Ein exakter Stand vor der Migration wird aus dem vollständigen Backup wiederhergestellt.

## Performance

Der synthetische Bestand enthält genau 200 Lernende, zusätzlich eine Lehrkraft, 39.810 Vokabelrichtungen, 6.000 Tageswerte, 400 Testversuche und 6.000 Testantworten sowie sieben tatsächlich importierte Lernpfade. Gemessen wurde die vollständige Listen-RPC über HTTP/PostgREST auf Loopback, einschließlich JSON-Antwort, nach fünf Aufwärmaufrufen mit 40 Messungen. Der abschließende p95 beträgt **293,625 ms**, die Vorgabe ist **unter 800 ms**. Während eines Teils der Messung liefen lokale Build-/DB-Prüfungen; dies ist keine Aussage über die spätere VPS-Latenz oder das Browser-Rendering.

Die Berechtigung zur jeweiligen Lerneinheit wird einmal pro Kombination aus Person und Einheit ermittelt statt erneut für jede Karte. Aggregationen arbeiten mengenbasiert, mit gezielten Indizes für aktive Versuche, Zeiträume und Sitzungsablauf. Sämtliche 40 Messwerte und Migrations-Hashes stehen in `phase-7-nachweise.json`.

## Verifikation

| Prüfung | Ergebnis |
| --- | --- |
| Vollständige Datenbank- und Import-/Audio-Regression | 531 bestanden, 0 fehlgeschlagen, 0 übersprungen |
| Jest | 1.923 Tests in 150 Suites bestanden, 0 übersprungen |
| Python VPS-Tests | 61 bestanden; zusätzlich 3 TTS-Tests bestanden |
| Reale parallele PostgreSQL-Transaktionen | 4 von 4 bestanden |
| Idempotenz, Backup, Rollback und Wiederanwendung | bestanden |
| Next.js Produktionsbuild | bestanden, 157 statische Seiten |
| TypeScript | bestanden |
| Playwright und Axe ohne Ausschlüsse | 8 Fälle bestanden (47,2 s), 13 vollständige Axe-Scans ohne Verstöße |

In den Vorläufen gefundene Probleme wurden korrigiert: künstliche Fixture-UUIDs erfüllen jetzt die produktive UUID-Validierung, die optionale RPC-Knoten-ID wird ausdrücklich als `null` übergeben, der Fachbeschriftungskontrast nutzt den vorhandenen Text-Token, Sternzusammenfassungen haben eine gültige zugängliche Rolle, verschachtelte Hauptbereiche wurden entfernt und gemeinsam verwendete Hover-Zustände bleiben lesbar. Die Überschriftenfolge des Notizbereichs wurde berichtigt. Auf den neuen Seiten sichtbare Navigationsziele wurden auf 48 px angehoben. Die breite Tabelle beginnt erst ab 1536 px, damit die neun Spalten auf kleineren Bildschirmen nicht zu schmal werden; darunter werden Karten verwendet. Ein paralleler Fixture-Aufbau darf nicht während der Prüfung „genau 200 Lernende“ laufen; die abschließenden Läufe verwenden getrennte Prüfphasen.

Zwölf Screenshots wurden visuell geprüft, einschließlich mobiler Pfadkarten in Hell/Dunkel, geöffneter Testantworten, Aktivitäten, Notizen und Bestätigung. Die Browserabnahme prüft zusätzlich den tatsächlichen Einstieg in das Aussprachegespräch. Die künstliche Audio-Datei ist kein Abnahmetest für die bereits vorhandene Audio-Wiedergabe. Nachweise: [JSON](phase-7-nachweise.json), [Bilder](phase-7-bilder/README.md).

Keine Produktionsmigration, kein Deployment, kein Push und keine Phase-6-Implementierung wurden ausgeführt. Die lokale Abnahme ist die Freigabegrundlage für einen späteren, separat beauftragten Produktionsschritt.
