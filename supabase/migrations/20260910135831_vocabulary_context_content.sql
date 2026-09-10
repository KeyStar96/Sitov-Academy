BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
-- Authored everyday examples, not a statistical claim about corpus frequency.
-- Existing editorial text is never replaced.
UPDATE public.vocabulary_cards c SET context_sentence_de=s.context_sentence_de
FROM jsonb_to_recordset($examples$
[
  {
    "word_de": "Adresse",
    "context_sentence_de": "Wie ist Ihre Adresse?"
  },
  {
    "word_de": "aha",
    "context_sentence_de": "Aha, jetzt verstehe ich das."
  },
  {
    "word_de": "Alphabet",
    "context_sentence_de": "Wir lernen das deutsche Alphabet."
  },
  {
    "word_de": "Anmeldeformular",
    "context_sentence_de": "Bitte füllen Sie das Anmeldeformular aus."
  },
  {
    "word_de": "Arabisch",
    "context_sentence_de": "Meine Freundin spricht Arabisch."
  },
  {
    "word_de": "auch",
    "context_sentence_de": "Ich lerne auch Deutsch."
  },
  {
    "word_de": "Auf Wiedersehen",
    "context_sentence_de": "Auf Wiedersehen, bis morgen!"
  },
  {
    "word_de": "aus",
    "context_sentence_de": "Ich komme aus der Ukraine."
  },
  {
    "word_de": "Buchstabe",
    "context_sentence_de": "Wie heißt dieser Buchstabe?"
  },
  {
    "word_de": "buchstabieren",
    "context_sentence_de": "Können Sie Ihren Namen bitte buchstabieren?"
  },
  {
    "word_de": "Bulgarien",
    "context_sentence_de": "Meine Nachbarin kommt aus Bulgarien."
  },
  {
    "word_de": "Dame",
    "context_sentence_de": "Die Dame wartet an der Haltestelle."
  },
  {
    "word_de": "danke",
    "context_sentence_de": "Danke für Ihre Hilfe!"
  },
  {
    "word_de": "Deutsch",
    "context_sentence_de": "Ich lerne Deutsch."
  },
  {
    "word_de": "Deutschland",
    "context_sentence_de": "Ich wohne in Deutschland."
  },
  {
    "word_de": "du",
    "context_sentence_de": "Wo wohnst du?"
  },
  {
    "word_de": "E-Mail",
    "context_sentence_de": "Ich schreibe Ihnen eine E-Mail."
  },
  {
    "word_de": "ein bisschen",
    "context_sentence_de": "Ich spreche ein bisschen Deutsch."
  },
  {
    "word_de": "Englisch",
    "context_sentence_de": "Sprechen Sie Englisch?"
  },
  {
    "word_de": "Entschuldigung",
    "context_sentence_de": "Entschuldigung, wo ist der Bahnhof?"
  },
  {
    "word_de": "Familienname",
    "context_sentence_de": "Wie ist Ihr Familienname?"
  },
  {
    "word_de": "Französisch",
    "context_sentence_de": "Sie spricht Französisch."
  },
  {
    "word_de": "Frau",
    "context_sentence_de": "Die Frau heißt Anna."
  },
  {
    "word_de": "Freut mich",
    "context_sentence_de": "Freut mich, Sie kennenzulernen!"
  },
  {
    "word_de": "Griechenland",
    "context_sentence_de": "Meine Familie lebt in Griechenland."
  },
  {
    "word_de": "Griechisch",
    "context_sentence_de": "Er spricht Griechisch."
  },
  {
    "word_de": "Gute Nacht",
    "context_sentence_de": "Gute Nacht, schlaf gut!"
  },
  {
    "word_de": "Guten Abend",
    "context_sentence_de": "Guten Abend, Frau Müller!"
  },
  {
    "word_de": "Guten Morgen",
    "context_sentence_de": "Guten Morgen, wie geht es Ihnen?"
  },
  {
    "word_de": "Guten Tag",
    "context_sentence_de": "Guten Tag, mein Name ist Anna."
  },
  {
    "word_de": "Hallo",
    "context_sentence_de": "Hallo, wie geht es dir?"
  },
  {
    "word_de": "Hausnummer",
    "context_sentence_de": "Unsere Hausnummer ist zwölf."
  },
  {
    "word_de": "heißen",
    "context_sentence_de": "Wie heißen Sie?"
  },
  {
    "word_de": "Herr",
    "context_sentence_de": "Herr Müller kommt aus Hannover."
  },
  {
    "word_de": "ich",
    "context_sentence_de": "Ich heiße Anna."
  },
  {
    "word_de": "Ich spreche ein bisschen Deutsch",
    "context_sentence_de": "Ich spreche ein bisschen Deutsch."
  },
  {
    "word_de": "interessant",
    "context_sentence_de": "Der Deutschkurs ist interessant."
  },
  {
    "word_de": "Italien",
    "context_sentence_de": "Er kommt aus Italien."
  },
  {
    "word_de": "Italienisch",
    "context_sentence_de": "Sie lernt Italienisch."
  },
  {
    "word_de": "ja",
    "context_sentence_de": "Ja, ich komme morgen."
  },
  {
    "word_de": "Kind",
    "context_sentence_de": "Das Kind spielt im Garten."
  },
  {
    "word_de": "kommen",
    "context_sentence_de": "Woher kommen Sie?"
  },
  {
    "word_de": "Land",
    "context_sentence_de": "Aus welchem Land kommen Sie?"
  },
  {
    "word_de": "leben",
    "context_sentence_de": "Meine Eltern leben in Berlin."
  },
  {
    "word_de": "Mein Name ist …",
    "context_sentence_de": "Mein Name ist Anna."
  },
  {
    "word_de": "Nachname",
    "context_sentence_de": "Mein Nachname ist Müller."
  },
  {
    "word_de": "Name",
    "context_sentence_de": "Wie ist Ihr Name?"
  },
  {
    "word_de": "nein",
    "context_sentence_de": "Nein, ich habe heute keine Zeit."
  },
  {
    "word_de": "Österreich",
    "context_sentence_de": "Meine Schwester wohnt in Österreich."
  },
  {
    "word_de": "Papa",
    "context_sentence_de": "Papa kocht das Abendessen."
  },
  {
    "word_de": "Polen",
    "context_sentence_de": "Meine Freundin kommt aus Polen."
  },
  {
    "word_de": "Polnisch",
    "context_sentence_de": "Er spricht Polnisch."
  },
  {
    "word_de": "Rumänien",
    "context_sentence_de": "Sie kommt aus Rumänien."
  },
  {
    "word_de": "Schweiz",
    "context_sentence_de": "Mein Bruder lebt in der Schweiz."
  },
  {
    "word_de": "sein",
    "context_sentence_de": "Ich bin neu hier."
  },
  {
    "word_de": "Sie",
    "context_sentence_de": "Woher kommen Sie?"
  },
  {
    "word_de": "Spanien",
    "context_sentence_de": "Wir machen Urlaub in Spanien."
  },
  {
    "word_de": "Spanisch",
    "context_sentence_de": "Ich lerne Spanisch."
  },
  {
    "word_de": "Sprache",
    "context_sentence_de": "Welche Sprache sprechen Sie?"
  },
  {
    "word_de": "sprechen",
    "context_sentence_de": "Ich spreche Deutsch und Russisch."
  },
  {
    "word_de": "Stadt",
    "context_sentence_de": "Hannover ist eine große Stadt."
  },
  {
    "word_de": "Straße",
    "context_sentence_de": "In welcher Straße wohnen Sie?"
  },
  {
    "word_de": "Syrien",
    "context_sentence_de": "Mein Nachbar kommt aus Syrien."
  },
  {
    "word_de": "Telefon",
    "context_sentence_de": "Das Telefon klingelt."
  },
  {
    "word_de": "Telefonnummer",
    "context_sentence_de": "Wie ist Ihre Telefonnummer?"
  },
  {
    "word_de": "toll",
    "context_sentence_de": "Das ist eine tolle Idee!"
  },
  {
    "word_de": "Tschüss",
    "context_sentence_de": "Tschüss, bis morgen!"
  },
  {
    "word_de": "Türkei",
    "context_sentence_de": "Meine Nachbarn kommen aus der Türkei."
  },
  {
    "word_de": "Türkisch",
    "context_sentence_de": "Meine Freundin spricht Türkisch."
  },
  {
    "word_de": "Tut mir leid",
    "context_sentence_de": "Tut mir leid, ich komme zu spät."
  },
  {
    "word_de": "und",
    "context_sentence_de": "Ich spreche Deutsch und Englisch."
  },
  {
    "word_de": "Ungarn",
    "context_sentence_de": "Er kommt aus Ungarn."
  },
  {
    "word_de": "Visitenkarte",
    "context_sentence_de": "Hier ist meine Visitenkarte."
  },
  {
    "word_de": "Vorname",
    "context_sentence_de": "Mein Vorname ist Anna."
  },
  {
    "word_de": "Was sprechen Sie? – Ich spreche …",
    "context_sentence_de": "Was sprechen Sie? Ich spreche Russisch."
  },
  {
    "word_de": "was?",
    "context_sentence_de": "Was machen Sie heute?"
  },
  {
    "word_de": "Wer ist das? – Das ist …",
    "context_sentence_de": "Wer ist das? Das ist meine Schwester."
  },
  {
    "word_de": "wer?",
    "context_sentence_de": "Wer kommt morgen?"
  },
  {
    "word_de": "Wie heißen Sie? – Ich heiße …",
    "context_sentence_de": "Wie heißen Sie? Ich heiße Anna."
  },
  {
    "word_de": "Wie heißt du? – Ich heiße …",
    "context_sentence_de": "Wie heißt du? Ich heiße Anna."
  },
  {
    "word_de": "wie?",
    "context_sentence_de": "Wie geht es Ihnen?"
  },
  {
    "word_de": "Willkommen",
    "context_sentence_de": "Willkommen in unserem Deutschkurs!"
  },
  {
    "word_de": "Woher kommen Sie? – Ich komme aus …",
    "context_sentence_de": "Woher kommen Sie? Ich komme aus Polen."
  },
  {
    "word_de": "woher?",
    "context_sentence_de": "Woher kommen Sie?"
  },
  {
    "word_de": "acht",
    "context_sentence_de": "Der Kurs beginnt um acht Uhr."
  },
  {
    "word_de": "achtzehn",
    "context_sentence_de": "Meine Tochter ist achtzehn Jahre alt."
  },
  {
    "word_de": "alt",
    "context_sentence_de": "Wie alt sind Sie?"
  },
  {
    "word_de": "Bruder",
    "context_sentence_de": "Mein Bruder wohnt in Berlin."
  },
  {
    "word_de": "Danke, gut.",
    "context_sentence_de": "Wie geht es Ihnen? Danke, gut."
  },
  {
    "word_de": "Das ist mein Bruder.",
    "context_sentence_de": "Das ist mein Bruder."
  },
  {
    "word_de": "Das ist meine Mutter.",
    "context_sentence_de": "Das ist meine Mutter."
  },
  {
    "word_de": "dein / deine",
    "context_sentence_de": "Ist das deine Tasche?"
  },
  {
    "word_de": "drei",
    "context_sentence_de": "Ich habe drei Kinder."
  },
  {
    "word_de": "dreizehn",
    "context_sentence_de": "Mein Sohn ist dreizehn Jahre alt."
  },
  {
    "word_de": "Ehefrau",
    "context_sentence_de": "Meine Ehefrau arbeitet heute."
  },
  {
    "word_de": "eins",
    "context_sentence_de": "Wir beginnen mit Lektion eins."
  },
  {
    "word_de": "elf",
    "context_sentence_de": "Wir treffen uns um elf Uhr."
  },
  {
    "word_de": "Eltern",
    "context_sentence_de": "Meine Eltern wohnen in Hannover."
  },
  {
    "word_de": "Enkel",
    "context_sentence_de": "Mein Enkel geht in die Schule."
  },
  {
    "word_de": "Enkelin",
    "context_sentence_de": "Meine Enkelin ist fünf Jahre alt."
  },
  {
    "word_de": "er",
    "context_sentence_de": "Er lernt Deutsch."
  },
  {
    "word_de": "Es geht.",
    "context_sentence_de": "Wie geht es dir? Es geht."
  },
  {
    "word_de": "Familie",
    "context_sentence_de": "Meine Familie lebt in Deutschland."
  },
  {
    "word_de": "fünf",
    "context_sentence_de": "Die Pause dauert fünf Minuten."
  },
  {
    "word_de": "fünfzehn",
    "context_sentence_de": "Der Kurs beginnt in fünfzehn Minuten."
  },
  {
    "word_de": "geschieden",
    "context_sentence_de": "Meine Eltern sind geschieden."
  },
  {
    "word_de": "Geschwister",
    "context_sentence_de": "Haben Sie Geschwister?"
  },
  {
    "word_de": "getrennt",
    "context_sentence_de": "Wir leben seit einem Jahr getrennt."
  },
  {
    "word_de": "Großeltern",
    "context_sentence_de": "Am Sonntag besuchen wir unsere Großeltern."
  },
  {
    "word_de": "gut",
    "context_sentence_de": "Mir geht es gut."
  },
  {
    "word_de": "Hast du Geschwister?",
    "context_sentence_de": "Hast du Geschwister?"
  },
  {
    "word_de": "Hauptstadt",
    "context_sentence_de": "Berlin ist die Hauptstadt von Deutschland."
  },
  {
    "word_de": "Ich habe keine Geschwister.",
    "context_sentence_de": "Ich habe keine Geschwister."
  },
  {
    "word_de": "ihr",
    "context_sentence_de": "Wo wohnt ihr?"
  },
  {
    "word_de": "Ihr / Ihre",
    "context_sentence_de": "Ist das Ihre Tasche?"
  },
  {
    "word_de": "in",
    "context_sentence_de": "Ich wohne in Hannover."
  },
  {
    "word_de": "Jahr",
    "context_sentence_de": "Ich lerne seit einem Jahr Deutsch."
  },
  {
    "word_de": "keine",
    "context_sentence_de": "Ich habe keine Geschwister."
  },
  {
    "word_de": "Lehrer",
    "context_sentence_de": "Unser Lehrer erklärt die Aufgabe."
  },
  {
    "word_de": "Lehrerin",
    "context_sentence_de": "Die Lehrerin spricht langsam."
  },
  {
    "word_de": "lernen",
    "context_sentence_de": "Wir lernen zusammen Deutsch."
  },
  {
    "word_de": "Mama",
    "context_sentence_de": "Mama liest ein Buch."
  },
  {
    "word_de": "Mann",
    "context_sentence_de": "Der Mann wartet auf den Bus."
  },
  {
    "word_de": "mein / meine",
    "context_sentence_de": "Das ist meine Familie."
  },
  {
    "word_de": "Meine Eltern sind verheiratet / geschieden",
    "context_sentence_de": "Meine Eltern sind verheiratet."
  },
  {
    "word_de": "meinen",
    "context_sentence_de": "Was meinen Sie?"
  },
  {
    "word_de": "Mutter",
    "context_sentence_de": "Meine Mutter kommt morgen."
  },
  {
    "word_de": "Na ja.",
    "context_sentence_de": "Wie war der Film? Na ja."
  },
  {
    "word_de": "neun",
    "context_sentence_de": "Der Unterricht beginnt um neun Uhr."
  },
  {
    "word_de": "neunzehn",
    "context_sentence_de": "Mein Sohn ist neunzehn Jahre alt."
  },
  {
    "word_de": "nicht so gut",
    "context_sentence_de": "Mir geht es heute nicht so gut."
  },
  {
    "word_de": "null",
    "context_sentence_de": "Meine Telefonnummer beginnt mit null."
  },
  {
    "word_de": "Oma",
    "context_sentence_de": "Meine Oma wohnt in der Nähe."
  },
  {
    "word_de": "Opa",
    "context_sentence_de": "Mein Opa arbeitet im Garten."
  },
  {
    "word_de": "Ort",
    "context_sentence_de": "In welchem Ort wohnen Sie?"
  },
  {
    "word_de": "Park",
    "context_sentence_de": "Wir gehen im Park spazieren."
  },
  {
    "word_de": "Pause",
    "context_sentence_de": "Jetzt machen wir eine Pause."
  },
  {
    "word_de": "Schwester",
    "context_sentence_de": "Meine Schwester arbeitet im Krankenhaus."
  },
  {
    "word_de": "sechs",
    "context_sentence_de": "Ich stehe um sechs Uhr auf."
  },
  {
    "word_de": "sechzehn",
    "context_sentence_de": "Meine Tochter ist sechzehn Jahre alt."
  },
  {
    "word_de": "sehr",
    "context_sentence_de": "Der Kurs ist sehr interessant."
  },
  {
    "word_de": "sehr gut",
    "context_sentence_de": "Das Essen schmeckt sehr gut."
  },
  {
    "word_de": "sie",
    "context_sentence_de": "Sie kommt aus der Türkei."
  },
  {
    "word_de": "sie (Plural)",
    "context_sentence_de": "Sie lernen zusammen Deutsch."
  },
  {
    "word_de": "sieben",
    "context_sentence_de": "Wir treffen uns um sieben Uhr."
  },
  {
    "word_de": "siebzehn",
    "context_sentence_de": "Mein Bruder ist siebzehn Jahre alt."
  },
  {
    "word_de": "Sohn",
    "context_sentence_de": "Mein Sohn spielt Fußball."
  },
  {
    "word_de": "super",
    "context_sentence_de": "Das hast du super gemacht!"
  },
  {
    "word_de": "Tochter",
    "context_sentence_de": "Meine Tochter liest gern."
  },
  {
    "word_de": "Vater",
    "context_sentence_de": "Mein Vater kocht gern."
  },
  {
    "word_de": "verheiratet",
    "context_sentence_de": "Ich bin seit zehn Jahren verheiratet."
  },
  {
    "word_de": "verstehen",
    "context_sentence_de": "Ich verstehe die Frage nicht."
  },
  {
    "word_de": "vier",
    "context_sentence_de": "Wir sind vier Personen."
  },
  {
    "word_de": "vierzehn",
    "context_sentence_de": "Meine Tochter ist vierzehn Jahre alt."
  },
  {
    "word_de": "Wie alt bist du? – Ich bin 20 Jahre alt.",
    "context_sentence_de": "Wie alt bist du? Ich bin 20 Jahre alt."
  },
  {
    "word_de": "Wie geht es dir?",
    "context_sentence_de": "Wie geht es dir?"
  },
  {
    "word_de": "Wie geht es Ihnen?",
    "context_sentence_de": "Wie geht es Ihnen?"
  },
  {
    "word_de": "Wie geht's?",
    "context_sentence_de": "Hallo, wie geht's?"
  },
  {
    "word_de": "wir",
    "context_sentence_de": "Wir lernen Deutsch."
  },
  {
    "word_de": "Wo lebt deine Familie? – Meine Familie lebt in …",
    "context_sentence_de": "Wo lebt deine Familie? Meine Familie lebt in Berlin."
  },
  {
    "word_de": "wohnen",
    "context_sentence_de": "Ich wohne in Hannover."
  },
  {
    "word_de": "zehn",
    "context_sentence_de": "Die Pause dauert zehn Minuten."
  },
  {
    "word_de": "zwanzig",
    "context_sentence_de": "Der Kurs kostet zwanzig Euro."
  },
  {
    "word_de": "zwei",
    "context_sentence_de": "Ich habe zwei Kinder."
  },
  {
    "word_de": "zwölf",
    "context_sentence_de": "Wir essen um zwölf Uhr."
  },
  {
    "word_de": "Apfel",
    "context_sentence_de": "Ich esse einen Apfel."
  },
  {
    "word_de": "Apfelsaft",
    "context_sentence_de": "Ich trinke gern Apfelsaft."
  },
  {
    "word_de": "Bäckerei",
    "context_sentence_de": "Ich kaufe Brot in der Bäckerei."
  },
  {
    "word_de": "Banane",
    "context_sentence_de": "Ich esse eine Banane."
  },
  {
    "word_de": "Bier",
    "context_sentence_de": "Ich möchte ein Bier, bitte."
  },
  {
    "word_de": "Birne",
    "context_sentence_de": "Die Birne schmeckt süß."
  },
  {
    "word_de": "brauchen",
    "context_sentence_de": "Wir brauchen Brot und Milch."
  },
  {
    "word_de": "Brot",
    "context_sentence_de": "Ich kaufe ein Brot."
  },
  {
    "word_de": "Brötchen",
    "context_sentence_de": "Ich hätte gern zwei Brötchen."
  },
  {
    "word_de": "Butter",
    "context_sentence_de": "Die Butter steht im Kühlschrank."
  },
  {
    "word_de": "Cent",
    "context_sentence_de": "Das Brötchen kostet fünfzig Cent."
  },
  {
    "word_de": "Das macht … Euro.",
    "context_sentence_de": "Das macht fünf Euro."
  },
  {
    "word_de": "der / die / das",
    "context_sentence_de": "Der Apfel, die Banane und das Brot liegen auf dem Tisch."
  },
  {
    "word_de": "doch",
    "context_sentence_de": "Hast du kein Brot? Doch, hier ist es."
  },
  {
    "word_de": "Ei",
    "context_sentence_de": "Ich esse zum Frühstück ein Ei."
  },
  {
    "word_de": "ein / eine",
    "context_sentence_de": "Ich kaufe einen Apfel und eine Banane."
  },
  {
    "word_de": "einkaufen",
    "context_sentence_de": "Ich gehe heute einkaufen."
  },
  {
    "word_de": "Euro",
    "context_sentence_de": "Das kostet drei Euro."
  },
  {
    "word_de": "finden",
    "context_sentence_de": "Wo finde ich die Milch?"
  },
  {
    "word_de": "Fisch",
    "context_sentence_de": "Am Freitag essen wir Fisch."
  },
  {
    "word_de": "Flasche",
    "context_sentence_de": "Ich kaufe eine Flasche Wasser."
  },
  {
    "word_de": "Fleisch",
    "context_sentence_de": "Ich esse kein Fleisch."
  },
  {
    "word_de": "Gemüse",
    "context_sentence_de": "Wir kaufen frisches Gemüse."
  },
  {
    "word_de": "Gramm",
    "context_sentence_de": "Ich hätte gern zweihundert Gramm Käse."
  },
  {
    "word_de": "haben",
    "context_sentence_de": "Haben Sie heute Zeit?"
  },
  {
    "word_de": "Haben Sie Eier?",
    "context_sentence_de": "Haben Sie Eier?"
  },
  {
    "word_de": "Haben wir Zucker?",
    "context_sentence_de": "Haben wir Zucker?"
  },
  {
    "word_de": "Hackfleisch",
    "context_sentence_de": "Ich brauche ein Pfund Hackfleisch."
  },
  {
    "word_de": "helfen",
    "context_sentence_de": "Kann ich Ihnen helfen?"
  },
  {
    "word_de": "Hunger",
    "context_sentence_de": "Ich habe Hunger."
  },
  {
    "word_de": "Ich brauche …",
    "context_sentence_de": "Ich brauche eine Flasche Wasser."
  },
  {
    "word_de": "Ich hätte gern …",
    "context_sentence_de": "Ich hätte gern ein Brot."
  },
  {
    "word_de": "Ich möchte …",
    "context_sentence_de": "Ich möchte einen Kaffee, bitte."
  },
  {
    "word_de": "Joghurt",
    "context_sentence_de": "Zum Frühstück esse ich Joghurt."
  },
  {
    "word_de": "Kaffee",
    "context_sentence_de": "Ich trinke morgens Kaffee."
  },
  {
    "word_de": "Kann ich Ihnen helfen?",
    "context_sentence_de": "Kann ich Ihnen helfen?"
  },
  {
    "word_de": "Kartoffel",
    "context_sentence_de": "Ich schäle eine Kartoffel."
  },
  {
    "word_de": "Käse",
    "context_sentence_de": "Ich esse gern Brot mit Käse."
  },
  {
    "word_de": "kaufen",
    "context_sentence_de": "Ich kaufe Milch im Supermarkt."
  },
  {
    "word_de": "kein / keine",
    "context_sentence_de": "Ich habe keinen Zucker."
  },
  {
    "word_de": "Kilo",
    "context_sentence_de": "Ich hätte gern ein Kilo Kartoffeln."
  },
  {
    "word_de": "Kiwi",
    "context_sentence_de": "Ich esse eine Kiwi."
  },
  {
    "word_de": "kosten",
    "context_sentence_de": "Wie viel kostet das Brot?"
  },
  {
    "word_de": "Kuchen",
    "context_sentence_de": "Am Sonntag backen wir einen Kuchen."
  },
  {
    "word_de": "Lauch",
    "context_sentence_de": "Für die Suppe brauche ich Lauch."
  },
  {
    "word_de": "Liter",
    "context_sentence_de": "Ich kaufe einen Liter Milch."
  },
  {
    "word_de": "Mehl",
    "context_sentence_de": "Für den Kuchen brauchen wir Mehl."
  },
  {
    "word_de": "Metzgerei",
    "context_sentence_de": "Ich kaufe Fleisch in der Metzgerei."
  },
  {
    "word_de": "Milch",
    "context_sentence_de": "Ich trinke Kaffee mit Milch."
  },
  {
    "word_de": "Mineralwasser",
    "context_sentence_de": "Ich möchte ein Mineralwasser, bitte."
  },
  {
    "word_de": "möchten",
    "context_sentence_de": "Was möchten Sie trinken?"
  },
  {
    "word_de": "Nein, danke. Das ist alles.",
    "context_sentence_de": "Nein, danke. Das ist alles."
  },
  {
    "word_de": "Obst",
    "context_sentence_de": "Ich esse jeden Tag Obst."
  },
  {
    "word_de": "Obst- und Gemüseladen",
    "context_sentence_de": "Ich kaufe Tomaten im Obst- und Gemüseladen."
  },
  {
    "word_de": "Orange",
    "context_sentence_de": "Ich esse eine Orange."
  },
  {
    "word_de": "Pfannkuchen",
    "context_sentence_de": "Heute machen wir Pfannkuchen."
  },
  {
    "word_de": "Pfund",
    "context_sentence_de": "Ich hätte gern ein Pfund Tomaten."
  },
  {
    "word_de": "Reis",
    "context_sentence_de": "Zum Abendessen gibt es Reis mit Gemüse."
  },
  {
    "word_de": "Saft",
    "context_sentence_de": "Möchten Sie ein Glas Saft?"
  },
  {
    "word_de": "Salat",
    "context_sentence_de": "Ich esse einen Salat."
  },
  {
    "word_de": "Salz",
    "context_sentence_de": "Kannst du mir bitte das Salz geben?"
  },
  {
    "word_de": "Schokolade",
    "context_sentence_de": "Ich esse gern Schokolade."
  },
  {
    "word_de": "sonst",
    "context_sentence_de": "Brauchen Sie sonst noch etwas?"
  },
  {
    "word_de": "Sonst noch etwas?",
    "context_sentence_de": "Sonst noch etwas?"
  },
  {
    "word_de": "Spinat",
    "context_sentence_de": "Heute gibt es Kartoffeln mit Spinat."
  },
  {
    "word_de": "Stück",
    "context_sentence_de": "Ich hätte gern ein Stück Kuchen."
  },
  {
    "word_de": "Supermarkt",
    "context_sentence_de": "Der Supermarkt ist bis acht Uhr geöffnet."
  },
  {
    "word_de": "Tee",
    "context_sentence_de": "Ich trinke abends Tee."
  },
  {
    "word_de": "Tomate",
    "context_sentence_de": "Ich schneide eine Tomate."
  },
  {
    "word_de": "Wein",
    "context_sentence_de": "Zum Essen trinke ich ein Glas Wein."
  },
  {
    "word_de": "Wie heißt das auf Deutsch?",
    "context_sentence_de": "Wie heißt das auf Deutsch?"
  },
  {
    "word_de": "Wie viel brauchen Sie denn?",
    "context_sentence_de": "Wie viel brauchen Sie denn?"
  },
  {
    "word_de": "Wurst",
    "context_sentence_de": "Ich hätte gern hundert Gramm Wurst."
  },
  {
    "word_de": "Würstchen",
    "context_sentence_de": "Die Kinder essen gern Würstchen."
  },
  {
    "word_de": "Zucker",
    "context_sentence_de": "Ich trinke meinen Kaffee ohne Zucker."
  },
  {
    "word_de": "Zwiebel",
    "context_sentence_de": "Für die Suppe brauche ich eine Zwiebel."
  },
  {
    "word_de": "aber",
    "context_sentence_de": "Die Wohnung ist klein, aber schön."
  },
  {
    "word_de": "Ach so!",
    "context_sentence_de": "Ach so! Jetzt verstehe ich das."
  },
  {
    "word_de": "Arbeitszimmer",
    "context_sentence_de": "Mein Schreibtisch steht im Arbeitszimmer."
  },
  {
    "word_de": "Bad",
    "context_sentence_de": "Das Bad ist neben der Küche."
  },
  {
    "word_de": "Badewanne",
    "context_sentence_de": "Im Bad steht eine Badewanne."
  },
  {
    "word_de": "Badezimmer",
    "context_sentence_de": "Das Badezimmer ist klein."
  },
  {
    "word_de": "Balkon",
    "context_sentence_de": "Wir frühstücken auf dem Balkon."
  },
  {
    "word_de": "Bett",
    "context_sentence_de": "Das Bett steht im Schlafzimmer."
  },
  {
    "word_de": "billig",
    "context_sentence_de": "Der Tisch ist billig."
  },
  {
    "word_de": "blau",
    "context_sentence_de": "Der Stuhl ist blau."
  },
  {
    "word_de": "braun",
    "context_sentence_de": "Unser Sofa ist braun."
  },
  {
    "word_de": "breit",
    "context_sentence_de": "Der Tisch ist einen Meter breit."
  },
  {
    "word_de": "Das Bad ist dort.",
    "context_sentence_de": "Das Bad ist dort."
  },
  {
    "word_de": "Das gefällt mir. / Das gefällt mir nicht.",
    "context_sentence_de": "Das gefällt mir sehr gut."
  },
  {
    "word_de": "Das Zimmer ist nicht teuer.",
    "context_sentence_de": "Das Zimmer ist nicht teuer."
  },
  {
    "word_de": "Das Zimmer ist sehr schön.",
    "context_sentence_de": "Das Zimmer ist sehr schön."
  },
  {
    "word_de": "Das Zimmer kostet 350 Euro im Monat.",
    "context_sentence_de": "Das Zimmer kostet 350 Euro im Monat."
  },
  {
    "word_de": "der / das / die",
    "context_sentence_de": "Der Tisch, das Bett und die Lampe sind neu."
  },
  {
    "word_de": "Die Möbel sind sehr schön.",
    "context_sentence_de": "Die Möbel sind sehr schön."
  },
  {
    "word_de": "dort",
    "context_sentence_de": "Der Bahnhof ist dort."
  },
  {
    "word_de": "dunkel",
    "context_sentence_de": "Das Zimmer ist zu dunkel."
  },
  {
    "word_de": "dunkelbraun",
    "context_sentence_de": "Der Schrank ist dunkelbraun."
  },
  {
    "word_de": "Dusche",
    "context_sentence_de": "Die Dusche ist im Badezimmer."
  },
  {
    "word_de": "er / es / sie",
    "context_sentence_de": "Der Tisch ist neu. Er ist sehr schön."
  },
  {
    "word_de": "Farbe",
    "context_sentence_de": "Welche Farbe hat Ihr Sofa?"
  },
  {
    "word_de": "Fernseher",
    "context_sentence_de": "Der Fernseher steht im Wohnzimmer."
  },
  {
    "word_de": "Flur",
    "context_sentence_de": "Die Schuhe stehen im Flur."
  },
  {
    "word_de": "Garten",
    "context_sentence_de": "Die Kinder spielen im Garten."
  },
  {
    "word_de": "gefallen",
    "context_sentence_de": "Die Wohnung gefällt mir."
  },
  {
    "word_de": "gelb",
    "context_sentence_de": "Die Wand ist gelb."
  },
  {
    "word_de": "Gerät",
    "context_sentence_de": "Das Gerät funktioniert nicht."
  },
  {
    "word_de": "grau",
    "context_sentence_de": "Der Teppich ist grau."
  },
  {
    "word_de": "groß",
    "context_sentence_de": "Unsere Küche ist groß."
  },
  {
    "word_de": "grün",
    "context_sentence_de": "Der Sessel ist grün."
  },
  {
    "word_de": "Handy",
    "context_sentence_de": "Mein Handy liegt auf dem Tisch."
  },
  {
    "word_de": "hässlich",
    "context_sentence_de": "Ich finde den Schrank hässlich."
  },
  {
    "word_de": "Haus",
    "context_sentence_de": "Wir wohnen in einem Haus mit Garten."
  },
  {
    "word_de": "hell",
    "context_sentence_de": "Das Zimmer ist sehr hell."
  },
  {
    "word_de": "hellbraun",
    "context_sentence_de": "Der Tisch ist hellbraun."
  },
  {
    "word_de": "hellgrün",
    "context_sentence_de": "Die Küche ist hellgrün."
  },
  {
    "word_de": "Herd",
    "context_sentence_de": "Der Herd steht in der Küche."
  },
  {
    "word_de": "hier",
    "context_sentence_de": "Ich wohne hier."
  },
  {
    "word_de": "kennen",
    "context_sentence_de": "Kennen Sie diese Straße?"
  },
  {
    "word_de": "klein",
    "context_sentence_de": "Unsere Wohnung ist klein."
  },
  {
    "word_de": "Küche",
    "context_sentence_de": "Ich koche in der Küche."
  },
  {
    "word_de": "Kühlschrank",
    "context_sentence_de": "Die Milch steht im Kühlschrank."
  },
  {
    "word_de": "Lampe",
    "context_sentence_de": "Die Lampe steht auf dem Tisch."
  },
  {
    "word_de": "möbliert",
    "context_sentence_de": "Das Zimmer ist möbliert."
  },
  {
    "word_de": "Monat",
    "context_sentence_de": "Die Miete kostet sechshundert Euro im Monat."
  },
  {
    "word_de": "neu",
    "context_sentence_de": "Mein Handy ist neu."
  },
  {
    "word_de": "nicht",
    "context_sentence_de": "Ich komme heute nicht."
  },
  {
    "word_de": "Quadratmeter",
    "context_sentence_de": "Die Wohnung hat sechzig Quadratmeter."
  },
  {
    "word_de": "rot",
    "context_sentence_de": "Das Sofa ist rot."
  },
  {
    "word_de": "ruhig",
    "context_sentence_de": "Die Wohnung ist sehr ruhig."
  },
  {
    "word_de": "schmal",
    "context_sentence_de": "Der Flur ist schmal."
  },
  {
    "word_de": "schön",
    "context_sentence_de": "Der Garten ist schön."
  },
  {
    "word_de": "Schrank",
    "context_sentence_de": "Meine Kleidung liegt im Schrank."
  },
  {
    "word_de": "Schreibtisch",
    "context_sentence_de": "Ich arbeite am Schreibtisch."
  },
  {
    "word_de": "schwarz",
    "context_sentence_de": "Der Fernseher ist schwarz."
  },
  {
    "word_de": "Sessel",
    "context_sentence_de": "Ich sitze im Sessel."
  },
  {
    "word_de": "Sofa",
    "context_sentence_de": "Wir sitzen auf dem Sofa."
  },
  {
    "word_de": "Stuhl",
    "context_sentence_de": "Bitte nehmen Sie auf dem Stuhl Platz."
  },
  {
    "word_de": "Teppich",
    "context_sentence_de": "Der Teppich liegt im Wohnzimmer."
  },
  {
    "word_de": "teuer",
    "context_sentence_de": "Die Wohnung ist zu teuer."
  },
  {
    "word_de": "Tisch",
    "context_sentence_de": "Das Essen steht auf dem Tisch."
  },
  {
    "word_de": "Toilette",
    "context_sentence_de": "Wo ist die Toilette?"
  },
  {
    "word_de": "weiß",
    "context_sentence_de": "Die Wand ist weiß."
  },
  {
    "word_de": "Wohnung",
    "context_sentence_de": "Ich suche eine Wohnung."
  },
  {
    "word_de": "Wohnzimmer",
    "context_sentence_de": "Wir sitzen im Wohnzimmer."
  },
  {
    "word_de": "Zimmer",
    "context_sentence_de": "Das Zimmer ist hell und ruhig."
  },
  {
    "word_de": "zusammenwohnen",
    "context_sentence_de": "Wir wohnen seit einem Jahr zusammen."
  },
  {
    "word_de": "Abend",
    "context_sentence_de": "Am Abend lese ich ein Buch."
  },
  {
    "word_de": "Abendessen",
    "context_sentence_de": "Das Abendessen ist fertig."
  },
  {
    "word_de": "am Montag / am Dienstag / am Mittwoch / am Donnerstag / am Freitag / am Samstag / am Sonntag",
    "context_sentence_de": "Am Montag gehe ich zum Deutschkurs."
  },
  {
    "word_de": "am Morgen / am Vormittag / am Mittag / am Nachmittag / am Abend",
    "context_sentence_de": "Am Morgen trinke ich Kaffee."
  },
  {
    "word_de": "Am Nachmittag geht sie spazieren oder kauft ein.",
    "context_sentence_de": "Am Nachmittag geht sie spazieren oder kauft ein."
  },
  {
    "word_de": "anfangen",
    "context_sentence_de": "Wann fängt der Kurs an?"
  },
  {
    "word_de": "anrufen (ruft … an)",
    "context_sentence_de": "Ich rufe meine Mutter an."
  },
  {
    "word_de": "arbeiten",
    "context_sentence_de": "Ich arbeite von Montag bis Freitag."
  },
  {
    "word_de": "aufräumen (räumt … auf)",
    "context_sentence_de": "Ich räume die Küche auf."
  },
  {
    "word_de": "aufstehen (steht … auf)",
    "context_sentence_de": "Ich stehe um sieben Uhr auf."
  },
  {
    "word_de": "besuchen",
    "context_sentence_de": "Am Sonntag besuche ich meine Eltern."
  },
  {
    "word_de": "Café",
    "context_sentence_de": "Wir treffen uns im Café."
  },
  {
    "word_de": "chatten",
    "context_sentence_de": "Ich chatte mit meiner Freundin."
  },
  {
    "word_de": "Deutschkurs",
    "context_sentence_de": "Mein Deutschkurs beginnt um neun Uhr."
  },
  {
    "word_de": "Dienstag",
    "context_sentence_de": "Am Dienstag gehe ich einkaufen."
  },
  {
    "word_de": "Donnerstag",
    "context_sentence_de": "Am Donnerstag habe ich einen Termin."
  },
  {
    "word_de": "einkaufen (kauft … ein)",
    "context_sentence_de": "Sie kauft im Supermarkt ein."
  },
  {
    "word_de": "erst",
    "context_sentence_de": "Der Kurs beginnt erst um zehn Uhr."
  },
  {
    "word_de": "essen (isst)",
    "context_sentence_de": "Er isst gern Gemüse."
  },
  {
    "word_de": "fernsehen (sieht … fern)",
    "context_sentence_de": "Am Abend sieht sie fern."
  },
  {
    "word_de": "Freitag",
    "context_sentence_de": "Am Freitag besuchen wir Freunde."
  },
  {
    "word_de": "früh",
    "context_sentence_de": "Ich stehe morgen früh auf."
  },
  {
    "word_de": "frühstücken",
    "context_sentence_de": "Wir frühstücken um acht Uhr."
  },
  {
    "word_de": "gehen",
    "context_sentence_de": "Ich gehe heute zum Deutschkurs."
  },
  {
    "word_de": "gern",
    "context_sentence_de": "Ich koche gern."
  },
  {
    "word_de": "halb …",
    "context_sentence_de": "Es ist halb acht."
  },
  {
    "word_de": "Hausaufgabe",
    "context_sentence_de": "Ich mache meine Hausaufgabe."
  },
  {
    "word_de": "hören (Musik hören)",
    "context_sentence_de": "Ich höre gern Musik."
  },
  {
    "word_de": "Ich stehe um Viertel nach sieben auf.",
    "context_sentence_de": "Ich stehe um Viertel nach sieben auf."
  },
  {
    "word_de": "in der Nacht",
    "context_sentence_de": "In der Nacht schlafe ich."
  },
  {
    "word_de": "jeden Tag",
    "context_sentence_de": "Ich lerne jeden Tag Deutsch."
  },
  {
    "word_de": "Kino",
    "context_sentence_de": "Am Samstag gehen wir ins Kino."
  },
  {
    "word_de": "kochen",
    "context_sentence_de": "Heute koche ich das Abendessen."
  },
  {
    "word_de": "kurz vor …",
    "context_sentence_de": "Es ist kurz vor acht."
  },
  {
    "word_de": "lange",
    "context_sentence_de": "Wie lange dauert der Kurs?"
  },
  {
    "word_de": "machen",
    "context_sentence_de": "Was machen Sie am Wochenende?"
  },
  {
    "word_de": "mit",
    "context_sentence_de": "Ich gehe mit meiner Freundin spazieren."
  },
  {
    "word_de": "Mittag",
    "context_sentence_de": "Am Mittag essen wir zusammen."
  },
  {
    "word_de": "Mittwoch",
    "context_sentence_de": "Am Mittwoch habe ich Deutschunterricht."
  },
  {
    "word_de": "Montag",
    "context_sentence_de": "Am Montag beginnt die neue Woche."
  },
  {
    "word_de": "Morgen",
    "context_sentence_de": "Am Morgen frühstücke ich zu Hause."
  },
  {
    "word_de": "müde",
    "context_sentence_de": "Ich bin heute sehr müde."
  },
  {
    "word_de": "Musik",
    "context_sentence_de": "Welche Musik hören Sie gern?"
  },
  {
    "word_de": "Nachmittag",
    "context_sentence_de": "Am Nachmittag gehe ich einkaufen."
  },
  {
    "word_de": "Nacht",
    "context_sentence_de": "In der Nacht ist es ruhig."
  },
  {
    "word_de": "oder",
    "context_sentence_de": "Möchten Sie Kaffee oder Tee?"
  },
  {
    "word_de": "Öffnungszeit",
    "context_sentence_de": "Wie sind die Öffnungszeiten?"
  },
  {
    "word_de": "Pia räumt die Küche auf.",
    "context_sentence_de": "Pia räumt die Küche auf."
  },
  {
    "word_de": "Präsentation",
    "context_sentence_de": "Ich mache eine Präsentation im Deutschkurs."
  },
  {
    "word_de": "Samstag",
    "context_sentence_de": "Am Samstag schlafe ich lange."
  },
  {
    "word_de": "schon",
    "context_sentence_de": "Es ist schon acht Uhr."
  },
  {
    "word_de": "Sie geht zum Deutschkurs.",
    "context_sentence_de": "Sie geht zum Deutschkurs."
  },
  {
    "word_de": "Sie kocht das Abendessen.",
    "context_sentence_de": "Sie kocht das Abendessen."
  },
  {
    "word_de": "Sie ruft ihre Familie an.",
    "context_sentence_de": "Sie ruft ihre Familie an."
  },
  {
    "word_de": "Sonntag",
    "context_sentence_de": "Am Sonntag besuchen wir unsere Familie."
  },
  {
    "word_de": "spät",
    "context_sentence_de": "Es ist schon spät."
  },
  {
    "word_de": "spazieren gehen",
    "context_sentence_de": "Wir gehen im Park spazieren."
  },
  {
    "word_de": "spielen",
    "context_sentence_de": "Die Kinder spielen im Garten."
  },
  {
    "word_de": "täglich",
    "context_sentence_de": "Ich übe täglich Deutsch."
  },
  {
    "word_de": "Uhr",
    "context_sentence_de": "Es ist acht Uhr."
  },
  {
    "word_de": "Uhrzeit",
    "context_sentence_de": "Wie spät ist es?"
  },
  {
    "word_de": "um (um 7 Uhr)",
    "context_sentence_de": "Der Kurs beginnt um neun Uhr."
  },
  {
    "word_de": "Viertel nach …",
    "context_sentence_de": "Es ist Viertel nach sieben."
  },
  {
    "word_de": "Viertel vor …",
    "context_sentence_de": "Es ist Viertel vor acht."
  },
  {
    "word_de": "Vormittag",
    "context_sentence_de": "Am Vormittag lerne ich Deutsch."
  },
  {
    "word_de": "wann?",
    "context_sentence_de": "Wann beginnt der Kurs?"
  },
  {
    "word_de": "zusammen",
    "context_sentence_de": "Wir lernen zusammen."
  },
  {
    "word_de": "Ausflug",
    "context_sentence_de": "Am Sonntag machen wir einen Ausflug."
  },
  {
    "word_de": "Auto",
    "context_sentence_de": "Mein Auto steht vor dem Haus."
  },
  {
    "word_de": "Auto fahren",
    "context_sentence_de": "Ich kann Auto fahren."
  },
  {
    "word_de": "bewölkt",
    "context_sentence_de": "Heute ist es bewölkt."
  },
  {
    "word_de": "bleiben",
    "context_sentence_de": "Heute bleibe ich zu Hause."
  },
  {
    "word_de": "bringen",
    "context_sentence_de": "Ich bringe einen Salat mit."
  },
  {
    "word_de": "Die Sonne scheint.",
    "context_sentence_de": "Die Sonne scheint."
  },
  {
    "word_de": "Durst",
    "context_sentence_de": "Ich habe Durst."
  },
  {
    "word_de": "einen Ausflug machen",
    "context_sentence_de": "Wir möchten einen Ausflug machen."
  },
  {
    "word_de": "Es ist warm / kalt / windig / bewölkt.",
    "context_sentence_de": "Heute ist es warm."
  },
  {
    "word_de": "Es regnet. / Es schneit.",
    "context_sentence_de": "Heute regnet es."
  },
  {
    "word_de": "Es sind 25 Grad.",
    "context_sentence_de": "Es sind 25 Grad."
  },
  {
    "word_de": "fahren (fährt)",
    "context_sentence_de": "Er fährt mit dem Bus zur Arbeit."
  },
  {
    "word_de": "Fahrrad",
    "context_sentence_de": "Mein Fahrrad steht im Keller."
  },
  {
    "word_de": "Fahrrad fahren",
    "context_sentence_de": "Ich fahre gern Fahrrad."
  },
  {
    "word_de": "fotografieren",
    "context_sentence_de": "Ich fotografiere gern Blumen."
  },
  {
    "word_de": "Freizeit",
    "context_sentence_de": "Was machen Sie in Ihrer Freizeit?"
  },
  {
    "word_de": "Freund / Freundin",
    "context_sentence_de": "Meine Freundin kommt heute zu Besuch."
  },
  {
    "word_de": "Freunde treffen",
    "context_sentence_de": "Am Wochenende treffe ich Freunde."
  },
  {
    "word_de": "Frühling",
    "context_sentence_de": "Im Frühling wird es warm."
  },
  {
    "word_de": "Fußball spielen",
    "context_sentence_de": "Mein Sohn spielt gern Fußball."
  },
  {
    "word_de": "Gitarre",
    "context_sentence_de": "Meine Gitarre steht im Wohnzimmer."
  },
  {
    "word_de": "Gitarre spielen",
    "context_sentence_de": "Ich spiele gern Gitarre."
  },
  {
    "word_de": "Grad",
    "context_sentence_de": "Heute sind es zwanzig Grad."
  },
  {
    "word_de": "grillen",
    "context_sentence_de": "Am Samstag grillen wir im Garten."
  },
  {
    "word_de": "heiß",
    "context_sentence_de": "Im Sommer ist es oft heiß."
  },
  {
    "word_de": "Herbst",
    "context_sentence_de": "Im Herbst regnet es oft."
  },
  {
    "word_de": "Hobby",
    "context_sentence_de": "Mein Hobby ist Lesen."
  },
  {
    "word_de": "Hund",
    "context_sentence_de": "Ich gehe mit meinem Hund spazieren."
  },
  {
    "word_de": "Ich tanze gern. / Ich lese gern.",
    "context_sentence_de": "Ich tanze gern."
  },
  {
    "word_de": "Ich treffe am Wochenende Freunde.",
    "context_sentence_de": "Ich treffe am Wochenende Freunde."
  },
  {
    "word_de": "Idee",
    "context_sentence_de": "Das ist eine gute Idee."
  },
  {
    "word_de": "im Frühling / im Sommer / im Herbst / im Winter",
    "context_sentence_de": "Im Sommer gehen wir schwimmen."
  },
  {
    "word_de": "Im Sommer ist es heiß.",
    "context_sentence_de": "Im Sommer ist es heiß."
  },
  {
    "word_de": "Internet",
    "context_sentence_de": "Ich suche die Adresse im Internet."
  },
  {
    "word_de": "kalt",
    "context_sentence_de": "Heute ist es kalt."
  },
  {
    "word_de": "lesen (liest)",
    "context_sentence_de": "Sie liest gern Bücher."
  },
  {
    "word_de": "lieber (Ich tanze lieber.)",
    "context_sentence_de": "Ich trinke lieber Tee."
  },
  {
    "word_de": "losgehen",
    "context_sentence_de": "Wann gehen wir los?"
  },
  {
    "word_de": "Mundharmonika",
    "context_sentence_de": "Mein Vater spielt Mundharmonika."
  },
  {
    "word_de": "nehmen",
    "context_sentence_de": "Ich nehme einen Kaffee, bitte."
  },
  {
    "word_de": "Picknick",
    "context_sentence_de": "Wir machen ein Picknick im Park."
  },
  {
    "word_de": "plus / minus",
    "context_sentence_de": "Heute sind es minus zwei Grad."
  },
  {
    "word_de": "Radio",
    "context_sentence_de": "Am Morgen höre ich Radio."
  },
  {
    "word_de": "Regen",
    "context_sentence_de": "Wir bleiben bei Regen zu Hause."
  },
  {
    "word_de": "regnen (Es regnet.)",
    "context_sentence_de": "Heute regnet es."
  },
  {
    "word_de": "scheinen (Die Sonne scheint.)",
    "context_sentence_de": "Die Sonne scheint."
  },
  {
    "word_de": "Schnee",
    "context_sentence_de": "Im Garten liegt Schnee."
  },
  {
    "word_de": "schneien (Es schneit.)",
    "context_sentence_de": "Im Winter schneit es manchmal."
  },
  {
    "word_de": "schwimmen",
    "context_sentence_de": "Ich gehe gern schwimmen."
  },
  {
    "word_de": "singen",
    "context_sentence_de": "Meine Tochter singt gern."
  },
  {
    "word_de": "Sommer",
    "context_sentence_de": "Im Sommer fahren wir ans Meer."
  },
  {
    "word_de": "Sonne",
    "context_sentence_de": "Die Sonne scheint heute."
  },
  {
    "word_de": "sonnig",
    "context_sentence_de": "Morgen wird es sonnig."
  },
  {
    "word_de": "Speisekarte",
    "context_sentence_de": "Kann ich bitte die Speisekarte haben?"
  },
  {
    "word_de": "stricken",
    "context_sentence_de": "Meine Oma strickt gern."
  },
  {
    "word_de": "tanzen",
    "context_sentence_de": "Wir tanzen gern zusammen."
  },
  {
    "word_de": "telefonieren",
    "context_sentence_de": "Ich telefoniere mit meiner Schwester."
  },
  {
    "word_de": "Temperatur",
    "context_sentence_de": "Die Temperatur steigt auf zwanzig Grad."
  },
  {
    "word_de": "Tennis spielen",
    "context_sentence_de": "Am Samstag spiele ich Tennis."
  },
  {
    "word_de": "treffen (trifft)",
    "context_sentence_de": "Sie trifft ihre Freunde im Café."
  },
  {
    "word_de": "überall",
    "context_sentence_de": "Im Frühling blühen überall Blumen."
  },
  {
    "word_de": "unter Null",
    "context_sentence_de": "Die Temperatur liegt unter Null."
  },
  {
    "word_de": "vergessen (vergisst)",
    "context_sentence_de": "Er vergisst oft seinen Schlüssel."
  },
  {
    "word_de": "viel / viele",
    "context_sentence_de": "Ich habe viele Freunde."
  },
  {
    "word_de": "vielleicht",
    "context_sentence_de": "Vielleicht komme ich morgen."
  },
  {
    "word_de": "wandern",
    "context_sentence_de": "Am Wochenende gehen wir wandern."
  },
  {
    "word_de": "warm",
    "context_sentence_de": "Heute ist es schön warm."
  },
  {
    "word_de": "Was machst du in der Freizeit?",
    "context_sentence_de": "Was machst du in der Freizeit?"
  },
  {
    "word_de": "Wetter",
    "context_sentence_de": "Wie ist das Wetter heute?"
  },
  {
    "word_de": "Wetterbericht",
    "context_sentence_de": "Ich höre den Wetterbericht im Radio."
  },
  {
    "word_de": "wichtig",
    "context_sentence_de": "Dieser Termin ist wichtig."
  },
  {
    "word_de": "windig",
    "context_sentence_de": "Heute ist es sehr windig."
  },
  {
    "word_de": "Winter",
    "context_sentence_de": "Im Winter ist es kalt."
  },
  {
    "word_de": "Wir machen einen Ausflug.",
    "context_sentence_de": "Wir machen einen Ausflug."
  },
  {
    "word_de": "Wolke",
    "context_sentence_de": "Am Himmel ist eine große Wolke."
  },
  {
    "word_de": "Am Nachmittag kommt Lea nach Hause.",
    "context_sentence_de": "Am Nachmittag kommt Lea nach Hause."
  },
  {
    "word_de": "Arzt",
    "context_sentence_de": "Ich habe einen Termin beim Arzt."
  },
  {
    "word_de": "Ärztin",
    "context_sentence_de": "Die Ärztin untersucht mich."
  },
  {
    "word_de": "auf jeden Fall",
    "context_sentence_de": "Ich komme auf jeden Fall."
  },
  {
    "word_de": "aufwecken (weckt … auf)",
    "context_sentence_de": "Kannst du mich um sieben Uhr aufwecken?"
  },
  {
    "word_de": "backen",
    "context_sentence_de": "Wir backen einen Kuchen."
  },
  {
    "word_de": "Bauchweh",
    "context_sentence_de": "Mein Kind hat Bauchweh."
  },
  {
    "word_de": "Das Abendessen ist fertig.",
    "context_sentence_de": "Das Abendessen ist fertig."
  },
  {
    "word_de": "Das hat richtig Spaß gemacht.",
    "context_sentence_de": "Das hat richtig Spaß gemacht."
  },
  {
    "word_de": "Fehler",
    "context_sentence_de": "Ich habe einen Fehler gemacht."
  },
  {
    "word_de": "fertig",
    "context_sentence_de": "Ich bin mit der Hausaufgabe fertig."
  },
  {
    "word_de": "Frühstück",
    "context_sentence_de": "Zum Frühstück esse ich Brot."
  },
  {
    "word_de": "gestern",
    "context_sentence_de": "Gestern war ich im Deutschkurs."
  },
  {
    "word_de": "heute",
    "context_sentence_de": "Heute lerne ich Deutsch."
  },
  {
    "word_de": "Ich kann nicht in die Schule gehen. Ich bin krank.",
    "context_sentence_de": "Ich kann nicht in die Schule gehen. Ich bin krank."
  },
  {
    "word_de": "Jonas hat Englisch gelernt.",
    "context_sentence_de": "Jonas hat Englisch gelernt."
  },
  {
    "word_de": "Kannst du Timo aufwecken?",
    "context_sentence_de": "Kannst du Timo aufwecken?"
  },
  {
    "word_de": "kaufen → hat gekauft",
    "context_sentence_de": "Ich habe gestern Brot gekauft."
  },
  {
    "word_de": "Klavier spielen",
    "context_sentence_de": "Meine Tochter spielt Klavier."
  },
  {
    "word_de": "können (kann, kannst, können)",
    "context_sentence_de": "Ich kann ein bisschen Deutsch sprechen."
  },
  {
    "word_de": "krank",
    "context_sentence_de": "Ich bin heute krank."
  },
  {
    "word_de": "Kurs",
    "context_sentence_de": "Mein Kurs beginnt um neun Uhr."
  },
  {
    "word_de": "lernen → hat gelernt",
    "context_sentence_de": "Ich habe gestern Deutsch gelernt."
  },
  {
    "word_de": "machen → hat gemacht",
    "context_sentence_de": "Ich habe meine Hausaufgabe gemacht."
  },
  {
    "word_de": "Mathematik / Mathe",
    "context_sentence_de": "Mein Sohn lernt Mathematik."
  },
  {
    "word_de": "nach Hause / heim",
    "context_sentence_de": "Nach dem Kurs gehe ich nach Hause."
  },
  {
    "word_de": "Note",
    "context_sentence_de": "Meine Tochter hat eine gute Note bekommen."
  },
  {
    "word_de": "prima / super",
    "context_sentence_de": "Das hast du prima gemacht!"
  },
  {
    "word_de": "Prüfung",
    "context_sentence_de": "Morgen habe ich eine Prüfung."
  },
  {
    "word_de": "pünktlich",
    "context_sentence_de": "Bitte kommen Sie pünktlich."
  },
  {
    "word_de": "reiten",
    "context_sentence_de": "Meine Tochter reitet gern."
  },
  {
    "word_de": "schmecken",
    "context_sentence_de": "Das Essen schmeckt sehr gut."
  },
  {
    "word_de": "schreiben",
    "context_sentence_de": "Ich schreibe eine E-Mail."
  },
  {
    "word_de": "schreiben → hat geschrieben",
    "context_sentence_de": "Ich habe eine E-Mail geschrieben."
  },
  {
    "word_de": "Schule",
    "context_sentence_de": "Meine Kinder gehen in die Schule."
  },
  {
    "word_de": "Schüler / Schülerin",
    "context_sentence_de": "Die Schülerin lernt Deutsch."
  },
  {
    "word_de": "Team",
    "context_sentence_de": "Wir sind ein gutes Team."
  },
  {
    "word_de": "Test",
    "context_sentence_de": "Heute schreiben wir einen Test."
  },
  {
    "word_de": "Unterricht",
    "context_sentence_de": "Der Unterricht beginnt um neun Uhr."
  },
  {
    "word_de": "Wir sind ein prima Team!",
    "context_sentence_de": "Wir sind ein prima Team!"
  },
  {
    "word_de": "wollen (will, willst, wollen)",
    "context_sentence_de": "Ich will Deutsch lernen."
  }
]
$examples$::jsonb)
AS s(word_de text,context_sentence_de text)
WHERE c.word_de=s.word_de AND c.context_sentence_de IS NULL;

UPDATE public.vocabulary_cards c SET
 context_sentence_en=coalesce(c.context_sentence_en,s.en),
 context_sentence_ru=coalesce(c.context_sentence_ru,s.ru),
 context_sentence_uk=coalesce(c.context_sentence_uk,s.uk),
 context_sentence_tr=coalesce(c.context_sentence_tr,s.tr),
 sentence_practice=true
FROM jsonb_to_recordset($sentences$
[
  {
    "word_de": "Name",
    "de": "Wie ist Ihr Name?",
    "en": "What is your name?",
    "ru": "Как вас зовут?",
    "uk": "Як вас звати?",
    "tr": "Adınız nedir?"
  },
  {
    "word_de": "Deutsch",
    "de": "Ich lerne Deutsch.",
    "en": "I am learning German.",
    "ru": "Я учу немецкий.",
    "uk": "Я вчу німецьку.",
    "tr": "Almanca öğreniyorum."
  },
  {
    "word_de": "Deutschland",
    "de": "Ich wohne in Deutschland.",
    "en": "I live in Germany.",
    "ru": "Я живу в Германии.",
    "uk": "Я живу в Німеччині.",
    "tr": "Almanya'da yaşıyorum."
  },
  {
    "word_de": "Telefonnummer",
    "de": "Wie ist Ihre Telefonnummer?",
    "en": "What is your telephone number?",
    "ru": "Какой у вас номер телефона?",
    "uk": "Який у вас номер телефону?",
    "tr": "Telefon numaranız nedir?"
  },
  {
    "word_de": "Adresse",
    "de": "Wie ist Ihre Adresse?",
    "en": "What is your address?",
    "ru": "Какой у вас адрес?",
    "uk": "Яка у вас адреса?",
    "tr": "Adresiniz nedir?"
  },
  {
    "word_de": "Vorname",
    "de": "Mein Vorname ist Anna.",
    "en": "My first name is Anna.",
    "ru": "Моё имя — Анна.",
    "uk": "Моє ім’я — Анна.",
    "tr": "Benim adım Anna."
  },
  {
    "word_de": "Nachname",
    "de": "Mein Nachname ist Müller.",
    "en": "My surname is Müller.",
    "ru": "Моя фамилия — Мюллер.",
    "uk": "Моє прізвище — Мюллер.",
    "tr": "Soyadım Müller."
  },
  {
    "word_de": "Sprache",
    "de": "Welche Sprache sprechen Sie?",
    "en": "Which language do you speak?",
    "ru": "На каком языке вы говорите?",
    "uk": "Якою мовою ви розмовляєте?",
    "tr": "Hangi dili konuşuyorsunuz?"
  },
  {
    "word_de": "sprechen",
    "de": "Ich spreche Deutsch und Russisch.",
    "en": "I speak German and Russian.",
    "ru": "Я говорю по-немецки и по-русски.",
    "uk": "Я розмовляю німецькою та російською.",
    "tr": "Almanca ve Rusça konuşuyorum."
  },
  {
    "word_de": "kommen",
    "de": "Woher kommen Sie?",
    "en": "Where do you come from?",
    "ru": "Откуда вы?",
    "uk": "Звідки ви?",
    "tr": "Nerelisiniz?"
  },
  {
    "word_de": "Entschuldigung",
    "de": "Entschuldigung, wo ist der Bahnhof?",
    "en": "Excuse me, where is the station?",
    "ru": "Извините, где вокзал?",
    "uk": "Вибачте, де вокзал?",
    "tr": "Affedersiniz, tren istasyonu nerede?"
  },
  {
    "word_de": "danke",
    "de": "Danke für Ihre Hilfe!",
    "en": "Thank you for your help!",
    "ru": "Спасибо за вашу помощь!",
    "uk": "Дякую за вашу допомогу!",
    "tr": "Yardımınız için teşekkürler!"
  },
  {
    "word_de": "wohnen",
    "de": "Ich wohne in Hannover.",
    "en": "I live in Hanover.",
    "ru": "Я живу в Ганновере.",
    "uk": "Я живу в Ганновері.",
    "tr": "Hannover'de yaşıyorum."
  },
  {
    "word_de": "lernen",
    "de": "Wir lernen zusammen Deutsch.",
    "en": "We are learning German together.",
    "ru": "Мы вместе учим немецкий.",
    "uk": "Ми разом вчимо німецьку.",
    "tr": "Birlikte Almanca öğreniyoruz."
  },
  {
    "word_de": "Familie",
    "de": "Meine Familie lebt in Deutschland.",
    "en": "My family lives in Germany.",
    "ru": "Моя семья живёт в Германии.",
    "uk": "Моя сім’я живе в Німеччині.",
    "tr": "Ailem Almanya'da yaşıyor."
  },
  {
    "word_de": "verstehen",
    "de": "Ich verstehe die Frage nicht.",
    "en": "I do not understand the question.",
    "ru": "Я не понимаю вопрос.",
    "uk": "Я не розумію запитання.",
    "tr": "Soruyu anlamıyorum."
  },
  {
    "word_de": "Kaffee",
    "de": "Ich trinke morgens Kaffee.",
    "en": "I drink coffee in the morning.",
    "ru": "Я пью кофе по утрам.",
    "uk": "Я п’ю каву вранці.",
    "tr": "Sabahları kahve içerim."
  },
  {
    "word_de": "Brot",
    "de": "Ich kaufe ein Brot.",
    "en": "I am buying a loaf of bread.",
    "ru": "Я покупаю буханку хлеба.",
    "uk": "Я купую хлібину.",
    "tr": "Bir ekmek alıyorum."
  },
  {
    "word_de": "Wohnung",
    "de": "Ich suche eine Wohnung.",
    "en": "I am looking for a flat.",
    "ru": "Я ищу квартиру.",
    "uk": "Я шукаю квартиру.",
    "tr": "Bir daire arıyorum."
  },
  {
    "word_de": "Küche",
    "de": "Ich koche in der Küche.",
    "en": "I am cooking in the kitchen.",
    "ru": "Я готовлю на кухне.",
    "uk": "Я готую на кухні.",
    "tr": "Mutfakta yemek yapıyorum."
  },
  {
    "word_de": "arbeiten",
    "de": "Ich arbeite von Montag bis Freitag.",
    "en": "I work from Monday to Friday.",
    "ru": "Я работаю с понедельника по пятницу.",
    "uk": "Я працюю з понеділка до п’ятниці.",
    "tr": "Pazartesiden cumaya kadar çalışıyorum."
  },
  {
    "word_de": "müde",
    "de": "Ich bin heute sehr müde.",
    "en": "I am very tired today.",
    "ru": "Я сегодня очень устал.",
    "uk": "Я сьогодні дуже втомився.",
    "tr": "Bugün çok yorgunum."
  },
  {
    "word_de": "Wetter",
    "de": "Wie ist das Wetter heute?",
    "en": "What is the weather like today?",
    "ru": "Какая сегодня погода?",
    "uk": "Яка сьогодні погода?",
    "tr": "Bugün hava nasıl?"
  },
  {
    "word_de": "schreiben",
    "de": "Ich schreibe eine E-Mail.",
    "en": "I am writing an email.",
    "ru": "Я пишу электронное письмо.",
    "uk": "Я пишу електронного листа.",
    "tr": "Bir e-posta yazıyorum."
  }
]
$sentences$::jsonb)
AS s(word_de text,de text,en text,ru text,uk text,tr text)
WHERE c.word_de=s.word_de AND c.context_sentence_de=s.de
 AND (c.context_sentence_en IS NULL OR c.context_sentence_en=s.en)
 AND (c.context_sentence_ru IS NULL OR c.context_sentence_ru=s.ru)
 AND (c.context_sentence_uk IS NULL OR c.context_sentence_uk=s.uk)
 AND (c.context_sentence_tr IS NULL OR c.context_sentence_tr=s.tr);
COMMIT;
