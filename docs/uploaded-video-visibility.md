# Hochgeladene Videos: Schüleransicht und Veröffentlichung

Stand: 20.09.2026. Produktives Release `57e227359dca`, Migrationen 16/17 angewendet. R1–R11 berücksichtigt.

## Befund und Änderung

Das vorhandene MP4 „A1.1 - Das Alphabet“ war erfolgreich gespeichert und seine Lerneinheit aktiv. `VideoLibrary` zeigte jedoch ausschließlich externe `source_url`-Links; Uploads ohne externe URL wurden ausgelassen. Zusätzlich verlangten Video-Layout und Datenbankrechte Trainer-/Sprach-/Einzelfreigaben neben dem Niveau.

- Die Videoübersicht zeigt veröffentlichte MP4/WebM-Dateien mit dem vorhandenen Player und dessen signiertem Zugriff. Externe Links bleiben unterstützt. Ein leerer Link führt bei einem vorhandenen Upload nicht mehr zum leeren Videozustand.
- Direkter Schalter „Für Schüler sichtbar“ in Medienverwaltung und Videoverwaltung, mit sichtbarem Status, Tastaturbedienung, 48-px-Bedienfläche und Fehleranzeige. Alle fünf Locales ergänzt. Die Aktion prüft Staff-Berechtigung serverseitig und verwendet das vorhandene `learning_units.is_active`; Uploads erhalten bereits bei ihrer Anlage eine eigene Einheit. Ein fehlgeschlagener Speichervorgang zeigt keinen erfundenen Erfolg. Dateien bleiben beim Ausblenden erhalten und für Staff prüfbar.
- Die Schülernavigation und Videoübersicht verwenden die übergeordnete Niveau-Freigabe. Das zusätzliche Videos-Layout mit Trainer-Sprachsperre ist entfernt. Die vorhandenen sprachabhängigen Trainer sowie externe Videolinks behalten ihre bisherigen Datenbankrechte.
- Migration 16 ergänzt einen privaten, identitätsgebundenen SQL-Helfer für aktive Upload-Einheiten. Niveau und Ordner müssen zusammenpassen. Dieselbe Freigabe gilt für Videometadaten, eingebettete Lerneinheiten und Storage. Ausgeblendete Videos liefern Schülern weder Metadaten noch neue signierte Links. Der Helfer wird in den RLS-Regeln über einen SELECT-Initplan aufgerufen; kein Sitzungs- oder Prozesscache. Privates Schema, leerer search_path, gesperrte PUBLIC-/anon-Rechte; explizites EXECUTE auch für den älteren Owner `postgres`.
- Migration 17 entfernt exakt die drei vom Nutzer genannten Platzhalter anhand geprüfter UUIDs, Titel, Quellen und fehlender Upload-Zuordnung. Veränderte Einträge bleiben geschützt; Wiederholung ist möglich. Die sechs zugehörigen kanonischen Seed-Zeilen sind entfernt. Keine Storage-Datei wurde gelöscht. Für diese drei Einheiten bestanden produktiv keine individuellen Freigaben.

Bereits ausgegebene signierte URLs gelten maximal 60 Sekunden; der offene Player erneuert seine Berechtigung nach 45 Sekunden. Neue Zugriffsanfragen beachten das Ausblenden sofort. Bereits heruntergeladene Dateien lassen sich dadurch nicht zurückrufen.

## Abnahme

| Prüfung | Ergebnis |
|---|---|
| Vollständige Datenbank-Testreihe, seriell auf VPS | **335/335 bestanden**, keine übersprungen; `/root/video-visibility-db-tests.log` |
| Neue DB-Regression | 7 Tests einschließlich ursprünglicher Zusatzsperre, deutschem Profil mit deaktiviertem Videotrainer, Metadaten/Unit-Join/Storage, Aus-/Einblenden, Staff-Vorschau, verweigerten Schüler-Schreibzugriffen, Niveauentzug, SQL-Rollback, Replay und exakter Platzhalterbereinigung |
| Betroffene Jest-Suites | **87/87 bestanden** in elf Suites: Medien, Player, Video-CMS, signed-file API, Trainerfreigaben und Sprachsperren |
| Migrationsrunner | **10/10 Python-Tests bestanden** |
| Typen / Build | TypeScript und Produktionsbuild auf VPS bestanden |
| Produktive DB | Bestehende Schüler- und Staff-Rollen: veröffentlicht lesbar, verborgen unlesbar, erneut veröffentlicht lesbar; Staff-Vorschau bleibt erlaubt. Alle Teständerungen zurückgerollt |
| Produktive HTTP-Kette | Kurzlebige Test-Tokens für bestehende Rollen im Arbeitsspeicher, keine neuen Konten: Auth validiert, Schüler-HTML enthält Alphabet-Video, `/api/course-assets` gibt 60-s-Link, tatsächlicher MP4-Range-Abruf liefert **HTTP 206** mit MP4-Header. Staff-HTML enthält Video und Sichtbarkeitsschalter; beide Ansichten ohne Platzhalter |
| Bestand | Null der drei Platzhalter übrig. Alphabet-Video einschließlich Unit-Metadaten unverändert: Kontroll-MD5 vor/nach `6f22ed94bcb6c7e30ccbe3de6dd321f9` |
| Betrieb | Release `57e227359dca` aktiv; App, Mail und Nginx aktiv, `/api/health`: `ready`. Keine RAM-/CPU-Erhöhung, kein neuer Dienst oder Monitoring |

Die bisherigen Tests für die deutsche Video-Navigationssperre wurden an die ausdrücklich gewünschte Niveau-Freigabe angepasst; Sperren für sprachabhängige Trainer bleiben geprüft. Der Quellen-lose Platzhalter ist im neuen DB-Test wie produktiv inaktiv. Keine Anforderung wurde durch einen Ausnahmefilter ausgeblendet.

## Backups und Rollback

Vor DB-Arbeiten `python3 deploy/vps/migrate-local.py --backup-only`; zusätzlicher Runner-Backup bei gestoppter App/Mail. Alle drei Sicherungen ausschließlich root-lesbar, jeweils **402 Dateiprüfsummen geprüft**, einschließlich **398 Storage-Objekten**.

| Anlass | Backup unter `/root/backups/` | PostgreSQL-SHA256 |
|---|---|---|
| Vor DB-Prüfung | `sitov-migration-20260920T181929613631Z` | `309fab13fcbb65b5c13459107595b828f0ed56d7359651f89e28830482a165a4` |
| Vor Produktivmigration | `sitov-migration-20260920T182846572670Z` | `25e393213e922506224b64d0c2f49e130ff4b3c741edadbd945fe778183d0100` |
| Produktivmigration 16/17 | `sitov-migration-20260920T182939691207Z` | `cad01b7b654d95017381d9f3422c864c27a790e22d22b41939d341afe58115ad` |

Storage-Manifest-SHA256 jeweils `0048900e26d703bce996215de07a4531a5b6f24f0e9dd8bea18491a81dac1e13`.

Rollback 16 nach frischem R8-Backup: `supabase/vps/rollback/16_uploaded_video_visibility.sql` in einer Transaktion anwenden und passende vorherige App aktivieren. Die inverse SQL stellt beide bisherigen Policies und die Storage-Prüfung wieder her und entfernt ausschließlich den neuen Helfer. Im isolierten Test geprüft; keine Uploads oder Sichtbarkeitswerte werden gelöscht.

Rollback 17: Den obigen Dump in eine isolierte Datenbank wiederherstellen. Ausschließlich die drei in Migration 17 genannten IDs in `learning_units`, `learning_videos` und gegebenenfalls `learning_unit_grants` in FK-Reihenfolge zurückkopieren, transaktional und mit `ON CONFLICT DO NOTHING`. Kein vollständiges Zurücksetzen der Produktion, kein Überschreiben späterer Inhalte oder Lernstände. Produktiv waren für diese IDs null Grant-Zeilen vorhanden.

## Schemaexport

`python3 deploy/vps/export-phase2-schema.py --database postgres --output /root/backups/uploaded-video-schema`

```sh
docker exec supabase-db-eknmzxvqilojjicinatnllbt pg_dump -U supabase_admin -d postgres --schema-only --no-owner --schema public --schema business_private --schema grammar_private --schema identity_private --schema learning_private --schema learning_reset_private --schema platform_private --schema private --schema pronunciation_private --schema trainer_access_private --schema vocabulary_private --schema media_private
```

Supabase-verwaltete Schemas Auth, Storage, Realtime, Extensions, GraphQL, Vault, Cron, Net und Migrationshistorie bleiben ausgeschlossen. Dump-Delta: neuer privater Helfer samt ACL, zwei Policies und Storage-Predicate. Öffentliche TypeScript-Typen über Postgres-Meta neu generiert, bytegleich. Kein manuell bearbeiteter Dump.

## Nachtrag: Video-Downloads für Schüler

Im Schülerplayer entfällt der Download-Button; `controlsList="nodownload"` und ein unterdrücktes Kontextmenü entfernen die normalen Speicheraktionen in unterstützenden Browsern. Die Medienverwaltung für Lehrkräfte/Admins behält den Download. Präsentationen bleiben herunterladbar.

`/api/course-assets` verweigert Video-Anfragen mit `download: true` für Schüler mit HTTP 403. Die Freigabe für Staff wird aus dem authentifizierten Profil gelesen; fehlende oder nicht lesbare Rollen geben keine Freigabe. Nur kanonische Präsentationspfade erlauben Schüler-Anhänge. Wiedergabe-Links bleiben kurzlebig und durch Storage-RLS geprüft.

Dies ist kein vollständiger Kopierschutz: Ein abspielbares Video liefert Daten an den Browser. Technisch versierte Nutzer können weiterhin Wiedergabe-Links bzw. Storage-Zugriff verwenden oder den Bildschirm aufnehmen. `nodownload` ist zudem [nicht in allen Browsern verfügbar](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/controlsList). Keine DRM-Zusage.

Abnahme: 24/24 gezielte Jest-Tests einschließlich Schüler-/Staff-Rollen, fehlender Profile, MP4/WebM, unveränderter Wiedergabe und Präsentationsdownloads. TypeScript nach Erneuerung der veralteten generierten Routentypen erfolgreich. Keine Datenbankänderung, keine Migration, keine neuen Dienste oder Ressourcenlimits. Rückweg: diese App-Änderung zurücknehmen und ein frisches Release bauen; Daten und Uploads bleiben unverändert.
