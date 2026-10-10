# Sitov Academy — S1 Epoch 39: Offline Parent-/Objective-CAS

Basis: `58fa57c76e6a30feca1a2729d21fa661483c2b96`. Ausschließlich Offline-Vorbereitung; keine Datenbankausführung, Verbindung, SSH-, Netzwerk-, Modell-, Audio- oder QA-Aktion.

## Vertrag und Aufruf

`deploy/vps/sitov-path-parent-cas.py` nimmt eine explizite JSON-Datei bis 2.000.000 Bytes und deren vollständigen SHA256 entgegen. Version 1 enthält ausschließlich `version`, `nodes` (höchstens 100) und `objectives` (höchstens 10). Jeder Eintrag enthält `before` und `after`.

Ein Node-Bild enthält `node` als vollständige tatsächliche Tabellenzeile einschließlich Zeitstempeln und unbekannten Feldern sowie `translations` als genau fünf vollständige Zeilen für de/en/ru/uk/tr. Ein Objective-Bild ist die vollständige Zeile mit Unit-UUID, Text-ID, area, description und allen weiteren Feldern. Objectives verwenden den tatsächlichen zusammengesetzten Schlüssel `(unit_id,id)`; ihre Text-ID ist keine UUID.

```sh
python3 deploy/vps/sitov-path-parent-cas.py --input FINAL.json --sha256 EXPLICIT_FINAL_SHA256 --output REVIEW.sql
```

Standardmäßig endet SQL mit `ROLLBACK`. `--reviewed-commit` emittiert stattdessen `COMMIT` ausschließlich für spätere explizit geprüfte Ausführung durch M. Das Tool führt niemals SQL aus. Die Ausgabedatei wird exklusiv mit 0600 erstellt; bestehende Artefakte werden nicht überschrieben.

Nur Node-title/topic/merkkarte, Translation-title/rule und Objective-description dürfen sich ändern. IDs, Fremdschlüssel, unit/kind/goals/order/active/anchors/test_size und sämtliche unbekannten Felder bleiben gleich. Leere Operationen, No-ops, doppelte Schlüssel/UUIDs/Locales, fehlende Zeilen, verschobene IDs, ungültige Kennungen, nicht endliche Zahlen, NUL und übergroße Eingaben werden abgelehnt. Inhalte werden als UTF-8-Hexdaten eingebettet; keine Nutzereingabe wird SQL-Bezeichner oder Dollar-Quote-Code.

## Transaktion und Schutz

SQL verwendet SERIALIZABLE, 2 Sekunden Lock-Timeout und 20 Sekunden Statement- sowie Idle-in-Transaction-Timeout. Ein privilegierter Akteur mit Superuser- oder BYPASSRLS-Eigenschaft ist erforderlich; fehlende Tabellen/Berechtigungen scheitern geschlossen. Deterministisch sortierte FOR-UPDATE-Sperren betreffen alle ausgewählten Parents, Übersetzungen und Objectives. Zusätzliche SHARE-ROW-EXCLUSIVE-Tabellensperren blockieren neue/entfernte Übersetzungen, verschobene Aufgaben, neue Archiv-/Special-Abhängigkeiten und DDL während der Prüfung. Sie betreffen learning_units, path_nodes, path_node_translations, path_objectives, learning_exercises, sitov_content_revisions und definitions. Diese breite Schreibsperre ist ein bewusster begrenzter Wartungs-Tradeoff; sie braucht native Kosten-/Nebenläufigkeitsprüfung durch M.

Vor Änderungen werden abhängige bestehende 114-Revisionen anhand aktueller Aufgaben und historischer vollständiger Vorher-/Nachherbilder beziehungsweise Projektionen abgelehnt. Unbeteiligte Revisionen sind kein pauschaler Blocker. Bestehende Special-Definitionen werden unabhängig von Aktivierung/Veröffentlichung einschließlich eigener Nodes, Anker, Objective-Ziele und Pool-Aufgaben geprüft und bei Abhängigkeit abgelehnt.

Jede Parent-/Objective-Zeile muss vollständig dem alten JSONB-Bild entsprechen. Alle fünf Übersetzungen werden als vollständige sortierte Multimenge verglichen. Der Count ist auf sechs begrenzt, die eigentliche Aggregation auf fünf Zeilen je Parent; keine vollständige Datenbankaggregation. Jede UPDATE-Anweisung verlangt genau eine Zeile. Es gibt keine INSERT-/DELETE-Anweisung und keine Archiv-/History-Mutation. Nach allen Updates folgen erneut vollständige Zeilen- und Übersetzungsprüfungen sowie die unmittelbare Prüfung verzögerter Constraints.

Der vorhandene `path_private.guard_catalog` setzt bei jedem Parent-UPDATE `updated_at` auf `clock_timestamp()`. Der Kandidat muss seinen ursprünglichen Zeitstempel behalten; die SQL-Nachprüfung akzeptiert ausschließlich diesen einen serverseitig erzeugten Zeitstempel innerhalb des aktuellen DO-Statements. Alle übrigen bekannten und unbekannten Spalten müssen exakt dem vollständigen Nachherbild entsprechen. Triggerbedingte weitere Änderungen führen zum Rollback.

## Tatsächlich geprüft

- `python3 -m unittest discover -s deploy/vps/tests -p test_sitov_path_parent_cas.py -v`: 10 CPU-/Dateitests PASS. Abgedeckt: valider Vertrag, SHA-Staleness, vorhandene SQL-CAS-Prädikate, unveränderte/unerlaubt geänderte unbekannte Felder, doppelte/fehlende/verschobene Übersetzungen, geschützte Identität, ungültige Kennungen, SQL-Injection-Inhalte als Daten, No-ops, Größen-/Zahlgrenzen und Abhängigkeitssperren in der SQL-Ausgabe.
- CLI help, tatsächliche CLI-Erzeugung einer 0600-ROLLBACK-Datei und Schutz gegen Überschreiben: PASS.
- Offline-Demonstration aus dem explizit gehashten S2-Epoch33-Inventar: 48 vollständige Parents plus ein Objective. Input 395578 Bytes, SHA256 `e96e84905eb0bc9367a04e49faf9e138ce394b6aa7b53bc4977eaf3d41ff69dd`. Das ist ausdrücklich kein final redaktionell freigegebener Kandidat; S2 ändert Kandidaten weiter.
- Tatsächliche private vollständige Quellabzüge geprüft: 330 Unit-Übersetzungen, SHA256 `cb7e2f20b858410b59525413daa32f267fc78535e0636ab226ef7fc52bbe6474`; 746 Objectives, SHA256 `a8bd013b75959a8015c0ad56cedcdaced7aeb7de7b889eba2acabc3065b961de`. Die Objective-Demonstration verwendet die vollständige tatsächliche Zeile für Lara→Lars. Unit-Übersetzungen erhalten keine Änderung.

## Grenzen und nächste Freigabe

Die Tests beweisen keine native SQL-Parser-/Trigger-/Lock-/RLS-/Race-Ausführung. Native Stale-/Duplicate-/Phantom-/History-/Special-Rejection, Zeitstempelverhalten, vollständige Rollback-Wiederherstellung und Laufzeitkosten bleiben Pflicht-Gates bei M. Ein SHA fixiert Bytes, ersetzt aber weder Quellvollständigkeit noch redaktionelle Freigabe. Neue Schemafelder fehlen gegebenenfalls im alten Paket und verursachen bewusst einen CAS-Abbruch.

M muss den finalen expliziten Input separat einfrieren und Parent-/Objective-Schritt vor dem ersten betroffenen 114-Archiv zusammen mit den 320 Exercise-Revisionen in derselben geprüften Transaktion orchestrieren. Diese Ausgabe ist eine eigenständige Review-Transaktion; sie darf nicht ungeprüft als separater Parent-COMMIT oder hinter bereits angelegte betroffene Archive gesetzt werden. Dafür existiert kein stiller Bypass. Keine Migration oder deployed SQL114-Datei wurde geändert, keine S2-Seeds verändert. Release-ready bleibt false.

Private Artefakte: `S1/epoch39-source-demonstration-not-final-private.json`, `S1/epoch39-source-demonstration-ROLLBACK-private.sql`, `S1/epoch39-cli-ROLLBACK-private.sql`, `S1/epoch39-resume-ledger.json` und `S1/epoch39-evidence-manifest-private.json` im Koordinationsverzeichnis. Keine tatsächlichen vollständigen Quellzeilen werden eingecheckt.
