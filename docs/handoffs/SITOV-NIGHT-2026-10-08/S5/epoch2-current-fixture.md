# Sitov Academy · S5 epoch 2 · isolierte Schema-92-Fixture

Geprüfte Ausgangs-SHA: `966a380f7a6118654f19750a9d62200795feb8c2`.
Freigabe: SETUP/Fixture bis 92, keine Migration 93/94 und keine Gesamtproduktabnahme.

## Installationsvertrag

`createSitovCurrentNativeDatabase({database, seed:true})` verlangt eine leere,
synthetisch benannte DB auf M's PostgreSQL 17.11: Unix-Socket
`/tmp/sitov-night-2026-10-08-pg`, Port 55438, keine TCP-Listener.
Der Standard `sitov_night_fixture` ist installiert und enthält nur erfundene Daten.
Die Tests erzeugen zusätzlich eine leere `sitov_night_schema_<pid>` und entfernen
ausschließlich diese selbst erzeugte DB nach dem Test.

Reihenfolge: synthetische Auth-/Storage-SQL-Prereqs und Rollen; kanonischer
DDL-Dump aus `supabase/schema.sql`; ausschließlich die öffentlichen Locale-,
CEFR-, Niveau- und Trainer-Lookups aus `supabase/seeds/vps-content.sql` am
Dump-Ende; sämtliche konsolidierten Snapshot-Ergänzungen; explizit VPS 90, 91,
92 jeweils in eigener Transaktion; Auth-Signup-Trigger mit der echten
`business_private.provision_profile()`; synthetische Bestandsfixture.
DDL samt Lookups wird atomar installiert. Der Snapshot erzeugt die endgültigen
Enum-Labels direkt; keine neue Enum-Erweiterung wird vor Commit verwendet.
Der vollständige 01–92-Runner ist inventarisiert und mit SHA256 dokumentiert,
einschließlich 08-Autocommit und 62-Enumtransaktion. Dies ist der normalisierte
Installationspfad, **kein historischer Replay jeder Migration 01–92**.
Keine Anwendung oder stillschweigende Auslassung von 93.

## Bestätigter Fehler und Reparaturauftrag an M

P1: Der kanonische Snapshot enthält 92, aber seine effektive
`get_learning_progress(uuid,text,integer)`-Definition fehlt der Marker
`sitov-media-visibility-v1` aus VPS 91. Native Probe vor Overlay: Position 0;
nach 91: Marker vorhanden. Gemeinsamer Patchbedarf: M synchronisiert
`supabase/schema.sql` mit der wirksamen 91-Definition. S5 ändert Produkt-SQL nicht.
90 ist als Recall-Definition bereits enthalten; 90–92 werden ausdrücklich
als aktuelle Abschluss-Overlays angewendet und ihre effektiven Marker geprüft.

Die ersten Installversuche klärten fehlende Lookup-Seeds und die Rollen
`authenticator`/`supabase_admin`. Der finale Bootstrap enthält diese explizit.
Der erste Fixture-Versuch zeigte den außerhalb des App-Dumps liegenden
Auth-Signup-Trigger. Die endgültige Fixture nutzt den echten Provisioner.
Fehlversuche wurden nicht als bestanden gewertet; Reproduzierbarkeit ist durch
die erfolgreiche Neuinstallation in einer zweiten, leeren DB nachgewiesen.

## Nachweise

`SITOV_NIGHT_NATIVE=1 node --test supabase/tests/sitov-night-current-schema.test.mjs`:
6 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen. Vollständige Installation,
960 Verbseed-Einträge, Security-/Media-/Recall-/Verbdefinitionen und reale
PostgreSQL-Rollen/RLS geprüft. Direkte SQL-Lesepfade für eigene und fremde
Gespräche, Lehrerrückmeldung und private Storage-Metadaten geprüft.

`npx eslint supabase/tests/helpers/sitov-night-current-db.mjs supabase/tests/helpers/sitov-night-current-native-db.mjs supabase/tests/sitov-night-current-schema.test.mjs scripts/sitov-night-current-db.mjs`: bestanden.
`git diff --check`: bestanden.
`node scripts/sitov-night-current-db.mjs snapshot`: tatsächlicher Baseline-Export.

Erwartete wirksame Rechte für acht QA-Einheiten: fehlende Trainerzeile/all,
explizit all und Lehrkraft je 8; selected mit Auswahl 4; selected ohne Auswahl,
disabled, deutsche UI und fremdes Konto ohne Niveauzugang je 0.
Private Zugriffspredikate werden als DB-Eigentümer mit Schüler-Claims ausgewertet;
das ist getrennt vom echten `SET ROLE authenticated`-RLS-Nachweis berichtet.
Ein Altbestand mit `hard`, Recording-/Playback-Checkpoint, Vokabel-Lernstand,
zwei historischen Lerntagen, Einreichung und Lehrerantwort ist vorhanden.

## Offene Abnahme

Kein PGlite-Lauf oder HTTP-Mock wird hier als nativer Nachweis ausgegeben.
Auth/JWT-Signaturprüfung, PostgREST/REST, Storage-HTTP und echte Audio-Dateien
sind nicht eingerichtet/nicht bewiesen. Die Storage-Fixture hat ausschließlich
synthetische Metadaten, keinen Qwen-/Wortzeiten-/Publikationsnachweis.
Kein Browserlauf, TypeScript-Produktcheck oder Produktionsbuild in dieser Lease.
Keine Aussage zu Zahlung, neuen Vortests oder vollständiger Plattformreife.

Migration 93: isolierter Vorher-nachher-Rechte-/Historienvergleich ausstehend;
die Helfer `sitovRightsSnapshot`/`sitovHistorySnapshot` liefern den Ausgangsstand.
Tatsächlicher späterer Live-Bestandsvergleich bleibt separates Deployment-Gate
bei COMMIT_AND_HANDOFF. Keine produktive Migration, kein Push/Deployment.
Rückweg: QA-Helfer/Fixtures sind außerhalb des Produktpfads; ausschließlich die
synthetischen Testdatenbanken entfernen. Keine Produktmigration zurückzurollen.
S5 wartet nach Übergabe auf die nächste gültige Lease; RELEASE_READY nicht erteilt.
