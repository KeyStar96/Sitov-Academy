# S5 epoch15: persistente QA-Speicherfreigabe, rein lesende Diagnose

Sauberer Ausgangsstand `efe6a54f7f3c5ff583cf13c9beb33063b35f47e1`, Branch `codex/sitov-night-s5-qa-memory-diagnosis`. Nur fünf exakte QA-Container/cached Images/internal-only Netzwerk, Scope-Guard bestanden; keine fremde Prozessinventur. Messungen 9.Oktober2026 10:19:57 und10:20:38 Europe/Berlin, 40.5 Sekunden Abstand.

## Tatsächlicher Zustand

Host MemAvailable 2569,86→2657,82 MiB; 3072-MiB-Erstellungsreserve jeweils unterschritten, zuletzt um 414.18 MiB. Swap0. Caps insgesamt960MiB/2CPU unverändert. Docker-stats-Werte sind Working Set mit Cachebereinigung, keine reservierte Kapazität und keine direkte Prognose freigebbaren Hostspeichers.

| Dienst | Working Set MiB | Cap MiB | Reserve MiB | Ist CPU% / Cap |
|---|---:|---:|---:|---|
| db | 97.16 | 384.0 | 286.84 | 0.00% / 0.75 CPU |
| auth | 13.03 | 128.0 | 114.97 | 0.01% / 0.25 CPU |
| storage | 171.1 | 256.0 | 84.9 | 0.01% / 0.5 CPU |
| rest | 32.46 | 64.0 | 31.54 | 0.07% / 0.25 CPU |
| gateway | 101.7 | 128.0 | 26.3 | 0.20% / 0.25 CPU |

**Konkreter zusätzlicher Blocker:** Gateway Running=true, aber **OOMKilled=true** an beiden Messpunkten, letzte StartedAt05:24:39Z/FinishedAt05:24:39Z, RestartCount0. Andere vier OOMFlagsfalse. Start-/Endzeiten und RestartCounts zwischen beiden Proben unverändert. Der vorhandene runtime.health()-Guard scheitert deshalb an seinem No-OOM-Assert. Drei anschließend separat diagnostisch und ohne Authheader gelesene URLs liefern tatsächlich200: auth health, rest root, storage status. Diese GETs umgehen keine Freigabe: Guard bleibt FAIL; HTTP200 ist kein Durable-PASS. OOMFlag belegt nicht den Zeitpunkt eines neuen Ereignisses zwischen den Proben; RestartCount0 schließt manuelle Neustarts/OOM-Vorgeschichte nicht aus. Keine Last- oder Dauerstabilitätsfreigabe aus40Sekunden Leerlauf.

## Exakte Regel und protokollierte Durchsetzung

`guard.py:10` verlangt3072MiB zusammen mit frischen Fakten, leerem Namespace, freien19483 und nicht existierenden Containern/Volumes/Netzwerk. `create.sh:6–7` führt diesen Guard **vor** compose up aus. Planhelper prüft dieselbe frische Erstellungsreserve. Dieser Guard ist nicht für eine bereits laufende Umgebung wiederverwendbar. `runtime.py:9–25` prüft den bestehenden Scope/Caps; `runtime.py:44–54` fordert Running/NoOOM und dreiHealth200, ohne kontinuierlichen3072Check.

Master latest_health08:04Z protokolliert3072 host_admission=false auf bestehender QA als zusätzliche Wartungs-/Freigabeentscheidung; dies ist kein Resultat der runtime.py-3072Prüfung, die nicht existiert. Die Anwendung auf bestehende Wartung muss M ausdrücklich klären und dokumentieren. S5 senkt/erlässt/etikettiert keine Grenze um. Historischer Cache-Recovery-Proof01:11Z dokumentiert Gateway128MiB, 16m Cache, dedicated processingoff, mit gestopptem eigenen Storage3146MiB Hostreserve; das ist kein aktueller Stabilitätsbeweis. Damals falseOOM/Health200 und Master08:04falseOOM ersetzen den jetzigen trueOOM-Befund nicht.

Aktuell hat Storage171,1MiB WorkingSet; dessen isolierter Stopp würde rein rechnerisch nur rund2828,9MiB Hostreserve erreichen, unter3072. Auch Summen/WorkingSet sind keine garantierte Rückgewinnung. Gateway hat nur26,3MiB Capreserve; freie Gesamtkapazität anderer Container hilft diesem Cap nicht. Hostreserve und früheres Gateway128MiB-OOM sind getrennte Risiken.

## Sicherster begrenzter nächster Schritt für M

**Jetzt kein positives Votum zur107Installation oder zum seriellen Learnerflow.** Zuerst in gesonderter ausdrücklicher bestehender-QA-Wartungsfreigabe nur den eigenen Gateway prüfen: cgroup memory.events/peak/current und die freigegebenen nicht geheimen Cacheparameter ohne Env-/Credentialdump; OOMUrsache und aktuelle Spitzenreserve klären. Kein blindes Neustarten als Fehlerbehebung. Falls eine Samecap-Recovery notwendig ist, separat von M autorisieren, exakt eigene Images/Labels/Netzwerk/Volumes/Caps erhalten, danach frischen NoOOM-Healthguard und begrenzte serielle Last-/Zeitbeobachtung mit dokumentiertem Abbruch bei erneutem OOM oder fehlender Reserve. Erst danach Entscheidung zu107Install und tatsächlichem Flow; hierfür neue Freigabe/Lease. Keine fremde Bereinigung, Capsteigerung oder Wiederanwendung von create.sh.

Mac: eigener PG-PID33224 lebt, Port55438 erreichbar; eigener SSH-Tunnel-PID80542 lebt,19483 erreichbar. Alter QA-Next-PID35932 existiert nicht,3143 geschlossen. Das erklärt zusätzlich fehlenden Browserbetrieb, unabhängig vom Linux-Hostspeicher. Keine Starts ausgeführt.

QA107 nicht installiert, aktueller Learnerflow UNGETESTET. Keine Daten-/Auth-/Container-/Config-/Produkt-/SQL-/Import-/Audio-/Build-/Teständerung. Verträge core/commercial/recommendation gelesen. JSONInvarianten, sanitierter Credential/JWT-Scan und GitDiffcheck geprüft. **WAIT; Diagnose übergeben, kein RELEASE_READY.**
