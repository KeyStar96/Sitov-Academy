# Sitov Academy – S7 Inhaltsaudit, Epoch5

Quelle `fd14abbe8568aff5f9e7c9d3aa5aa19b42d755da`; B1.1-Pools41–50, Manifestindices40:50.

**CHANGES_REQUIRED.** Alle10 vollständigen Quellen,240 Fragen/720 Optionen, Schlüssel/Begründungen und40 Kernmatrizen gelesen. 17 Befunde an13 Fragen plus Mapping und drei Gruppen zugehöriger Curriculumstellen. Kein nachgewiesen falscher Schlüssel; eine öffentliche Mehrdeutigkeit.

Kernbefunde: b11-01.nominal.q2 verrät die gesuchte Form eine schon in der Einleitung. b11-04.verbs.q3 lässt uns und euch zu, solange die reflexive Lesart nicht öffentlich verlangt wird. Zwei weitere Fragen können natürlich formuliert werden. Neun Infinitivfragen erhalten eine ausdrücklich nicht als Keyfehler behauptete Terminologieempfehlung: Grundform / Infinitiv ohne zu.

Das registrierte Berufsthema verweist auf den ersten Lesetext; die40Kerntopic-Verweise selbst sind leer. Für Bewerbung und Praktikum ist eine begrenzte Teilzuordnung belegbar. In zugehörigen Berufsankern stehen weibliche Szenenrollen; notwendige feminine Anredeübungen sind davon ausdrücklich ausgenommen. Kein bereits sichtbarer UI-Lernlink wird behauptet.

Alle10/10 TextVersion-Hashes, 10/10 SQL-/Revisionskörper und 10/10 freigegebene Katalogkörper stimmen überein. 0 technische Spanabweichungen; kein nachgewiesen falsch aus der Vollquelle abgeleitetes Verbkonstrukt.

Alle Reparaturen sind Vorschläge. Keine Produktquelle geändert; keine DB/API/QA/Audio-/Runtimeprüfung, menschliche Freigabe oder empirische Kalibrierung.

## Einzelbefunde

### sitov.audit.S7.e5.001 · P1 · sitov.pretest.b11-01.nominal.q2

Die Einleitung „Ich informiere mich über eine Ausbildung“ liefert schon genau die gesuchte Form eine samt derselben Wortgruppe über eine Ausbildung. Die anschließende Lücke lässt sich abschreiben, ohne die Präpositionalergänzung zu beherrschen.

Reparaturkriterium: Die Einleitung mit der fertigen Lösung entfernen. Verbvalenz und Singularangabe reichen als öffentliche Prämissen.

```json
{
  "promptDe": "Welche Form ergänzt »Ich informiere mich über ___ Ausbildung«, wenn genau eine gemeint ist?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Sich informieren über verlangt hier Akkusativ. Ausbildung ist feminin Singular; der unbestimmte Artikel lautet eine."
}
```

### sitov.audit.S7.e5.002 · P1 · sitov.pretest.b11-04.verbs.q3

„Wir setzten ___ zusammen“ erlaubt sowohl das reflexive uns (wir kamen zum Gespräch zusammen) als auch das transitive euch (wir setzten die angesprochenen Personen zusammen). Die öffentliche Frage verlangt nur eine Form; den reflexiven Gebrauch setzt erst die private Begründung voraus.

Reparaturkriterium: Den verlangten Rückbezug öffentlich als Reflexivform benennen. Keine Änderung des tatsächlichen Quellsatzes oder der Antwortkennungen.

```json
{
  "promptDe": "Welche Reflexivform ergänzt »Wir setzten ___ zusammen«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Gefragt ist das Reflexivpronomen zum Subjekt wir: uns. Euch wäre ein Objekt für andere angesprochene Personen und erfüllt die ausdrücklich verlangte reflexive Lesart nicht."
}
```

### sitov.audit.S7.e5.003 · P2 · sitov.pretest.b11-06.words.q4

„Was trifft man, wenn man Entscheidungen über Essen und Museumsbesuche trifft?“ wiederholt die Wendung und fragt formal nach ihrem schon genannten Objekt. Die Antwortoptionen beschreiben dagegen die Bedeutung des Entscheidens.

Reparaturkriterium: Direkt nach der Bedeutung der Wendung fragen.

```json
{
  "promptDe": "Was bedeutet »Entscheidungen über Essen und Museumsbesuche treffen«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Entscheidungen treffen bedeutet, zwischen Möglichkeiten zu wählen. Bloße Kenntnisnahme und Erinnerung sind andere Tätigkeiten."
}
```

### sitov.audit.S7.e5.004 · P2 · sitov.pretest.b11-08.words.q4

„Den Ablauf erst nach der Veranstaltung erinnern“ ist gegenüber der üblichen Formulierung mit an etwas zurückdenken wenig natürlich. Dies ist eine sprachliche Glättungsempfehlung; kein kategorisches Verbot sämtlicher transitiver Verwendungen von erinnern und kein Schlüsselfehler.

Reparaturkriterium: Die rückblickende Alternative in gewöhnlichem Deutsch ausdrücken.

```json
{
  "optionId": "sitov.pretest.b11-08.words.q4.c",
  "old": "Den Ablauf erst nach der Veranstaltung erinnern.",
  "new": "Erst nach der Veranstaltung an den Ablauf zurückdenken.",
  "correctOptionId": "unverändert",
  "rationaleDe": "Planung bedeutet, Aufgaben und Ablauf im Voraus vorzubereiten. Rückblickendes Nachdenken und Beginn ohne Absprache sind andere Handlungen."
}
```

### sitov.audit.S7.e5.005 · P2 · sitov.pretest.b11-01.verbs.q6

Gefragt wird nach dem Infinitiv, unter den Alternativen steht neben der Grundform vorbereiten auch vorzubereiten, ein gültiger Infinitiv mit zu. In üblicher Schulterminologie ist die Grundform gemeint; präziser ist die ausdrückliche Einschränkung ohne zu. Kein nachgewiesen falscher Schlüssel und keine pauschale Beanstandung der gültigen zu-Form.

Reparaturkriterium: Öffentlich Grundform beziehungsweise Infinitiv ohne zu verlangen; dieselbe Teilfertigkeit und alle Kennungen erhalten.

```json
{
  "promptDe": "Welche Grundform (Infinitiv ohne zu) gehört zu »Ich bereite meine Bewerbung vor«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Die verlangte Grundform ohne zu lautet vorbereiten. vorzubereiten ist der Infinitiv mit zu und deshalb nicht die hier ausdrücklich verlangte Form."
}
```

### sitov.audit.S7.e5.006 · P2 · sitov.pretest.b11-02.verbs.q3

Gefragt wird nach dem Infinitiv, unter den Alternativen steht neben der Grundform losgehen auch loszugehen, ein gültiger Infinitiv mit zu. In üblicher Schulterminologie ist die Grundform gemeint; präziser ist die ausdrückliche Einschränkung ohne zu. Kein nachgewiesen falscher Schlüssel und keine pauschale Beanstandung der gültigen zu-Form.

Reparaturkriterium: Öffentlich Grundform beziehungsweise Infinitiv ohne zu verlangen; dieselbe Teilfertigkeit und alle Kennungen erhalten.

```json
{
  "promptDe": "Welche Grundform (Infinitiv ohne zu) gehört zu »Bevor ich losgehe«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Die verlangte Grundform ohne zu lautet losgehen. loszugehen ist der Infinitiv mit zu und deshalb nicht die hier ausdrücklich verlangte Form."
}
```

### sitov.audit.S7.e5.007 · P2 · sitov.pretest.b11-03.verbs.q3

Gefragt wird nach dem Infinitiv, unter den Alternativen steht neben der Grundform vorschlagen auch vorzuschlagen, ein gültiger Infinitiv mit zu. In üblicher Schulterminologie ist die Grundform gemeint; präziser ist die ausdrückliche Einschränkung ohne zu. Kein nachgewiesen falscher Schlüssel und keine pauschale Beanstandung der gültigen zu-Form.

Reparaturkriterium: Öffentlich Grundform beziehungsweise Infinitiv ohne zu verlangen; dieselbe Teilfertigkeit und alle Kennungen erhalten.

```json
{
  "promptDe": "Welche Grundform (Infinitiv ohne zu) gehört zu »Mein Bruder schlug vor, einen Kurs zu besuchen«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Die verlangte Grundform ohne zu lautet vorschlagen. vorzuschlagen ist der Infinitiv mit zu und deshalb nicht die hier ausdrücklich verlangte Form."
}
```

### sitov.audit.S7.e5.008 · P2 · sitov.pretest.b11-05.verbs.q2

Gefragt wird nach dem Infinitiv, unter den Alternativen steht neben der Grundform weiterleiten auch weiterzuleiten, ein gültiger Infinitiv mit zu. In üblicher Schulterminologie ist die Grundform gemeint; präziser ist die ausdrückliche Einschränkung ohne zu. Kein nachgewiesen falscher Schlüssel und keine pauschale Beanstandung der gültigen zu-Form.

Reparaturkriterium: Öffentlich Grundform beziehungsweise Infinitiv ohne zu verlangen; dieselbe Teilfertigkeit und alle Kennungen erhalten.

```json
{
  "promptDe": "Welche Grundform (Infinitiv ohne zu) gehört zu »Bevor ich die Nachricht weiterleitete«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Die verlangte Grundform ohne zu lautet weiterleiten. weiterzuleiten ist der Infinitiv mit zu und deshalb nicht die hier ausdrücklich verlangte Form."
}
```

### sitov.audit.S7.e5.009 · P2 · sitov.pretest.b11-06.verbs.q5

Gefragt wird nach dem Infinitiv, unter den Alternativen steht neben der Grundform austauschen auch auszutauschen, ein gültiger Infinitiv mit zu. In üblicher Schulterminologie ist die Grundform gemeint; präziser ist die ausdrückliche Einschränkung ohne zu. Kein nachgewiesen falscher Schlüssel und keine pauschale Beanstandung der gültigen zu-Form.

Reparaturkriterium: Öffentlich Grundform beziehungsweise Infinitiv ohne zu verlangen; dieselbe Teilfertigkeit und alle Kennungen erhalten.

```json
{
  "promptDe": "Welche Grundform (Infinitiv ohne zu) gehört zu »Wir tauschten Tipps aus«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Die verlangte Grundform ohne zu lautet austauschen. auszutauschen ist der Infinitiv mit zu und deshalb nicht die hier ausdrücklich verlangte Form."
}
```

### sitov.audit.S7.e5.010 · P2 · sitov.pretest.b11-07.verbs.q5

Gefragt wird nach dem Infinitiv, unter den Alternativen steht neben der Grundform ausschalten auch auszuschalten, ein gültiger Infinitiv mit zu. In üblicher Schulterminologie ist die Grundform gemeint; präziser ist die ausdrückliche Einschränkung ohne zu. Kein nachgewiesen falscher Schlüssel und keine pauschale Beanstandung der gültigen zu-Form.

Reparaturkriterium: Öffentlich Grundform beziehungsweise Infinitiv ohne zu verlangen; dieselbe Teilfertigkeit und alle Kennungen erhalten.

```json
{
  "promptDe": "Welche Grundform (Infinitiv ohne zu) gehört zu »Ich schalte den Computer aus«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Die verlangte Grundform ohne zu lautet ausschalten. auszuschalten ist der Infinitiv mit zu und deshalb nicht die hier ausdrücklich verlangte Form."
}
```

### sitov.audit.S7.e5.011 · P2 · sitov.pretest.b11-08.verbs.q2

Gefragt wird nach dem Infinitiv, unter den Alternativen steht neben der Grundform vorbereiten auch vorzubereiten, ein gültiger Infinitiv mit zu. In üblicher Schulterminologie ist die Grundform gemeint; präziser ist die ausdrückliche Einschränkung ohne zu. Kein nachgewiesen falscher Schlüssel und keine pauschale Beanstandung der gültigen zu-Form.

Reparaturkriterium: Öffentlich Grundform beziehungsweise Infinitiv ohne zu verlangen; dieselbe Teilfertigkeit und alle Kennungen erhalten.

```json
{
  "promptDe": "Welche Grundform (Infinitiv ohne zu) gehört zu »Eine Gruppe bereitet Geschichten vor«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Die verlangte Grundform ohne zu lautet vorbereiten. vorzubereiten ist der Infinitiv mit zu und deshalb nicht die hier ausdrücklich verlangte Form."
}
```

### sitov.audit.S7.e5.012 · P2 · sitov.pretest.b11-09.verbs.q5

Gefragt wird nach dem Infinitiv, unter den Alternativen steht neben der Grundform aufschreiben auch aufzuschreiben, ein gültiger Infinitiv mit zu. In üblicher Schulterminologie ist die Grundform gemeint; präziser ist die ausdrückliche Einschränkung ohne zu. Kein nachgewiesen falscher Schlüssel und keine pauschale Beanstandung der gültigen zu-Form.

Reparaturkriterium: Öffentlich Grundform beziehungsweise Infinitiv ohne zu verlangen; dieselbe Teilfertigkeit und alle Kennungen erhalten.

```json
{
  "promptDe": "Welche Grundform (Infinitiv ohne zu) gehört zu »Ich schreibe mir ein Beispiel auf«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Die verlangte Grundform ohne zu lautet aufschreiben. aufzuschreiben ist der Infinitiv mit zu und deshalb nicht die hier ausdrücklich verlangte Form."
}
```

### sitov.audit.S7.e5.013 · P2 · sitov.pretest.b11-10.verbs.q3

Gefragt wird nach dem Infinitiv, unter den Alternativen steht neben der Grundform anbieten auch anzubieten, ein gültiger Infinitiv mit zu. In üblicher Schulterminologie ist die Grundform gemeint; präziser ist die ausdrückliche Einschränkung ohne zu. Kein nachgewiesen falscher Schlüssel und keine pauschale Beanstandung der gültigen zu-Form.

Reparaturkriterium: Öffentlich Grundform beziehungsweise Infinitiv ohne zu verlangen; dieselbe Teilfertigkeit und alle Kennungen erhalten.

```json
{
  "promptDe": "Welche Grundform (Infinitiv ohne zu) gehört zu »Ein Rentner bietet Hilfe an«?",
  "options": "unverändert",
  "correctOptionId": "unverändert",
  "rationaleDe": "Die verlangte Grundform ohne zu lautet anbieten. anzubieten ist der Infinitiv mit zu und deshalb nicht die hier ausdrücklich verlangte Form."
}
```

### sitov.audit.S7.e5.014 · P2 · sitov.pretest.b11-01.words

Alle vierzig Kernzuordnungen bleiben leer. Für Bewerbung und Praktikum im ersten Wortschatzkern sind in dem registrierten gleichstufigen Thema konkrete Anker vorhanden. Dies belegt nur eine begrenzte Teilzuordnung; weder die zwei Katalogkarten noch die Themenähnlichkeit decken die sechs Einzelziele vollständig ab.

Reparaturkriterium: M kann einen partiellen Lernverweis prüfen und die verbleibenden vier Einzelziele ausdrücklich offenhalten. Keine vollständige Kompetenzabdeckung behaupten.

```json
{
  "topicIds": [
    "sitov.topic.berufseinstieg-b11"
  ],
  "pendingReasonDe": "Teilbeleg für Bewerbung im Anker P5-N1 und Praktikum im Anker P5-N9-E07. Andere Einzelziele bleiben offen: Ausbildung berufliches Lernen, Beratung Unterstützung Entscheidung, Zweifel Unsicherheit, Unklarheiten Verständnislücken. Keine vollständige Kernabdeckung."
}
```

### sitov.audit.S7.e5.015 · P1 · /4/nodes/0

Das registrierte Thema verweist auf den auditierten ersten Lesetext. Seine zugehörigen Lernanker verwenden weibliche fiktive Szenenrollen, obwohl die jeweiligen Ziele Berufserfahrung, Freude, Berufsbezeichnung oder Begrüßung sind. Der Vortestkern selbst hat aktuell keinen Topic-Verweis; ein bereits sichtbarer UI-Lernlink wird nicht behauptet.

Reparaturkriterium: Szenenpersonen männlich gestalten und Kennungen erhalten. Synchron gespeicherte Antworttexte, accepted_answers, Übersetzungen und wiederholte Erklärungstexte mit derselben geänderten Rollenbeschreibung konsistent nachziehen. Grammatisch notwendige feminine Anrede-/Genderübungen unverändert fachlich korrekt lassen.

```json
{
  "exactFieldReplacements": [
    {
      "jsonPointer": "/4/nodes/0/exercises/2/content/question",
      "old": "Auf Frau Okafor kann man sich immer verlassen. Sie ist sehr …",
      "new": "Auf Herrn Okafor kann man sich immer verlassen. Er ist sehr …",
      "actualField": "Auf Frau Okafor kann man sich immer verlassen. Sie ist sehr …",
      "ref": "P5-N1-E03"
    },
    {
      "jsonPointer": "/4/nodes/0/exercises/4/content/question",
      "old": "Ich habe fünf Jahre als Köchin gearbeitet. Ich habe also schon viel …",
      "new": "Ich habe fünf Jahre als Koch gearbeitet. Ich habe also schon viel …",
      "actualField": "Ich habe fünf Jahre als Köchin gearbeitet. Ich habe also schon viel …",
      "ref": "P5-N1-E05"
    }
  ],
  "answerTextFollowup": "Bei P5-N9-E04 korrekte Option, correct_answer und accepted_answers von Frau Sommer auf Herr Sommer synchron ändern; die Auswahlposition und Exercise-ID bleiben erhalten. Bei P5-N9 nach Änderung Friseurin → Friseur auch die wiederholte zugehörige Erklärung aktualisieren. Andere Keys bleiben unverändert."
}
```

### sitov.audit.S7.e5.016 · P1 · /4/nodes/6

Das registrierte Thema verweist auf den auditierten ersten Lesetext. Seine zugehörigen Lernanker verwenden weibliche fiktive Szenenrollen, obwohl die jeweiligen Ziele Berufserfahrung, Freude, Berufsbezeichnung oder Begrüßung sind. Der Vortestkern selbst hat aktuell keinen Topic-Verweis; ein bereits sichtbarer UI-Lernlink wird nicht behauptet.

Reparaturkriterium: Szenenpersonen männlich gestalten und Kennungen erhalten. Synchron gespeicherte Antworttexte, accepted_answers, Übersetzungen und wiederholte Erklärungstexte mit derselben geänderten Rollenbeschreibung konsistent nachziehen. Grammatisch notwendige feminine Anrede-/Genderübungen unverändert fachlich korrekt lassen.

```json
{
  "exactFieldReplacements": [
    {
      "jsonPointer": "/4/nodes/6/exercises/4/content/question",
      "old": "Es macht mir …, anderen Menschen etwas zu erklären. Vielleicht werde ich Lehrerin.",
      "new": "Es macht mir …, anderen Menschen etwas zu erklären. Vielleicht werde ich Lehrer.",
      "actualField": "Es macht mir …, anderen Menschen etwas zu erklären. Vielleicht werde ich Lehrerin.",
      "ref": "P5-N7-E05"
    },
    {
      "jsonPointer": "/4/nodes/6/exercises/7/content/text_after",
      "old": " ist Pilotin. Davon habe ich schon als Kind geträumt.",
      "new": " ist Pilot. Davon habe ich schon als Kind geträumt.",
      "actualField": " ist Pilotin. Davon habe ich schon als Kind geträumt.",
      "ref": "P5-N7-E08"
    }
  ],
  "answerTextFollowup": "Bei P5-N9-E04 korrekte Option, correct_answer und accepted_answers von Frau Sommer auf Herr Sommer synchron ändern; die Auswahlposition und Exercise-ID bleiben erhalten. Bei P5-N9 nach Änderung Friseurin → Friseur auch die wiederholte zugehörige Erklärung aktualisieren. Andere Keys bleiben unverändert."
}
```

### sitov.audit.S7.e5.017 · P1 · /4/nodes/8

Das registrierte Thema verweist auf den auditierten ersten Lesetext. Seine zugehörigen Lernanker verwenden weibliche fiktive Szenenrollen, obwohl die jeweiligen Ziele Berufserfahrung, Freude, Berufsbezeichnung oder Begrüßung sind. Der Vortestkern selbst hat aktuell keinen Topic-Verweis; ein bereits sichtbarer UI-Lernlink wird nicht behauptet.

Reparaturkriterium: Szenenpersonen männlich gestalten und Kennungen erhalten. Synchron gespeicherte Antworttexte, accepted_answers, Übersetzungen und wiederholte Erklärungstexte mit derselben geänderten Rollenbeschreibung konsistent nachziehen. Grammatisch notwendige feminine Anrede-/Genderübungen unverändert fachlich korrekt lassen.

```json
{
  "exactFieldReplacements": [
    {
      "jsonPointer": "/4/nodes/8/merkkarte/rule",
      "old": "Ich habe eine Ausbildung als Friseurin gemacht.",
      "new": "Ich habe eine Ausbildung als Friseur gemacht.",
      "actualField": "Über die eigene Arbeit sprechen – auch im Vorstellungsgespräch: Ich bin Mechaniker von Beruf. Ich habe eine Ausbildung als Friseurin gemacht. Davor habe ich als Kellner in einem Hotel gearbeitet. Ich war im Verkauf / im Lager tätig. Dort war ich für die Bestellungen zuständig (zuständig für + Akkusativ). Ich beende gerade meinen Deutschkurs. Ich habe ein Praktikum bei einer Autofirma gemacht. Ich habe leider noch keine Berufserfahrung. Zu Beginn: Vielen Dank für die Einladung zum Gespräch.",
      "ref": "rule"
    },
    {
      "jsonPointer": "/4/nodes/8/exercises/2/content/question",
      "old": "Nach der Schule habe ich eine Ausbildung … Friseurin gemacht.",
      "new": "Nach der Schule habe ich eine Ausbildung … Friseur gemacht.",
      "actualField": "Nach der Schule habe ich eine Ausbildung … Friseurin gemacht.",
      "ref": "P5-N9-E03"
    },
    {
      "jsonPointer": "/4/nodes/8/exercises/3/content/question",
      "old": "Du kommst zum Vorstellungsgespräch und begrüßt die Chefin. Was sagst du?",
      "new": "Du kommst zum Vorstellungsgespräch und begrüßt den Chef. Was sagst du?",
      "actualField": "Du kommst zum Vorstellungsgespräch und begrüßt die Chefin. Was sagst du?",
      "ref": "P5-N9-E04"
    },
    {
      "jsonPointer": "/4/nodes/8/exercises/7/content/text_after",
      "old": "? – Ich bin Elektrikerin.",
      "new": "? – Ich bin Elektriker.",
      "actualField": "? – Ich bin Elektrikerin.",
      "ref": "P5-N9-E08"
    }
  ],
  "answerTextFollowup": "Bei P5-N9-E04 korrekte Option, correct_answer und accepted_answers von Frau Sommer auf Herr Sommer synchron ändern; die Auswahlposition und Exercise-ID bleiben erhalten. Bei P5-N9 nach Änderung Friseurin → Friseur auch die wiederholte zugehörige Erklärung aktualisieren. Andere Keys bleiben unverändert."
}
```
