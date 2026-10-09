# S3 epoch49: drei konkrete Reparaturen an Pools37–39

Basis `e77b8d437c1378c49ee091afdcd93fb2505522b0`, Branch `codex/sitov-night-s3-pools37-39-quality`. M-Auftrag: `master/M-pools37-39-review-repair-request.json` in den privaten Orchestrierungsdaten. Die drei tatsächlichen Befunde sind korrigiert; unabhängige Freigabe weiterhin ausstehend.

- `sitov.pretest.a22-08.nominal.q1`: Der öffentliche Kontext sagt jetzt ausdrücklich, dass die Wohnung den Freunden gehört und das Ziel meines Weges ist. Damit wird ihre gegenüber der Ortslesart ihrer eindeutig. Richtige Antwort, Antwort-ID, Reihenfolge, Quellenstelle und Matrixeinheit bleiben erhalten; Prompt und Begründung sind präzisiert.
- `sitov.pretest.a22-07.syntax.q6`: Die Aufgabe verlangt die Wortfolge nach In Zukunft. Richtig: wiederhole ich Datum und Uhrzeit. Die Distraktoren setzen ich vor das finite Verb oder verschieben dieses ans Satzende. Die Aufgabe prüft jetzt tatsächliche Verbzweitstellung statt die Wortbedeutung von Datum/Uhrzeit. Assessment-Einheit, sechste Matrixeinheit, entsprechender Quellenbeleg und Mapping-Lückenbeschreibung sind passend aktualisiert.
- `sitov.pretest.a22-09.verbs.q6`: Die Aufgabe ergänzt Die Schule ___ Geräte zur Verfügung mit der Präsensform von stellen. Richtig stellt, Distraktoren stellen/stellst. Assessment-Einheit, sechste Matrixeinheit, Quellenbeleg und Mapping-Lückenbeschreibung entsprechen jetzt der finiten dritten Person Singular.

Die zwei ausdrücklich angeforderten richtigen Antworttexte ändern sich; sämtliche Frage-/Antwort-IDs, richtige Antwort-IDs, Reihenfolge, Äquivalenzschlüssel und Wiederholungsformen bleiben gleich. Drei volle Aufgaben, zwei volle Kompetenzkerne und drei Autorenreviews ändern sich; neun öffentliche Audio-Textaliaswerte ändern sich (drei Prompts, sechs Antworttexte). Die übrigen69 Aufgaben dieser drei Pools sind exakt erhalten. Die bisherigen36 Pools einschließlich der von M integrierten18 A1.1-Qualitätskorrekturen und41 Aliasänderungen bleiben gegenüber der zugewiesenen Basis exakt erhalten. Unverändert: Textkörper, Textversionen, Inventar, Coverage39/60,21offen,3744Aliase und89inaktiveLegacy-Einträge.

Der Delta-Nachweis enthält vollständige alte/neue Aufgaben, Kerne, Reviews und Aliase, Inhalts- und Bytehashes des gesamten alten/neuen Manifests sowie Audio-Textaliasmanifests und einen vollständigen aktuellen Audit aller72 Aufgaben der Pools37–39. Die Tests stellen zunächst exakt den zugewiesenen39-Pool-Stand mit M-quality18 wieder her; erst danach greifen die bestehenden quality18- und sämtliche älteren97-Nachweise. Kein Neusetzen historischer Hashes oder Entfernen bestehender Tests.

Bestätigte Prüfungen:

- `node --test scripts/sitov-pronunciation-pretests-authoring.test.mjs`:103/103 PASS, alle99 vorherigen Prüfungen erhalten.
- `node scripts/sitov-pronunciation-pretests-authoring.mjs`:PASS39/60,21pending,3744publicaudioaliases,89inactivelegacy.
- `./node_modules/.bin/jest __tests__/sitov-pretest-author.test.ts --runInBand`:7/7 PASS.
- `git diff --check`:PASS.

Vier neue Offline-Prüfungen sichern den vollständigen Delta-Rückweg/Bytebeweis, den tatsächlichen aktuellen39-Pool-Vertrag mit72 Auditbindungen und Quellenwortgrenzen, die drei konkreten öffentlichen Konstrukte sowie Fehlermutationen. Alle drei alten Aufgaben scheitern an den neuen Konstruktprüfungen. Mutationen ohne Zielangabe, mit falscher V2-/Präsenslösung, mit bloßer lexikalischer Umbenennung, alten Kernen oder alten hörbaren Textwerten werden zurückgewiesen.

Keine SQL-Migration oder Laufzeit-/App-Änderung. Rückweg: Commit nur für diese inaktiven Autorenkandidaten zurücknehmen; bestehende historische Projektionen bleiben als Nachweis im Delta. Neue Definitionen benötigen beim späteren privaten Import echte datenbankberechnete Versionen. Die redaktionellen JSON.stringify-Hashes sind keine JSONB-Testversionen. Frühere Audiobindungen der neun geänderten öffentlichen Texte dürfen nicht auf den neuen Stand übertragen werden.

Autor S3, unabhängiger M-Review ausstehend, humanReview=false, calibrationStatus=pending, publicationAuthorized=false. Audio nur Textkandidaten; keine Synthese, Wortzeitmarken, Storage-/DB-Importe, QA-Assets, Browser-/Native-Prüfung, Veröffentlichung, Deployment oder Reset. M besitzt die folgenden Review-/Audio-/Importgates. Nach Commit und atomarer Statussicherung WAIT ohne eigene Fortsetzung.

Aktuelle redaktionelle Definitionshashes:

- `cff8a034-8b6e-5258-affc-6958091ef60b`: `ab35bac23a75d2a497c92cac5b0afd32d6952bbab3849d7df96e798f150d8582`
- `4533b44b-4ec1-5147-8a69-3345d5df7933`: `99bafb9966d55591923f4e3c0cf8a01b6efd95a5db1790fc4d17bd1cb7e5d620`
- `4c550a8b-95b1-5a53-ac3c-b2ad48ea592d`: `a558b4fd59684c644315e443c5040bf528fdaf79cf07d34a5eaa37b5e8ff9fe9`

Delta-Datei SHA256: `f50e2c60729326b16041188d22eb5d92f6d42f2a575c8ca0ee98ea36f59b21d6`.
