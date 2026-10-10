# Sitov Academy · S5 Epoch43 · QA60-Treiber

Basis `0bd4e01a9aef668485461008881f8ea01d5cceb9`. Offline geprüft und eigene private Vorschlagskopie erstellt. **24 synthetische Tests PASS; tatsächliche native60-Eingabestruktur offline PASS. Alle realen API-/SQL-Verträge bleiben nativ UNGETESTET.** Keine SSH-, DB-, API-, Runtime-, Browser-, Modell- oder Produktaktion. S3/M-Originale unverändert.

## Konkrete Befunde und Korrekturen

- **P1:** Source83:13–17/54 erzwingt für Lehrer MFA=false; S3e81.create erwartet dagegen true und würde vor Enrollment abbrechen. Der private Vorschlag erzeugt ausschließlich einen neuen QA-Admin (Source83:19–25), führt echte Password-/GoTrue-Faktorendpunkte aus und bindet die User-ID/E-Mail nach MFA erneut über GoTrue. Keine gefälschten JWTs, keine Rollenclaims, keine Änderung kopierter Nutzer. Die neue Rolle ist ausdrücklich admin, nicht teacher.
- **P1:** Originale SQL-Aufrufe haben keinen BEGIN/SET LOCAL/Read-only-Vertrag. Vorschlag: 15s statement/2s lock/4MB work_mem/15s idle, Read-only für Abfragen, Schreibtransaktion ausschließlich für die bewachte neue Fixture-Profiländerung. Input64KiB, einzelne JSON-Antwort, Output/Fehlerdateien1MiB, Prozess-/IO-Fristen.
- **P1:** Original validate_scope allein prüft nicht den vollständigen geforderten RAM-/Caps-/Health-Vertrag. Vorschlag verwendet zusätzlich den SHA-gepinnten table_hashes/runtime-Guard: mindestens1984MiB, exakt960MiB/2CPU,3×200, alle fünf OOM=false, anschließend Auth/REST/Storage-Ziel und native DB62580.
- Native60-Prüfung verlangt nun sämtliche vier tatsächlichen Whole-Proof-Schlüssel,60 Definitionen/Approvals,5650 Audio-Proofs, genaue Claims und eindeutige IDs. Template bleibt executionAuthorized=false. Neue verpflichtende Pins: Guard-Helper, zugehöriges runtime.py und eingefrorene Audioerwartung. M muss private Pfade stagen/rehashen; Helper und runtime.py bleiben Geschwister.

Publication-Parameter und Response-Felder stimmen statisch mit102 überein;105 erhält aktuelle Authority/CAS-/Receipt-Prüfung. NULL-Base-CAS, exakte Request-ID-Wiederholung und HOLD bei Teiljournal bleiben erhalten. Vor Actor-POST wird die neue Fixture-Absicht gespeichert; nur neue, serverseitig bestätigte ID/E-Mail kann zur Profiländerung führen. Kopierte75 werden gezählt und vor/nach dem Lauf mit unveränderten User-/Profil-/Sourcehashes verglichen. Keine automatische Wiederveröffentlichung oder Cleanup.

Primär60: größtes tatsächlich eingefrorenes Audio237548 Bytes;2MiB HTTP-Grenze genügt. Audio-GET verwendet nun das echte Schüler-Token und bindet Hash/Bytes zusätzlich an das eingefrorene Audio-Bundle. HTTP erhält eine absolute IO-Frist. Synthetische Aufnahme bleibt ausdrücklich als solche markiert; kein Mikrofon-/Hörbewertungs-PASS.

Tests: Publication-Args/Response/CAS/Versionfehler, vier Whole-Proof-Negative, SQL-Präfix/Transaktionsgrenzen, TOTP-Referenzvektor, nur neuer Admin mit Password/MFA/User-Bindung und geschützter Profiländerung, unautorisierte Ausführung sowie RAM/Caps/Health/OOM-Negative. Python-Import/AST PASS. Native Adapter, tatsächlicher GoTrue-MFA-Ablauf, SQL-Schema und vollständiger Schülerflow bleiben offen. HumanReview=false, Kalibrierung pending; keine Release-Freigabe.

Private Artefakte0600 unter S5/epoch43-*; öffentlich keine IDs, Credentials oder Antwortschlüssel.

- `epoch43-driver-proposal.py` SHA256: `05f1af51869c57713c0a5cbb8bf1982e8109c282795e1166c910fcfcaed05028`
- `epoch43-execution-template-private.json` SHA256: `1dbcc18a55d320f5ac2244dff8bc1fa2eaf501ebc7044e5044e2d17c75501ecf`
- `epoch43-driver-tests.py` SHA256: `d298460b1b18cdb3899ba0d05258c9d1bfee9d6a7a37a1940d701941d0167072`
- `epoch43-tests-private.json` SHA256: `15f903e5a4f8424ff60eda1eb5787aa8d98d00ae07e4723319cb1d1f6d636711`
- Originale81 SHA256: `deb9e7efe0ce6bcb66ce5516e783623bfe14ab4b290b4a0e1c7e68bfb4336948`
