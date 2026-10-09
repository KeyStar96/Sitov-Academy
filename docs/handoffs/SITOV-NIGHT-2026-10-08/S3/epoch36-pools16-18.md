# Sitov Academy — S3 Epoch36: private A1.2-Pools16–18

Base `cdf479971e30d2320074dfd67f14fec870095a81`, Branch `codex/sitov-night-s3-pretests16-18`. Lease bis 2026-10-09 11:29:30.772946 UTC, letzte Minute SAVE; anschließend WAIT.

Die nächsten drei tatsächlichen kanonischen A1.2-Texte mit Sortierung6–8 wurden authored: Eine Wohnung besichtigen, Ein Ausflug mit dem Zug, In der Bibliothek. Je24 Fragen, vier tatsächlich vorhandene Kerne (Wortschatz, Verbformen, Syntax, Nominalformen), jeweils sechs unterschiedliche Matrixeinheiten und zwei disjunkte ausgewogene Formen mit je12 Fragen. Zeit-/Rollen-/Bezugfragen liefern ihre benötigte Prämisse öffentlich; »halb zehn« wird ausdrücklich unabhängig von morgens/abends als halbe Stunde vor zehn abgefragt. Fiktive Personen sind männlich; grammatisches Genus wird sachlich geprüft. Quellen, Codepointspannen und Textversionen bleiben exakt.

Kryptografische Zufallsquelle des Betriebssystems über secrets.SystemRandom von Beginn an: unabhängige ausgewogene Label-/Positionsfolgen und zufällige Optionsbijektionen/-permutationen. Je Sechserkern richtige Labels a/b/c jeweils zweimal und Position1/2/3 jeweils zweimal; zwölf unterschiedliche Label- und zwölf unterschiedliche Positionsfolgen; jede Frageindex-Spalte über die neuen Kerne enthält alle drei Labels/Positionen. Nur konkretes versiegeltes Autorenresultat, kein Seed und kein öffentliches Antwort-aus-ID-Verfahren gespeichert.

Alle neuen Definitionen inaktiv und ausschließlich `author_checked_independent_review_pending`, Autor/Reviewer sitov.agent.S3, humanReview=false, calibrationStatus=pending. Keine unabhängige M-Freigabe behauptet. `epoch36-pools16-18-author-review.json` liefert alle72 exakten Prompts/Optionen/privateKeys/richtigen Antworttexte/Begründungen/Matrixeinheiten/Quellspannen, die vollständigen tatsächlichen Quellkörper, Definitionhashes und präzise alte/neue Manifest-/Aliashashes plus alte Coverage/Inventarzeilen für Rückprojektion. `epoch36-reference-audio-candidates.json` liefert drei vollständige rohe Referenztext-Aliaskandidaten. Beides sind Autoren-/Textkandidaten, keine Tondateien, Alignment-, Import- oder Storage-Nachweise.

Die ursprünglichen15 Definitionen einschließlich sämtlicher aktueller M-Reviews sind identisch; die ersten1440 Aliasse behalten Reihenfolge und Bytewerte.288 neue öffentliche Prompt-/Optionsaliase angehängt:1728 insgesamt.18/60 private Entwürfe,42 offen;89 inaktive Legacy-Texte unverändert. Die Tests projizieren explizit exakt den vorherigen15er-Stand samt M-Proofs und1440er-Aliasprefix zurück, prüfen dessen komplette Byte-/Inhaltshashes und wenden erst danach sämtliche vorherigen35/34/33- und älteren Frozenprüfungen an. Kein historischer Hash neu baselinegesetzt. Gleichzeitig validieren sie die tatsächlichen18 Definitionen und1728 Aliasse direkt.

Nur20 kanonische Same-level-Themen: modalverben teilweise für tatsächlich müssen (Zug) und dürfen (Bibliothek), zeit teilweise für vier Wochen (Bibliothek), akkusativ-a12 teilweise für entsprechende Nominalformen. Konkreter Wortschatz, andere Verbformen, lokale Dative, Endungen und Referenzen bleiben ausdrücklich offen; keine erfundenen Ziele oder A1.1-Fallbacks.

Validierung: `node --test scripts/sitov-pronunciation-pretests-authoring.test.mjs` **53 PASS/0fail/0skip**; Authoring-CLI **PASS18/60,42pending,1728aliases,89inactivelegacy**; `git diff --check` PASS. Neue Tests prüfen echte Quellkörper/Hashes/Offsets/Ref-Kandidaten, Formen/Matrixeinheiten, Schlüssel und öffentlich nötigen Kontext, männliche Rollen, abwechslungsreiche balancierte Optionen, direkte Aliasparität sowie falsche Spannen, wiederholte Einheiten, geteilte Wiederholungsfragen, stufenfremde Mappings, fehlende Aliasse und all.a-Verteilung. Strukturprüfung ersetzt keine unabhängige didaktische M-Prüfung oder empirische Kalibrierung.

## Neue redaktionelle Definitionshashes

JSON.stringify-SHA256; PostgreSQL wird spätere immutable testVersion aus definition::text selbst berechnen:

- `5b3316e2-4a9f-5689-ba11-e5d0dc420f2b`: `b1be666d18cacc1a07c75240265b02181ba3eb1ad34b0ee789b2e89ca9dd1c35`.
- `00cedd4e-cf66-50ae-a181-e687d85a8379`: `805b898f2b4bf909efb384477861b1575907fc10e0592f4c0fb9208770302665`.
- `0022c931-279a-5050-ac2d-459c1e978cd1`: `142b23f43b7b2a0c43f6a2ce91d5de26558759783c7e48f74a1c68157cfe9fce`.

M prüft alle72 neuen Fragen/Keys/Begründungen und genaue Definitionen unabhängig. Eine spätere separat autorisierte lokale männliche Qwen-Vorbereitung einschließlich Wortzeitmarken, Import, exakter unveränderlicher Versions-/Audio-Proof-Bindung und Publikation bleibt ausstehend. Keine Übertragung alter Bestehensnachweise. Keine Produktion, QA, Browser/native, SQL, Runtime, Audioassets, TTS, Import oder Veröffentlichung; kein fullTS/Build/fullJest. Produktionsvalidator und __tests__/sitov-pretest-author.test.ts unberührt. Nur eigener Worktree/Allowlist. Bestehende Lernerdaten unverändert. Gesamtvorhaben **NOT_RELEASE_READY**.
