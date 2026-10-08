# Sitov Academy · S5 epoch 4 · tatsächlicher Transport: isolierter Plan

Nur READONLY-Planungslease. Keine Container, Netzwerke, Volumes, Konfigurationen
oder Testkonten auf dem VPS angelegt. Keine Produktionsumstellung, keine
Feature-/Browser-/HTTP-Abnahme. Eigener Stand 53a7 behalten; keine neuen
Featureabhängigkeiten oder Cherry-Picks. `baseline92` bleibt bytegenau gepinnt.

## Tatsächlich ermittelt

SSH `sitov-academy`: Docker-Image-Inspect, `/proc/meminfo`, `df`, `ss` und
Compose-Versionsabfrage. Nur Image-IDs, Versionstags, Architektur, Image-User,
ENV-Namen, Ports und freie Ressourcen ausgegeben; keine ENV-Werte/Keys/Logs.
Maschinenlesbarer Nachweis: `e2e/sitov-night-real-transport/inspection.json`.
Die fünf lokal vorhandenen amd64-Images sind vollständig per `sha256:`-ID
im Planner festgelegt: PostgreSQL 15.19.0.003, GoTrue v2.186.0, Storage v1.44.2,
PostgREST v14.6, Kong 3.9.1. Docker Compose meldet 5.6.0.
Die frischen Inspektionen bestanden das Mindest-RAM-Gate von 3 GiB.
Docker-Disk hat rund 190 GiB frei, Port 19483 war unbesetzt.

## Konkreter Runner und private Vorbereitung

`e2e/helpers/sitov-night-real-transport-plan.mjs` hat ausschließlich `inspect`,
`plan`, `stage`. `stage` liest frisch per SSH und schreibt nur lokal. Es hat
15 Dateien unter folgendem privaten, nicht getrackten Ordner erzeugt:

`<git-common-dir>/sitov-orchestration/SITOV-NIGHT-2026-10-08/S5/transport-epoch4/`

Ordner 0700, alle Dateien 0600, kein Überschreiben bestehender Ordner/Schlüssel.
Neue unabhängige zufällige DB-/JWT-/Schüler-Testpasswörter; HS256-Anon- und
Service-JWTs, Ablauf 48 Stunden. Keine vorhandenen Produktionsschlüssel genutzt.
Secretwerte nicht ausgegeben oder committed. Keine Remote-Erstellung beim Staging.

```sh
node e2e/helpers/sitov-night-real-transport-plan.mjs plan
node e2e/helpers/sitov-night-real-transport-plan.mjs inspect
# Nur falls ein NEUER privater lokaler Ordner gewünscht wird:
node e2e/helpers/sitov-night-real-transport-plan.mjs stage ABS_PRIVATE_S5_DIR
```

Reviewbare, versionierte `create.sh`, `guard.py`, `install-bundle.py`, `cleanup.py`
liegen unter `e2e/sitov-night-real-transport/`. Ihre privaten Kopien enthalten die
staged Compose-/ENV-/Kong-/SQL-Dateien. **create/install/cleanup nicht ausgeführt.**
M muss den privaten Ordner in einer neuen ausdrücklichen Infrastruktur-Lease
mit erhaltenen Dateirechten in einen privaten QA-Ordner auf den VPS übertragen.
Erst dort: `bash create.sh`. Vor jeder Erstellung neue <=120s-Inspektion,
>=3072 MiB frei, >=4 GiB Disk, freier 19483-Port, unveränderte lokale Image-IDs,
leerer exakter Namensraum. Bei bestehendem Objekt oder fehlender Voraussetzung
abbrechen; niemals vorhandene Container wiederverwenden.

## Isolation, Ressourcen und Versionen

Namespace/Label: `sitov-night-20261008-qa`, ausschließlich internes neues
Bridge-Netzwerk `sitov-night-20261008-qa-isolated`, kein Egress und keine
Produktionsnetz-Anbindung. Nur Kong `127.0.0.1:19483:8000` publiziert; DB/Auth/
REST/Storage ohne Hostports. Kein Docker-Socket/Hostnetz/Privileged-Mount.
Nur eigene benannte DB-/Filesystem-Volumes, exakte Namen und Labels.
`--pull never` und IDs statt veränderlicher Tags, kein Neustart-Loop.

Limits: DB 384 MiB/0,75 CPU; Auth 128/0,25; REST 64/0,25; Storage 256/0,5;
Gateway 128/0,25. Summe **960 MiB/2 CPUs**, Swap-Limit entspricht RAM-Limit.
Diese Grenzen sind geplant und getestet, ihre Service-Tauglichkeit ist noch
unbewiesen. Bei OOM/Bootstrapfehler bleibt der HTTP-Nachweis blockiert.
Containerlogging `none`; keine Schlüssel-/Payload-/Schülerdaten-Logdumps.

Kong routet `/auth/v1`, `/rest/v1`, `/storage/v1` zu den echten Diensten.
JWT-Prüfung erfolgt in GoTrue/PostgREST/Storage; kein Gateway-Key-Auth-Plugin.
Zugriff ist ausschließlich über Loopback/SSH vorgesehen. Auth nur Email,
Autoconfirm an, kein SMTP/Phone/OAuth/Internet; später ausschließlich `.invalid`
Schüler anlegen. Kein realer Benutzer-/Bestandsdatenimport.

## Tatsächlicher Vendor-Bootstrap und eingefrorenes Bundle

Das echte gecachte PostgreSQL-Image initialisiert seine Vendor-Rollen und
`auth.uid()`/`auth.jwt()`. `create.sh` prüft sie tatsächlich nach DB-Start.
Fehlen sie, stoppt `vendor_bootstrap_missing`: keine nativen QA-Stub-Schemas
oder Ersatzfunktionen. Nur frisch generierte Passwörter für authenticator,
supabase_auth_admin, supabase_storage_admin; JWT-Rollengrants an authenticator.
GoTrue und Storage führen anschließend ihre eigenen echten Migrationen aus.
Storage verwendet `file`, eigenen persistenten Filesystem-Volume und 5-MiB-Limit.

`install-bundle.py ABS_BUNDLE` akzeptiert erst ein exakt eingefrorenes
`manifest.json`: target `integrated96`, integrierte 40-stellige SHA,
baseline_source_sha e22, Dateien in Reihenfolge baseline_schema, baseline_lookups,
migration93, migration94, migration95, migration96; jede Datei relativer SQL-
Basename, volle Source-SHA und SHA256. Baseline-/Lookup-Hash fest vorgeschrieben.
Aktuell **kein solches Bundle vorhanden**, keine unzugewiesenen Features gelesen.

Nach realer Auth-Healthprüfung und tatsächlicher Storage-HTTP-Bucketerstellung
prüft der Installer reale `auth.users`/`storage.objects` und leeren öffentlichen
App-Katalog. Vendor-Schemas/-Funktionen werden weder erzeugt noch ersetzt.
Explizite einzige Snapshotanpassung: `CREATE SCHEMA public` wird IF-NOT-EXISTS,
damit vorhandene Vendor-Extensions/Funktionen erhalten bleiben; Lookup-INSERTs
werden am geprüften Dump-Ende eingebaut. Basis läuft als postgres; zugewiesene
93–96 jeweils separat als supabase_admin, wie Produktions-DDL. Apply-Metadaten
werden lokal privat gespeichert. Fehler brechen ab; keinerlei Success-Vortäuschung.

## Späterer Mac-Browserpfad und Cleanup

Nach M's verifiziertem Start:
`ssh -N -L 127.0.0.1:19483:127.0.0.1:19483 sitov-academy`.
Dann Supabase-URL `http://127.0.0.1:19483` und ausschließlich neue private
Anon-/Service-Schlüssel in einem getrennten lokalen Next-Prozess auf 3143.
M muss dafür den exakten App-/96-Stand, isolierte Laufzeitkonfiguration und
Audio-/Wortzeiten-Testassets zuweisen. Erst echte `.invalid` Auth-Sign-ins,
JWTs und die darauf basierenden RPC/REST/RLS/Storage-/Next-/Browserflüsse gelten
als HTTP-Beweis. Kein injizierter Session-/Serveradapter und keine Auth-Stubs.
Prepared-Audio-Autorenassets können später explizit in QA importiert werden;
es gibt aktuell keinen Audio-/Upload-/Browserproof.

Bei Fehler oder Abschluss: `python3 cleanup.py` im privaten QA-Ordner auf VPS.
Entfernt ausschließlich fünf exakt benannte Container und die beiden Volumes/
das Netzwerk nach Namens- und Labelprüfung. Kein prune, generisches stop/rm,
Produktionspfad oder Produktionsnetz. Private Schlüssel/Ordner danach separat
gezielt entfernen. Nicht ausgeführt, keine neue Automation.

## Prüfung und Grenzen

`node --test e2e/sitov-night-real-transport/plan.test.mjs`: 4 bestanden, 0 Fehler,
0 übersprungen. Praktische Guards für Headroom/Alter/Port/Image, falsche Netz-/
Volume-/Host-/Ressourceneinstellungen und Ausgabe von Secrets in Repo-Pfade.
ESLint, Python-AST und `bash -n` sowie Diff-Check bestanden.
Private Staging-Dateien/rechte nachgewiesen; reale Services nicht gestartet.
Compose-Datei wurde nicht auf dem VPS angewendet oder als Laufzeiterfolg geprüft.
GoTrue-/Storage-Migrationen, PostgreSQL-Imageinit, Kong-Health, OOM-Freiheit,
echte HTTP-Abläufe und eingefrorene 93–96 bleiben konkrete offene Gates.

ENV-Vorschlag basiert auf [offizieller Compose-Quelle](https://github.com/supabase/supabase/blob/3fc8af387ec4dfb449510828a938e1f6e57a9575/docker/docker-compose.yml)
und [Storage v1.44.2 Konfiguration](https://github.com/supabase/storage/blob/v1.44.2/src/config.ts).
Das Image-Inspect beweist gecachte Identität; es beweist keine erforderlichen
ENV-Werte oder ausgeführten Vendor-Migrationen. S5 wartet nach Commit/Übergabe;
RELEASE_READY bleibt ausdrücklich unerteilt.
