# Phase 8 — Abnahme und Auslieferung

Stand: 26.09.2026. Ausschließlich Abnahme und Auslieferung der Phasen 1–5/7. Phase 6 ist auf Nutzerwunsch aus dem MVP ausgeschlossen. **Abgeschlossen und produktiv aktiviert:** Release `01fa06e013d6` auf `codex/vps-self-hosted`; öffentliches Health `ready`.

## Abnahmematrix

| Anforderung | Automatisierter Nachweis |
| --- | --- |
| Phase 1: Aktionsreihenfolge, Artikelhinweise, Freischaltung | Jest: `article-hint`, `learning-path-ui`, Vokabel-UI; DB: `fair-grading-migration` einschließlich Groß-/Kleinschreibung, Interpunktion und Artikelstatus |
| Phase 2: vier Modi, Brotkrumen, mobile Leiste/Aufnahme, letztes Niveau, reduzierte Bewegung | Jest: `phase2-navigation`, `phase2-motion`, `home-last-active-level`; DB: `last-active-level`; Browsermatrix auf drei Geräten |
| Phasen 3/4: vollständiger erster Pfad, Folgeschaltung und Lösungsgeheimhaltung | Pixel-7-Produktionsbuild: `master4-phase4.spec.ts`, 3/3; 78 Übungs- und 16 Testantworten, alle drei Aufgabenformen; Startantworten enthalten keine Lösungen. DB: `learning-path` prüft knapp unter 80 % und genau 80 %. Seed-/Import-Suites grün |
| `/exercises` → `/path`, ein RPC für die Karte | `phase8-path-routing`, alle sechs Geräte-/Themenkombinationen; kanonische Route lädt `getLearningPath` einmal |
| Phase 5: Mitnahme, Fach erhalten, aus/an, Reset | `vocabulary-carryover` DB sowie Actions-/UI-Jest-Suites |
| Phase 7: alle Tabs, Rechte, Notfallaktionen, keine Einspruchs-UI | `teacher-dashboard` DB, Actions-/UI-Jest; Phase-7-Playwright 8/8 und Phase-8-Matrix |
| Barrierefreiheit | 37 Lernenden-/Admin-Ziele × hell/dunkel × Desktop Chrome/Pixel 7/iPhone 14 = 222 Fälle; vollständiges Axe ohne Regel-/Elementfilter; zusätzlich Lernpfad-Regelkarte/Aufgaben |
| Fünf Sprachen | `translation-integrity`; Hilfe für Lernpfad und Wortmitnahme in de/en/ru/uk/tr, bisherige Hilfe erhalten |
| Phase 6 und deren Hilfetexte | **N/A: ausdrücklich übersprungen**, keine neuen Benachrichtigungen oder „Neu“-Markierungen eingeführt |

Die Matrix verwendet echte PostgreSQL-/PostgREST-Aufrufe mit isolierten synthetischen Personen und englischer Oberfläche. Desktop/Pixel verwenden Chromium, iPhone WebKit. Die Authentifizierung des lokalen Harness ist synthetisch; der Produktionsrauchtest verwendet dagegen eine echte GoTrue-Sitzung. Es werden keine Live-Lernenden als Testpersonen verwendet.

## Regression und Datenbank-Kompatibilität

- Vollständiges Jest: **1.931 Tests / 153 Suites**, keine Skips.
- Sämtliche DB-/Node-Tests: **531**, keine Skips; Python: **61 VPS + 3 TTS**.
- TypeScript und Produktionsbuild erfolgreich.
- PostgreSQL **15.8**: kumulative Migrationen **32–39**, doppelte Anwendung, sämtliche Rückwege 39–32 und Wiederanwendung. Drei Seedimporte mit stabilen IDs und identischen Inhalten. Bestehende Grammatikfortschritte bleiben erhalten.
- Zweiter Klon behält originale Eigentümer/Grants bei. Beide Klone bestätigen den Ablauf. [Erster Nachweis](phase-8-postgres15-nachweise.json), [Originalrechte](phase-8-postgres15-owner-nachweise.json).
- Lokal: Lehrerlisten-HTTP-p95 **155,572 ms**, 200 Lernende, 39.810 Richtungszeilen, 40 Aufrufe nach fünf Warmups, PostgreSQL 17.11/PostgREST 16.4; Grenze 800 ms. Dies ist ausdrücklich keine Messung mit 200 echten Produktionspersonen.

Die ersten Browserläufe waren nicht grün: fehlende H1/falsche Landmarks, ein HEAD-Fehler im Testgateway, Safari-Datumsformatierung und Streaming-Weiterleitungen wurden gefunden und korrigiert. Unvollständige Browserinstallationen und hängende Node-26-Abschlüsse wurden durch frische Browser mit Node 24 ersetzt. Keine fehlgeschlagene Assertion wurde ausgeblendet. Details im [Prüfbericht](PHASE-8-PRUEFBERICHT.md).

## Leistung

Die endgültige Lighthouse-Messung ([Messdaten](phase-8-performance.json)) nutzt mobilen Viewport, simulierte Netzwerk-/CPU-Drosselung und vor jeder Route einen geleerten Browser-Cache. Die authentifizierte Sitzung bleibt erhalten. Der Knoten ist ein Zustand innerhalb der Lernpfadroute und wird deshalb als Timespan gemessen, nicht als erfundene eigenständige Navigation.

| Ansicht | Performance | LCP | FCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| home | 80 | 5.24 s | 1.35 s | 6.0 ms | 0.000 |
| level | 81 | 5.01 s | 1.35 s | 1.0 ms | 0.000 |
| path | 81 | 5.01 s | 1.50 s | 0.5 ms | 0.000 |

Knoten-Timespan: Score 100, Öffnen plus Weiter zur Aufgabe 74 ms, TBT 0 ms, CLS 0.0102. Timespan verwendet `provided` ohne zusätzliche Drosselung und ist nicht direkt mit den Navigationsscores vergleichbar.

Die mobilen Kaltstart-LCPs von rund fünf Sekunden bleiben ein Optimierungspunkt, vor allem globale Schrift-/JS-Ladekosten. Kein festgelegter Lighthouse-Mindestscore existiert im Phase-8-Auftrag; diese Einschränkung wird nicht als perfektes Ergebnis dargestellt.

**N/A für den numerischen Phase-0-Vergleich:** Phase 0 enthält keine Lighthouse-Baseline. Diese Messungen sind die Erstbaseline.

Lernpfad-JavaScript aus Next-Build/Bundle-Analyse: **1.123.856 Bytes unkomprimiert**, **357.556 Bytes gzip** (20 Chunks). Framer Motion: 134 Client-Quellmodule, 87.991 Bytes; kein Quellmodul in mehreren Client-Chunks, eine installierte Paketversion.

Der Erstlauf fand ein 9.089.426-Byte-Favicon und einen schlechten simulierten Home-LCP. Die Metadaten verwenden nun die vorhandene lokale Bildoptimierung: 64 × 64 Pixel / 3.468 Bytes statt 3072 × 3072 Pixel. Die Originaldatei bleibt erhalten; kein CDN oder weiterer Dienst.

## Auslieferung und Rückweg

[Produktionsnachweise](phase-8-live-nachweise.json), [vollständige Browsermatrix](phase-8-browser-nachweise.json). Erfolgreich ausgeführter Ablauf: Vorbereitung ohne Umschalten → privates Vollbackup → Migrationen 32–39 bei gestoppter App/Mail → separates frisches Vollbackup → atomarer Seed-CLI → Inhalts-/Rechteprüfung → Aktivierung mit `--schema-changed` → echter Testaccount und Bereinigung → Dienste/Health → Schema-/Typenexport.

Das erste Storage-Backup war wegen eines abgeschnittenen Video-Downloads ungültig und wurde nicht verwendet. Ein vollständiger Wiederholungslauf sicherte 563 Objekte. Jede produktive DB-Änderung verwendet erneut den Backupweg von `migrate-local.py`; Dumps, Storage-Dateien, Schlüssel und Sitzungen bleiben außerhalb Git.

Bei einem Fehler nach Schemaänderungen bleiben App/Mail gestoppt; kein automatisches Zurückschalten auf ein inkompatibles altes UI. Rückwegdateien werden umgekehrt einzeln angewendet und archivieren neue Lern-/Auditdaten. Exakte Wiederherstellung benötigt das passende vollständige DB-/Storage-Backup und das dazugehörige Release. Keine RAM-Limits wurden erhöht und keine dauerhaften Dienste hinzugefügt.


### Produktives Ergebnis

- Migrationen **32–39** am 26.09.2026 eingespielt. 38/39 sind die notwendigen Phase-7-Abhängigkeiten; Phase 6 wurde nicht implementiert.
- Seed per CLI atomar importiert: **7 Pfade, 85 Knoten, 769 Aufgaben, 87 Lernziele**, SHA256 `d5d954b7579ababef29876eb5321757d722194bd096ae44bf1ab925864c99a0c`. Alle sieben geschützten Exporte vollständig verglichen; das definierte Standardfeld `is_active=true` ergänzt und Lernziele nach ID wie im Export sortiert. Keine Inhalte/Antworten vom Vergleich ausgeschlossen.
- Alte Grammatikfortschritte vor/nach Migration/Import per vollständigem Hash identisch. Altunits archiviert; sieben nachvollziehbare Lehrkraftnotizen aus der Bestandsmigration. RLS, private Antwortbelege und privilegierte RPC-Grants geprüft.
- Release **01fa06e013d6** mit Artefaktprüfsummen und `--schema-changed` aktiviert. App, nginx, TTS, Postfix und Mail-Worker aktiv; keine Neustartschleifen, unveränderte Limits (App 2 GiB, Mail 256 MiB), rund 2,8 GiB verfügbarer VPS-RAM nach Freigabe.
- Produktionsrauchtest auf öffentlichem HTTPS mit echtem GoTrue-Testkonto: Home, Niveau, alle vier Modi, kompletter erster Pfadknoten und eine Vokabelrunde mit **10 Karten**. Keine Browserfehler; Lösungen und Lernstände von PostgreSQL bestätigt.
- Testkonto/Sitzungen, Person, Freigaben, Lernstände, private Vokabel-Antwortbelege und Test-Outbox entfernt; abschließender Katalogscan findet **0 zugehörige Anwendungszeilen**. Der Worker wurde erst nach Entfernung der Testmails gestartet. Er verarbeitet die bestehende reguläre Outbox.
- `supabase/schema.sql` frisch aus **Produktions-PostgreSQL 15.8** exportiert. `database.types.ts` aus dessen Katalog aktualisiert: 16 Tabellen/20 RPCs plus Enums, inhaltlich bereits identisch. TypeScript danach grün. Schemaunterschiede zum lokalen Snapshot betreffen Versions-/ACL-Darstellung und die originalen Postgres-Grants.
- Zwei private VPS-Verifikationsklone nach zusätzlichen geprüften Klonbackups entfernt. Backupnachweise bleiben root-only außerhalb Git.

### Betriebliche Einschränkungen und erfolglose Zwischenversuche

Der Backupprüfer erkannte auch vor der Testbereinigung einmal einen abgeschnittenen Storage-Download. Kein COMPLETE-Marker und keine davon abhängige Änderung erfolgten. Der vollständige Wiederholungslauf war gültig. Insgesamt wurden für Migration, Import, Testanlage, Bereinigung und private Antwortbelege fünf frische vollständige Produktionsbackups mit jeweils 563 Objekten verwendet. Die sporadischen Downloadabbrüche sind weiterhin ein Betriebspunkt: vor jeder weiteren Änderung muss der vollständige Backupnachweis bestehen; ein bloß gestarteter Backupjob reicht nicht.

Der erste Vokabel-Rauchtest verwendete irrtümlich den Testskript-Parameter `lesson=1`; echte Lektionsschlüssel sind keine solche Nummer. Dadurch erschien ein leerer gefilterter Stapel, ohne Antworten zu speichern. Der endgültige Lauf nutzte den normalen Trainer mit der zuvor über die Oberfläche aktivierten Lektion und schloss alle zehn Karten ab.

Die letzte aktivierte Laufzeitrevision bleibt `01fa06e013d6`. Der anschließende Abschlusscommit enthält ausschließlich Nachweise, STATUS und den Produktionsschemaexport; dafür ist kein weiterer Laufzeitwechsel nötig.
