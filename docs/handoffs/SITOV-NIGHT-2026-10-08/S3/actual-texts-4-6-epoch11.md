# S3 · Tatsächliche Texte 4–6 · Epoche 11

Privater Autorenentwurf für Sitov Academy. Nur die drei zugewiesenen A1.1-Texte wurden ergänzt. Die gespeicherten Quelltexte, Text-IDs, vorhandenen Antworten, Fortschritte und ersten drei Definitionen einschließlich Review-Metadaten bleiben unverändert. Kein SQL-, Action-, UI- oder Typen-Patch; keine Synthese, Datenbank-/Storage-Imports, Aktivierung oder Veröffentlichung.

| Text | Text-ID | Quelltext-SHA256 | Offline-Definitions-SHA256 |
| --- | --- | --- | --- |
| Ein neuer Nachbar | b73f6228-c6c7-591b-ac83-2bae82a3b163 | a0c4ecb232d0c84138f9c7339c8d73303f8d61b091f9d35577376bf813be5c61 | 792f3b15527ce1ec040e15afe9102fe5d345c4446ef045b777561b09b76f0bad |
| Am Samstag im Park | fd1297a1-999f-5759-b0d9-1f77c381d114 | 3cb341c9b76f3f4d4e6a48ace30270051b1f4c990c8ab16a4feaba09c49f9e01 | 724bb3995b93816e94ef2e7020425350323477e4568083299774bba61b99af1f |
| Mein Zimmer | a218b88e-9369-5472-b5fe-34c99d1ced76 | 05ab1affff92acc58f0ced58954e72fef04e482abf499d41c812d5f285f4fefc | b1113b6f37a2ab91f4eb037a57ec80c3c4cde8f0b7701c0c48cab933dcb8d2d0 |

Die Offline-Definitionshashes sind SHA256 von JSON.stringify(definition). Der verbindliche Datenbank-Testversionshash wird erst beim privaten Import über kanonisches JSONB::text berechnet; diese beiden Verfahren sind nicht austauschbar.

Jeder Text besitzt vier aus seiner tatsächlichen Quelle abgeleitete Kerne (Wortschatz, Verbformen, Syntax und nominale Formen), jeweils sechs Aufgaben mit unterschiedlichen Prüfgegenständen, drei Optionen mit genau einem privaten Schlüssel, exakten Codepoint-Belegen und privaten Begründungen einschließlich der Ablenkungsoptionen. Zwei disjunkte Formen mit zwölf Aufgaben enthalten jeweils drei Aufgaben pro Kern. Keine Form verwendet Fragen der anderen Form. Alle Figuren und personengebundenen Optionen entsprechen männlichen Lerncharakteren.

Die Unterschiede sind fachlich beabsichtigt:

- **Ein neuer Nachbar:** nachbarschaftliche Begegnung und Befinden; Präsens mit treffen/lächeln; W-Frage Wie geht es Ihnen; gegenseitiges uns, männliches Er und die tatsächlich vorkommenden Dativbezüge Ihnen/ihm. Indirekte Personenbezüge werden nicht als abwesend deklariert. Später wird als lexikalische Zeitangabe geprüft; produktive Adjektivvergleiche sind kein zusätzlicher Kern.
- **Am Samstag im Park:** Natur- und Parkwortschatz, die Bedeutungsunterscheidung Sitzbank/Geldinstitut; Singular/Plural und das gemeinsame Subjekt Freund und ich; getrennte Objekte Musik/Brot; Richtungsakkusativ in den Park gegenüber Ortsdativ auf einer Bank; echte Plurale und Positivform ein kleiner Hund. Kleiner ist hier keine Komparativform.
- **Mein Zimmer:** Möbel, Raumrichtung, Farbe und Vorliebe; reale stehen/liegen/lesen-Formen; Negation und Gegensatz nicht groß, aber schön; das getrennte Verb mache … an mit seiner Satzklammer; Ortsdativ auf dem Tisch, feminines Akkusativobjekt die Lampe und neue Wörter im Plural. Trennbare Verben werden ausdrücklich erfasst und nicht als abwesend deklariert.

Nicht vorkommende Modalverben, Vergangenheitsformen und Nebensätze erhalten textbezogene Begründungen. Themenzuordnungen verwenden ausschließlich bestehende IDs; unvollständige Lernzielabdeckung bleibt ausdrücklich gekennzeichnet und erteilt keine Lern-/Audio-Berechtigung.

Die neue Review-Stufe lautet author_checked_independent_review_pending. S3 ist Autor und hat keine unabhängige Prüfung des eigenen Materials behauptet. M muss nun alle 72 neuen Aufgaben, Belege, Optionen, Schlüssel, Eindeutigkeit und die Abdeckung der tatsächlichen Kerne unabhängig fachlich prüfen. humanReview=false und calibrationStatus=pending dokumentieren vorhandene Evidenz. Sie führen keine zusätzliche Pflicht menschlicher Freigabe ein. Die bisherigen ersten drei agentgeprüften Entwürfe und ihre Provenienz bleiben eingefroren.

Audio-Aliase enthalten ausschließlich öffentliche promptDe, nichtleere fragmentDe und options.textDe. Alle neuen fragmentDe sind null. Die ersten 288 Alias-IDs und UTF-8-Texte bleiben unverändert; 288 neue Aliase werden angehängt. Insgesamt: 576 Aliase, 486 unterschiedliche rohe Texte; der neue Teil enthält 263 unterschiedliche rohe Texte, einschließlich Wiederverwendung mit dem ersten Teil. Diese Zählungen sind keine vorberechneten Audio-/Cache- oder Importnachweise. M muss normalisierte gemeinsame Cache-Identitäten prüfen, vorhandene Assets wiederverwenden und fehlende Qwen-Aufnahmen mit Wortzeiten lokal vorberechnen, prüfen und importieren. Private Schlüssel, Kennungen, Belege und Begründungen sind keine Audiotexte.

Eingefrorene SHA256-Werte für die ersten drei Datensätze (JSON.stringify) und ersten 288 Alias-Paare:

- Definitionen samt Metadaten: 64ef9ff63db660b92316c30d41b47eced8d84855e9ae3b68d071759169f75f45
- Aliase: 9dbf9e8b9c3ec4b6858cfe41d7626ad145d8f57c5fef5f405fe95c6a3fa3caff

Validierung: 30 Offline-Tests, CLI-Autoren-/Aliasprüfung und git diff --check. Die Prüfungen erkennen falsche Quellen/Offsets, fehlende oder erfundene Kernfertigkeiten, doppelte/equivalente Aufgaben, fehlende Schlüssel/Begründungen, gemeinsame/unbalancierte Formen, falsche Review-Provenienz und fehlende/geänderte/zusätzliche/private Audio-Aliase. Gezielt geprüft werden die nötigen Ihnen/ihm-Bezüge, Richtungs-/Ortskasus und anmachen/Satzklammer. Keine neuen nativen DB-, HTTP-, Browser- oder realen Audiodatei-Nachweise werden aus diesem Inhaltsblock abgeleitet.

Abdeckung nach diesem Block: 6/60 private Entwürfe, 54 noch ohne Aufgabenpool; 89 inaktive Altdaten unverändert. Unabhängig agentgeprüft: erste3, neue3 ausstehend. Importiert/aktiviert/veröffentlicht:0. RELEASE_READY=false. Nach geprüftem eigenem Commit erfolgt HANDOFF/WAIT; weitere Texte brauchen einen neuen START.
