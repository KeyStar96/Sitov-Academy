# Sitov Academy — S3 Epoch33: gleichstufige Kernzuordnung

Ausgangs-HEAD `d0a5fecdda955747970bd25c69fd0a733a31df2a`, Branch `codex/sitov-night-s3-same-level-core-mapping`. Lease bis 2026-10-09 10:33:22.760252 UTC; letzte Minute SAVE, anschließend WAIT.

Alle 12 bestehenden privaten Definitionen mit 48 Kernen wurden gegen die 16 aktuellen Themen mit ihren kanonischen Stufen, Ankern und Zielen sowie den S2-Epoch21-Vorschlag geprüft. 40 Themenlisten geändert, alle 48 offenen Teilabdeckungen konkretisiert. Vier vorhandene stufenfremde Einträge entfernt: a11-05.words→zeit, a12-01.verbs/a12-02.verbs→trennbare-verben und a12-02.nominal→akkusativ.

## Endgültige Teilzuordnungen

Alle untenstehenden Suffixe haben das Präfix `sitov.topic.`. Eine Zuordnung bedeutet Teilabdeckung und verleiht weder Kompetenz noch Zugriff. Leere Felder bleiben ausdrücklich als Lücke dokumentiert.

| Definition | words | verbs | syntax | nominal |
|---|---|---|---|---|
| a11-01 | kennenlernen,tageszeit-a11 | kennenlernen,praesens-a11 | satzbau-a11 | nominativ,familie,akkusativ |
| a11-02 | essen-a11,wohnen-a11 | essen-a11,praesens-a11 | satzbau-a11 | akkusativ,nominativ |
| a11-03 | wohnen-a11 | praesens-a11,wohnen-a11 | satzbau-a11 | nominativ |
| a11-04 | kennenlernen | kennenlernen,praesens-a11 | satzbau-a11 | nominativ |
| a11-05 | tageszeit-a11 | praesens-a11,essen-a11 | satzbau-a11 | akkusativ,nominativ |
| a11-06 | wohnen-a11 | trennbare-verben,praesens-a11,wohnen-a11 | trennbare-verben,satzbau-a11 | nominativ,akkusativ |
| a11-07 | einkaufen-a11,essen-a11 | einkaufen-a11,praesens-a11 | satzbau-a11 | nominativ |
| a11-08 | familie | praesens-a11,kennenlernen | satzbau-a11 | familie,nominativ |
| a11-09 | tageszeit-a11 | trennbare-verben,praesens-a11 | trennbare-verben,satzbau-a11,tageszeit-a11 | offen |
| a11-10 | tageszeit-a11,wohnen-a11 | praesens-a11,essen-a11 | satzbau-a11 | nominativ,akkusativ |
| a12-01 | gesundheit-a12 | offen | zeit,ablauf-a12 | akkusativ-a12 |
| a12-02 | offen | offen | ablauf-a12 | akkusativ-a12 |

Drei Vorschläge bewusst enger gefasst: a11-09.words enthält keine abgefragte Trennbarkeit; a11-07.nominal prüft Dativ, Plural, Artikel/Subjekt, Bezug und Besitz, aber keinen Akkusativ; a12-01.words fragt keine Zeitpräposition/Dauer ab. Daher dort keine bloße Kontextzuordnung zu Trennbarkeit, Akkusativ bzw. Zeit. Die Entscheidungen stehen zusätzlich bei den betreffenden Kernen im Delta. A1.2-Arzt-/Kochverbformen erhalten keine Ersatzabdeckung durch müssen/dürfen oder A1.1-Verben. a11-09.nominal und a12-02.words bleiben ohne genaue gleichstufige Ziele. Alle übrigen nur teilweise abgedeckten Teilfertigkeiten sind in `pendingReasonDe` einzeln benannt.

## Provenienz und Unveränderlichkeit

Alle zwölf geänderten Reviews stehen ehrlich auf `author_checked_independent_review_pending`: Autor und prüfender Autor `sitov.agent.S3`, `humanReview=false`, `calibrationStatus=pending`. Frühere M-Reviews werden ausschließlich im Delta als historische Evidenz erhalten; keine neue M-Freigabe behauptet.

Das maschinenprüfbare `epoch33-same-level-mapping-delta.json` enthält für jeden Text jede alte/neue Kernzuordnung, alle alten/neuen Reviews, genaue alte/neue Definition-SHA256 sowie Mapping-Quelldatei-SHA und alte/neue Manifest-SHA. Rücknahme ausschließlich der dokumentierten Mapping-/Review-Felder rekonstruiert den kompletten vorigen Manifestinhalt und dessen exakte Dateibytes. Darauf folgen weiterhin alle bisherigen eingefrorenen Erst3/6/9/10–12-Hash-/Review-Prüfungen; keine historischen Hashes wurden neu baselinegesetzt.

Vorherige Manifest-Datei SHA256: `f357b40eb91d543958eba702553dcc0dfa4b7e0af44b964d91bcea1e09b5118e`.

Audiodatei mit 1152 Aliasen bleibt byteidentisch, SHA256: `73feb52404ba32f91dd42b9176df42ec66014ed63fa1c9c405232b9fb7604c7e`. Alle gesprochenen Prompts/Optionen, Fragmente, Quelltexte/-spannen, Begründungen, Schlüssel/Antworten, Frage-/Kern-/Text-/Unit-IDs, Sprachformen, Formulare und sonstigen Definitionfelder bleiben identisch. Die Rückrekonstruktion und direkte Aliasprojektion prüfen dies. Keine neuen Pools; weiterhin 12/60, 48 offen.

## Validator und ausgeführte Prüfungen

Der Offline-Validator liest nun das JSON-Literal der kanonischen Topic-Mapping-Konstante ohne Codeausführung, prüft eindeutige bekannte Stufen und Stufengleichheit der Topic-Anker/Ziele und verwendet eine explizite Topic→Stufe-Map. Ein bekannter Themenname der falschen Stufe führt zu `same-level topic mapping required`. Das rekonstruierte Original enthält exakt vier solche Fehler. Positive Tests akzeptieren den aktuellen Stand; Negativtests prüfen alle vier bekannten Fälle.

- `node --test scripts/sitov-pronunciation-pretests-authoring.test.mjs`: **40 Tests PASS**, 0 Fehler/Skips.
- `node scripts/sitov-pronunciation-pretests-authoring.mjs`: PASS, 12/60 private Drafts, 48 offen, 1152 Aliase, 89 inaktive Legacy-Einträge.
- `git diff --check`: PASS.

## Exakte spätere Versionsfolge / Übergabe

Alle zwölf Definitionsobjekte ändern sich durch Mappingmetadaten. Bei einem später von M autorisierten Import müssen dafür neue unveränderliche, von PostgreSQL aus `sha256(definition::text)` berechnete Testversionen entstehen; die JSON.stringify-SHA in diesem Handoff sind redaktionelle Transporthashes und behaupten keinen DB-Testversion-Hash. Neue unabhängige Prüfung und die erforderliche aktuelle Audio-/Publikations-Proof-Bindung müssen auf die neuen exakten Definitionen zeigen. Identischer gesprochener Text überträgt keinen alten Pass und keine frühere Definitionsfreigabe. Vorige Versuche, Bestehen, Aufnahmen, Fortschritt und History bleiben erhalten. Kompatibilitäts-/Passübertragung bleibt deaktiviert.

M übernimmt die unabhängige Prüfung und entscheidet separat über späteren Import/Version-/Proof-Bindung. Hier keine QA-, DB-, Import-, Audio-, Publikations-, SQL-, Runtime- oder M-Checkout-Operationen; kein fullTS/Build/Browser/native Lauf. Nur freigegebene Seed-Mapping-/Review-Metadaten, Offline-Validator/-Tests und diese Epoch33-Dokumente. Gesamtvorhaben **NOT_RELEASE_READY**.
