# Sitov Academy · S5 Epoch42 · Auth/REST-Wechsel und Rollback

Unabhängige Offline-Prüfung auf Basis `aa2763921a3f13afc60cd8d0d707cf4f7c98b30d`. M-Original unverändert und UNEXECUTED. Kein SSH, DB-, API-, Browser-, Modell-, Runtime- oder nativer SQL-Aufruf durch S5. **Kein nativer Compile-/Runtime-PASS und keine Ausführungsfreigabe.**

## Befunde

- **P1:** Das Original stoppt/detacht/benennt Originalcontainer um, besitzt im Fehlerpfad aber nur Fehlerprotokollierung und keinen Rollback. Ein Fehler nach dem ersten Stop kann Auth/REST unerreichbar zurücklassen.
- **P1:** Vor dem ersten Stop prüft das Original Config/HostConfig und Scope-IDs, aber nicht die vollständige originale Netzwerkbindung/Mounts/Image/Running-Zustände. Der Vorschlag prüft diese gegen den SHA-gepinnten Snapshot und weist ID-, Netzwerk-, Port-, Caps- und Env-Abweichungen vor Mutationen ab.
- Der ursprüngliche OOM-Vergleich über Mitgliedschaft akzeptiert wegen Python-Gleichheit auch numerische0. Der Vorschlag erlaubt ausschließlich None oder das boolesche False und normalisiert nur None→False.

## Privater Vorschlag

`S5/epoch42-switch-proposal.py` behält die Config-/HostConfig-Kopie und den gezielten DB-Pfadwechsel bei. Userinfo einschließlich percent-encodierter Credentials, Query, Fragment und alle übrigen Env-Werte bleiben erhalten. Neue Container verwenden dieselben privaten IPs und Aliase, Images, Mounts, Caps und Portregeln. DB/Storage/Gateway werden vor und nach dem Wechsel sowie vor dem Rollback auf unveränderte Identität und Konfiguration geprüft. Docker-generierte Endpoint-IDs werden beim Rückweg nicht mit IP-/Alias-Erhalt verwechselt.

Write-ahead-Journal vor jedem Schritt, atomarer privater Save mit fsync, blockiertes wiederholtes Apply. Bekannte neue Container werden beim Rollback in umgekehrter Reihenfolge gestoppt/detacht/entfernt; Originale werden niemals entfernt, sondern unter Name/IP/Alias und Originalkonfiguration wieder gestartet. Rollback lässt sich erneut aufrufen. Fremde/neue ID- oder Config-Abweichungen führen vor Rollback-Mutationen zu HOLD.

Apply-Frist180s und separate Rollback-Frist120s; Docker-Unix-Socket-Adapter mit höchstens15s pro Request, Gesamtdeadline und begrenzten Antwortgrößen. Kein Standardaufruf mutiert die Runtime. M muss den Vorschlag prüfen und ausdrücklich `execute('apply')` bzw. `execute('rollback')` verwenden; Snapshot und bestehender Runtime-Helper sind SHA-gepinnt. Die native Docker-Adapterfunktion ist **UNGETESTET**. Der bestehende Runtime-Health-Guard wird übernommen; dessen Laufzeit wird von diesen synthetischen Transporttests nicht bewiesen.

**Bewusster HOLD:** Ist Create serverseitig erfolgt, seine Antwort/ID aber verloren, entfernt der Rückweg keinen nur anhand des Namens gefundenen Container. Originale bleiben erhalten; M muss die unbekannte ID unabhängig bestätigen. Dieser Zweig ist kein erfolgreicher automatischer Rollback und bleibt ein manueller Recovery-Fall. Auch Fehler während des Rollbacks bleiben als HOLD im Journal erhalten.

## Offline-Verifikation

30 synthetische Verhaltenstests PASS: Credentials/Config/HostConfig/IPs/Aliase/Caps/Ports, wiederholtes Apply und Rollback, je vor/nach den zehn Apply-Mutationen injizierte Fehler, falsche IDs, fremdes Netzwerk, Ports, OOM true/numeric0, Caps-/Env-Drift, neue Config/ID-Drift sowie Deadline. Nach verlorener Create-Antwort wird HOLD erwartet; alle Originale bleiben bestehen. Python-AST-Parse PASS. Keine realen IDs oder Credentials in Fixtures.

- M-Original SHA256: `f079a9b2094d986a282e4382ec3c5c9666db890886708e4162541651dd00acff`
- Privater Vorschlag SHA256: `671d8a6eb60b2948b63b2bf1f19412124ec0a8a96e347985ab9173bdf891343d`
- Tests SHA256: `b624f36d0d93d16f023249a745ac0263f0f3eb974f322f2589d560bc36fffa05`
- Testbeleg SHA256: `6755600a43c5775b0c59f6cc301f4c2278e1710a9c2e41ec2ffba3651bfc4d59`
