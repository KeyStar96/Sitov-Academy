# Claude Opus 5.5 - Content Generation Prompt

**Kontext:**
Du handelst als didaktischer Experte für Deutsch als Zweitsprache (DaZ) und strukturierter Datenarchitekt.
Wir bauen für die "Sitov Academy" einen neuen Lernpfad. Die Zielgruppe sind Erwachsene, die Deutsch lernen. Die Oberflächensprachen sind Englisch, Russisch, Ukrainisch und Türkisch.

**Deine Aufgabe:**
Generiere den vollständigen JSON-Seed für den Lernpfad des Niveaus "A1.1".
Der JSON-Output muss exakt in das Datenbankschema passen, damit er als `supabase/seeds/path-a1.1.json` gespeichert und von unserem System importiert werden kann.

**Strukturvorgaben für das JSON:**
Das JSON soll ein Array von Pfaden (Lektionen 1 bis 7) sein. Jeder Pfad enthält Knoten (Übungen, Wiederholung, Test).
Jede Aufgabe (Exercise) braucht:
- `exercise_type`: (z.B. "multiple_choice", "fill_in_blank", "sentence_building")
- `content`: Ein JSON-Objekt mit der eigentlichen Aufgabe (Text, Lücken, Antwortmöglichkeiten).
- `accepted_answers`: Ein Array mit den korrekten Antworten.
- `translations`: Ein Objekt mit Übersetzungen der Aufgabenstellung und Erklärungen in `en`, `ru`, `uk`, `tr`.
- `hint` & `explanation`: Didaktische Hilfestellungen.

**Pädagogische Regeln:**
1. **Keine Lehrbuchinhalte:** Erfinde komplett eigene Sätze, Namen und Situationen. Kopiere nichts aus bestehenden Büchern!
2. **Klarheit:** Sätze müssen für Erwachsene im Alltag relevant sein (Arbeit, Einkaufen, Arzt, Nachbarschaft).
3. **Erklärungen:** Jede Aufgabe bekommt eine "Merkkarte" (eine kurze Grammatikregel) als Erklärung.

---

## ANHANG A — LERNZIELKATALOG A1.1 (in eigenen Worten)

Nur Lernziele, keine Buchtexte (R14). Jede Zeile ist ein prüfbares Lernziel und bekommt im Seed eine Kennung (zum Beispiel `P1-G2` für Pfad 1, Grammatik, Ziel 2).

### Pfad 1 — Kennenlernen
* **Grammatik**
  * G1 Aussagesatz: Das Verb steht auf Position 2.
  * G2 W-Fragen mit wer, wie, woher, was; das Verb steht auf Position 2.
  * G3 Präsens von kommen, heißen, sprechen und sein für ich, du und Sie: Endungen -e, -st, -en; Besonderheiten „du heißt“ und „du sprichst“; sein: bin, bist, sind.
  * G4 „Ich heiße …“ und „Mein Name ist …“ ohne Frau oder Herr vor dem eigenen Namen.
* **Kommunikation**
  * K1 Begrüßen passend zur Tageszeit (Morgen, Tag, Abend), auch förmlich am Telefon mit Firmenname; willkommen heißen; „Freut mich“.
  * K2 Verabschieden: Auf Wiedersehen, Tschüs, Gute Nacht, am Telefon „Auf Wiederhören“.
  * K3 Nach dem Namen fragen und ihn nennen, jemanden vorstellen („Das ist …“).
  * K4 Buchstabieren und um Buchstabieren bitten.
  * K5 Herkunft erfragen und nennen, auch Länder mit Artikel („aus der Türkei“).
  * K6 Sprachen erfragen und nennen, mit „ein bisschen“ und „nur ein bisschen“ als Antwort auf ein Lob.
  * K7 Sich entschuldigen, bitten und danken.
  * K8 Gesprächsstrategien: zustimmen, nachfragen („Wie bitte?“), um Zeit bitten, Nichtwissen sagen, Interesse zeigen.
  * K9 Sie oder du: wann was passt.
  * K10 Am Telefon nach einer Person fragen.
* **Kann-Ziele:** Visitenkarte lesen, Anmeldeformular ausfüllen (Name, Land, Stadt, Sprache).
* **Wortschatz:** fünf Länder, fünf Sprachen, das Alphabet.

### Pfad 2 — Familie und Angaben zur Person
* **Grammatik**
  * G1 Possessivartikel mein/meine, dein/deine, Ihr/Ihre im Nominativ (maskulin, neutral, feminin, Plural).
  * G2 Vollständiges Präsens aller Personen von regelmäßigen Verben (leben, wohnen, lernen, kommen) sowie heißen, sprechen, sein und haben.
* **Kommunikation**
  * K1 Nach dem Befinden fragen (förmlich und informell) und mit einer Abstufung antworten, Gegenfrage „Und Ihnen/dir?“.
  * K2 Andere vorstellen: „Das ist/sind …“, Herkunft und Wohnort in der 3. Person.
  * K3 Angaben zur Person: Geburtsort, Wohnort, Adresse (in + Stadt, in der + Straße), Telefonnummer.
  * K4 Familienstand, Kinder und deren Alter.
  * K5 Orte einordnen: „liegt in Nord-/Süddeutschland“, „Hauptstadt von“.
  * K6 Zahlen 0 bis 20.
  * K7 Strategien: „Na ja“, „Ach“, „Ja, genau“, „Nein, falsch“.
* **Kann-Ziele:** Formular mit Geburtsort, Wohnort, Telefonnummer und Familienstand ausfüllen; einfache Informationen über Personen verstehen.
* **Wortschatz:** Familie, Familienstand.

### Pfad 3 — Einkaufen
* **Grammatik**
  * G1 Ja-/Nein-Frage mit dem Verb auf Position 1, im Vergleich zur W-Frage.
  * G2 Unbestimmter Artikel ein/eine und Negativartikel kein/keine im Nominativ; Plural ohne Artikel bzw. mit „keine“.
  * G3 Pluralformen: mit Umlaut, -e, -er, -n, -s, ohne Endung.
  * G4 Konjugation von „möchte“.
* **Kommunikation**
  * K1 Nach einem Wort fragen („Wie heißt das auf Deutsch?“) und korrigieren („Das ist doch kein …“).
  * K2 Einkaufsgespräch: Hilfe anbieten, Wunsch äußern („Ich hätte gern …“, „Ich möchte …“), nach Ware fragen, Preis erfragen, „Sonst noch etwas?“ – „Das ist alles.“
  * K3 Mengenangaben: Gramm, Kilo, Pfund, Liter, Flasche, Packung, Becher, Dose.
  * K4 Preise lesen und sprechen („1,10 €“ = „ein Euro zehn“), Singular und Plural bei „kostet/kosten“.
  * K5 Strategien: „Ja, natürlich“, „Nein, tut mir leid“, „Ja, bitte“, „Nein, danke“.
* **Kann-Ziele:** Einkaufszettel schreiben, einfaches Rezept lesen.
* **Wortschatz:** acht Obst- und Gemüsesorten, fünf Mengenangaben.

### Pfad 4 — Wohnen
* **Grammatik**
  * G1 Bestimmter Artikel der/das/die, Plural die; Wörter immer mit Artikel lernen (Farbcode).
  * G2 Personalpronomen er/es/sie und Plural sie als Ersatz für Nomen.
  * G3 Verneinung mit „nicht“ und „kein“.
* **Kommunikation**
  * K1 Gefallen und Missfallen: „Wie gefällt dir/Ihnen …?“, „Wie gefallen …?“ mit Abstufung.
  * K2 Nach dem Ort fragen und antworten (hier, dort).
  * K3 Zimmer und Möbel beschreiben: Preis, Größe, Maße („60 mal 120 Zentimeter“), Farbe, Alter.
  * K4 Telefonat zu einer Kleinanzeige: Ist … noch da? Größe, Alter, Preis, Adresse, Termin („Sind Sie heute zu Hause?“).
  * K5 Strategien: Rückfrage mit „…, nicht?“, „…, oder?“, „…, richtig?“; „Sag mal“, „Schau mal“.
  * K6 Zahlen bis eine Million.
* **Kann-Ziele:** Wohnungsanzeigen mit Abkürzungen verstehen, die eigene Wohnung beschreiben.
* **Wortschatz:** fünf Zimmer, fünf Möbelstücke, Farben, Gegensatzpaare von Adjektiven.

### Pfad 5 — Tagesablauf
* **Grammatik**
  * G1 Trennbare Verben (aufstehen, aufräumen, einkaufen, anrufen, fernsehen, anfangen, abholen) mit Satzklammer, auch in der Ja-/Nein-Frage.
  * G2 Zeitangaben: am (Tag, Tageszeit), um (Uhrzeit), von … bis; Ausnahme „in der Nacht“.
  * G3 Konjugation von anfangen, arbeiten (e-Einschub wie bei finden und kosten), essen, fernsehen, schlafen.
  * G4 Verb auf Position 2 auch bei vorangestellter Zeitangabe (Inversion).
* **Kommunikation**
  * K1 Uhrzeit offiziell und umgangssprachlich: halb, Viertel vor/nach, kurz vor/nach, gleich.
  * K2 Öffnungszeiten erfragen und verstehen.
  * K3 Verabredung: „Hast du Zeit?“, zusagen („Das passt gut“), absagen („Da habe ich keine Zeit“).
  * K4 Vorlieben mit „gern“ und „nicht gern“.
  * K5 Strategien: „Stimmt“, „Ich glaube …“.
  * K6 Wochentage und Tageszeiten.
* **Kann-Ziele:** Über den eigenen Tag sprechen, Öffnungszeiten auf Schildern und in Ansagen verstehen, einen kurzen Lesetext verstehen.
* **Wortschatz:** fünf Alltagsaktivitäten, die Wochentage.

### Pfad 6 — Freizeit und Wetter
* **Grammatik**
  * G1 Akkusativ mit bestimmtem Artikel (den, das, die).
  * G2 Akkusativ mit unbestimmtem Artikel (einen, ein, eine, Plural ohne Artikel).
  * G3 Akkusativ mit Negativartikel (keinen, kein, keine).
  * G4 Antworten auf Ja-/Nein-Fragen mit ja, nein und doch (auch auf verneinte Fragen).
  * G5 Vokalwechsel bei lesen, treffen, nehmen, fahren (Wiederholung: fernsehen, essen, sprechen, schlafen, anfangen).
* **Kommunikation**
  * K1 Hobbys nennen und bewerten („Das macht Spaß“, „Ich finde … toll“).
  * K2 Lieblings…: Buch, Film, Musik, Spiel.
  * K3 Wetter beschreiben: Sonne, Regen, Schnee, Wind, Wolken, Temperatur in Grad; Lieblingswetter; „mag ich gar nicht“.
  * K4 Am Imbiss bestellen.
  * K5 Zustimmen und verneinen.
  * K6 Strategien: „Guck mal“, „Na klar“, „Na gut“, „Kein Problem“, „Moment mal“.
* **Kann-Ziele:** Wetterbericht verstehen, kurze Personenporträts und Interviews über Hobbys verstehen.
* **Wortschatz:** fünf Hobbys, sieben Wetterwörter.

### Pfad 7 — Können, Wollen, Vergangenheit
* **Grammatik**
  * G1 Modalverben können und wollen, ich und er/sie/es ohne Endung.
  * G2 Satzklammer mit Modalverb: Modalverb auf Position 2, Infinitiv am Ende.
  * G3 Perfekt mit haben: ge…t (auch gearbeitet) und ge…en mit Vokalwechsel (getroffen, getrunken, gesprochen, geschrieben).
  * G4 Perfekt mit sein bei Bewegung (gegangen, gefahren, gekommen).
  * G5 Satzklammer im Perfekt, auch in der Frage.
* **Kommunikation**
  * K1 Starken Wunsch äußern („Ich will …“).
  * K2 Vorschlagen („Wollen wir …?“) und reagieren.
  * K3 Fähigkeit mit Abstufung (sehr gut, ein bisschen, nicht so gut, gar nicht).
  * K4 Sich oder das eigene Kind entschuldigen (krank, kann nicht kommen) und darauf reagieren („Gute Besserung“, „Ich sage es der Lehrerin“).
  * K5 Strategien: „Ja, super!“, „Nein, nicht so gern“, „Schade!“.
  * K6 Über gestern, früher und das Wochenende sprechen.
* **Kann-Ziele:** Eine Entschuldigung für den Deutschkurs formulieren, von vergangenen Tätigkeiten erzählen.
* **Wortschatz:** fünf Wörter zum Thema Schule, fünf Aktivitäten im Deutschkurs, fünf Freizeitaktivitäten.

**Output:**
Liefere mir bitte ausschließlich das wohlgeformte JSON-Dokument zurück. Wenn das JSON zu groß für eine einzelne Nachricht wird, generiere zuerst Pfad 1 bis 3, und biete mir an, den Rest im nächsten Schritt zu generieren.
