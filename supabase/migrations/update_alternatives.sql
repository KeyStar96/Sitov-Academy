-- Auto-generated update script for alternative answers
BEGIN;

-- "Ich habe zwei Kinder." -> Ziffer vs. Wort
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Ich habe 2 Kinder.', 'Ich habe zwei Kinder.']::text[] WHERE id = '054dcd28-6231-4530-84fa-5130a5fe2bc8';

-- "Die Temperatur steigt..." -> Ziffer vs. Wort, °C, Plural/Singular
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Die Temperatur steigt auf 20 Grad.', 'Die Temperatur steigt auf zwanzig Grad.', 'Die Temperatur steigt auf 20 Grad Celsius.', 'Die Temperatur steigt auf 20 °C.', 'Die Temperaturen steigen auf 20 Grad.']::text[] WHERE id = '062ba7b1-099b-4d53-a42e-531b5d8dce6e';

-- "Die Miete kostet..." -> Ziffer vs. Wort, Euro-Zeichen, "pro Monat", Synonym "beträgt"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Die Miete kostet 600 Euro im Monat.', 'Die Miete kostet 600 € im Monat.', 'Die Miete kostet sechshundert Euro im Monat.', 'Die Miete kostet 600 Euro pro Monat.', 'Die Miete beträgt 600 Euro im Monat.']::text[] WHERE id = '0751c7c0-997c-4fc2-99b0-478c796a08d0';

-- "Heute sind es minus 2 Grad." -> Ziffer vs. Wort, Synonym "hat es"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Heute sind es -2 Grad.', 'Heute sind es minus 2 Grad.', 'Heute sind es minus zwei Grad.', 'Heute hat es -2 Grad.', 'Heute hat es minus 2 Grad.']::text[] WHERE id = '09beac3b-bde7-4c12-9b2a-632c46136d02';

-- "Das hast du super gemacht!" -> Gängige Lob-Synonyme im A1-Niveau
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Das hast du super gemacht!', 'Das hast du toll gemacht!', 'Das hast du sehr gut gemacht!', 'Das hast du klasse gemacht!']::text[] WHERE id = '09c21566-126b-49fb-9f1a-b653245fd580';

-- "Wie geht es dir?" -> Mit/Ohne Bindestrich, umgangssprachliche Verkürzung (SQL-Escape: '')
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Wie geht es dir? - Es geht.', 'Wie geht es dir? – Es geht.', 'Wie geht es dir? Es geht.', 'Wie geht''s dir? - Es geht.', 'Wie geht''s? - Es geht.']::text[] WHERE id = '0f88b902-7e86-47f2-b977-9f50e15f601f';

-- "Der Unterricht beginnt..." -> Ziffer vs. Wort, Synonym "fängt an", Synonym "startet"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Der Unterricht beginnt um 9 Uhr.', 'Der Unterricht beginnt um neun Uhr.', 'Der Unterricht fängt um 9 Uhr an.', 'Der Unterricht fängt um neun Uhr an.', 'Der Unterricht startet um 9 Uhr.']::text[] WHERE id = '1037a031-34eb-4699-b40a-254676c2c17b';

-- "Ich lese gern." -> gern vs. gerne (beides 100% gleichwertig)
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Ich lese gern.', 'Ich lese gerne.']::text[] WHERE id = '11a55dd5-4e89-49d5-bda0-bb976072d5c3';

-- "Wo lebt deine Familie?" -> Mit/Ohne Bindestrich, Synonym "wohnt"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Wo lebt deine Familie? - Meine Familie lebt in Berlin.', 'Wo lebt deine Familie? – Meine Familie lebt in Berlin.', 'Wo lebt deine Familie? Meine Familie lebt in Berlin.', 'Wo wohnt deine Familie? - Meine Familie wohnt in Berlin.']::text[] WHERE id = '14b46a4e-cf6d-4c35-bd90-ec926482c11e';

-- "Meine Tochter ist 14 Jahre alt." -> Ziffer vs. Wort, weglassen von "Jahre alt"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Meine Tochter ist 14 Jahre alt.', 'Meine Tochter ist vierzehn Jahre alt.', 'Meine Tochter ist 14.']::text[] WHERE id = '17b37259-9cc4-41fe-b9a5-71befcd9fdb3';

-- "Meine Tochter ist 18 Jahre alt." -> Ziffer vs. Wort, weglassen von "Jahre alt"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Meine Tochter ist 18 Jahre alt.', 'Meine Tochter ist achtzehn Jahre alt.', 'Meine Tochter ist 18.']::text[] WHERE id = '182603e5-d4e9-4741-ba04-eaaf1685d686';

-- "Wer ist das?" -> Mit/Ohne Bindestrich
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Wer ist das? - Das ist meine Schwester.', 'Wer ist das? – Das ist meine Schwester.', 'Wer ist das? Das ist meine Schwester.']::text[] WHERE id = '2aa2d6e5-3c47-4e0c-b425-2b365f8cd1a9';

-- "Wir sind 4 Personen." -> Ziffer vs. Wort, Synonym "Leute"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Wir sind 4 Personen.', 'Wir sind vier Personen.', 'Wir sind 4 Leute.', 'Wir sind vier Leute.']::text[] WHERE id = '2b5181e7-3471-4f3d-8696-cd994f99aff4';

-- "Der Supermarkt ist geöffnet." -> Ziffer vs. Wort, 20 Uhr (Standard für 8 PM), Synonym "hat auf"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Der Supermarkt ist bis 8 Uhr geöffnet.', 'Der Supermarkt ist bis acht Uhr geöffnet.', 'Der Supermarkt ist bis 20 Uhr geöffnet.', 'Der Supermarkt hat bis 8 Uhr auf.', 'Der Supermarkt hat bis 20 Uhr auf.']::text[] WHERE id = '343df964-9479-4004-8124-f8bfdcbd627b';

-- "Der Kurs beginnt..." -> Ziffer vs. Wort, Synonym "fängt an", Synonym "startet"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Der Kurs beginnt um 8 Uhr.', 'Der Kurs beginnt um acht Uhr.', 'Der Kurs fängt um 8 Uhr an.', 'Der Kurs fängt um acht Uhr an.', 'Der Kurs startet um 8 Uhr.']::text[] WHERE id = '38841dcc-f2dd-4a39-8858-610a12fd14b3';

COMMIT;
