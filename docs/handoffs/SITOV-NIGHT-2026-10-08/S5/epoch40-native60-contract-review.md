# Sitov Academy · S5 Epoch40 · unabhängige Offline-Prüfung

Basis: `478dfd503e2f0546ad41ed0c34d93111937035b8`. Kein SSH, DB-, API-, Browser- oder Runtime-Aufruf. Native PostgreSQL15-Kompilation und tatsächliche GET-Belege bleiben UNGETESTET. Keine Release-Freigabe.

## Ergebnis und notwendige Anpassungen

- **P1 – Ausführungslimits:** S3 `epoch80-batch01-native.sql:6` (ebenso Batch02/03) setzt 60 Sekunden; `work_mem` fehlt. Private S5-Kopien setzen 15s, `lock_timeout=2s`, `work_mem=4MB`. Alle bleiben bei ROLLBACK. Drei-Zeilen-Probe vorbereitet; auch sie prüft alle 5398 Assets. Ob dieser gesamte DO-Block unter 15s bleibt, muss M nativ messen; ein Timeout darf nicht durch Erhöhung umgangen werden.
- **P1 – Belegformat/Provenienz vor Ausführung schließen:** M schreibt echte GET-Belege als JSONL, S3 `epoch80-emitter.py:10,114` liest ein JSON-Array. SQL:12 benötigt CSV. M muss erst den vollständigen Importabschluss (5398, complete=true) und dessen Receipt-Dateihash binden, jede tatsächliche Zeile mit `actualFullGET is True`, vollständiger UUID, eindeutigen Pfaden, Bodyhash/-bytes und Metadaten validieren und verlustfrei nach CSV konvertieren. `validate_get` (Zeilen29–32) prüft UUID/Body/Metadaten, aber nicht das tatsächliche FULLGET-Flag oder Abschluss-Provenienz. Niemals erwartete Werte zum Auffüllen tatsächlicher Belege verwenden. Keine Belegdatei wurde von S5 erzeugt.
- SQL-Kopien verwenden relative Dateinamen. M muss sie samt SHA-geprüften CSVs in einem privaten Ausführungsordner verwenden; die tatsächliche `epoch40-actual-full-get.csv` fehlt absichtlich. Originale bleiben unverändert.

## Unabhängig verifiziert

60 eindeutige Definitionen, CSVs exakt gleich reviewed-native60; 60 Source-Version-/Ganzzeilenhashbindungen und History0, 60 auflösbare exakte Review-Dokumentpfade, neun Originaldokumente mit passenden SHA256, verschiedene Autor-/Revieweridentitäten, humanReview=false und calibrationStatus=pending. 5398 eindeutige gesprochene Texte; sämtliche erwarteten CSV-Metadaten/Bodyhashes/-größen stimmen mit dem Review-Bundle überein. Die zuvor direkt geprüften 60 Definition-Serialisierungen stimmen mit dem eingefrorenen Payload überein.

SQL:24–28 bindet vollständige native Objekt-UUID, tatsächliche Bodybelege, erwartete Metadaten als Teilmenge und vollständige aktuelle Metadaten gegen GET; optionale spokenAlignment-Werte bleiben exakt. Daher sind zusätzliche von M erlaubte Upload-Metadaten mit dem Teilmengenvertrag vereinbar, sofern die tatsächlichen GET-Metadaten vollständig erhalten bleiben.

SQL:31–39 sperrt die Quellzeile, prüft Ganzzeilenhash/Textversion und alle fünf Historybereiche vor Insert. SQL:43 setzt active=false; SQL:45–50 verwendet native public_audio_texts und PostgreSQL-jsonb-Wortzeitmarkenhashes. SQL:54–56 erzwingt Reference/PublicAudio/Staff-Gates. Source94:122–148, Source102:7–14 und Source117:59–70 sind dazu statisch konsistent; 117 bewahrt die übrigen Prüfungen und berücksichtigt Clock-Spoken-Alignment. Keine nachgewiesene PostgreSQL15-Syntaxstörung gefunden, aber ohne native Ausführung kein Compile-PASS.

Die 60 Originalreview-Bindungen sind Offline-Vertrauen: SQL selbst löst die neun Dateien nicht auf. M muss die SHA-Pins der geprüften Eingabe-CSVs und Originalreviews im Ausführungsmanifest erhalten. Keine aktive Veröffentlichung oder Staff-RPC wurde ausgeführt.

## Artefakte

Private Belege und Kopien: `S5/epoch40-offline-evidence-private.json`, `S5/epoch40-M-batch01-native.sql` bis `03`, `S5/epoch40-M-probe3-native.sql`, dazu Eingabe-CSVs. Modus0600, übergeordnetes S5-Verzeichnis0700. SHA256 aller Originale/Kopien steht im privaten Beleg.

Synthetischer Offline-Negativtest am isoliert geladenen Validator: ungültige UUID, Bodyhash und Engine-Metadaten werden abgewiesen; 5398 synthetische Zeilen mit actualFullGET=false werden trotzdem akzeptiert. Dieser Test belegt die Flag-Lücke, keine tatsächlichen GETs.

Geprüfte Original-SHA256:

- `epoch80-batch01-native.sql`: `19d71068aa730b55da790eef79e52d52db7eeee9fd3c89515456c185450343f0`
- `epoch80-batch02-native.sql`: `aa5ea2507c61475f8120d9d38e6049741f99f691ce878c3042b5dc27269d7769`
- `epoch80-batch03-native.sql`: `920943a780294da1a122b7f08acfee83609d92c6bc335b8f3787b7216ec5654d`
- `epoch80-emitter.py`: `578748448f4e4e0b56d75936880c9ff1f979ff5a87d33982253f8f44cd24add5`
- `epoch80-reviewed-native60-private.json`: `578fd3f0ecafa6f126d0c6451ac9a1c4624a138f91e17e323bc58a8777182880`
- `epoch80-expected5398.csv`: `a68640a21c08c48575a3d2b90ab5f39634c43cca6c37daf8f04d0a9940bc9ead`
