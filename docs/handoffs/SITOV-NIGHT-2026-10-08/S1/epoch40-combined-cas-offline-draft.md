# Sitov Academy — Epoch 40: kombinierter Offline-CAS-Entwurf

Basis `71a46311fd1e9d157d3195a4c3185dceafcaccba`. Neue Dateien: `deploy/vps/sitov-path-combined-cas.py` und zugehörige CPU-Tests. Der bestehende Parent-Preparer wird unverändert geladen. Keine Datenbankausführung, SSH-/API-/Netzwerk-, Modell-, Audio-, Import-, Migrations-, Push- oder Deployment-Aktion.

## Tatsächlicher Stand

Alle 399 vollständigen Exercise-Vorherbilder und Business-Nachherbilder aus dem eingefrorenen Strukturinventar wurden offline validiert; ebenso 49 Parents und ein Objective. Elterninput-SHA256 `bf99123d8840abd1a700145b11f8e2a5e9280dceec760871ffce57394102f577`; Inventar-SHA256 `6c16439938dd39907905627a96b0b946691790db0bebf13861dca8e8bfc8ee67`.

Die reale SQL-Erzeugung ist ohne finales Freigabemanifest gesperrt. M bestätigte ausdrücklich, dass ein solches Manifest noch fehlt und die Epoch36-Eingaben ausschließlich Strukturfixtures sind. Keine Freigabe wurde aus Commit-Lineage erfunden. Die synthetischen Testfreigaben bleiben ausschließlich Testdaten.

`python3 -m unittest discover -s deploy/vps/tests -p 'test_sitov_path_*_cas.py' -v`: 16 PASS, davon sechs neue Combined-Tests und zehn unveränderte Parent-Regressionstests. CLI help PASS. Geprüft sind unveränderliche Felder, vollständige Vorherbildkonsistenz, unbekannte erhaltene Felder, verschobene/fehlende Locales, No-ops, doppelte IDs, veraltete SHA/Dokumente, Freigabebindungen, Batchgrenzen, SQL-Injection als Hexdaten, exklusive 0600-Ausgabe, Transaktionsreihenfolge und konservative Offline-Recovery-Klassifizierung. Das beweist keine native SQL-Ausführung.

## Eingaben und Freigabemanifest

CLI verlangt `--parents`, `--inventory`, `--reviews`, jeweils mit explizitem `--…-sha256`, sowie `--output`. Default ist ROLLBACK; `--reviewed-commit` emittiert lediglich COMMIT. Ausgabedateien werden exklusiv mit 0600 angelegt. Inventar/Reviews sind auf 32 MB und Exercises auf 1000 begrenzt; der bestehende Parent-Vertrag behält seine kleineren Grenzen.

Reviewmanifest Version 1 enthält ausschließlich:

```json
{
  "version": 1,
  "planUUID": "CANONICAL_UUID",
  "parentSHA256": "EXACT_PARENT_FILE_SHA256",
  "inventorySHA256": "EXACT_INVENTORY_FILE_SHA256",
  "parentsApproval": {
    "approved": true,
    "binding": {"parentSHA256": "EXACT_PARENT_FILE_SHA256", "inventorySHA256": "EXACT_INVENTORY_FILE_SHA256"},
    "reviewer": "EXPLICIT_REVIEWER",
    "evidence_uri": "EXPLICIT_EVIDENCE_URI",
    "docPath": "LOCAL_REVIEW_DOCUMENT",
    "docSHA256": "EXACT_DOCUMENT_SHA256",
    "sourceCommit": "EXACT_40_HEX_SOURCE_COMMIT"
  },
  "exercises": [{
    "id": "EXACT_EXERCISE_UUID",
    "approved": true,
    "binding": {"id": "EXACT_EXERCISE_UUID", "beforeFullSHA256": "CANONICAL_FULL_BEFORE_SHA256", "afterBusinessSHA256": "CANONICAL_COMPLETE_AFTER_BUSINESS_SHA256"},
    "reviewer": "EXPLICIT_REVIEWER",
    "evidence_uri": "EXPLICIT_EVIDENCE_URI",
    "docPath": "LOCAL_REVIEW_DOCUMENT",
    "docSHA256": "EXACT_DOCUMENT_SHA256",
    "sourceCommit": "EXACT_40_HEX_SOURCE_COMMIT"
  }]
}
```

ParentsApproval bindet den gesamten Parent-/Objective-Input einschließlich aller IDs und Nachherbilder. Jede Exercise benötigt genau eine eigene ID-Freigabe. Dokumentbytes werden tatsächlich SHA-geprüft, auf 2 MB begrenzt; ein Commitfeld allein erzeugt niemals Zustimmung. Die Echtheit der menschlichen Zustimmung und die Commit-/Dokument-Lineage muss M prüfen. Die Python-Quellbindungshashes verwenden die dokumentierte `canonical`-Serialisierung und sind ausdrücklich keine PostgreSQL-CAS-Hashes.

## Emittierter Ablauf

Eine einzige SERIALIZABLE-Transaktion übernimmt Timeouts und Parent-Sperren aus dem vorhandenen Preparer. Vor jeder Parent-Mutation werden sämtliche vollständigen alten Exercises und alle fünf vollständigen Übersetzungen exakt gegen PostgreSQL geprüft; breite begrenzte Tabellensperren verhindern Phantoms, neue Historien, Definitionsänderungen und DDL. Betroffene vorhandene Exercise-Archive, belegte Plan-Request-IDs und alte Special-Pool-Abhängigkeiten werden abgelehnt. Der Parent-Preparer ergänzt seine History-/Anchor-/Objective-Abhängigkeitssperren einschließlich inaktiver Definitionen.

Nach Parents/Objective konstruiert der Eigentümer die tatsächliche PostgreSQL-Revision-Projection und überlagert ausschließlich content, translations, explanation_card und topic. Topic muss exakt dem tatsächlich gesperrten Parent entsprechen. IDs, type, unit/node/goal/ref/order/path_is_active und unbekannte vollständige Felder bleiben erhalten. Vorher-/Nachher-CAS-Hashes entstehen ausschließlich über `path_private.sitov_revision_hash` im PostgreSQL-Prozess.

Batches werden in SQL anhand des tatsächlichen `jsonb::text` auf höchstens 100 Einträge UND 1.500.000 Bytes begrenzt. Einzelne übergroße Einträge scheitern. Request-UUIDs sind deterministische UUIDv5 aus PlanUUID und Batchindex; IDs sind sortiert und eindeutig. Der Python-Batchhelfer ist nur eine Offline-Schätzung, keine Behauptung über PostgreSQL-Serialisierung.

Private Konstruktion und Hashing erfolgen als Eigentümer. Ausschließlich der bestehende öffentliche Writer wird nach `SET LOCAL ROLE service_role` aufgerufen; anschließend folgt RESET ROLE. Es gibt weder private Writer-Grants noch deaktivierte Trigger oder synthetisch akzeptierte Audio-Gates. Die echten SQL114-/115-Validierungen, insbesondere vorberechnete Assets, bleiben wirksam.

Anschließend prüft SQL vollständige finale Parent-/Objective-Zeilen und Übersetzungen, Exercise-Projektionen, vollständige Archive-Vorher-/Nachherbilder einschließlich unbekannter Spalten, CAS-Hashes, unveränderte quellengebundene Review-Evidenz, Actor, genaue Archiv- und Receipt-Anzahlen sowie Receipt-Payload/-Result. `SET CONSTRAINTS ALL IMMEDIATE` liegt vor dem einzigen ROLLBACK beziehungsweise explizit emittierten COMMIT.

## Ehrliche Grenzen und nächste Gates

Dies ist ein reviewfähiger Entwurf, keine Ausführungsfreigabe. M muss das aktuelle Inventar aktualisieren und nach unabhängiger Prüfung reale Freigaben erstellen. Native Parser-, Rollenwechsel-im-DO-, Timeout-, Trigger-, vollständige Vorher-/Nachher-, Batchgrößen-, Archiv-/Receipt-, Prepared-Asset-, Fehler-/Rollback- und Parallelitätsprüfungen stehen aus. Die große eingebettete Planliteral wird zweimal verwendet; SQL-Größe, Speicher und Laufzeit sind besonders zu prüfen. Keine Special-Definition darf vor dieser noch zu prüfenden gemeinsamen Adoption erstellt werden.

`classify(plan, observed)` führt keinerlei I/O oder Wiederholung aus. Exakt alt ohne Historie ergibt `OLD_REVIEW_REQUIRED`, gemischte/geänderte Zustände `MIXED_OR_CHANGED_ABORT`, fehlende Daten `INCOMPLETE_READBACK_ABORT`. Ein vollständig neues Quellbild ergibt bewusst nur `NEW_NATIVE_ARCHIVE_VERIFICATION_REQUIRED`: Eine native Read-only-Erhebung und vollständige Recovery-Verifikation der authentischen Archive/Receipts ist noch nicht implementiert. Dieser offene Teil darf nicht als fertige Recovery ausgegeben oder durch Blind-Retry ersetzt werden.

Private Struktur-/Testnachweise und Resume liegen in `S1/epoch40-structural-proof-private.json`, `S1/epoch40-resume-ledger.json` und `S1/epoch40-evidence-manifest-private.json`. Release-ready bleibt false; kein Produktivbestand wurde angefasst.
