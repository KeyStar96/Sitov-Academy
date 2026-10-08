# Sitov Academy · S5 epoch 3 · eingefrorene Baseline 92

Ausgangspunkt: eigener QA-Commit `d11ed51326853eb14ebf3673f3fa916f5239f4da`.
Einzige neue zugewiesene Abhängigkeit:
`e22c73883356e61700ed57f3cfeb601f9bf55b32`, lokal übernommen als
`6b4486d8e82f65796590e445f8768bf085bf2267`.
Verifizierter Abhängigkeitsdiff: ausschließlich `supabase/schema.sql`, 71 neue
Zeilen zur effektiven Migration-91-Korrektur. Keine weiteren Featurecommits.

## Version und Installationsquelle

Explizites Ziel `baseline92`, reviewed-through 92, vollständige Source-SHA e22
wie oben. `supabase/tests/fixtures/sitov-night-current92-schema.sql` enthält
bytegenau die e22-Version von `supabase/schema.sql` (2.547.750 Bytes).
SHA256: `c6b90f3bb5527ae6d36d0336c84afd7c5549a5e16d9f79af245d21c0fb8b5cfe`.
Die zugehörigen öffentlichen Lookup-INSERTs sind ebenfalls aus e22 gepinnt:
`sitov-night-current92-lookups.sql`, SHA256
`9e19b140bc5ae9b0585cadb3e97a0691a4c04717dce62959682c689e985e1803`.
Die 92 Runner-Dateien mit Quellenprüfsummen und Transaktionsart stammen aus
derselben e22-Revision; es wird weiterhin kein historischer Replay behauptet.

Der Installer prüft Ziel und beide Inhaltsprüfsummen vor der DB-Verbindung.
Unbekannte Ziele (`canonical`, `integrated96`) oder abweichende Inhalte führen
zum Abbruch. Er liest keine veränderliche kanonische Schema-/Seed-/Runnerdatei
und keine späteren VPS-Overlays. 90/91/92 sind bereits im exakten Snapshot wirksam.
Enums werden als finale Labels erstellt; 62 bleibt im Inventar separat committed.

Neue API: `createSitovBaseline92NativeDatabase({database, target:'baseline92', seed:true})`.
Der bestehende Name `createSitovCurrentNativeDatabase` ist ein Kompatibilitätsalias
für dieses feste Ziel. Er bedeutet ausdrücklich nicht den neuesten App-Stand.
`sitov_qa_fixture.installation` speichert Ziel, Source-SHA, beide Inhaltsprüfsummen
und reviewed-through in der installierten synthetischen DB; keine Client-Grants.
Diese Metadaten benennen den installierten Ausgangsstand, nicht später manuell
angewendete Migrationen. Vergleichsläufe müssen diese zusätzlich protokollieren.

## CLI und native Nachweise

```sh
node scripts/sitov-night-current-db.mjs plan --target baseline92
# Install nur in einer leeren, selbst angelegten synthetischen DB:
node scripts/sitov-night-current-db.mjs install --target baseline92 --database sitov_night_NAME
node scripts/sitov-night-current-db.mjs snapshot --target baseline92 --database sitov_night_NAME
SITOV_NIGHT_NATIVE=1 node --test supabase/tests/sitov-night-current-schema.test.mjs
```

Native PostgreSQL 17.11, weiterhin M's socket-only Instanz 55438. Der Test erzeugt
und entfernt ausschließlich seine eigene disposable DB. Er testet die echte
CLI-Installation und den CLI-Snapshot. 8 Tests bestanden, 0 Fehler, 0 übersprungen:
die bisherigen sechs Baselineprüfungen plus exakte Quellbytes/Prüfsummen/
unbekannte Ziele und ein kontaminierter kanonischer Schema-/Seed-Pfad in einem
separaten temporären Testbaum. Trotz dortiger Future-Canaries bleibt die geladene
Baseline unverändert. Kein kanonisches Repository-SQL wurde dafür verändert.

Voll/all und selected-empty/subset/disabled/de/outsider verhalten sich weiterhin
wie zuvor; `hard`, Recording-/Playback-Checkpoint, historische Einreichung und
Lehrerantwort, Lernstand und Lerntage erhalten. Echte authenticated Rollen/RLS
für eigene/fremde Gespräche und Storage-Metadaten weiterhin bestätigt.
Gezieltes ESLint und `git diff --check` bestanden.

## Nächste Integrationsprüfung

Ein zukünftiges Ziel benötigt eine eigene ausdrückliche START-Lease, genaue
integrierte SHA, erlaubte Dependency-SHAs/Dateien, explizite Source-/Digest-Metadaten
und eine getrennte Installsequenz. Baseline92 bleibt unverändert. Migrationen
93–96 dürfen nur ausdrücklich nach der Baseline angewendet und im Vorher-/Nachher-
Rechte-/Historienvergleich ausgewiesen werden. Ein unbekanntes Ziel wird nicht
auf die kanonische Datei umgebogen.

Keine 93–96, keine HTTP-/Browser-/Audio-/Produktionsabnahme in dieser Einheit.
Keine produktive Migration, kein Push/Deployment, keine RELEASE_READY-Freigabe.
S5 wartet nach Commit/Übergabe. Historischer Schema-91-Befund aus epoch2 ist
im ausdrücklich zugewiesenen e22-Snapshot repariert und nativ bestätigt.
