# Sitov Academy – S7 Inhaltsaudit, Epoch4

Quelle: `3511d252ab0e756d31d93f15bde09bc58262cdb1`. A2.2-Pools31–40, Manifestindices30:40.

**CHANGES_REQUIRED.** Alle10 vollständigen Quellen,240 Fragen/720 Optionen, private Schlüssel/Begründungen und40 Kernzuordnungen gelesen. 9 Befunde an7 Fragen und zwei verknüpften Lernankern; davon4 vor Veröffentlichung zu beheben. Kein nachgewiesen falscher Schlüssel; eine öffentliche Mehrdeutigkeit.

Die beiden wesentlichen Aufgabenbefunde: a22-03.verbs.q2 lässt neben sich auch uns zu, weil der Empfänger des Wunsches öffentlich offenbleibt. a22-07.verbs.q3 behauptet aus „fragte … nach meiner Telefonnummer“ das trennbare Verb nachfragen; die Quelle belegt fragen nach. Konkrete Reparaturen erhalten den Lesetext und die gespeicherten Kennungen.

Die übrigen fünf Aufgabenbefunde sind gezielte Qualitätsempfehlungen. Der tatsächliche verknüpfte Vorschlagsanker verwendet Mia und eine Freundin als fiktive Szenenpersonen. Grammatische feminine Paradigmen und die Tierbezeichnung Katze werden nicht als weibliche menschliche Lernfigur behandelt.

Quellenbindung: 10/10 TextVersion-Hashes, 10/10 SQL-/Revisionskörper und 10/10 Katalogkörper stimmen überein; 0 Spanauszüge weichen technisch ab. Ein positionsgetreuer Span bestätigt allein noch kein behauptetes Grammatikkonstrukt.

Mapping bleibt ehrlich partiell. Der genehmigte Katalogexport dient nur als ID-/Inhaltsevidenz; keine neue DB-Abfrage. Keine Audio-, Runtime-, QA-, menschliche Freigabe oder empirische Kalibrierung. Keine Produktquelle geändert.

## Konkrete Befunde

### sitov.audit.S7.e4.001 · P1 · sitov.pretest.a22-03.verbs.q2

„Die Nachbarn wünschten ___ eine Bank“ lässt sowohl sich (für die Nachbarn selbst) als auch uns (für die Sprechergruppe) zu. Wünschen erlaubt neben der reflexiven Verwendung einen anderen Dativempfänger. Die öffentliche Frage legt den Empfänger nicht fest; die private Begründung schließt uns nur wegen eines anderen Personenbezugs aus, obwohl genau dieser Bezug öffentlich offenbleibt.

Reparaturkriterium: Den reflexiven Rückbezug auf die Nachbarn in der öffentlichen Angabe ausdrücklich festlegen. Den beabsichtigten Schlüssel sich und alle IDs erhalten.

```json
{
  "promptDe": "Die Nachbarn wollten eine Bank für sich selbst. Welche Form ergänzt »Die Nachbarn wünschten ___ eine Bank«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Die öffentliche Angabe legt fest, dass die Nachbarn die Bank für sich selbst wünschen. Das rückbezügliche Dativpronomen zur dritten Person Plural lautet sich. Uns würde eine andere Empfängergruppe bezeichnen; mich ist hier kein Dativ."
}
```

### sitov.audit.S7.e4.002 · P1 · sitov.pretest.a22-07.verbs.q3

Die Quelle sagt „Der Mitarbeiter fragte noch einmal nach meiner Telefonnummer.“ Nach ist hier die Präposition der Ergänzung nach meiner Telefonnummer, keine abgetrennte Verbpartikel. Die Matrix behauptet nachfragen, und die Begründung behauptet eine Satzklammer fragte … nach. Nur der eigens verkürzte öffentliche Übungssatz belegt nachfragen; das tatsächlich gespeicherte Quellziel tut dies nicht.

Reparaturkriterium: Die Aufgabe auf fragen und seine reale Präpositionalergänzung beziehen; Quelle nicht umschreiben. Core-Einzelziel und private Begründung berichtigen. Antwort-/Aufgaben-IDs beibehalten.

```json
{
  "promptDe": "Welche Grundform gehört zu »Der Mitarbeiter fragte nach meiner Telefonnummer«?",
  "optionTextChanges": [
    {
      "optionId": "sitov.pretest.a22-07.verbs.q3.c",
      "old": "nachfragen",
      "new": "fragen"
    },
    {
      "optionId": "sitov.pretest.a22-07.verbs.q3.b",
      "old": "fragen",
      "new": "befragen"
    },
    {
      "optionId": "sitov.pretest.a22-07.verbs.q3.a",
      "old": "nachgefragt",
      "new": "gefragt"
    }
  ],
  "correctOptionId": "sitov.pretest.a22-07.verbs.q3.c (unverändert)",
  "assessmentUnit": "fragte Präteritum fragen mit nach + Dativ",
  "coreLanguageUnitIndex": 2,
  "coreLanguageUnit": "fragte Präteritum fragen mit nach + Dativ",
  "rationaleDe": "Fragte ist die Präteritumform von fragen. Nach meiner Telefonnummer ist die Präpositionalergänzung mit nach + Dativ; nach ist in diesem Quellsatz keine abgetrennte Verbpartikel. Befragen ist ein anderes Verb, gefragt ein Partizip."
}
```

### sitov.audit.S7.e4.003 · P2 · sitov.pretest.a22-02.syntax.q6

Die Frage fragt die schon vollständig sichtbare Monatsdauer ab; die richtige Option wiederholt „Einen Monat“. Eine Unterscheidung von Dauer, Beginn oder Bezugszeit wird nicht verlangt. Das deklariert zwar ehrlich eine Probezeit, liefert aber nur schwache Evidenz für den Syntaxkern.

Reparaturkriterium: Die gleiche reale für-Dauer gegen Beginn-/Zeitpunktlesarten kontrastieren.

```json
{
  "promptDe": "Was drückt »Wir probieren die Regelung zunächst für einen Monat aus« über die erste Probephase aus?",
  "options": [
    {
      "id": "sitov.pretest.a22-02.syntax.q6.c",
      "textDe": "Die erste Probephase dauert einen Monat."
    },
    {
      "id": "sitov.pretest.a22-02.syntax.q6.a",
      "textDe": "Die Probephase beginnt erst in einem Monat."
    },
    {
      "id": "sitov.pretest.a22-02.syntax.q6.b",
      "textDe": "Die Probephase begann vor einem Monat."
    }
  ],
  "correctOptionId": "unverändert",
  "rationaleDe": "Für einen Monat bezeichnet hier die Dauer der ersten Probephase. In einem Monat würde einen künftigen Beginn nennen; vor einem Monat einen vergangenen Zeitpunkt."
}
```

### sitov.audit.S7.e4.004 · P2 · sitov.pretest.a22-05.nominal.q4

Die Frage verlangt „als Vergleich zu neueren Wörtern“ eine Form von alt, nennt aber die zu prüfende Steigerungsstufe nicht ausdrücklich. Auch die natürliche Gegenüberstellung alte Wörter / neuere Wörter kann eine inhaltliche Vergleichsabsicht tragen. Die private Begründung setzt dagegen ausdrücklich Komparativ voraus. Dies ist eine Präzisierungsempfehlung, kein bewiesener falscher Schlüssel.

Reparaturkriterium: Die verlangte Komparativform öffentlich nennen, wie es andere Aufgaben dieses Pools bereits tun.

```json
{
  "promptDe": "Welche Komparativform von alt ergänzt »Ich wiederhole ___ Wörter«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Ältere ist die Komparativform von alt. Alte ist Positiv, älteste Superlativ."
}
```

### sitov.audit.S7.e4.005 · P2 · sitov.pretest.a22-05.words.q3

Die richtige Definition wiederholt inhaltlich zum abgefragten Inhalt. Das Wort mitteilt liefert zwar echte Bedeutung, der zusätzliche Wortstamm schafft aber einen vermeidbaren Zuordnungshinweis. Die falschen Optionen bleiben im passenden Sprachbereich; keine absurde Distraktorbehauptung.

Reparaturkriterium: Die richtige Bedeutung ohne Wiederholung des Zielwortstamms ausdrücken.

```json
{
  "optionId": "sitov.pretest.a22-05.words.q3.c",
  "old": "Darauf achten, was der Text inhaltlich mitteilt.",
  "new": "Darauf achten, welche Informationen und Aussagen der Text vermittelt.",
  "correctOptionId": "unverändert",
  "rationaleDe": "Inhalt betrifft die Informationen und Aussagen des Textes. Lautbildung gehört zur Aussprache, die Wortreihenfolge zur sprachlichen Form."
}
```

### sitov.audit.S7.e4.006 · P2 · sitov.pretest.a22-09.words.q3

Die falsche Option „Ein Kurs, der allein wegen seines Namens am Wochenende stattfinden muss“ ist unnötig metasprachlich und umständlich. Es genügt eine natürliche Konkurrenz der Tageszeiten.

Reparaturkriterium: Drei gleichartig formulierte Zeitdefinitionen verwenden.

```json
{
  "optionId": "sitov.pretest.a22-09.words.q3.b",
  "old": "Ein Kurs, der allein wegen seines Namens am Wochenende stattfinden muss.",
  "new": "Ein Kurs, dessen Unterricht nur am Nachmittag stattfindet.",
  "correctOptionId": "unverändert",
  "rationaleDe": "Abendkurs bezeichnet Unterricht am Abend. Früher Morgen und Nachmittag sind andere Tageszeiten."
}
```

### sitov.audit.S7.e4.007 · P2 · sitov.pretest.a22-09.words.q6

Für Geräte konkurrieren nur Lehrpersonen und Unterrichtszeitpunkte. Diese scheiden bereits durch die grobe Bedeutungsart aus. Die Aufgabe kann enger zwischen verwandten Begriffen technischer Ausstattung unterscheiden.

Reparaturkriterium: Falsche Definitionen im Bereich Computer-/Kursausstattung belassen und von physischen Geräten abgrenzen.

```json
{
  "optionTextChanges": [
    {
      "optionId": "sitov.pretest.a22-09.words.q6.c",
      "old": "Die Personen, die den Kurs unterrichten.",
      "new": "Die Programme, mit denen man an einem Computer arbeitet."
    },
    {
      "optionId": "sitov.pretest.a22-09.words.q6.a",
      "old": "Nur die Zeitpunkte, zu denen Unterricht stattfindet.",
      "new": "Die digitalen Dateien, die man für den Kurs herunterlädt."
    }
  ],
  "correctOptionId": "unverändert",
  "rationaleDe": "Computergeräte sind physische technische Gegenstände. Programme und digitale Dateien sind Inhalte oder Software, keine Geräte."
}
```

### sitov.audit.S7.e4.008 · P1 · P1-N6-E03

Der tatsächliche verknüpfte Lernanker verwendet eine weibliche fiktive Person im Vorschlagsszenario. Das Ziel ist Vorschläge formulieren; eine weibliche Lernfigur ist dafür grammatisch nicht erforderlich.

Reparaturkriterium: Fiktive Lernperson männlich gestalten; fachliches Vorschlagsziel und gespeicherte Kennungen erhalten. Paradigmen er/es/sie und sachlich notwendige grammatische Genderbeispiele bleiben korrekt.

```json
{
  "old": "Mia macht einen Vorschlag für den Abend.",
  "new": "Milan macht einen Vorschlag für den Abend.",
  "exerciseId": "unverändert",
  "correctAnswer": "unverändert"
}
```

### sitov.audit.S7.e4.009 · P1 · P1-N7-E01

Der tatsächliche verknüpfte Lernanker verwendet eine weibliche fiktive Person im Vorschlagsszenario. Das Ziel ist Vorschläge formulieren; eine weibliche Lernfigur ist dafür grammatisch nicht erforderlich.

Reparaturkriterium: Fiktive Lernperson männlich gestalten; fachliches Vorschlagsziel und gespeicherte Kennungen erhalten. Paradigmen er/es/sie und sachlich notwendige grammatische Genderbeispiele bleiben korrekt.

```json
{
  "old": "Du möchtest am Samstag mit einer Freundin ins Museum gehen. Wie machst du einen Vorschlag?",
  "new": "Du möchtest am Samstag mit einem Freund ins Museum gehen. Wie machst du einen Vorschlag?",
  "exerciseId": "unverändert",
  "correctAnswer": "unverändert"
}
```
