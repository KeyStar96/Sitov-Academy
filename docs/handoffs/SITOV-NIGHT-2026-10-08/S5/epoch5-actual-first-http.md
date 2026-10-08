# Sitov Academy · S5 epoch 5 · erster tatsächlicher Auth-/HTTP-Nachweis

Eigene QA-Ausgangscommits 53a7/e63 behalten. Ausschließlich zugewiesene neue
Abhängigkeiten a250b9598ee5f17758ad889bd23664e06bbcbb8d und
67bc5dfb711df423423d252c1b119c368616c57a übernommen, lokal 76b4b4d und ef0f24f.
Keine weiteren Featurecommits, keine Änderung an gemeinsamen Fixturehelfern.
Gepinnte Baseline92 bleibt unverändert. M installiert/verwaltet das App-Schema.

## Konkrete Runner-Reparaturen

Die epoch4-Vorbereitung war ein Plan, kein verifizierter Service-Start. Tatsächliche
Vendor-Erkenntnisse sind jetzt übernommen:

- DB-Image benötigt `POSTGRES_USER=supabase_admin` für migrate.sh. Ready-/psql-
  Verbindungen und gesamte Baseline samt 93–96 müssen als supabase_admin laufen;
  Vendor-postgres ist demoted. Keine Ersatzfunktionen oder QA-Authschemas.
- Vor GoTrue-Start nur auth.uid()/Vendor-Rollen verlangen; auth.jwt() erst nach
  den echten GoTrue-Migrationen und tatsächlicher Auth-Healthprüfung verlangen.
- Kong läuft mit UID1001: private mount-Datei 0600, Eigentümer1001:1001,
  äußerer privater Ordner weiterhin0700. UID1001 direkt aus dem QA-Container bestätigt.
- Internes Docker-Netz publiziert keine Hostports. Unwirksame ports-Konfiguration
  entfernt. Runtime prüft exakte Namen, Labels, Image-IDs, einziges internes
  QA-Netz, private Gateway-IP, Ressourcen und tatsächlich fehlende Hostbindungen.
  Remote Installer nutzt ausschließlich diese verifizierte Gateway-IP.
- Bucket-Kollision ist kein allgemeiner Success: nur 400/409, anschließendes
  echtes GET auf dieselbe ID und public=false; sonst Abbruch.
- SQL-Fehler werden privat diagnostizierbar gespeichert, ohne Inhalt/Keys auszudrucken.
- Cleanup validiert alle exakten Namen/Labels vor der ersten Löschung. Es gibt
  keine teilweise Löschung vor Entdeckung eines späteren falschen Volume-Labels.

Reusable Dateien: Planner, create.sh, guard.py, runtime.py, install-bundle.py,
cleanup.py. **Keine erneute Containererstellung, keine Anwendung dieser geänderten
Create-/Install-/Cleanup-Dateien auf M's laufende Infrastruktur durch S5.**

## Tatsächliche HTTP-Prüfung nach M READY

M veröffentlichte `APP_BUNDLE96_INSTALLED_READY_FOR_S5_HTTP`, installed_target
67bc5dfb711df423423d252c1b119c368616c57a, installed_at23:35:55 UTC. Erst danach
wurden zwei neue .invalid-Konten per echtem GoTrue Admin-HTTP angelegt und per
echtem Passwort-HTTP angemeldet. M's eigene private Testschlüssel wurden nur
in-memory aus `/tmp/sitov-night-20261008-qa-master` gelesen; kein Key/Passwort/
JWT/Account-ID ausgegeben oder committed. Keine realen Daten/SMTP-Nachrichten.

Runner `first-http.py --ready-target 67bc5dfb711df423423d252c1b119c368616c57a`
nutzt ausschließlich scope-geprüfte echte QA-Dienste. Ausführung dieser Lease:
Python-Code via SSH-stdin, runtime-Modul im Speicher geladen; kein Remote-
Konfigurationsschreiben und kein zusätzliches Container-/Schema-Setup.
**Exit0; 14 tatsächliche Assertions bestanden:**

- Zwei tatsächliche GoTrue-Kontoanlagen, zwei Passwort-Sign-ins und zwei echte
  HS256-signierte Schüler-JWTs, richtige sub/role. Keine injizierte Schülersession.
- Eigene Profile sichtbar, fremdes Profil über REST unsichtbar; echtes
  authenticated-RLS mit tatsächlich von GoTrue ausgegebenem JWT.
- Eigener kommerzieller Kontext erreichbar, fremder Kontext forbidden.
- Schüler kann sich über direkten RPC kein VIP geben; Vorher-/Nachherkontext identisch.
- Anonymer Access-Kontext-RPC HTTP401/403 abgewiesen.
- Schüler kann die privaten QA-Buckets nicht auflisten; leeres Storage-HTTP-Ergebnis.

Die beiden ausschließlich selbst erzeugten Testkonten wurden anschließend per
GoTrue Admin-DELETE gezielt entfernt. Cleanup bestätigt, keine fremden Konten
oder Container gelöscht. Dauerhafter minimaler Nachweis:
`e2e/sitov-night-real-transport/epoch5-first-http-evidence.json`.

## Service-/Ressourcennachweis und Tests

Gateway über verifiziertes internes QA-Netz an 10.0.3.3:8000. Auth-/REST-/Storage-
Health jeweils tatsächliches HTTP200. Alle fünf Container running, OOMKilled=false,
RestartCount0, ExitCode0. Tatsächliche gesetzte Grenzen zusammen960MiB/2CPU.
NetworkSettings.Ports tatsächlich leer/null, keine veröffentlichten Hostports.
Das ist eine punktuelle Zustandsprüfung, kein Langzeit-/Last-/OOM-Stabilitätsnachweis.

Mac-SSH-Forward nach jeweils neuer Runtime-IP-Prüfung:
`ssh -N -L 127.0.0.1:19483:10.0.3.3:8000 sitov-academy`.
Kein Forward auf Remote127.0.0.1:19483, da dort kein Hostport existiert.

`node --test e2e/sitov-night-real-transport/plan.test.mjs`: 4 bestanden.
`PYTHONDONTWRITEBYTECODE=1 python3 runtime.test.py` im Transport-Unterordner:
4 bestanden. Tests prüfen tatsächlichen Netzwerk-/Hostport-Guard, begrenzten
Retry und Wiederherstellung, vollständige Vorabvalidierung vor Cleanup und
exakte Cleanup-Namen. Diese acht sind **Unit-/Guardtests**, getrennt von den
14 echten HTTP-Assertions. ESLint, Python-AST, bash -n und Diff-Check bestanden.

## Offene Gates

Keine Veröffentlichung oder Vortest-Textpass behauptet. M's erste drei realen
Prepared-Audio-/Wortzeiten-/Source-Definitionen sind separate QA-Publikation.
Keine Prüfung von Referenzaudio-Bytes, Upload/Recording/Submission, tatsächlichen
Textversionen/Doppel-Submit, vollständigem VIP/Trial/Revoke/Payment-Flow, Browser/
Next/SSH-Forward, Mobile, fünf UI-Sprachen, Axe/Reduced Motion oder Live-Bestands-
migration in dieser Einheit. Reales Storage-HTTP wurde für Bucket-Sichtbarkeit
bewiesen; das ist kein Object-Upload-/Download-Beweis.
Keine produktiven Daten/Migration/Netz-/Konfigurationsänderung, kein Deploy/Push,
keine RELEASE_READY-Freigabe. M behält Infrastruktur-/Schema-/Assetkontrolle.
S5 übergibt Commit/Nachweise und wartet auf die nächste gültige Lease.
