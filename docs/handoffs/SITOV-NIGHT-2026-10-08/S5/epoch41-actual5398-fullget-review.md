# Sitov Academy · S5 Epoch41 · tatsächliche 5398 FULLGET-Belege

**PASS für die unabhängig offline geprüften Belegbindungen.** Basis `0b9c946815b97272790f85cd41e473ab893b0b85`. Keine neuen P0/P1-Abweichungen in diesen Belegen gefunden. Native PostgreSQL15-Kompilation/-Ausführung und Veröffentlichung bleiben ungeprüft; keine Release-Freigabe.

- 5398 unverändert aus der originalen JSONL geladene Zeilen: `actualFullGET is True` in jeder Zeile, 5398 eindeutige Pfade, 5398 eindeutige vollständige kanonische UUIDs, exakt vollständige erwartete Pfadmenge.
- Alle Body-SHA256/-größen stimmen mit Expected5398, dem eingefrorenen Review-Bundle und den beiden SHA-gepinnten Manifesten (5338+60) überein. Sämtliche lokalen Audiodateien wurden erneut gehasht: insgesamt 106701224 Bytes.
- Alle sieben verpflichtenden Runtime-Metadaten, sämtliche Wortzeitmarken und optionale `spokenAlignment` stimmen exakt überein. Beide Clock-Alignment-Belege bestehen. Zusätzlich stimmt die vollständige Metadatenmenge jeder Zeile mit der Upload-Whitelist aus den eingefrorenen Sidecars überein.
- Finalreport: complete=true, headOnly=false, real-full-GET, expected/verified/fullyValidated=5398, failed=0, uploaded=5398, reused=0, productionWrites=0. Report bindet den SHA256 der originalen Receipt-Datei. Ziel-DB/OID62580/Owner und nativeStageAfter passen; pretestDefinitions=0. Zeitfolge und Laufzeit sind konsistent.
- Die vier **im M-Bericht gespeicherten** Health-Belege zeigen jeweils 3×200, 960MiB/2CPU, kein OOM und mindestens 1984MiB verfügbaren RAM. Abschluss-Health stammt von 2026-10-10 11:17:59 UTC; S5 hat keinen neuen Live-Health-Aufruf vorgenommen.

19 gezielte Negativtests bestehen: false/missing/numeric FULLGET, doppelte oder fehlende Pfade/Zeilen, unerwarteter Pfad, ungültige/doppelte UUID, Bodyhash/-größendrift, Metadaten-/Zusatzfelddrift, fehlendes Spoken-Alignment/WordTimings, unvollständiger Finalreport, falscher Receipt-Hash/Zähler/Stage und fehlerhafter Health-Status. JSON wird zudem ohne doppelte Schlüssel oder nichtendliche Zahlen gelesen. Die Eingabehashes wurden vor und nach der Prüfung bestätigt.

## Aussagegrenze und Übergabe

S5 prüft M-gelieferte, SHA-gepinnte Originalbelege. Im M-Importer erzeugen Zeilen57–58 den Bodyhash und die Größe aus dem tatsächlichen authentifizierten GET sowie UUID/Metadaten aus der tatsächlichen Info-Antwort; Zeile61 bindet Receipt-SHA und Abschluss. S5 hat diese GETs nicht selbst wiederholt und keine tatsächliche CSV erzeugt. Kein Beleg wurde von S5 aus Sollwerten aufgefüllt. M übernimmt die Konvertierung der tatsächlichen JSONL und den nativen Probeprozess.

Der in Epoch40 nachgewiesene schwächere S3-Validator wird dadurch nicht geändert. Die vorliegenden Originalbelege bestehen den strengeren S5-Vertrag. SQL-Limits15s/lock2s/work_mem4MB, Default-ROLLBACK und tatsächliche native Gates bleiben für M maßgeblich. HumanReview/HumanListening/PublicationApproved bleiben false; Kalibrierung pending und keine Wahrnehmungsbewertung. Keine SSH-, DB-, API-, Browser-, Modell-, Import- oder Runtime-Aktion durch S5.

## Beleg-Pins

- `final-private.json`: `cef5a4183d628d4deb8c6081e548a64379cb86a7a8aae5055bd1961b0ebfd4a0`
- `actual-full-GET-receipts-private.jsonl`: `83a813c843decd9c64f923086187a7cf407f8ef627cd1af7e2fb71f6866e87d8`
- `epoch80-expected5398.csv`: `a68640a21c08c48575a3d2b90ab5f39634c43cca6c37daf8f04d0a9940bc9ead`
- `epoch40-offline-evidence-private.json`: `ed6f285fe623ff3dd982c20e97b7b1afcf61f938193ae908f7a7b9983eed49cd`
- `epoch41-offline-proof-private.json`: `563aea36c7b2b5d08ae2f49f0a3cae6ab6be3cef53de6fb153307850852c32fa`
- `epoch41-receipt-audit.py`: `0fe7504715142a5a55dd695a061883e6043f4580cb310a9aab222ec407aa44f2`
- M-Importerquelle: `a038bfb07347415985fc21380cad1722c29b80ac440301cdeb3993b84b5651ad`

Private Originaldaten, UUIDs, Texte, Metadaten und Einzelbelege bleiben außerhalb des Commits. S5-Artefakte0600, übergeordnetes Verzeichnis0700.
