# Sitov Academy – S4 Epoch 21 Qualitätsvorschläge

Exakte Basis: `751938cb537cce3ec1cf439ec070f81c2a16da68`. 18 Vorschläge, 16 S7-Blocker und zwei gleiche zusätzliche Fehler. Vollständige 72er Prüfliste folgt. **Nicht angewendet, M-Neuprüfung erforderlich; kein Human-, Audio-, Kalibrierungs- oder Produktionsnachweis.**

Epoch 20 blieb nach ENOBUFS ohne vollständigen Patch. Dieser Lauf nutzt einen zuvor privat gesicherten Generator und direktes historisches Git-Lesen ohne die alte Puffergrenze.

Einzige Änderung am Wortlaut einer richtigen Option: `a11-03.syntax.q1`, »Es benennt den gezeigten Raum.« → »Das ist der Raum für unseren Kurs.« Bedeutung als Vorschlag erhalten; ausdrücklich von M erneut zu prüfen.

IDs, Optionsreihenfolge, richtige Schlüssel, Cores, Assessment Units, Equivalence Keys, Formen, Quelltexte, Spannen und Mappings bleiben erhalten. Neue Übungssätze sind öffentliche Aufgabenprämissen und ersetzen keine Quelltexte. Historische Review-Belege bestätigen ausschließlich die vorherigen Definitionen.

## Änderungen

- `sitov.pretest.a11-01.words.q2` (sitov.audit.S7.e1.001): Herkunft, Wohnort und Reiseziel sind plausible Ortsbeziehungen; ein Personenname ist kein sinnvoller Ablenker.
- `sitov.pretest.a11-01.words.q4` (sitov.audit.S7.e1.002): Benachbarte Zahlwörter statt einer unmöglichen Uhrzeit oder Familiengröße.
- `sitov.pretest.a11-02.words.q1` (sitov.audit.S7.e1.003): Drei natürliche Mahlzeiten; nur die Morgenmahlzeit entspricht frühstücken.
- `sitov.pretest.a11-02.words.q2` (sitov.audit.S7.e1.004): Andere Zimmerfunktionen statt sachfremder Gegenstände.
- `sitov.pretest.a11-02.words.q3` (sitov.audit.S7.e1.005): Lebensmittel und Milchprodukte sind plausible Nachbarbegriffe; nur Käse passt zur richtigen Beschreibung.
- `sitov.pretest.a11-02.words.q4` (sitov.audit.S7.e1.006): Gefäß, Inhalt und Zutat statt Person oder Tageszeit.
- `sitov.pretest.a11-02.words.q5` (sitov.audit.S7.e1.007): Alter und Geschmack sind natürliche Eigenschaften von Brot.
- `sitov.pretest.a11-03.words.q1` (sitov.audit.S7.e1.008): Drei plausible Raumfunktionen.
- `sitov.pretest.a11-03.words.q2` (sitov.audit.S7.e1.009): Licht und Temperatur sind plausible unterschiedliche Raumeigenschaften.
- `sitov.pretest.a11-03.words.q3` (sitov.audit.S7.e1.010): Helligkeit und Größe sind benachbarte Raumeigenschaften.
- `sitov.pretest.a11-03.words.q5` (sitov.audit.S7.e1.011): Der öffentliche Übungssatz legt die Schultafel fest. Alle Antworten beschreiben plausible Dinge im Kursraum.
- `sitov.pretest.a11-03.words.q6` (sitov.audit.S7.e1.012): Heft, Stift und Tasche sind plausible Schulsachen.
- `sitov.pretest.a11-02.syntax.q2` (sitov.audit.S7.e1.024): Sprecher und angesprochene Person sind öffentlich benannt. Alle Akteursoptionen sind Personen; nur Paul ist mit ich gemeint.
- `sitov.pretest.a11-02.syntax.q6` (sitov.audit.S7.e1.025): Der öffentliche Kontext definiert wir. Jede falsche Antwort beschränkt genau eine der beiden Aussagen auf eine Person.
- `sitov.pretest.a11-03.syntax.q5` (sitov.audit.S7.e1.026): Zwei mögliche männliche Akteure im sichtbaren Übungskontext; der Lehrer ist das gemeinsame Subjekt beider Verben.
- `sitov.pretest.a11-03.syntax.q1` (sitov.audit.S7.e1.033): Konkrete einfache Aussage statt abstrakter Metasprache; Frage und Aufforderung sind eindeutige Alternativen. Richtiger Wortlaut benötigt M-Neuprüfung.
- `sitov.pretest.a11-01.syntax.q5` (zusätzlicher gleicher Fehler): Zusätzlicher gleicher Fehler: Buch als Getränk erlaubt Ausschluss ohne Satzverständnis. Beide neuen Objekte sind trinkbar; nur Tee gehört zu trinken.
- `sitov.pretest.a11-02.syntax.q5` (zusätzlicher gleicher Fehler): Zusätzlicher gleicher Fehler: Person und Tätigkeit als Essen erlauben Ausschluss. Beide neuen Objekte sind essbar; nur Apfel gehört zu isst.

## Definitionshashes

| Text | Vorher | Kandidat |
| --- | --- | --- |
| Guten Tag, das bin ich | `06fd9a4ab8474385583ef42b39a9bd884681a71c29e989dae6b8eb87633855dd` | `1c5591cbbf53d9489d19dbfa0178221e024a90177da3d0d679e6a5da4b3ce6d8` |
| Mein Frühstück | `138d693692a655c656ddec034e3ed08cdc04d338099e85a1758e7db87ddcfcc9` | `aee6ecd8bf159d092581f1ac4219f072fdfa8ad89614597fc6bf4cd8d24d3965` |
| Unser Kursraum | `4ed47739d1a31c885a2d5d015aa30c4ec7dc548e2fe3f91328001391741166c9` | `da37b30709dca3939e583745c8cd9b8f6884dd572f8c17c7ed61af931c6045bc` |

SHA256 of UTF-8 native JSON.stringify(full definition), preserving parsed key order; neither task-only hash nor PostgreSQL jsonb serialization.

## Vollständige Kandidaten-Prüfliste: 72 Fragen

### sitov.pretest.a11-01.words.q1

Was bedeutet »ich heiße Leon«?

- `sitov.option.1`: Mein Name ist Leon.
- `sitov.option.2`: Ich wohne bei Leon.
- `sitov.option.3`: Ich lerne mit Leon.

Schlüssel: `sitov.option.1` – Mein Name ist Leon.
Begründung: heißen nennt den Namen; wohnen bezeichnet den Wohnort, lernen eine Tätigkeit.

### sitov.pretest.a11-01.words.q2 – geändert

Was sagt »aus Polen kommen« aus?

- `sitov.option.1`: Polen ist der neue Wohnort.
- `sitov.option.2`: Polen ist das Ziel einer Reise.
- `sitov.option.3`: Polen ist das Herkunftsland.

Schlüssel: `sitov.option.3` – Polen ist das Herkunftsland.
Begründung: »Aus Polen kommen« nennt die Herkunft. Ein jetziger Wohnort oder das Ziel einer Reise ist etwas anderes.

### sitov.pretest.a11-01.words.q3

Was bedeutet »in Hannover wohnen«?

- `sitov.option.1`: Hannover verlassen.
- `sitov.option.2`: In Hannover leben.
- `sitov.option.3`: Nach Hannover fahren.

Schlüssel: `sitov.option.2` – In Hannover leben.
Begründung: wohnen bezeichnet den Ort des Lebens; fahren und verlassen beschreiben eine Ortsveränderung.

### sitov.pretest.a11-01.words.q4 – geändert

Was bedeutet »dreißig Jahre alt«?

- `sitov.option.1`: Das Alter ist 30 Jahre.
- `sitov.option.2`: Das Alter ist 13 Jahre.
- `sitov.option.3`: Das Alter ist 33 Jahre.

Schlüssel: `sitov.option.1` – Das Alter ist 30 Jahre.
Begründung: Dreißig bedeutet 30. Dreizehn bedeutet 13, dreiunddreißig bedeutet 33. Alle Antworten nennen ein mögliches Alter.

### sitov.pretest.a11-01.words.q5

Was bedeutet »zusammen lernen«?

- `sitov.option.1`: Allein lernen.
- `sitov.option.2`: Nicht mehr lernen.
- `sitov.option.3`: Gemeinsam lernen.

Schlüssel: `sitov.option.3` – Gemeinsam lernen.
Begründung: zusammen bedeutet gemeinsam; allein ist das Gegenteil, nicht mehr beschreibt ein Ende.

### sitov.pretest.a11-01.words.q6

Welcher Tagesabschnitt ist »der Abend«?

- `sitov.option.1`: Die Mittagszeit.
- `sitov.option.2`: Der spätere Teil des Tages.
- `sitov.option.3`: Der frühe Morgen.

Schlüssel: `sitov.option.2` – Der spätere Teil des Tages.
Begründung: Abend liegt nach dem Tag und vor der Nacht; Morgen und Mittag sind andere Tagesabschnitte.

### sitov.pretest.a11-01.verbs.q1

Welche Grundform gehört zu »heiße« in »Ich heiße Leon«?

- `sitov.option.1`: heißen
- `sitov.option.2`: heizen
- `sitov.option.3`: heiraten

Schlüssel: `sitov.option.1` – heißen
Begründung: heiße ist eine Form von heißen; heizen und heiraten sind andere Verben mit anderer Bedeutung.

### sitov.pretest.a11-01.verbs.q2

Ergänze: Ich ___ aus Polen.

- `sitov.option.1`: kommst
- `sitov.option.2`: kommt
- `sitov.option.3`: komme

Schlüssel: `sitov.option.3` – komme
Begründung: komme passt zu ich; kommst gehört zu du, kommt zu er oder ihr.

### sitov.pretest.a11-01.verbs.q3

Welches Wort ist das gebeugte Verb in »Ich wohne jetzt in Hannover«?

- `sitov.option.1`: wohne
- `sitov.option.2`: jetzt
- `sitov.option.3`: Hannover

Schlüssel: `sitov.option.1` – wohne
Begründung: wohne ist die an ich angepasste Verbform; jetzt ist eine Zeitangabe, Hannover ein Ortsname.

### sitov.pretest.a11-01.verbs.q4

Ergänze: Ich ___ dreißig Jahre alt.

- `sitov.option.1`: bin
- `sitov.option.2`: ist
- `sitov.option.3`: sind

Schlüssel: `sitov.option.1` – bin
Begründung: sein hat hier die unregelmäßige ich-Form bin; ist und sind passen nicht zu ich.

### sitov.pretest.a11-01.verbs.q5

Ergänze: Wir ___ zusammen Deutsch.

- `sitov.option.1`: lernt
- `sitov.option.2`: lerne
- `sitov.option.3`: lernen

Schlüssel: `sitov.option.3` – lernen
Begründung: lernen stimmt mit wir überein; lernt ist eine andere Person, lerne steht bei ich.

### sitov.pretest.a11-01.verbs.q6

Welche zwei Grundformen gehören zu »Wir trinken Tee und lesen ein Buch«?

- `sitov.option.1`: trinken und lesen
- `sitov.option.2`: trinken und lernen
- `sitov.option.3`: trinken und wohnen

Schlüssel: `sitov.option.1` – trinken und lesen
Begründung: trinken und lesen benennen die beiden Verben; lernen und wohnen kommen in dieser Aussage nicht als Tätigkeiten vor.

### sitov.pretest.a11-01.syntax.q1

Welcher Satz hat die normale Aussagesatzstellung?

- `sitov.option.1`: Ich heiße Leon.
- `sitov.option.2`: Ich Leon heiße.
- `sitov.option.3`: Heiße ich Leon?

Schlüssel: `sitov.option.1` – Ich heiße Leon.
Begründung: Im Aussagesatz steht heiße nach dem Subjekt; die zweite Form ist falsch, die dritte eine Frage.

### sitov.pretest.a11-01.syntax.q2

Was verbindet »und« in »Ich komme aus Polen und wohne in Hannover«?

- `sitov.option.1`: Zwei verschiedene Namen.
- `sitov.option.2`: Eine Frage und ihre Antwort.
- `sitov.option.3`: Zwei Aussagen über dieselbe Person.

Schlüssel: `sitov.option.3` – Zwei Aussagen über dieselbe Person.
Begründung: kommen und wohnen haben dasselbe Subjekt ich; und verbindet die beiden Tätigkeiten, keine Namen oder Frage-Antwort-Paarung.

### sitov.pretest.a11-01.syntax.q3

Welcher Satz nennt ein Alter in korrekter deutscher Wortstellung?

- `sitov.option.1`: Ich lerne Deutsch.
- `sitov.option.2`: Ich bin dreißig Jahre alt.
- `sitov.option.3`: Ich dreißig bin alt Jahre.

Schlüssel: `sitov.option.2` – Ich bin dreißig Jahre alt.
Begründung: Nur »Ich bin dreißig Jahre alt.« nennt ein Alter in korrekter deutscher Wortstellung. »Ich lerne Deutsch.« nennt eine Tätigkeit; die dritte Antwort hat eine falsche Wortstellung.

### sitov.pretest.a11-01.syntax.q4

Ergänze: Am Abend ___.

- `sitov.option.1`: trinken wir Tee
- `sitov.option.2`: wir Tee trinken
- `sitov.option.3`: wir trinken Tee

Schlüssel: `sitov.option.1` – trinken wir Tee
Begründung: Nach Am Abend steht das finite Verb trinken vor wir; die anderen Varianten verletzen die Verbzweitstellung.

### sitov.pretest.a11-01.syntax.q5 – geändert

Übung: »Wir trinken Tee und kaufen Milch.« Was trinken wir?

- `sitov.option.1`: Milch.
- `sitov.option.2`: Tee und Milch.
- `sitov.option.3`: Tee.

Schlüssel: `sitov.option.3` – Tee.
Begründung: »Tee« gehört zu »trinken«, »Milch« zu »kaufen«. Der Satz sagt nicht, dass wir die Milch trinken.

### sitov.pretest.a11-01.syntax.q6

Was beschreibt »klein« in »Meine Familie ist klein«?

- `sitov.option.1`: Die Stadt.
- `sitov.option.2`: Die Familie.
- `sitov.option.3`: Den Namen.

Schlüssel: `sitov.option.2` – Die Familie.
Begründung: Das Subjekt Meine Familie erhält die Eigenschaft klein; Name und Stadt sind hier keine Satzglieder.

### sitov.pretest.a11-01.nominal.q1

Ergänze: ___ Familie ist klein.

- `sitov.option.1`: Meine
- `sitov.option.2`: Mein
- `sitov.option.3`: Meinen

Schlüssel: `sitov.option.1` – Meine
Begründung: Familie ist feminin und hier Subjekt: meine; mein ist hier ohne passende feminine Endung, meinen passt nicht zum Nominativ Singular.

### sitov.pretest.a11-01.nominal.q2

Ergänze: ___ Mann heißt Paul.

- `sitov.option.1`: Meine
- `sitov.option.2`: Meinen
- `sitov.option.3`: Mein

Schlüssel: `sitov.option.3` – Mein
Begründung: Mann ist maskulin und Subjekt: mein Mann; meine wäre feminin oder Plural, meinen wäre Akkusativ.

### sitov.pretest.a11-01.nominal.q3

Ergänze: Wir lesen ___ Buch.

- `sitov.option.1`: einen
- `sitov.option.2`: ein
- `sitov.option.3`: eine

Schlüssel: `sitov.option.2` – ein
Begründung: Buch ist neutral; im Akkusativ bleibt ein. Eine ist feminin, einen ist maskuliner Akkusativ.

### sitov.pretest.a11-01.nominal.q4

Wen umfasst das Wort »wir«?

- `sitov.option.1`: Die sprechende Person und mindestens eine weitere Person.
- `sitov.option.2`: Nur die sprechende Person.
- `sitov.option.3`: Nur eine andere Person.

Schlüssel: `sitov.option.1` – Die sprechende Person und mindestens eine weitere Person.
Begründung: wir schließt den Sprecher und weitere Personen ein; ich wäre nur der Sprecher, er nur eine andere männliche Person.

### sitov.pretest.a11-01.nominal.q5

Wer spricht in »Ich komme aus Polen« über sich selbst?

- `sitov.option.1`: Nur der Zuhörer.
- `sitov.option.2`: Eine Gruppe ohne die sprechende Person.
- `sitov.option.3`: Die sprechende Person.

Schlüssel: `sitov.option.3` – Die sprechende Person.
Begründung: ich verweist auf den Sprecher; du wäre der Zuhörer, sie im Plural eine andere Gruppe.

### sitov.pretest.a11-01.nominal.q6

Wessen Mann ist Paul in »Mein Mann heißt Paul«?

- `sitov.option.1`: Der Mann der sprechenden Person.
- `sitov.option.2`: Der Mann des Zuhörers.
- `sitov.option.3`: Der Mann einer anderen, nicht genannten Person.

Schlüssel: `sitov.option.1` – Der Mann der sprechenden Person.
Begründung: Mein zeigt die Beziehung zur sprechenden Person; dein würde den Zuhörer bezeichnen, sein eine andere männliche Person.

### sitov.pretest.a11-02.words.q1 – geändert

Was bedeutet »frühstücken«?

- `sitov.option.1`: Am Morgen essen.
- `sitov.option.2`: Am Mittag essen.
- `sitov.option.3`: Am Abend essen.

Schlüssel: `sitov.option.1` – Am Morgen essen.
Begründung: Frühstücken heißt am Morgen essen. Essen am Mittag oder am Abend ist eine andere Mahlzeit.

### sitov.pretest.a11-02.words.q2 – geändert

Was ist eine »Küche«?

- `sitov.option.1`: Ein Raum zum Schlafen.
- `sitov.option.2`: Ein Raum zum Duschen.
- `sitov.option.3`: Ein Raum zum Kochen.

Schlüssel: `sitov.option.3` – Ein Raum zum Kochen.
Begründung: Die Küche ist ein Raum zum Kochen. Schlafen und Duschen gehören zu anderen Räumen in der Wohnung.

### sitov.pretest.a11-02.words.q3 – geändert

Was ist »Käse«?

- `sitov.option.1`: Ein Lebensmittel aus Mehl.
- `sitov.option.2`: Ein Lebensmittel aus Milch.
- `sitov.option.3`: Ein Getränk aus Milch.

Schlüssel: `sitov.option.2` – Ein Lebensmittel aus Milch.
Begründung: Käse ist ein Lebensmittel aus Milch. Ein Lebensmittel aus Mehl ist zum Beispiel Brot; ein Getränk aus Milch ist kein Käse.

### sitov.pretest.a11-02.words.q4 – geändert

Was ist eine »Tasse« in »eine Tasse Tee«?

- `sitov.option.1`: Ein Gefäß für das Getränk.
- `sitov.option.2`: Das Getränk im Gefäß.
- `sitov.option.3`: Das Wasser für den Tee.

Schlüssel: `sitov.option.1` – Ein Gefäß für das Getränk.
Begründung: Die Tasse ist das Gefäß. Der Tee ist das Getränk darin; das Wasser ist eine Zutat für den Tee.

### sitov.pretest.a11-02.words.q5 – geändert

Was bedeutet »frisches Brot« hier?

- `sitov.option.1`: Brot, das süß schmeckt.
- `sitov.option.2`: Brot, das schon alt ist.
- `sitov.option.3`: Brot, das noch nicht alt ist.

Schlüssel: `sitov.option.3` – Brot, das noch nicht alt ist.
Begründung: Frisches Brot ist noch nicht alt. Süß nennt den Geschmack; altes Brot ist nicht frisch.

### sitov.pretest.a11-02.words.q6

Was bedeutet »ein bisschen sprechen«?

- `sitov.option.1`: Sehr viel sprechen.
- `sitov.option.2`: Etwas sprechen.
- `sitov.option.3`: Überhaupt nicht sprechen.

Schlüssel: `sitov.option.2` – Etwas sprechen.
Begründung: ein bisschen meint eine kleine Menge; nichts und sehr viel unterscheiden sich davon.

### sitov.pretest.a11-02.verbs.q1

Ergänze: Ich ___ in der Küche.

- `sitov.option.1`: sitze
- `sitov.option.2`: sitzt
- `sitov.option.3`: sitzen

Schlüssel: `sitov.option.1` – sitze
Begründung: sitze stimmt mit ich überein; sitzt und sitzen gehören zu anderen Personen.

### sitov.pretest.a11-02.verbs.q2

Welche Grundform gehört zu »frühstücke«?

- `sitov.option.1`: frühstücken
- `sitov.option.2`: früh
- `sitov.option.3`: Frühstück

Schlüssel: `sitov.option.1` – frühstücken
Begründung: frühstücken ist die Grundform des Verbs; früh ist eine Zeitbeschreibung, Frühstück der Name der Mahlzeit.

### sitov.pretest.a11-02.verbs.q3

Ergänze: Brot, Käse und eine Tasse Tee ___ auf dem Tisch.

- `sitov.option.1`: stehe
- `sitov.option.2`: stehen
- `sitov.option.3`: steht

Schlüssel: `sitov.option.2` – stehen
Begründung: Mehrere aufgezählte Dinge bilden einen Plural: stehen. Steht ist Singular, stehe eine ich-Form.

### sitov.pretest.a11-02.verbs.q4

Ergänze: Mein Sohn ___ Milch.

- `sitov.option.1`: trinkt
- `sitov.option.2`: trinke
- `sitov.option.3`: trinken

Schlüssel: `sitov.option.1` – trinkt
Begründung: Mein Sohn ist dritte Person Singular: trinkt; trinke und trinken haben andere Subjekte.

### sitov.pretest.a11-02.verbs.q5

Ergänze: Er ___ einen Apfel.

- `sitov.option.1`: esse
- `sitov.option.2`: essen
- `sitov.option.3`: isst

Schlüssel: `sitov.option.3` – isst
Begründung: essen wechselt bei er zu isst; esse gehört zu ich und essen zur Mehrzahl.

### sitov.pretest.a11-02.verbs.q6

Ergänze: Wir haben Zeit und ___.

- `sitov.option.1`: spreche
- `sitov.option.2`: sprechen
- `sitov.option.3`: spricht

Schlüssel: `sitov.option.2` – sprechen
Begründung: sprechen passt zum gemeinsamen Subjekt wir; spricht ist Singular, spreche eine ich-Form.

### sitov.pretest.a11-02.syntax.q1

Welche Aussage nennt eine Uhrzeit?

- `sitov.option.1`: Es ist sieben Uhr.
- `sitov.option.2`: Es sieben Uhr ist.
- `sitov.option.3`: Sieben ist Uhr es.

Schlüssel: `sitov.option.1` – Es ist sieben Uhr.
Begründung: Die feste Aussage beginnt mit Es ist und der Uhrzeit; die beiden anderen Wortfolgen bilden keinen korrekten Aussagesatz.

### sitov.pretest.a11-02.syntax.q2 – geändert

Übung: Paul sagt zu Leon: »Ich sitze in der Küche und frühstücke.« Wer frühstückt?

- `sitov.option.1`: Leon.
- `sitov.option.2`: Paul und Leon.
- `sitov.option.3`: Die sprechende Person.

Schlüssel: `sitov.option.3` – Die sprechende Person.
Begründung: Paul sagt »ich«. In diesem Satz macht Paul beides: Er sitzt in der Küche und frühstückt. Leon wird nicht als zweite frühstückende Person genannt.

### sitov.pretest.a11-02.syntax.q3

Ergänze: Auf dem Tisch ___.

- `sitov.option.1`: Brot stehen Käse und Tee
- `sitov.option.2`: stehen Brot, Käse und Tee
- `sitov.option.3`: Brot, Käse und Tee stehen

Schlüssel: `sitov.option.2` – stehen Brot, Käse und Tee
Begründung: Nach dem Ortsausdruck folgt stehen als finites Verb; die anderen Folgen setzen das Verb zu spät oder zerreißen die Aufzählung.

### sitov.pretest.a11-02.syntax.q4

Wie viele Dinge nennt »Brot, Käse und eine Tasse Tee«?

- `sitov.option.1`: Drei Dinge.
- `sitov.option.2`: Zwei Dinge.
- `sitov.option.3`: Ein Ding.

Schlüssel: `sitov.option.1` – Drei Dinge.
Begründung: Die Aufzählung nennt Brot, Käse und die Tasse Tee; Tasse Tee ist dabei eine zusammengehörige Gruppe.

### sitov.pretest.a11-02.syntax.q5 – geändert

Übung: »Er isst einen Apfel und kauft Brot.« Was isst er?

- `sitov.option.1`: Brot.
- `sitov.option.2`: Ein Apfel und Brot.
- `sitov.option.3`: Ein Apfel.

Schlüssel: `sitov.option.3` – Ein Apfel.
Begründung: »Einen Apfel« gehört zu »isst«, »Brot« zu »kauft«. Der Satz sagt nicht, dass er auch Brot isst.

### sitov.pretest.a11-02.syntax.q6 – geändert

Übung: Paul und Leon sagen: »Wir haben Zeit und sprechen.« Welche zwei Aussagen passen dazu?

- `sitov.option.1`: Nur Paul hat Zeit. Beide sprechen.
- `sitov.option.2`: Wir haben Zeit. Wir sprechen.
- `sitov.option.3`: Beide haben Zeit. Nur Leon spricht.

Schlüssel: `sitov.option.2` – Wir haben Zeit. Wir sprechen.
Begründung: Paul und Leon sagen »wir«. Beide haben Zeit und beide sprechen. Die anderen Antworten beschränken eine der beiden Aussagen auf nur eine Person.

### sitov.pretest.a11-02.nominal.q1

Ergänze den Ort: Ich sitze in ___ Küche.

- `sitov.option.1`: der
- `sitov.option.2`: die
- `sitov.option.3`: den

Schlüssel: `sitov.option.1` – der
Begründung: Beim Ort steht Küche im Dativ feminin: der Küche; die wäre Nominativ oder Akkusativ, den passt nicht zu Küche.

### sitov.pretest.a11-02.nominal.q2

Ergänze den Ort: Das Brot liegt auf ___ Tisch.

- `sitov.option.1`: den
- `sitov.option.2`: der
- `sitov.option.3`: dem

Schlüssel: `sitov.option.3` – dem
Begründung: Der Ort verlangt Dativ; Tisch ist maskulin, deshalb dem. Den wäre Akkusativ, der hier nicht die Dativform.

### sitov.pretest.a11-02.nominal.q3

Ergänze: ___ Tasse Tee steht auf dem Tisch.

- `sitov.option.1`: Einen
- `sitov.option.2`: Eine
- `sitov.option.3`: Ein

Schlüssel: `sitov.option.2` – Eine
Begründung: Tasse ist ein feminines Subjekt: eine; ein ist maskulin oder neutral, einen maskuliner Akkusativ.

### sitov.pretest.a11-02.nominal.q4

Ergänze: Er isst ___ Apfel.

- `sitov.option.1`: einen
- `sitov.option.2`: ein
- `sitov.option.3`: eine

Schlüssel: `sitov.option.1` – einen
Begründung: Apfel ist ein maskulines Objekt im Akkusativ: einen; ein wäre Nominativ, eine feminin.

### sitov.pretest.a11-02.nominal.q5

Ergänze: ___ Sohn trinkt Milch.

- `sitov.option.1`: Meine
- `sitov.option.2`: Meinen
- `sitov.option.3`: Mein

Schlüssel: `sitov.option.3` – Mein
Begründung: Sohn ist maskulin und Subjekt: mein Sohn; meine und meinen passen hier nicht zum Nominativ Singular.

### sitov.pretest.a11-02.nominal.q6

Worauf verweist »er« in »Mein Sohn trinkt Milch. Er isst einen Apfel«?

- `sitov.option.1`: Auf den Apfel.
- `sitov.option.2`: Auf meinen Sohn.
- `sitov.option.3`: Auf die Milch.

Schlüssel: `sitov.option.2` – Auf meinen Sohn.
Begründung: Er übernimmt das bereits genannte männliche Subjekt Sohn; Milch ist feminin, Apfel das neue Objekt der zweiten Aussage.

### sitov.pretest.a11-03.words.q1 – geändert

Was ist ein »Kursraum«?

- `sitov.option.1`: Ein Raum für Unterricht.
- `sitov.option.2`: Ein Raum zum Essen.
- `sitov.option.3`: Ein Raum zum Schlafen.

Schlüssel: `sitov.option.1` – Ein Raum für Unterricht.
Begründung: Im Kursraum findet der Unterricht statt. Räume zum Essen oder Schlafen haben andere Aufgaben.

### sitov.pretest.a11-03.words.q2 – geändert

Was bedeutet »ein heller Raum«?

- `sitov.option.1`: Ein Raum ohne Licht.
- `sitov.option.2`: Ein sehr warmer Raum.
- `sitov.option.3`: Ein Raum mit viel Licht.

Schlüssel: `sitov.option.3` – Ein Raum mit viel Licht.
Begründung: Hell bedeutet: Es gibt viel Licht. Ohne Licht ist der Raum dunkel. Warm nennt die Temperatur, nicht das Licht.

### sitov.pretest.a11-03.words.q3 – geändert

Was bedeutet »ein großer Raum«?

- `sitov.option.1`: Ein Raum mit viel Licht.
- `sitov.option.2`: Ein Raum mit viel Platz.
- `sitov.option.3`: Ein sehr kleiner Raum.

Schlüssel: `sitov.option.2` – Ein Raum mit viel Platz.
Begründung: Groß bedeutet hier viel Platz. Ein kleiner Raum hat wenig Platz. Viel Licht macht einen Raum hell, aber nicht groß.

### sitov.pretest.a11-03.words.q4

Welche Zahl bedeutet »zwölf«?

- `sitov.option.1`: 12
- `sitov.option.2`: 6
- `sitov.option.3`: 20

Schlüssel: `sitov.option.1` – 12
Begründung: zwölf entspricht 12; sechs entspricht 6 und zwanzig 20.

### sitov.pretest.a11-03.words.q5 – geändert

Übung: Der Lehrer schreibt an die Tafel. Was ist hier eine »Tafel«?

- `sitov.option.1`: Ein Tisch zum Arbeiten.
- `sitov.option.2`: Ein Regal für Bücher.
- `sitov.option.3`: Eine Fläche zum Schreiben im Unterricht.

Schlüssel: `sitov.option.3` – Eine Fläche zum Schreiben im Unterricht.
Begründung: An die Tafel schreibt der Lehrer. Tisch und Regal sind andere Gegenstände im Kursraum.

### sitov.pretest.a11-03.words.q6 – geändert

Was ist ein »Heft« beim Deutschlernen?

- `sitov.option.1`: Ein Stift zum Schreiben.
- `sitov.option.2`: Ein kleines Buch zum Schreiben.
- `sitov.option.3`: Eine Tasche für Bücher.

Schlüssel: `sitov.option.2` – Ein kleines Buch zum Schreiben.
Begründung: In ein Heft schreibt man. Mit einem Stift schreibt man; in einer Tasche trägt man Bücher.

### sitov.pretest.a11-03.verbs.q1

Ergänze: Der Kursraum ___ hell.

- `sitov.option.1`: ist
- `sitov.option.2`: sind
- `sitov.option.3`: bin

Schlüssel: `sitov.option.1` – ist
Begründung: Der Kursraum ist dritte Person Singular: ist; sind ist Plural, bin gehört zu ich.

### sitov.pretest.a11-03.verbs.q2

Ergänze: Zwölf Stühle und sechs Tische ___ hier.

- `sitov.option.1`: steht
- `sitov.option.2`: stehe
- `sitov.option.3`: stehen

Schlüssel: `sitov.option.3` – stehen
Begründung: Mehrere Stühle und Tische sind ein Pluralsubjekt: stehen; steht und stehe passen nicht dazu.

### sitov.pretest.a11-03.verbs.q3

Welche Grundform gehört zu »liegt« in »Mein Heft liegt auf dem Tisch«?

- `sitov.option.1`: liegen
- `sitov.option.2`: legen
- `sitov.option.3`: laufen

Schlüssel: `sitov.option.1` – liegen
Begründung: liegt gehört zu liegen und beschreibt hier einen Zustand am Ort; legen bezeichnet eine Handlung, laufen eine Bewegung.

### sitov.pretest.a11-03.verbs.q4

Ergänze: Der Lehrer ___.

- `sitov.option.1`: kommt
- `sitov.option.2`: kommen
- `sitov.option.3`: komme

Schlüssel: `sitov.option.1` – kommt
Begründung: Der Lehrer ist dritte Person Singular: kommt; kommen und komme verlangen andere Subjekte.

### sitov.pretest.a11-03.verbs.q5

Welche Form zeigt in »Der Lehrer kommt und sagt guten Morgen« das Sprechen?

- `sitov.option.1`: sagt
- `sitov.option.2`: kommt
- `sitov.option.3`: Morgen

Schlüssel: `sitov.option.1` – sagt
Begründung: sagt ist die Verbform für die sprachliche Äußerung; kommt nennt das Ankommen, Morgen ist ein Nomen.

### sitov.pretest.a11-03.verbs.q6

Ergänze: Unser Deutschkurs ___ jetzt.

- `sitov.option.1`: beginne
- `sitov.option.2`: beginnt
- `sitov.option.3`: beginnen

Schlüssel: `sitov.option.2` – beginnt
Begründung: Der einzelne Deutschkurs beginnt; beginnen ist die Mehrzahlform, beginne gehört zu ich.

### sitov.pretest.a11-03.syntax.q1 – geändert

Ein Lehrer zeigt auf einen Raum und sagt: »Das ist unser Kursraum.« Was sagt er?

- `sitov.option.1`: Das ist der Raum für unseren Kurs.
- `sitov.option.2`: Ist das unser Kursraum?
- `sitov.option.3`: Komm bitte in den Kursraum!

Schlüssel: `sitov.option.1` – Das ist der Raum für unseren Kurs.
Begründung: Der Lehrer zeigt den Kursraum und sagt, welcher Raum das ist. Er fragt nicht nach dem Raum und bittet niemanden hereinzukommen.

### sitov.pretest.a11-03.syntax.q2

Worauf verweist »hier« in »Das ist unser Kursraum. Hier stehen Stühle«?

- `sitov.option.1`: Auf den Kursraum.
- `sitov.option.2`: Auf eine Person.
- `sitov.option.3`: Auf eine Uhrzeit.

Schlüssel: `sitov.option.1` – Auf den Kursraum.
Begründung: Hier nennt den zuvor erwähnten Ort, den Kursraum; es bezeichnet weder eine Person noch eine Uhrzeit.

### sitov.pretest.a11-03.syntax.q3

Was nennt »an der Wand« in »An der Wand ist eine Tafel«?

- `sitov.option.1`: Den Ort der Tafel.
- `sitov.option.2`: Die Uhrzeit.
- `sitov.option.3`: Eine handelnde Person.

Schlüssel: `sitov.option.1` – Den Ort der Tafel.
Begründung: An der Wand bezeichnet den Ort der Tafel; es nennt keine Zeit und keine handelnde Person.

### sitov.pretest.a11-03.syntax.q4

Was liegt in »Mein Heft liegt auf dem Tisch«?

- `sitov.option.1`: Mein Heft.
- `sitov.option.2`: Der Tisch.
- `sitov.option.3`: Beide Gegenstände.

Schlüssel: `sitov.option.1` – Mein Heft.
Begründung: Mein Heft ist das Subjekt von liegt; auf dem Tisch bezeichnet den Ort, nicht ein zweites liegendes Subjekt.

### sitov.pretest.a11-03.syntax.q5 – geändert

Übung: Paul wartet im Kursraum. »Der Lehrer kommt und sagt guten Morgen.« Wer sagt guten Morgen?

- `sitov.option.1`: Paul.
- `sitov.option.2`: Paul und der Lehrer.
- `sitov.option.3`: Der Lehrer.

Schlüssel: `sitov.option.3` – Der Lehrer.
Begründung: »Der Lehrer« gehört zu »kommt« und zu »sagt«. Paul wartet; der Satz sagt nicht, dass Paul die Begrüßung spricht.

### sitov.pretest.a11-03.syntax.q6

Ergänze: Jetzt ___.

- `sitov.option.1`: unser beginnt Deutschkurs
- `sitov.option.2`: beginnt unser Deutschkurs
- `sitov.option.3`: unser Deutschkurs beginnt

Schlüssel: `sitov.option.2` – beginnt unser Deutschkurs
Begründung: Nach Jetzt steht beginnt als finites Verb; unser Deutschkurs ist die zusammengehörige Subjektgruppe danach.

### sitov.pretest.a11-03.nominal.q1

Worauf verweist »Er« in »Das ist unser Kursraum. Er ist hell«?

- `sitov.option.1`: Auf den Kursraum.
- `sitov.option.2`: Auf eine Tafel.
- `sitov.option.3`: Auf mehrere Stühle.

Schlüssel: `sitov.option.1` – Auf den Kursraum.
Begründung: Kursraum ist maskulin Singular und wird mit er wiederaufgenommen; Tafel wäre sie, Stühle im Plural ebenfalls sie.

### sitov.pretest.a11-03.nominal.q2

Ergänze: Das ist ___ Kursraum.

- `sitov.option.1`: unsere
- `sitov.option.2`: unseren
- `sitov.option.3`: unser

Schlüssel: `sitov.option.3` – unser
Begründung: Kursraum ist hier maskulin im Nominativ: unser; unsere ist feminin oder Plural, unseren Akkusativ.

### sitov.pretest.a11-03.nominal.q3

Ergänze den Ort: Die Tafel ist an ___ Wand.

- `sitov.option.1`: dem
- `sitov.option.2`: der
- `sitov.option.3`: die

Schlüssel: `sitov.option.2` – der
Begründung: Wand ist feminin und steht als Ort im Dativ: der Wand; die ist kein Dativ, dem gehört zu maskulinen oder neutralen Nomen.

### sitov.pretest.a11-03.nominal.q4

Ergänze: An der Wand ist ___ Tafel.

- `sitov.option.1`: eine
- `sitov.option.2`: ein
- `sitov.option.3`: einen

Schlüssel: `sitov.option.1` – eine
Begründung: Tafel ist feminin und das Subjekt: eine; ein und einen passen nicht zu diesem Genus.

### sitov.pretest.a11-03.nominal.q5

Ergänze: ___ Heft liegt auf dem Tisch.

- `sitov.option.1`: Meine
- `sitov.option.2`: Meinen
- `sitov.option.3`: Mein

Schlüssel: `sitov.option.3` – Mein
Begründung: Heft ist neutral im Nominativ: mein Heft; meine und meinen passen hier nicht.

### sitov.pretest.a11-03.nominal.q6

Ergänze den Ort: Das Heft liegt auf ___ Tisch.

- `sitov.option.1`: die
- `sitov.option.2`: dem
- `sitov.option.3`: den

Schlüssel: `sitov.option.2` – dem
Begründung: Tisch ist maskulin, der Ort steht im Dativ: dem Tisch; den ist Akkusativ, die kein passender maskuliner Dativ.

## Prüfung und Grenzen

Generatorprüfungen: tatsächliche vorherige Aufgaben und Audio-Aliasse exakt gelesen; alle 16 Befunde zugeordnet; 18 Änderungen/72 Fragen/12 Cores; eindeutige Options-IDs und drei verschiedene Optionen; unveränderte Schutzfelder und Quellen; Quellspannen und vorherige native Definitionshashes geprüft. Die semantische Eindeutigkeit ist ein begründeter redaktioneller Vorschlag, kein automatischer Nachweis oder empirische Kalibrierung. M muss alle Kandidaten erneut prüfen.

JSON enthält vollständige Alt-/Neu-Aufgaben, alle zugehörigen Alias-Einträge und Text-Hashes, vollständige vorherige und Kandidatendefinitionen, exakte Quelldatei-Hashes und historischen Review-/S7-Nachweis. M übernimmt atomare Anwendung, immutable Versionshistorie, neue Version und versionsgenaues lokales Qwen-Audio mit echten Wortzeiten vor Veröffentlichung. Keine App-/QA-/API-/TTS-/Import-/Publikationsprüfung ausgeführt.
