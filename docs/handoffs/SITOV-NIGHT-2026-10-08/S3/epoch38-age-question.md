# Sitov Academy — S3 Epoch38: Alters-/Wortstellungsfrage als neuer inaktiver Kandidat

Base `d66e876f6942bb4f5990df259db6758fad505855`, bestehender Branch `codex/sitov-night-s3-pretests19-24`. Lease bis 2026-10-09 13:52:57.703841 MESZ (Assignment:11:52:57.703841 UTC); letzte Minute SAVE, danach WAIT.

Änderung ausschließlich an `sitov.pretest.a11-01.syntax.q3` im ersten privaten Seed-Entwurf, zugehörigem Autorenreview und genau zwei öffentlichen Textaliaswerten. Die geänderte Definition ist ein Offline-Kandidat für einen später separat autorisierten neuen unveränderlichen DB-Testversionsimport; eine neue DB-Version wurde hier nicht erzeugt.

| Feld | Vorher | Aktueller Kandidat |
|---|---|---|
| Öffentlicher Prompt | Welcher Satz drückt ein Alter aus? | Welcher Satz nennt ein Alter in korrekter deutscher Wortstellung? |
| Distraktor `sitov.option.1` | Bin dreißig ich Jahre alt. | Ich lerne Deutsch. |
| Richtige Antwort | `sitov.option.2`: Ich bin dreißig Jahre alt. | unverändert |

Begründung passend aktualisiert: Nur der richtige Satz verbindet eine Altersangabe mit korrekter Wortstellung; Ich lerne Deutsch. nennt eine Tätigkeit, die dritte Antwort hat eine falsche Wortstellung. Alle Options-IDs und ihre Reihenfolge, Frage-/Kern-/Text-/Unit-IDs, korrekter Schlüssel/Antworttext, Matrixeinheiten, Quellen/Codepointspannen, Textversion, Mappings, Formen und sonstigen Aufgaben sind unverändert. Die anderen20 Pools sind vollständig identisch.21/60 Drafts,39 offen,2016 öffentliche Textaliase bleiben erhalten; davon ändern sich ausschließlich Prompt und sitov.option.1 dieser Frage, keine Alias-ID oder Reihenfolge.

Der zuvor exakte unabhängige M-Review ist im Delta vollständig mit Dokumentreferenz/SHA/Zeit erhalten. Der neue Kandidat steht ehrlich auf author_checked_independent_review_pending, Autor/Reviewer sitov.agent.S3, humanReview=false, calibrationStatus=pending; kein alter M-Beleg für die neue Definition übernommen oder neue M-Freigabe behauptet.

`epoch38-age-question-delta.json` enthält vollständige alte/neue Aufgabe, alte/neue Reviews, beide konkreten Aliaswerte und sämtliche alten/neuen Definition-/Manifest-/Alias-Inhalts- und Dateibytehashes. Der Test stellt zuerst alte Aufgabe und Review sowie die beiden alten Aliaswerte wieder her, bevor irgendeine21→18→15→12-Historienprojektion ausgeführt wird. So bleiben alle vorhandenen ursprünglichen Hashes und M-Proofs exakt gültig für ihre jeweiligen alten Zustände. Aktueller Kandidat und alle tatsächlichen21/2016 werden zusätzlich unmittelbar validiert.

Neue redaktionelle JSON.stringify-SHA256 der ersten Definition: `06fd9a4ab8474385583ef42b39a9bd884681a71c29e989dae6b8eb87633855dd`; vorher: `e33ea78f9f6e845cb9acfccac23d3c3adff57ce9306355d98bdf967247a9148f`. Dies sind redaktionelle Transporthashes, keine PostgreSQL-JSONB-Testversionbehauptungen.

Validierung: `node --test scripts/sitov-pronunciation-pretests-authoring.test.mjs` **61 PASS/0fail/0skip**; Authoring-CLI **PASS21/60,39pending,2016aliases,89inactivelegacy**; `git diff --check` PASS. Drei zusätzliche Tests prüfen klare aktuelle Frage/richtigen Schlüssel, exakte Beschränkung und20 unveränderte Pools, bytegenaue vorherige Manifest-/Aliasrekonstruktion, genau2Aliasänderungen und direkte aktuelle Validierung. Wiederverwendung des alten unabhängigen Reviews für die neue Definition scheitert; die alten Audio-Textaliaswerte liefern exakt zwei Konsistenzfehler. Die bisherigen58 Fälle/Negativguards bleiben erhalten.

Das von M gemeldete aktive QA-Asset mit Pfadpräfix97f01… und dessen alte Proof-/Attempt-/Historybindungen werden hier weder gelesen noch geändert. Keine aktive CAS, Überschreibung, Reparatur alter Bytes/Wordtimings oder Neuverknüpfung alter Versuche. Alte Antworten müssen weiterhin über ihre alte immutable Definition dargestellt und bewertet werden; gleiche IDs ersetzen keine Versionsbindung und übertragen keinen alten Pass.

M muss den exakten neuen Kandidaten unabhängig prüfen und anschließend separat über neue DB-Version, die beiden lokal männlich mit Qwen vorbereiteten Aliasaufnahmen/positiven Wortzeitmarken, Import sowie exakte aktuelle Audio-/Publikations-Proof-Bindung entscheiden. Die Offline-Prüfung bestätigt Text-/Strukturkonsistenz, keine tatsächliche Audioqualität, positiven Zeitintervalle oder Storagebereitschaft.

Keine QA-, SQL-, Runtime-, Browser-/native-, TTS-, Audioasset-, Import-, UI-, Schema- oder Publikationsoperation; keine neuen Pools und kein fullTS/Build/fullJest. Produktionsvalidator, frühere Audit-/Reviewdateien und M-Checkout unangetastet. Freigabe bleibt blockiert, Gesamt **NOT_RELEASE_READY**. Nach Commit/atomarem WAIT/Handoff keine Fortsetzung ohne neue Lease.
