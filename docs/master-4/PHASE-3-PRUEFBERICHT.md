# Phase 3 — Infrastruktur-Prüfbericht

## Prüfung vor Änderungen

26.09.2026. `00_CODEX-4-RULES.md`, `03_PHASE-3-GPT.md`, `STATUS.md` und der Phase-2-Prüfbericht gelesen. Ausgangsrevision `a25f8285c89a0bfecec6d4d65657a594547cfabc`, sauberer Arbeitsbaum. Der ausdrückliche Zusatzauftrag beschränkt diesen Durchlauf auf Datenbank-Architektur, Tabellen, RPCs, Enums und Zod-Verträge. Lernoberfläche, Routenwechsel und CMS-Oberfläche werden hier nicht vorgezogen; Phase 4 wird nicht ausgeführt.

| Bereich | Geprüfter Ist-Zustand | Soll dieses Durchlaufs |
|---|---|---|
| Migrationen | VPS-Dateien bis 32; Runner mit expliziter Reihenfolge | Vorgeschaltete Enum-Migration ab 33, danach idempotente Infrastruktur und Rückwege |
| Inhalt | Vorhandener Seed `supabase/seeds/path-a1.1.json`, 2.813.970 Bytes, SHA256 `d5d954b7579ababef29876eb5321757d722194bd096ae44bf1ab925864c99a0c` | Unverändert lassen; Vertragsprüfung ohne produktiven Import, keine neuen Lerninhalte |
| Datenmodell | Units, Exercises, Grammatikübersetzungen und alter Aufgabenfortschritt; keine Pfadknoten/Testversuche | Pfadkennzeichen, Knoten/Übersetzungen/Lernziele, Fortschritt, Versuche/Antworten, Staff-Eingriffe |
| Bewertung | Phase-1-`grade_answer`; alter Grammatikvertrag für zwei Typen | Alle neun Typen in SQL, korrespondierende Zod-Prüfung, strikt lösungsfreie Startantworten |
| Zugriff | `unit_allowed`, Trainer-/Unit-Freigaben, Sprachschutz aus 07 | Bestehende Freigaben erhalten, RLS und RPC-Schreibgrenze, keine Lösungen über Tabellen/Alt-RPCs |
| Reset | Niveau-/Gesamtreset und tabübergreifende Browserinvalidierung vorhanden | Neue Pfaddaten einbeziehen, anderer Lernstand bleibt erhalten |
| Nachweise | PGlite-Testhelfer, PostgreSQL-Klon-/Exportwerkzeug und Backup-Runner vorhanden | RPC-/Vertrags-/Berechtigungstests, doppelte Migration, Rückweg, Schema-/Typenabgleich |

Keine Produktionsmigration und kein Deployment Bestandteil dieses lokalen Infrastrukturauftrags. Persistente DB-Änderungen nur mit dem vorhandenen Backup-Verfahren; lokale isolierte Testdatenbanken enthalten ausschließlich Testdaten.

## Umsetzung und Nachweise

Die folgenden Nachweise dokumentieren den lokalen Infrastrukturabschluss.

### Implementierte Infrastruktur

- **33_path_exercise_types.sql:** sechs neue Werte des vorhandenen `exercise_type`, eigenständig vor der Verwendung committet durch den Runner.
- **34_path_content_contract.sql:** neun passende SQL-Contentverträge, deutscher Sprachschutz auch für verschachtelte Aufgaben, zentrale Bewertung und strikt lösungsfreie Feldauswahl. Die drei Bestandsformen bleiben kompatibel; `target_form` bleibt Pflicht. Fehler sind strukturierte Codes.
- **35_path_learning.sql:** Pfadkennzeichen an Units, Knoten und Übersetzungen, Lernziele, Fortschritt, eingefrorene Aufgaben pro Versuch, Testantworten und manuelle Eingriffe. RLS und explizite RPC-Grants; alte Grammatik-Aufrufe können keine Pfadaufgaben bewerten. Bestehende Grammatik-Units aller Niveaus werden archiviert, nicht gelöscht.
- Übungsknoten führen falsche Antworten ans Warteschlangenende. Ein Antwortbeleg mit Request-ID verhindert doppelte Wertung nach Netzwerkwiederholung. Fortsetzung verwendet den gespeicherten Versuch; Wiederholung kann ausdrücklich neu gestartet werden. Sterne werden aus Erstversuchen berechnet, der beste Wert bleibt erhalten.
- Tests ziehen jedes Pfadlernziel, füllen bis zur Testgröße auf und erzwingen beim nächsten Versuch eine andere Aufgabenmenge. Ein aktiver Test wird fortgesetzt. Antworten bleiben bis zum Abschluss unbewertet und ohne Rückmeldung; bestanden wird anhand des ungerundeten Bruchs ab 80 %. `SOFT_ERROR` zählt als richtig.
- Freischaltungen beachten weiterhin `unit_allowed`; ein bestandener Vorgänger öffnet den nächsten Pfad. Spezial-Zweige blockieren nichts. Ein Niveau wird niemals automatisch freigeschaltet; keine Lehrkraft-Benachrichtigung wird erzeugt.
- Niveau- und Gesamtreset löschen auch alle neuen persönlichen Tabellen, einschließlich privater Snapshots/Antwortbelege. Browserinvalidierung berücksichtigt den reservierten Präfix `sitov_path:`. `get_last_active_level` erkennt neue Pfadhandlungen.
- Import-/Export-RPCs und Zod-Schemas verwenden das vorhandene Quellformat. Nur authentifizierte Lehrkraft/Admin dürfen importieren. Fehlende Inhalte werden archiviert; laufende Versuche behalten ihre eingefrorene Aufgabenfassung. Die Kommandozeile validiert standardmäßig ohne DB-Verbindung.
- Privater Storage-Bucket `path-audio`; Zugriff auf Aufgaben-Audio erst im eigenen, zugänglichen Versuch. Offline-Skript nutzt den vorhandenen lokalen Piper-Dienst und einen begrenzten lokalen ffmpeg-Prozess, ohne neue Dienste oder RAM-Erhöhung. Keine Audioerzeugung und kein Upload ausgeführt, da der reale Seed keine Hörübungen enthält.

### Prüfung und Grenzen

Der PostgreSQL-Klon ist eine **synthetische lokale Datenbank**, kein Abzug echter Personendaten. `deploy/vps/tests/phase3-local-clone.py` startet ausschließlich für den Test PostgreSQL 17.11 ohne TCP-Listener, mit 32 MB Shared Buffers und zehn Verbindungen. Das bestehende `migrate-local.py` führt Reihenfolge und Transaktionen aus; ein Testadapter ersetzt nur Docker-Zugriff und Backup-Ziel. Vor DB-Änderungen entsteht ein geprüftes `pg_dump`-Backup. Nach dem Lauf wird der temporäre Cluster beendet und entfernt. Der bekannte produktive PostgreSQL-15.8-Stand wird nicht verändert; dessen konkrete Laufzeitabnahme bleibt vor einer späteren Aktivierung erforderlich.

Zweimalige Anwendung der drei Dateien, Rückweg 35 → 34 → 33 und Wiederanwendung liefern identische Schemaauszüge. Zwei tatsächlich überlappende PostgreSQL-Sitzungen erzeugen genau einen Übungsversuch und bei identischer Request-ID genau eine Wertung samt Antwortbeleg. Der Schemaauszug und der öffentliche Typenkatalog stammen aus diesem echten PostgreSQL-Klon; `export-path-types.py` aktualisiert die betroffenen öffentlichen TypeScript-Verträge aus dem Katalog.

Die Rückwege erhalten Pfaddaten: Migration 35 deaktiviert die neue API und Pfade und stellt die alten Funktionen/Unit-Aktivierungen wieder her. Migration 34 kann vollständig zurückgenommen werden, solange keine Aufgaben mit den sechs neuen Typen gespeichert sind; andernfalls stoppt sie ausdrücklich und verlangt den Backup-Rückweg. PostgreSQL-Enumwerte aus 33 bleiben additiv erhalten, weil einzelne Enumlabels nicht sicher entfernt werden können. Es wird kein `DROP CASCADE` verwendet.

Der vollständige DB-Regressionslauf enthält auch den bereits vorhandenen Test `path-a1-seed.test.mjs`: Dieser lädt den unveränderten Inhalt ausschließlich in seine kurzlebige Altschema-Testdatenbank. Es gab **keinen Import in eine Projekt-, Klon- oder Produktionsdatenbank über den neuen Pfadimport**, und keinen Phase-4-Lauf. Die neuen Importtests verwenden ausschließlich kleine künstliche Fixtures.

Ein bestehender Last-active-level-Test hatte einen Zeitgleichstand zwischen zwei direkt aufeinanderfolgenden PGlite-Transaktionen. Die Aussprache-Fixture besitzt nun ausdrücklich einen späteren Zeitstempel; die fachlichen Assertions und die RPC wurden dafür nicht abgeschwächt. Python benötigte PyYAML für den bestehenden Traefik-Test; es wurde nur in einem temporären Test-Venv installiert. Kein Testfilter, Skip oder Axe-Ausschluss wurde ergänzt.

Neue Lernseiten, Routing, CMS-Oberfläche und deren Playwright-/Axe-Abnahme sind gemäß der ausdrücklichen Infrastruktur-Beschränkung nicht Bestandteil dieses Durchlaufs. Die unveränderten Lernseiten erhalten durch dieses Commit noch keinen neuen Lernpfad. Die Aktivierung von 32–35 auf dem VPS muss deshalb später mit dem passenden UI-Release abgestimmt werden.

Reproduktionsbefehle:

```sh
node scripts/path-seed.mjs
node scripts/path-listening-audio.mjs
node --test --test-concurrency=2 supabase/tests/*.test.mjs scripts/path-listening-audio.test.mjs
npx jest --runInBand __tests__/learning-path-schema.test.ts __tests__/learning-reset-events.test.ts
python3 deploy/vps/tests/phase3-local-clone.py --output /tmp/sitov-phase3-clone-check
python3 deploy/vps/export-path-types.py /tmp/sitov-phase3-clone-check/public-catalog.json
npx tsc --noEmit
```

`npm run build` wurde mit den dokumentierten lokalen Platzhalter-URLs aus dem Phase-2-Bericht ausgeführt. Ergebnisse und Prüfsummen stehen abschließend im Status und in `phase-3-db-nachweise.json`.
