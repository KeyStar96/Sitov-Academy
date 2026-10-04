# Sitov Academy: Sicherheitsmaßnahmen vom 4. Oktober 2026

Dieser Bericht ergänzt die ursprüngliche Prüfung `docs/sitov-security-audit-2026-10-04.md`. Er beschreibt geprüfte Änderungen, die produktive Umsetzung und verbleibende Grenzen. Ein behobener Befund ist keine Garantie, dass die gesamte Installation frei von Sicherheitsfehlern ist. Private Sicherungen, Schlüssel und produktive Zugangsdaten liegen außerhalb des Git-Repositories.

## Befunde und Umsetzung

| Befund | Umsetzung | Abnahme / verbleibende Grenze |
| --- | --- | --- |
| PostgreSQL 15.8 ohne spätere Sicherheitskorrekturen | Kompatibles Supabase-Image auf PostgreSQL **15.19** aktualisiert; kein Major-Upgrade erforderlich. | Vollständige physische Wiederherstellungsprobe, Erweiterungen, `pg_verifybackup`, Neuaufbau der Datenbankindizes und Aktualisierung der Collation-Versionen. Produktive Datenbank und Dienste geprüft. |
| Verwundbare Produktionspakete | Next.js / eslint-config-next **16.3.8**, Nodemailer **10.0.14**, korrigierte transitive brace-expansion-Versionen. | Produktionsbuild und SMTP-Versand an einen lokalen Testserver bestanden. `npm audit --omit=dev`: **0 bekannte Meldungen** am Prüftag. |
| Unbegrenzter Schüler-/Cache-Speicher | Atomare Byte-, Objekt-, Nutzer-, Tages- und gemeinsame Quoten in Migration 79; 30-Minuten-Tickets mit Größenbindung und Mengenbegrenzung. | Direkte, signierte und privilegierte finale Storage-Schreibvorgänge erfasst. Temporäre Übertragungen brauchen zusätzliche Betriebsreserve. Keine bestehenden Schülerdateien entfernt. |
| Beliebige fremdsprachige TTS-Texte | Bindung an eine zugängliche Karte und exakt deren gespeicherte Inhalte, einschließlich Cachetreffern. Persistente Synthese-Tageskontingente. | Deutsche Beispiele bleiben ausschließlich vorberechnetes Qwen-Audio. Worker-Neustarts umgehen die Kontingente nicht. |
| Gemeinsame VPS-Partition kann vollgeschrieben werden | nginx begrenzt gleichzeitige Storage-Schreiber und Schreibraten; Minutentimer pausiert öffentliche Storage-Schreibzugriffe bei knapper Festplatte. | Objekt-, TUS- und S3-Schreibwege erfasst. Lesezugriffe, Löschen, Auth und Realtime bleiben verfügbar. Lokales Journald-Protokoll; keine externe Benachrichtigung eingerichtet. |
| Öffentliche Verwaltungsports / Docker-Umgehung | Persistente IPv4-/IPv6-Regeln für Host-INPUT und DOCKER-USER auf `ens6`. | Öffentlich erlaubt: SSH 22, SMTP 25, HTTP 80, HTTPS 443 und QUIC 443/UDP; Verwaltungsdienste über SSH-Tunnel erreichbar. Docker-DNAT wird anhand des ursprünglichen Zielports geprüft. |
| Veraltete Betriebssystem-/Docker-Pakete | Verfügbare Paketkorrekturen und Docker **29.8.2** installiert; Kernel **6.8.0-146-generic** durch geprüften VPS-Neustart aktiviert. | Website, Mail, Datenbank, Docker, Firewall und Timer nach Neustart erfolgreich geprüft. Docker `live-restore` war während der Aktualisierung aktiv. |
| Wöchentliches Backup ausschließlich auf VPS | Täglich 03:30 Uhr Europe/Berlin, höchstens 14 vollständige Sicherungen, zusätzliche Speicherbudgets und 20-GiB-Betriebsreserve. Authentifizierte Streamingverschlüsselung mit **age 1.3.2**. | Unabhängige vollständige Sicherungen auf dem Mac vorhanden und entschlüsselt geprüft. Mac-Abruf vorbereitet und installiert; wegen der WLAN-/Hotspot-Vorgabe bis zur expliziten Freigabeliste und erlaubtem SSID-Zugriff gesperrt. |
| Unterrichtsaufzeichnung und Einwilligung | Nach Nutzerkorrektur verpflichtende, separate Bestätigung für reguläre Online-Kurse und Online-Probestunden; Online-Privatunterricht und Präsenz ausgenommen. Prüfungen in Formular, Serveraktion und Buchungs-RPC, auch bei Monatsauswahl. | Die Buchungsregel allein bestätigt keine rechtliche Wirksamkeit einer verpflichtenden Einwilligung. Rechtsgrundlage, Widerrufe, Teams-Zugriff und Löschfristen bleiben gesondert zu prüfen. |
| Meta SDK auf privaten Wegen / Widerruf über Tabs | SDK entfernt. Explizite Bildereignisse nur auf exakter Startseite und Kursanmeldung, nach gültiger Einwilligung; bereinigte URL ohne Referrer und Kontaktfelder. | Native Browserprüfung für fehlenden HTTP-Referer und tabübergreifenden Widerruf bestanden. Anzeigenzuordnung muss in Meta Events Manager geprüft werden. |
| Zusätzlicher Schutz für privilegierte Konten | TOTP-Guards in UI, Serveraktionen, API-Hook und RLS. Auf ausdrücklichen Nutzerwunsch gilt nach Migration 83 **Passwortanmeldung für Lehrkräfte**; Administratoren behalten MFA. | Rollenwechsel Lehrkraft → Admin erzwingt die Pflicht. Lehrkräfte werden nicht zur Einrichtung umgeleitet und sehen kein MFA-Symbol. |
| Großzügige Rechte für künftige API-Objekte | Migration 81 entfernt automatische anon/authenticated-/PUBLIC-Freigaben für neue öffentliche Objekte von postgres/supabase_admin. | Bestehende Rechte und Vendor-Schemas erhalten. Neue APIs benötigen ausdrückliche Freigaben und passende RLS. |
| Fehlende CSP / verschachtelte Hauptbereiche | Produktions-CSP und ergänzende Browserheader; keine externen Skriptziele mehr. Datenschutz und Impressum verwenden einen Hauptbereich. | Inline-Skripte/-Styles bleiben für aktuelle Next-Hydration und Motion erlaubt. Strengere Nonces/Hashes benötigen einen gesonderten Rendering-Umbau. |

## Upload- und Synthesegrenzen

| Bereich | Je Nutzer | Je UTC-Tag | Gesamtbestand |
| --- | --- | --- | --- |
| Ausspracheaufnahmen | 250 MiB / 200 Objekte | 25 Uploads / 512 MiB | 5 GiB / 20.000 Objekte |
| Prüfungsaufnahmen | 500 MiB / 400 Objekte | 40 Uploads / 600 MiB | 10 GiB / 40.000 Objekte |
| Audio-Cache | Gemeinsamer Bestand | Synthese: 100 Anfragen / 100.000 Zeichen pro Nutzer | 8 GiB / 100.000 Objekte |
| Kursmaterial | Bestehende Freigaben | Kein neues Tageslimit | 30 GiB / 20.000 Objekte |

Aussprache und Prüfungen je Nutzer zusammen: 750 MiB / 600 Objekte. Alle drei Audiobuckets zusammen: 20 GiB / 160.000 Objekte. Alle vier Buckets zusammen: 50 GiB / 180.000 Objekte. Fremdsprachige Neusynthesen insgesamt: 500 Anfragen / 1.000.000 Zeichen pro UTC-Tag; zusätzlich bleibt das bestehende Minutenlimit wirksam. Eine Löschung oder ein Lernreset gibt Speicherplatz frei, setzt jedoch kein Tageskontingent zurück.

nginx erlaubt acht gleichzeitig laufende öffentliche Storage-Schreibanfragen je Client und zehn Anfragen/Sekunde mit kurzem Burst von 30. Die Clientkennung stammt aus dem letzten vom kontrollierten Traefik angehängten Proxy-Hop. Bei weniger als 15 GiB oder 8 % freiem Dateisystemplatz pausieren die Schreibwege mit HTTP 503. Nach einer Pause werden sie erst bei mindestens 20 GiB **und** 10 % frei wieder freigegeben. Unter 25 GiB erscheinen zusätzliche lokale Warnungen. Diese Reserve ergänzt Quoten und ersetzt keine externe Überwachung.

Details, konservative Größenreservierung, Ticketregeln und reale Paralleltests stehen in `docs/sitov-storage-security-limits.md`.

## Datenbankupgrade und Wiederherstellung

Produktives Image:

```text
supabase/postgres:15.19.0.003@sha256:bce4f0725a10d80bb16e01d678db8d40dd09223d18562125902e2682dd74ecdb
```

Die Image-Pins sind auch in den gespeicherten Coolify-Compose-Vorlagen aktualisiert, damit ein späteres erneutes Bereitstellen nicht auf das alte Image zurückfällt. Die frühere Coolify-Konfiguration ist privat gesichert.

Die neue Imageversion verwendet UID/GID 100:101 statt 105:106 und eine neuere glibc. Datenvolume und benutzerdefiniertes PostgreSQL-Konfigurationsvolume wurden entsprechend angepasst. Die pgsodium-Schlüsselbytes wurden erhalten. Nach dem Wechsel wurden die Indizes der bestehenden Datenbanken sowie template1 neu aufgebaut und deren Collation-Version aktualisiert. template0 hat absichtlich keinen gespeicherten Collation-Versionswert; eine `REFRESH`-Änderung aus `NULL` ist nicht zulässig. template0 bleibt nicht verbindbar. Die sieben bestehenden Anwendungs-/Betriebsdatenbanken und template1 stimmen mit der laufenden Bibliothek überein.

Die erste produktive Umstellung benötigte ungefähr vier Minuten Unterbrechung, weil das neue Image einen zusätzlichen Konfigurationsordner und die korrigierten Schlüsselberechtigungen erforderte. Nach deren Korrektur waren die produktiven Dienste wieder bereit. Der Storage-Bestand mit **16.951 Objekten** war unverändert vorhanden. Das physische Upgrade wurde vorher auf einer vollständigen Kopie geprobt; geplante Cronjobs waren dort ausgeschaltet.

Für ein Engine-Rollback genügt **kein bloßer Imagewechsel** nach Collation-Neuaufbau. Unter `/root/backups/sitov-pg15-upgrade-20261004` liegen das vollständige gestoppte alte Cluster, die frühere Compose-Konfiguration und die benutzerdefinierte Konfiguration. Eine Wiederherstellung muss alle Datenbankverbraucher stoppen, Cluster und Konfiguration zusammen zurückspielen, die alte UID/GID und das alte Image wiederherstellen und danach Integrität, Storage-Bestand und passende Anwendung prüfen. Das darf keine inzwischen entstandenen produktiven Daten stillschweigend überschreiben.

Die unabhängige physische age-Sicherung liegt unter `/Users/denniskostjuk/.codex/backups/sitov-academy/sitov-cluster-security-20261004.age`. Ihre SHA256 lautet `bcfedac70932b9fb9972a25464ba93f568c29ad3642ebe6389bb78ada9af4c79`; **6.713 Dateien** wurden nach vollständiger Entschlüsselung anhand ihrer Manifest-Prüfsummen kontrolliert. Die separate Konfigurationssicherung im selben privaten Ordner enthält zusätzlich pgsodium-Schlüssel, App-Konfiguration und Compose-Stände; alle **sechs Manifest-Dateien** wurden entschlüsselt geprüft. Die vorherige unabhängige App-/Storage-Sicherung wurde ebenfalls vollständig entschlüsselt und anhand von **16.955 Dateien** kontrolliert.

Der private age-Schlüssel liegt ausschließlich auf dem Mac im geschützten Sicherungsordner. Auf dem VPS liegt nur der öffentliche Empfänger. Wiederherstellung zunächst in einer isolierten Umgebung:

```sh
age --decrypt --identity sitov-backup-identity.txt --output backup.tar BACKUP.age
```

Das erzeugt sensible Klartextdaten. Das Archiv ausschließlich in ein privates Wiederherstellungsverzeichnis entpacken, `sha256.json` für jeden enthaltenen Dateipfad prüfen und nach erfolgreicher Wiederherstellung den temporären Klartext entfernen. Für das physische Cluster zusätzlich `pg_verifybackup` aus der passenden PostgreSQL-Version ausführen. Für die logische tägliche Sicherung Rollen, `postgres.dump`, Buckets und die unter UUIDs gesicherten Storage-Objekte samt ursprünglicher Pfadzuordnung gemeinsam wiederherstellen. Bei aufgebrauchter Festplatte stoppt die tägliche Sicherung sichtbar, statt die Betriebsreserve aufzufüllen; sie löscht die neueste vollständige Sicherung nicht.

Ein einmaliger unabhängiger Mac-Export schützt den geprüften Sicherungsstand vor den Migrationen. Der tägliche Timer erzeugt verschlüsselte Dateien **auf demselben VPS**. Der Nutzer hat den Mac als vorläufiges unabhängiges Ziel gewählt, ausschließlich über normales WLAN ohne Handy-Hotspot. Der Mac-LaunchAgent ist installiert und versucht den Abruf nach Anmeldung sowie viermal täglich. Er ist für Downloads derzeit gesperrt: Die ausdrückliche WLAN-Freigabeliste fehlt, und CoreWLAN kann die SSID in diesem Ausführungskontext nicht lesen. macOS benötigt dafür eine erlaubte native Benutzeranwendung mit Standortberechtigung. Eine unbekannte Verbindung wird niemals zugelassen; es fand nach dieser Einschränkung kein weiterer Backup-Download statt. Details, Grenzen der Hotspot-Erkennung und Wiederherstellung stehen in `deploy/mac/README.md`. Erst regelmäßige **erfolgreiche** externe Abrufe schützen spätere Datenstände vor VPS-Verlust.

## Staff-MFA und Freigaben

Die beiden vorhandenen Staff-Profile wurden zunächst verpflichtend umgestellt. **Auf ausdrücklichen Nutzerwunsch wurde anschließend die MFA-Pflicht für Lehrkräfte durch Migration 83 wieder entfernt.** Die zweite Anmeldung gilt weiterhin für Administratorkonten. Administratorkonten mit MFA-Pflicht und ohne Authenticator werden bei der nächsten Verwaltungsanmeldung zur Einrichtung geführt. Die Einrichtung benötigt keinen vorherigen Verwaltungszugriff. Neue Lehrkräfte benötigen nur ihr Passwort. Neue Administratoren sowie Beförderungen zur Adminrolle verlangen die zweite Anmeldung durch die Migration.

Der Schutz prüft sowohl den `aal2`-Claim des tatsächlich verwendeten Tokens als auch einen noch vorhandenen verifizierten TOTP-Faktor. Er umfasst PostgREST-RPCs mit `SECURITY DEFINER` und serverseitige privilegierte Verwaltungsabfragen. Der Service-Key und direkter privilegierter SQL-Zugriff sind weiterhin betriebliche Vertrauensgrenzen. Bei Verlust eines Authenticators bleibt ein unabhängiger SQL-Wiederherstellungsweg für ein außerhalb der Sitzung identitätsgeprüftes Einzelkonto verfügbar.

Supabase Auth 2.186.0 verwaltet Faktoren anhand des aktuellen gespeicherten Sitzungsstatus. Ein älteres JWT derselben bereits mit TOTP bestätigten Sitzung kann deshalb weiterhin Faktoren verwalten. Ein **frischer Passwortlogin** wird bei bereits vorhandenem verifiziertem Faktor abgewiesen. Der isolierte Test hat diese Unterscheidung bestätigt. Gestohlene bestehende Sitzungen müssen widerrufen werden. Details und Wiederherstellung stehen in `docs/security/sitov-staff-mfa.md`.

## Verifikation

- Lokaler Produktionsbuild mit Next.js 16.3.8 erfolgreich; statische und dynamische Routen einschließlich aller Staff-Sicherheitssprachen gebaut.
- 210 gezielte Jest-Prüfungen in elf betroffenen Suites bestanden; zusätzliche CSP-Prüfung nach Entfernung des SDK-Skriptziels bestanden.
- Isolierte Datenbanktests für Storage, vollständigen Schema-/Reset-Ablauf, MFA und Defaultrechte bestanden. Reale PostgreSQL-Paralleltests prüfen die letzte verfügbare Upload-, Ticket- und Synthesereservierung.
- Die Migrationen 79, 80 und 81 wurden auf einer vollständigen PostgreSQL-15.19-Wiederherstellungskopie angewendet. Die echte Auth-/REST-Probe verwendete dasselbe GoTrue-/PostgREST-Image wie die Produktion und keine externen E-Mails.
- Chrome prüft den echten Meta-Adapter mit lokalen Netzwerk-Fixtures: kein Referer, bereinigte Seite, private Wege ausgeschlossen, Widerruf in einem zweiten Tab. Es wurden keine Testereignisse an Meta gesendet.
- Python-Prüfungen für Firewall, Disk-Hysterese, Backup-Retention und echte age-Ver-/Entschlüsselung einschließlich Manipulationserkennung bestanden; Migrationrunner-Vertragstests bestanden. Zehn zusätzliche Mac-Prüfungen für echte Streamingentschlüsselung, Manipulation, Netzwerksperre, Wechselabbruch und Aufbewahrung bestanden; Swift 6 kompiliert den Netzwerkguard.
- ESLint für geänderten Anwendungscode und `git diff --check` bestanden. Produktionsaudit am Prüftag ohne bekannte npm-Meldungen.

## Verbleibende Maßnahmen

1. **Unabhängige tägliche Sicherung auf dem Mac:** WLAN-Namen freigeben und den von macOS erlaubten SSID-Zugriff über eine native Benutzeranwendung einrichten. Der vorbereitete Abruf bleibt bis dahin gesperrt. Die erste geprüfte Mac-Sicherung ersetzt keine erfolgreichen künftigen externen Abrufe.
2. **Unterrichtsaufzeichnung:** Das Kursmodell ist nach Nutzerkorrektur festgelegt: reguläre Online-Kurse und Online-Probestunden werden immer zur späteren Schüleransicht aufgezeichnet; Online-Privatunterricht ist ausgenommen. Die getrennte Zustimmung ist dafür seit Migration 84 technisch verpflichtend. Die Wirksamkeit einer verpflichtenden Einwilligung beziehungsweise die passende Rechtsgrundlage muss gesondert geprüft werden. Widerrufe, Teams-Zugriff und tatsächliche Löschung bleiben Aufgaben des Aufzeichnungsbetriebs. Historische Einwilligungen werden nicht umgeschrieben.
3. **Meta Events Manager:** Die ausdrücklich übertragenen öffentlichen Ereignisse und deren Anzeigenzuordnung mit tatsächlicher freiwilliger Einwilligung prüfen. SDK-Automatik und neu gesetzte Tracking-Cookies werden nicht wieder aktiviert.
4. **Strengere CSP:** Inline-Skriptfreigabe mit einem späteren Nonce-/Hash-Konzept und dazu passender Next-Auslieferung ersetzen. Aktuelle Header reduzieren Angriffsfläche, verhindern aber nicht jede XSS-Ausführung.
5. **Entwicklungsabhängigkeiten:** Das vollständige npm-Audit meldet 34 hohe betroffene Knoten im Entwicklungswerkzeugbaum aufgrund der derzeit ungepatchten `braces`-Kette. Der Produktionsbaum ist sauber. Keine ungetestete inkompatible Toolchain-Zwangsaktualisierung vorgenommen; Upstream-Patch verfolgen und beim Erscheinen geprüft übernehmen. Unvertrauenswürdige Glob-Muster nicht in Build-/Testwerkzeuge übernehmen.
6. **Externe Betriebsalarme:** Der Disk-Guard protokolliert lokal. Ein unabhängiger Kanal für Sicherungsfehler, niedrigen freien Speicher und Dienststörungen muss mit vorhandenem Ziel ergänzt werden.

## Quellen

- [Supabase PostgreSQL 15.19 / 17.11 Updatehinweise](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
- [PostgreSQL-Sicherheitskorrektur für RLS und wiederverwendete Pläne](https://www.postgresql.org/support/security/CVE-2024-10976/)
- [Supabase TOTP-MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp), [PostgREST API-Hook](https://docs.postgrest.org/en/stable/references/configuration.html#db-pre-request)
- [Supabase Storage 1.44.2 Uploader](https://github.com/supabase/storage/blob/v1.44.2/src/storage/uploader.ts), [S3-Authentifizierung](https://supabase.com/docs/guides/storage/s3/authentication)
- [age 1.3.2](https://github.com/FiloSottile/age/releases/tag/v1.3.2)
- [Meta Pixel Bildintegration](https://developers.facebook.com/documentation/meta-pixel/advanced/), [EDPB: freiwillige Einwilligung](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)

## Veröffentlichungsnachweis

Anwendungsrelease **28fd85380d20**, gebaut mit Webpack unter einer festen 2.375-GiB-cgroup-Grenze. Der erste Turbopack-Build wurde an seiner 2.5-GiB-Grenze beim TypeScript-Schritt beendet; ausschließlich der Build war betroffen. Der zweite begrenzte Build bestand. Migrationen **79, 80, 81 und 82** sind produktiv angewendet; der passende Anwendungscode wurde anschließend aktiviert. Die abschließende Sicherung vor den Migrationen liegt unter `/root/backups/sitov-migration-20261004T182719718550Z`, enthält 16.951 Storage-Objekte und wurde vom Migrationrunner vollständig geprüft.

Die Wartung für Sicherung, Migration und Aktivierung dauerte ungefähr **3 Minuten 20 Sekunden**. Danach lieferte die öffentliche Health-Route `ready`, die Startseite HTTP 200 samt neuer CSP, der geschützte Staff-RPC bei `aal1` HTTP 403, das eigene Profil und die MFA-Statusabfrage HTTP 200. Ein `aal2`-Claim ohne vorhandenen verifizierten Faktor wurde ebenfalls abgewiesen. Die vorhandene Interface-Sprache wird bei der Verwaltungsanmeldung berücksichtigt; die Sicherheitsseite selbst wurde in **de/en/ru/uk/tr** mit gültiger diagnostischer Anmeldung und `private, no-store` geprüft. Ein neuer größenbegrenzter Uploadticket-Insert wurde auf der echten Produktionsdatenbank in einer Transaktion geprüft und vollständig zurückgerollt, ohne Schülerkontingente zu verändern.

Beide vorhandenen Staff-Profile haben `sitov_mfa_required=true`. Alle 16.951 Storage-Objekte sind erhalten, und die alte pauschale Aufnahmebeschreibung kommt im Kurskatalog nicht mehr vor. nginx wurde mit seiner tatsächlichen öffentlichen Route geprüft: Storage-GET, DELETE und die Leseoperationen `object/sign`, `object/list` sowie `object/list-v2` umgehen die Diskpause; signierter Upload, S3-PUT und TUS-PATCH werden bei gesetzter Pause mit HTTP 503 gesperrt. Die Pause wurde unmittelbar wieder aufgehoben.

Nach dem kontrollierten VPS-Neustart läuft **6.8.0-146-generic**. Alle produktiven Container mit Healthcheck meldeten gesund; App, Mail, nginx, Docker und Firewall sind aktiv. Backup-, Disk-Guard- und Proxy-Trust-Timer sind aktiv. Öffentliche Health-Prüfung erneut `ready`; PostgreSQL weiterhin 15.19, beide Staff-Flags gesetzt, 16.951 Storage-Objekte und keine Collation-Abweichung außerhalb des absichtlich unversionierten template0. Die IPv4-/IPv6-Dockerregeln sind nach Neustart vorhanden; externe Verwaltungsport-Prüfungen für 8000, 6001, 6002, 9000, 9080 und 5432 bleiben gesperrt.

Der erste neue tägliche Sicherungsdienst lief am 4. Oktober von **18:40:24 bis 18:43:38 UTC** erfolgreich durch. Das Archiv `/root/backups/encrypted/daily/sitov-daily-20261004T184025664940Z.age` ist **584.939.128 Bytes** groß; SHA256: `ecabfc761426a1da75cb87b3d5288fc3ac3c3994837a716660cdf29cb6c0d817`. Der Exporter prüfte vorher alle **16.955 Manifest-Dateien**, einschließlich 16.951 Storage-Objekten. Dieses neue Archiv wurde wegen der gesperrten WLAN-Freigabe noch nicht auf den Mac übertragen; die erste unabhängig entschlüsselt geprüfte Sicherung bleibt dort vorhanden. Die beendete isolierte Testkopie und das durch age ersetzte experimentelle große CMS-Archiv wurden entfernt; geprüfte Sicherungen und vollständige kalte Rollbackdaten bleiben erhalten.

### Nachträgliche Anpassung: Passwortanmeldung für Lehrkräfte

Der Nutzer hat die verpflichtende zweite Anmeldung für Lehrkräfte ausdrücklich abgelehnt. Migration 83 setzt die MFA-Anforderung auf die Adminrolle, entfernt bestehende Lehrkraftflags und verhindert deren erneute Aktivierung durch neue Konten, Rollenwechsel oder den bisherigen MFA-RPC. Lehrkraft → Admin aktiviert die Pflicht atomar, auch wenn ein Aufrufer ausdrücklich `false` übergibt.

Die Anwendung prüft MFA nur für Administratoren. Lehrkräfte sehen kein MFA-Symbol und gelangen bei einem alten Einrichtungslink unmittelbar in die Verwaltung. Rollenrechte, Zuständigkeiten, Uploadquoten, Rate-Limits und Passwortschutz bleiben aktiv. Die eine unbestätigte Lehrkraft-Einrichtung wurde über Auths Admin-API aufgeräumt; es gab keine verifizierten Lehrkraftfaktoren.

Verifikation vor Veröffentlichung: Datenbanktest mit ursprünglicher Migration 80 plus 83 prüft Lehrkraft-AAL1, bestehende REST-/Storage-Rechte, verweigerte Wiederaktivierung, Admin-AAL1-Verweigerung, Admin-AAL2-Freigabe und beide Rollenwechsel. 139 gezielte Anwendungstests einschließlich tatsächlichem Verwaltungslayout, Backendkontext und alter Sicherheitsroute sowie die vollständigen Builds auf Mac und VPS bestanden.

Produktiv am 4. Oktober 2026 veröffentlicht: Release `a5c54cb23257`, Migration 83. Unmittelbar vorher vollständige PostgreSQL-/Storage-Sicherung unter `/root/backups/sitov-migration-20261004T194125168654Z`; alle 16.951 Objekte geprüft. Für beide realen Lehrkraftkonten bestanden `aal1`-Auth, öffentlicher REST-Zugriff, die serverseitig gerenderte Verwaltungsseite ohne MFA-Symbol und der alte Sicherheitslink mit Weiterleitung zur Verwaltung. Ein Rollenwechsel zur Adminrolle mit ausdrücklich ausgeschalteter Flag wurde innerhalb einer zurückgerollten Transaktion auf dem VPS geprüft: Flag automatisch an, private API bei `aal1` verweigert. Es wurde kein Adminprofil dauerhaft angelegt. Nach Entfernen der einen unbestätigten TOTP-Einrichtung verbleiben null Lehrkraftfaktoren. App, Mail und Disk-Guard-Timer aktiv; öffentliche Health-Prüfung `ready`, Storage weiterhin 16.951 Objekte.

### Nachträgliche Anpassung: Aufzeichnung der Online-Gruppenkurse

Nach Nutzerkorrektur werden reguläre Online-Gruppenkurse und Online-Probestunden immer in Teams zur späteren Schüleransicht aufgezeichnet. Neue Buchungen und Monatsänderungen benötigen dafür eine eigene, zunächst leere Bestätigung; Online-Privatunterricht und Präsenzunterricht sind ausgenommen. Die Regel wird anhand gespeicherter Kursdaten in Anwendung und Datenbank durchgesetzt, einschließlich direkter alter Monats-RPCs. Historische Zustimmung wird nicht rückdatiert oder aus fehlenden Werten abgeleitet.

Migration 84 speichert neue tatsächliche Bestätigungen als geschützten Nachweis mit Buchung, Quelle, Zeit, Konto bei angemeldeten Monatsbuchungen, angezeigter Sprache und Kursumfang. Der unveränderliche Textstand `sitov-recording-2026-10-04-v1` enthält alle fünf Sprachfassungen einmalig; Belege referenzieren diesen Text. Monatsnachweise verwenden die aktuell angezeigte Sprache auch bei abweichender Profilsprache. Pro Konto höchstens zehn erfolgreiche Monatsbestätigungen in zehn Minuten und 40 pro UTC-Tag; abgewiesene oder zurückgerollte Vorgänge verbrauchen nichts.

Verifikation vor Veröffentlichung: 243 Anwendungstests in elf Suites, 33 Datenbankprüfungen einschließlich vier realer PostgreSQL-17-Parallelprüfungen, 13 Migrationrunner-Prüfungen, vollständiger lokaler Produktionsbuild und anschließender Typecheck bestanden. Migration und Buchungswege bestanden außerdem eine vollständig zurückgerollte Probe auf der tatsächlichen PostgreSQL-15.19-Produktionsdatenbank; keine Testbuchung und keine Test-E-Mail blieb bestehen.

**Rechtsprüfung und Teams-Einrichtung stehen aus.** Weil auch Schülerstimmen und -bilder erfasst werden, muss die Wirksamkeit der verpflichtenden Einwilligung im konkreten interaktiven Kurs geprüft werden. Der Webseiten-Nachweis ersetzt keine freie Entscheidung, keinen umgesetzten Widerruf und keine tatsächliche Löschung. Microsofts Richtlinie „Require participant agreement for recording and transcription“ kann ergänzend vor Mikrofon-/Kamerabeiträgen eine Zustimmung verlangen und diese protokollieren; sie wurde nicht im Tenant eingerichtet. Der konkrete Betriebsablauf und die primären Quellen stehen in `docs/security/sitov-privacy-hardening-2026-10-04.md`.

Produktiv am 4. Oktober 2026 veröffentlicht: Release `9d9e2248f4a0`, Migration 84, vollständiger begrenzter VPS-Build bestanden. Vorherige geprüfte Sicherung unter `/root/backups/sitov-migration-20261004T203633692622Z`, alle 16.951 Objekte erhalten; PostgreSQL-Dump SHA256 `0b202e6148f77720cc07d1feb7d7dbc46989b8339cfb80e79ec06c515df91126`. Produktiver Textstand exakt mit der fünfsprachigen Fixture identisch, beide Online-Kursbeschreibungen berichtigt. Öffentliche Anmeldeseiten in de/en/ru/uk/tr HTTP 200 mit neuem Pflichttext, anonymer Monats-RPC und privater Nachweiszugriff über HTTP gesperrt. Lehrkraft-MFA weiterhin ausgeschaltet, App und Mail aktiv, Health `ready`; Uploadpause aufgehoben und Disk-Guard-Timer aktiv. Die Microsoft-Einstellungen wurden nicht geändert und eine juristische Freigabe liegt nicht vor.
