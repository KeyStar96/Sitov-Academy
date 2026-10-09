# Sitov Academy – S4 Epoch29: abschließende Textvorschläge

Exakte Basis `977af1831184db379457f52c03cfc7a1c5970a68`. Fünf konkrete Taskdeltas; keine Produktanwendung.

{"finalPools": 12, "fullSourcesRead": 14, "grammarTasksRead": 216, "A12TasksRead": 2, "totalTasksSemanticallyRead": 218, "candidateTasks": 5, "aliasDeltas": 14, "correctAnswerTextDeltas": 2, "asrRowsRead": 109, "audioQA": false}

216 Grammatikaufgaben in Pools49–60 vollständig mit Prompt, drei Optionen, Schlüssel und Vollquellen gelesen. Keine weiteren nachgewiesenen erfundenen Verbformen und keine ___/…-Prompts in diesen216 Aufgaben.
Keine Inhaltskorrektur allein wegen dass/das, fiel/viel, Jahr/Ja oder Zahlenschreibweise.
b12-06.nominal.q5: bestimmten Uhrzeit passt korrekt nach ab einer. Keine Artikeldopplung; unverändert.
Einzelne echte Flexionsformen und Genitiv-/Dativgruppen mit ASR-Abweichung bleiben unverändert. Hörprüfung erforderlich; keine endlose Einzelwort-Neusynthese empfohlen.
Zusätzlich betroffene Wortschatz-/Quelltextzeilen werden ausschließlich anhand der ASR-Befunde zugeordnet; keine pauschale vollständige Wortschatzprüfung behauptet.
Die beiden A1.2-Kandidaten ändern ausdrücklich den richtigen Antwortwortlaut bei unveränderter Schlüssel-ID. Alle fünf ändern vorgeschlagene Unit/Equivalence samt Kernmatrix. Keine Behauptung unveränderter diagnostischer Äquivalenz oder Kalibrierung.
Kandidaten bestehen aus fünf taskbezogenen Deltas; keine alten Epoch28-Ganzdefinitionen enthalten. Alle Vorher-Werte stammen aus der exakten aktuellen Basis.

## Kandidaten

### Pool 16 · sitov.pretest.a12-06.syntax.q6

Welche Satzfolge ist richtig, wenn beide Tätigkeiten zu »möchten« gehören?

→ Welche Antwort nennt zwei Infinitive ohne zu, die gemeinsam von »Wir möchten« abhängen?

Vollständige falsche Modalverb-Sätze werden im größeren ASR teilweise in richtige Sätze normalisiert. Metasprachliches Wortformpaar verringert diesen Kontext; akustischer Erfolg bleibt unbewiesen.

- `sitov.pretest.a12-06.syntax.q6.b`: »Wir möchten noch eine Nacht darüber schläft und morgen anrufen.« → »schläft und anrufen«
- `sitov.pretest.a12-06.syntax.q6.c`: »Wir möchten noch eine Nacht darüber schlafen und morgen ruft an.« → »schlafen und ruft an«
- `sitov.pretest.a12-06.syntax.q6.a`: »Wir möchten noch eine Nacht darüber schlafen und morgen anrufen.« → »schlafen und anrufen« **richtiger Schlüssel**

Beide von möchten abhängigen Verbformen stehen hier im Infinitiv: schlafen und anrufen. Schläft und ruft an sind echte finite Formen, keine Infinitive.

Vollsatzurteil wird zur Auswahl eines Wortformpaares. Das primäre Lernziel bleibt die Koordination zweier Infinitive nach möchten; Satzbau im vollständigen Satz wird nicht mehr geprüft. Neue Unit und neuer Equivalence-Key vorgeschlagen.

Unit: »möchten mit zwei koordinierten Infinitiven« → »möchten: zwei koordinierte Infinitive anhand eines Wortformpaares«

Equivalence: `sitov:a12-06:syntax:6:editorial-v2` → `sitov:a12-06:syntax:6:editorial-v2:audio-safe-v1`

### Pool 17 · sitov.pretest.a12-07.syntax.q3

Welcher Satz ist richtig, wenn beide Tätigkeiten zu »müssen« gehören?

→ Welche Antwort nennt zwei Infinitive ohne zu, die gemeinsam von »Wir müssen« abhängen?

Der Distraktor mit packt wird vom größeren ASR als packen wiedergegeben. Wortformpaare ersetzen ganze ungrammatische Sätze; kein gesicherter Audiobefund.

- `sitov.pretest.a12-07.syntax.q3.c`: »Wir müssen früh aufstehen und die Taschen packen.« → »aufstehen und packen« **richtiger Schlüssel**
- `sitov.pretest.a12-07.syntax.q3.b`: »Wir müssen früh aufsteht und die Taschen packen.« → »aufsteht und packen«
- `sitov.pretest.a12-07.syntax.q3.a`: »Wir müssen früh aufstehen und die Taschen packt.« → »aufstehen und packt«

Müssen verlangt hier beide Infinitive: aufstehen und packen. Aufsteht und packt sind echte finite Formen und erfüllen die verlangte Infinitivform nicht.

Vollsatzurteil wird zur Auswahl eines Wortformpaares. Primäres Lernziel zwei koordinierte Infinitive nach müssen bleibt; vollständige Satzbauprüfung entfällt. Neue Unit und neuer Equivalence-Key vorgeschlagen.

Unit: »zwei Infinitive Modalverb« → »müssen: zwei koordinierte Infinitive anhand eines Wortformpaares«

Equivalence: `sitov:a12-07:syntax:3` → `sitov:a12-07:syntax:3:audio-safe-v1`

### Pool 55 · sitov.pretest.b12-05.syntax.q3

Welche Wortfolge setzt »Der Lehrer hört« als indirekten Satz fort?

→ Welche Wortfolge setzt »Der Lehrer hört« als indirekten Fragesatz mit was und dem Modalverb am Ende fort?

ASR normalisiert möchten nach ich zu möchte. Der neue Distraktor ist als Hauptsatzfolge grammatisch echt, passt aber nicht als indirekter was-Satz.

- `sitov.pretest.b12-05.syntax.q3.b`: »was ich eigentlich ausdrücken möchte« → »was ich eigentlich ausdrücken möchte« **richtiger Schlüssel**
- `sitov.pretest.b12-05.syntax.q3.c`: »was möchte ich eigentlich ausdrücken« → »was möchte ich eigentlich ausdrücken«
- `sitov.pretest.b12-05.syntax.q3.a`: »was ich eigentlich ausdrücken möchten« → »ich möchte eigentlich etwas ausdrücken«

Die indirekte was-Frage lautet was ich eigentlich ausdrücken möchte. Das finite Modalverb steht am Ende. Was möchte ich eigentlich ausdrücken ist eine direkte Frage; ich möchte eigentlich etwas ausdrücken ist eine Hauptsatzfolge.

Der Kongruenzfehler-Distraktor entfällt zugunsten einer echten Hauptsatzfolge. Primär bleibt indirekter was-Satz mit Modalverb am Ende; zusätzliche Singular-Kongruenzdiagnose entfällt. Unit und Equivalence-Key ändern sich ausdrücklich.

Unit: »was indirekter Inhalt Modalverbfinal« → »was-Satz: Modalverbfinalstellung statt Hauptsatzfolge«

Equivalence: `sitov:b12-05:syntax:3` → `sitov:b12-05:syntax:3:audio-safe-v1`

### Pool 55 · sitov.pretest.b12-05.syntax.q4

Welche Wortfolge folgt auf »Entscheidend ist, dass«?

→ Welche Wortfolge setzt »Entscheidend ist, dass« als Nebensatz mit dem finiten Verb am Ende fort?

ASR glättet bleibt zu bleibe. Die neue echte Hauptsatzfolge vermeidet den Personfehler, verletzt jedoch die verlangte Stellung im dass-Nebensatz.

- `sitov.pretest.b12-05.syntax.q4.b`: »bleibe ich selbst aktiv« → »bleibe ich selbst aktiv«
- `sitov.pretest.b12-05.syntax.q4.c`: »ich selbst aktiv bleibe« → »ich selbst aktiv bleibe« **richtiger Schlüssel**
- `sitov.pretest.b12-05.syntax.q4.a`: »ich selbst aktiv bleibt« → »ich bleibe selbst aktiv«

Nach dass lautet die passende Folge ich selbst aktiv bleibe. Das finite Verb steht am Ende. Ich bleibe selbst aktiv ist eine Hauptsatzfolge, bleibe ich selbst aktiv eine Folge mit Verb am Anfang.

Person-Kongruenz als Distraktormerkmal entfällt; getestet wird die Verbfinalstellung gegenüber echten Hauptsatzfolgen. Unit und Equivalence-Key ändern sich ausdrücklich.

Unit: »dass bleibe Verbfinal« → »dass-Satz: Verbfinalstellung statt Hauptsatzfolge«

Equivalence: `sitov:b12-05:syntax:4` → `sitov:b12-05:syntax:4:audio-safe-v1`

### Pool 57 · sitov.pretest.b12-07.syntax.q3

Es geht um Menschen, denen ich begegnen könnte. Welche Wortfolge ergänzt nach »Menschen« einen Relativsatz?

→ Es geht um Menschen, denen ich begegnen könnte. Welche Wortfolge ergänzt nach »Menschen« einen Relativsatz mit dem finiten Verb am Ende?

ASR normalisiert würden zu würde. Die neue Hauptsatzfolge ist grammatisch echt und passt nicht als verlangter Relativsatz nach Menschen.

- `sitov.pretest.b12-07.syntax.q3.b`: »denen ich sonst kaum begegnen würden« → »ich würde ihnen sonst kaum begegnen«
- `sitov.pretest.b12-07.syntax.q3.c`: »denen ich sonst kaum begegnen würde« → »denen ich sonst kaum begegnen würde« **richtiger Schlüssel**
- `sitov.pretest.b12-07.syntax.q3.a`: »denen würde ich sonst kaum begegnen« → »denen würde ich sonst kaum begegnen«

Der Relativsatz lautet denen ich sonst kaum begegnen würde. Denen ist Dativ Plural zu Menschen; würde steht am Ende. Ich würde ihnen sonst kaum begegnen ist eine Hauptsatzfolge; denen würde ich sonst kaum begegnen hat keine Verbfinalstellung.

Der Personfehler würden entfällt als Distraktor. Primär bleibt der denen-Relativsatz mit Modalverb am Ende, keine separate Kongruenzdiagnose. Unit und Equivalence-Key ändern sich ausdrücklich.

Unit: »denen Relativsatz Modalverbfinal« → »denen-Relativsatz: Modalverbfinalstellung statt Hauptsatzfolge«

Equivalence: `sitov:b12-07:syntax:3` → `sitov:b12-07:syntax:3:audio-safe-v1`

## Grenzen

109 ASR-Zeilen gelesen: 25 aus dem verifizierten M-Befund (24 im Endpool-Bereich, wehtun außerhalb), 37 für55–57, 31 für58–60,16 fürA12rest. Größerer ASR ist ein Diagnosehinweis, keine Hörprüfung. Korrekte Texte und harmlose homophone Orthografien werden nicht aus Erkennungstexten abgeleitet.

Alle Vollquellen, Quellspannen, aktuellen Vorher-Tasks, Kernmatrizen, historischen Draft-/Reviewmetadaten, Aliasdeltas und Ganzdefinitionshashes stehen in der JSON-Datei. Kandidaten sind unfreigegeben; neue Audio-/Definitionsbindung, echte Wortzeiten, unabhängige Redaktion und Kalibrierung bleiben ausstehend.
