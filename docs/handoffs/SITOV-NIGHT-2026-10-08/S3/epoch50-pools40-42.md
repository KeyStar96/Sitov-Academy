# S3 epoch50: kanonische Pools40–42

Basis `2023b1277e9e0c1a798e4810d46998fabe4d38d8`, Branch `codex/sitov-night-s3-pools40-42`. Drei vollständige inaktive Autorenpools mit72 neuen Fragen und288 neuen öffentlichen Audio-Textaliasen. Stand42/60,18offen,4032Aliase,89inaktiveLegacy-Texte.

Die tatsächlichen kanonischen Quellen sind A2.2sort10 Ein Gespräch mit dem Lehrer, B1.1sort1 Ein neuer Beruf als Chance und B1.1sort2 Nachhaltiger einkaufen. Der Audit enthält alle drei vollständigen Textkörper, exakte Quellversionen, zwölf vollständige Kompetenzkerne, Quellenbelege mit Wortgrenzen sowie sämtliche72 öffentlichen Prompts/Optionen, private Lösungsschlüssel, Begründungen und Matrixeinheiten. Referenz-Audio-Textkandidaten enthalten unveränderte Quelltexte.

Jeder Pool hat vier Kerne mit je sechs unterschiedlichen Matrixeinheiten und zwei disjunkte12-Fragen-Formen mit je drei Aufgaben pro Kern. Richtige Antwortlabels und Positionen wurden separat mit OS crypto.randomInt erzeugt und ausgeglichen; zwölf unterschiedliche Zeitpläne pro Verteilungsart, jeweils alle drei Werte über die Frageindizes. Frage-/Antwortkennungen verwenden sitov.

Die Verbkerne prüfen tatsächliche finite Formen, Partizipien, Infinitive und trennbare Verbformen. Syntaxkerne prüfen Verbposition, Relativ-/indirekte Sätze, Modalverbklammern, Zeitfolge, Gründe und Gegensätze. Der Lehrertext enthält den echten Relativsatz in das er seine Aufgaben schreibt; dieser wird nicht als fehlend markiert. Die Berufswahl prüft unter anderem gearbeitet hatte und empfahl, der Einkauf musste gegenüber müsste und konzessive/kausale Beziehungen. Bewegungs-, Besitz- und Vergleichsaufgaben enthalten alle nötigen öffentlichen Prämissen. Die Frage zur Partizipbildung einladen enthält eine Lücke und nennt die Lösung nicht vorweg. Distraktoren bleiben im jeweiligen fachlichen Feld.

Themenzuordnungen bleiben mit konkreten Lücken pro Matrixeinheit leer. Der vorhandene B1.1-Berufseinstieg belegt einen beruflichen Kontext, aber keine vollständige exakte Abdeckung dieser sechs spezifischen Einheiten pro Kern; keine erfundenen oder stufenfremden Ziele und keine Selbstfreigabe des gesperrten Zieltextes über einen Link.

Die vorherigen39 Definitionen und aktuellen M-Reviews bleiben einschließlich quality18, epoch49-Dreierkorrektur und der3744 vorhandenen Aliaswerte exakt erhalten. Die Tests frieren diesen Zustand vor der M39-, epoch49-, quality18- und sämtlichen älteren Rekonstruktionen ein. Der Audit hält Inhalts- und Bytehashes des alten/neuen vollständigen Manifests und der Audio-Textaliasdatei. Alle104 bisherigen Prüfungen sind erhalten.

Bestätigte Prüfungen:

- `node --test scripts/sitov-pronunciation-pretests-authoring.test.mjs`:108/108 PASS.
- `node scripts/sitov-pronunciation-pretests-authoring.mjs`:PASS42/60,18pending,4032publicaudioaliases,89inactivelegacy.
- `./node_modules/.bin/jest __tests__/sitov-pretest-author.test.ts --runInBand`:7/7 PASS nach letzter Inhaltsänderung.
- `git diff --check`:PASS.

Vier neue Prüfungen kontrollieren tatsächliche42/4032 plus eingefrorene39/3744-Bytehashes, alle72 Auditbindungen/Quellenwortgrenzen/Kerne/Formen/Ausgleich, fachliche Formen und sichtbare Kontexte sowie negative Quellen-/Einheiten-/Form-/Niveau-/Audio-/Lösungsschlüssel-/Kontextmutationen. Die Validierung bewertet nicht automatisch die sprachdidaktische Güte; unabhängiger M-Review bleibt erforderlich.

Keine SQL-/Runtime-/App-Änderung. Keine QA-Assets, TTS, Wortzeitmarken, Storage-/DB-Importe, Browser-/Native-Beweise, Publikation, Deployment oder Reset. Inaktive Autorenkandidaten: reviewer/authorIdentity S3, humanReview=false, calibrationStatus=pending, publicationAuthorized=false. Die JSON.stringify-Definitionshashes sind redaktionelle Nachweise und keine zukünftigen DB-JSONB-Testversionen. M besitzt Review, vollständige lokale Qwen-Audiovorbereitung und Import-/Publikationsgates. Rückweg ist das Zurücknehmen dieses Kandidatencommits; veröffentlichte Fortschritte werden nicht berührt. Nach Commit und atomarer Sicherung WAIT.

Aktuelle Quellen und Hashes:

- Ein Gespräch mit dem Lehrer / `f6fed4f3-e48e-5cc0-91e6-270734c1e369` / Text `02f2a7e85c1679d0e465db37347d6ec2b84f6c45f166d5e60dd1407182bc0b32` / Definition `4801386e2b668d9c6f517965680ad2d8663aa38094e77249715f6380b87769b7`.
- Ein neuer Beruf als Chance / `19846618-a6c3-5001-84d5-06b21b99dff5` / Text `146c5dffad6893cf79a59f2eefc1fdd64950f184ad06785ecc10357885a8f78f` / Definition `64f4f35de68c436d8e68bebd67b8fcb1a7a00f9e94a314255ebda6c5b29c9660`.
- Nachhaltiger einkaufen / `b5bd057d-17ae-5fac-824a-a8a75fe827ed` / Text `d36d679af3ede7f9fda0bf326125838f6a1f9cbdda659233d08968b444e2b09b` / Definition `99745348f68281431416e8184857316abdfd6cee44c317d26ddff125186e3e23`.
