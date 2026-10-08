# Sitov Academy: Medienzahlen der Lernanalyse

Stand: 8. Oktober 2026. Migration 91 wurde auf dem VPS in einer begrenzten atomaren Transaktion angewendet und mit dem nativen Smoke-Test geprüft. Der gemeinsame Anwendungsrelease `3e4f58087c62` ist produktiv aktiv.

## Korrigierte Auswertung

`get_learning_progress` zählte bislang aktive Medien ungefähr anhand der Niveaus. Die neue Medienabfrage berücksichtigt die Freigaben des ausgewerteten Lernenden: Niveauzugang, aktivierten Mediathek-Trainer, Veröffentlichungszustand, Ordnerzugang und die individuelle Auswahl von Link-Units. Auch eine explizite Niveauauswahl kann einen gesperrten Zugang nicht umgehen. Lehrkräfte erhalten für die jeweilige Person dieselben Medienzahlen wie deren eigene Fortschrittsansicht.

Die vorhandenen Zugriffsregeln unterscheiden Medienarten. Veröffentlichte Unterrichtsvideos und Unterlagen sind über ihren Ordner beziehungsweise ihr Niveau zugänglich; die Auswahl einzelner Link-Units begrenzt sie nicht. Externe Links folgen weiterhin den Unit-Freigaben und der bestehenden Sprachregel. Bei einem Profil mit deutscher Interface-Sprache bleiben hochgeladene Videos und Unterlagen erreichbar, während die derzeitigen Leserechte externe Links ausschließen. Diese Änderung vereinheitlicht die Auswertung mit diesem bestehenden Verhalten.

`totalMedia` enthält aktuell zugängliche, veröffentlichte Medieneinträge. Leere alte Linkeinträge zählen nicht. `viewedMedia` zählt bereits betrachtete Einträge innerhalb dieses Bestands. „Zuletzt angesehen“ zeigt nur weiterhin zugängliche Medien und deren heutigen Titel. Die Tageskurve behält auch historische Aufrufe inzwischen entzogener, ausgeblendeter oder gelöschter Medien; die Migration verändert keinen Aufruf, Lernstand, Freigabedatensatz und keine Inhalts-ID.

Die Kennzahl bildet die Zugriffs- und Veröffentlichungsregeln des gespeicherten Katalogs ab. Sie prüft keine Verfügbarkeit fremder Webseiten und lädt keine Mediendateien zur Funktionsprüfung herunter.

## Migration und Rückrollweg

- Kanonische Migration: `supabase/migrations/20261008143225_sitov_learning_progress_media_visibility.sql`.
- Identische VPS-Fassung: `supabase/vps/91_sitov_learning_progress_media_visibility.sql`; im Runner ausdrücklich registriert.
- Rückrollweg: `supabase/vps/rollback/91_sitov_learning_progress_media_visibility.sql`.
- Native Abnahme: `deploy/vps/tests/sitov-learning-progress-media-visibility.sql`; erzeugt isolierte Testpersonen und rollt alle Prüfdaten zurück.

Die Migration ersetzt ausschließlich den Medienabschnitt der vorhandenen RPC-Definition. Spätere Verb- und Niveauanpassungen, Besitzer, Berechtigungen, Authentifizierung und fremde Fortschrittsabschnitte bleiben erhalten. Eine Wiederholung ist wirkungslos; unerwartete Änderungen am Abfragevertrag brechen die Migration ab. Der Rückrollweg verwendet dieselben Vertragsprüfungen. Die bereits vorhandene privilegierte RPC prüft weiterhin die Identität und den Zugriff auf die angeforderte Person; es werden keine neuen öffentlichen Datenfunktionen oder Leserechte angelegt. Die expliziten Grant-Abfragen innerhalb der RPC sind notwendig, weil eine `SECURITY DEFINER`-Funktion die RLS des Aufrufers umgeht ([Supabase-Funktionsdokumentation](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker)).

Vor der Anwendung wurde die vollständige verschlüsselte Sicherung `sitov-daily-20261008T171704452497Z.age` auf dem freigegebenen WLAN zum Mac übertragen und dort entschlüsselt sowie anhand aller 21.841 Manifestdateien geprüft. Erst danach wurden App und Mail kurz angehalten, die Migration angewendet und der native Smoke-Test mit abschließendem `ROLLBACK` ausgeführt. Alle synthetischen Daten und Mail-Aufträge wurden zurückgerollt. Der installierte Migrationsrunner kennt jetzt ebenfalls Migration 91.

Die angemeldete englische Fortschrittsansicht wurde in Safari nach dem Release neu geladen; die Mediathek zeigte für das überprüfte Lernkonto fehlerfrei „0 of 0“. Der native Test prüft zusätzlich Lernenden-, Lehrkraft-, Peer- und anonyme Zugriffe sowie positive Medienbestände und Rechteänderungen. Die echte Lehrkraftoberfläche mit einem Lernkonto mit sichtbaren Medien bleibt als gesonderte UI-Abnahme offen.

## Lokale Prüfung

```sh
node --test supabase/tests/sitov-learning-progress-media-visibility.test.mjs \
  supabase/tests/learning-progress-focus.test.mjs \
  supabase/tests/sitov-verb-learning-progress.test.mjs
python3 -m unittest discover -s deploy/vps/tests -p test_migrate_local.py
npx jest __tests__/neural-audio-adapter.test.ts __tests__/neural-audio-cache.test.ts \
  __tests__/learning-progress-actions.test.ts __tests__/learning-progress.test.tsx --runInBand --silent
```

Die neue Regression besteht mit **12 Prüfungen**. Sie vergleicht die Kennzahl mit tatsächlichen authentifizierten RLS-Abfragen, prüft gezielte Unit-Auswahl, aktive und gesperrte Niveaus einschließlich B2.1, Trainer-Deaktivierung, Veröffentlichungsänderungen, deutsche Profilsprache, Lehrkraft-/Peer-/anonyme Zugriffe und unveränderte historische Tagesdaten. Sie prüft außerdem Migration, Wiederholung, Ablehnung eines veränderten Abfragevertrags, gezielten Rollback und erneute Anwendung. Der native Smoke-Test wurde in derselben isolierten Datenbank erfolgreich ausgeführt und hat sämtliche synthetischen Zeilen zurückgerollt.

Die beiden bestehenden Datenbankregressionen für Lernanalyse/Fokus und Verbfortschritt bestehen mit **14 Prüfungen**. Zusätzlich bestehen **55 Anwendungstests** in den vier oben aufgeführten Suites, **13 Migrationsrunner-Prüfungen**, ESLint für die betroffenen Audio-Dateien und `git diff --check`. Der komplette Produktionsbuild mit dem aktualisierten Lockfile besteht. Der vollständige Jest-Lauf und sein einzelner unveränderter Fehler sind im [Abhängigkeitsbericht](sitov-dev-dependencies-2026-10-08.md) dokumentiert.
