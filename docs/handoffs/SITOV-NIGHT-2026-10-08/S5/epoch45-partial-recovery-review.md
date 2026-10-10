# Sitov Academy · S5 Epoch45 · unabhängige Recovery-Prüfung

**42 Offline-Tests PASS.** Eigene private Proposalcopy; S3/M-Originale unverändert. Basis `689958473746927a23ce8fbe5309f152a7e6fc90`. Keine Credentials-Datei gelesen, keine SSH-/API-/DB-/Runtime-/Browser-/Modellaktion. Native Ausführung durch S5 ungeprüft.

P1 Recovery-Lücke: S3e82 akzeptiert initial nur genau1 aktives Receipt und lehnt spätere gültige Teilstände ab. Der Vorschlag verlangt `expectedInitialActivePrefixCount` als exakte Ganzzahl1..60 im zukünftigen M-Manifest, derzeit streng1 und executionAuthorized=false. Frische native Definitionen/Versionen/aktive Bool-Flags und Actor/Request/Payload-Receipts müssen exakt das Präfix bilden; frischer gepinnter Drain muss dieselbe Zahl bestätigen. Legacy-Journal bleibt Teilhistorie und ersetzt keine native Wahrheit.

Erstes Receipt: identischer Actor/Request und exakte Wiederholung. Nur weitere initial nativ bestätigte Präfixeinträge werden übersprungen; unerwartete neue aktive Einträge bleiben HOLD. Lost-ACK wird nativ gelesen und ohne blinden Retry abgebrochen; falsches Receipt bleibt HOLD. Neue Accounts/Faktoren/nativeWrites sind gesperrt, inklusive Enrollment-Queryvarianten und fremder Faktor-ID. Bereits begonnener Schülerflow führt vor weiterer Veröffentlichung zu HOLD.

M fand einen P1-Fehler in der ersten S5-Kopie: Semikolon-Statements lagen im optionalen Faktor-if, wodurch Nichtfaktor-Aufrufe None zurückgaben. Korrigiert durch eigene Zeilen nach dem if. Ein neuer positiver Test prüft die tatsächliche Override-Weiterleitung für Password/User/REST/Storage und gepinnte Faktor-Challenge/Verify mit gemocktem Base-HTTP. Der alte41-Test-Stand deckte diese Weiterleitung nicht ab und ist überholt.

Alle zwölf Originaldateipins stimmen, Original-M-Treiber und S3-Basis sind bytegleich.120 Queries aus tatsächlichen Eingaben durch den Read-only-Wrapper geprüft: größtes SQL29992 Bytes, mit Wrapper30154 Bytes, unter64KiB. Geerbt:15s statement/2s lock/4MB work_mem/15s idle,1MiB SQL-Ausgabe, absolute IO-Fristen, gepinnter1984MiB/exakt960MiB/2CPU/3×200/alle5OOMfalse-Guard und Ziel62580. RAM-HOLD bleibt verbindlich.

Whole-SQL bindet60 Definitionen/Approvals,5650 Belege, Quell-/Review-/Audiohashes und aktuelle117 Gates. Publication-Args/Responses entsprechen102/105. Vorhandene Actor-/Faktorbindung, Password-/TOTP-/GoTrue-User-Prüfung und kopierte75-Hash-Erhaltung bleiben erhalten. Geerbter Schülerflow als Mock geprüft: zero progress, VIP-CAS, eigener PASS, Prepared-Audio mit Schüler-Token, eigenes Upload-Ticket, Storage-Upload und Submission-UUID samt historischem Receipt nach Entzug. Source94 verwendet public.submissions.auth_user_id und create_submission(p_prompt_id,p_audio_path). Größte Primärdatei237548 Bytes unter2MiB.

Tests: Präfix1/2/60 und Bounds, Nichtpräfix-/Versions-/Actor-/Request-/Payloadfehler, Skip-/No-blind-replay, Lost-/Wrong-ACK, Creation-/Write-Denials, sieben Whole-Gates, begonnener Schülerflow, vollständiger Flow-Mock und sechs positive HTTP-Weiterleitungen. M meldet nativen Read-only-Preflight des unveränderten S3-Originals um12:48:30UTC als PASS; S5 hat ihn nicht nativ wiederholt. Neue Query/Präfixlogik und tatsächlicher Auth-/Studentflow bleiben nativ ungeprüft. HumanReview=false, calibration pending; keine Release-Freigabe.

Private Dateien0600; M muss Pfade/SHA stagen und eine frische explizite Freigabe samt frischen State-/Drain-/Journalpins verwenden. Keine realen IDs, Antworten oder Credentials im Commit.

- `epoch45-recovery-proposal.py` SHA256: `05ae7c4b2944a7fd6e4c55520b0affbb38f9b36ab6f9ecd4cc1df924fa130ef4`
- `epoch45-base-driver.py` SHA256: `01acdb0e1dd8d4ee0e3e293674ba22a1581a51325e099d077bb15088b15fc014`
- `epoch45-execution-template-private.json` SHA256: `731e0991476990c4a40acdcef20f2379e2c82631a0c0a5eb61feff55807353cc`
- `epoch45-recovery-tests.py` SHA256: `86c64c5799b9b51e31e22970b1be8d7da30206e6e9f79bcb5eb864c670e7f653`
- `epoch45-tests-private.json` SHA256: `7d8fab4f8b158906151f21614147d5472c12ef586bfc5bc833232a28a9f6f4e8`
- `epoch45-input-audit-private.json` SHA256: `b78021f230de8b6570ec3a2e47cef9f055c3dcd65b946d515fee885cca0466b0`
- Original S3e82: `79aef8b037bf6215a16386256309a5af77bae34919a87383b873015001de6949`
