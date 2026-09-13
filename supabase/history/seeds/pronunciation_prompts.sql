-- Seed: Aussprache-Übungssätze für alle CEFR-Familien A1–C2.
-- 8 Sätze je Niveau, Fokus auf typische Lautstellen (ch, ü, ö, sch, z …).

INSERT INTO public.pronunciation_prompts (cefr_level, sentence_de, focus, sort_order) VALUES
-- A1
('A1', 'Guten Tag, ich heiße Anna.', 'ie, ch', 1),
('A1', 'Ich komme aus Hannover.', 'kommen, aus', 2),
('A1', 'Das ist mein Freund.', 'eu, nd', 3),
('A1', 'Ich trinke gerne Kaffee.', 'r, ä', 4),
('A1', 'Wo ist der Bahnhof, bitte?', 'ch, hof', 5),
('A1', 'Heute ist das Wetter schön.', 'ö, eu', 6),
('A1', 'Ich habe zwei Brüder.', 'ü, zwei', 7),
('A1', 'Entschuldigung, wie spät ist es?', 'sch, ä', 8),
-- A2
('A2', 'Gestern war ich mit meiner Freundin im Park.', 'war, r', 1),
('A2', 'Kannst du mir bitte helfen?', 'st, pf', 2),
('A2', 'Ich kaufe Brot, Milch und Äpfel.', 'ä, pf', 3),
('A2', 'Wir treffen uns um halb vier vor dem Kino.', 'pf, v', 4),
('A2', 'Meine Wohnung liegt ganz in der Nähe.', 'ö, ch', 5),
('A2', 'Am Wochenende besuche ich meine Eltern.', 'ch, wo', 6),
('A2', 'Der Zug hat zehn Minuten Verspätung.', 'z, ä', 7),
('A2', 'Ich möchte einen Termin beim Arzt machen.', 'ö, ch', 8),
-- B1
('B1', 'Ich bin der Meinung, dass Sport den Alltag erleichtert.', 'ng, ch', 1),
('B1', 'Letztes Jahr habe ich zum ersten Mal allein verreist.', 'z, ei', 2),
('B1', 'Es fällt mir schwer, vor vielen Menschen zu sprechen.', 'sch, ch', 3),
('B1', 'Wenn ich Zeit hätte, würde ich öfter ins Theater gehen.', 'ö, ü', 4),
('B1', 'Die Nachbarin hat uns freundlich begrüßt.', 'ü, ch', 5),
('B1', 'Könntest du das bitte noch einmal wiederholen?', 'ö, ie', 6),
('B1', 'Trotz des Regens sind wir spazieren gegangen.', 'z, sp', 7),
('B1', 'Ich habe mich über die Nachricht sehr gefreut.', 'ü, eu', 8),
-- B2
('B2', 'Es kommt darauf an, wie gründlich man sich vorbereitet.', 'ü, ch', 1),
('B2', 'Die Diskussion hat gezeigt, dass beide Seiten berechtigte Einwände haben.', 'sch, ä', 2),
('B2', 'Ich würde vorschlagen, die Entscheidung um eine Woche zu verschieben.', 'sch, ie', 3),
('B2', 'Eigentlich wollte ich widersprechen, aber mir fehlten die Worte.', 'ch, ei', 4),
('B2', 'Der Vortrag war zwar anspruchsvoll, aber äußerst lehrreich.', 'äu, ch', 5),
('B2', 'Man sollte nicht voreilig urteilen, bevor alle Fakten vorliegen.', 'ei, g', 6),
('B2', 'Inzwischen hat sich die Lage deutlich entspannt.', 'z, sch', 7),
('B2', 'Es wäre wünschenswert, wenn wir uns auf einen Kompromiss einigen könnten.', 'ü, ss', 8),
-- C1
('C1', 'Die These, dass Sprache unser Denken formt, ist keineswegs neu.', 's, z', 1),
('C1', 'Es bedarf einer differenzierten Betrachtung, um vorschnelle Schlüsse zu vermeiden.', 'z, sch', 2),
('C1', 'Ungeachtet aller Einwände bleibt die Kernaussage überzeugend.', 'ä, z', 3),
('C1', 'Die Nuancen der deutschen Satzmelodie entscheiden über Höflichkeit und Distanz.', 'z, ch', 4),
('C1', 'Ein präziser Wortschatz ersetzt mitunter ganze Erklärungen.', 'z, ch', 5),
('C1', 'Sie argumentierte schlüssig, ohne den Gegenüber bloßzustellen.', 'sch, ü', 6),
('C1', 'Die Ironie lag weniger im Inhalt als im Tonfall.', 'ie, f', 7),
('C1', 'Wer Widersprüche aushält, gewinnt an sprachlicher Souveränität.', 'ch, ä', 8),
-- C2
('C2', 'Die feinen Registerwechsel zwischen Amtsdeutsch und Umgangssprache verlangen ein sicheres Gespür.', 'sch, ü', 1),
('C2', 'Selbst flüchtige Alliterationen können einem Satz Gewicht verleihen.', 'fl, tz', 2),
('C2', 'Es ist bezeichnend, wie ein einziges Modalpartikel den ganzen Satz kippt.', 'ch, z', 3),
('C2', 'Zwischen Understatement und Übertreibung liegt die Kunst der Nuance.', 'ü, z', 4),
('C2', 'Die Prosodie verrät oft mehr als die gewählten Lexeme.', 's, ie', 5),
('C2', 'Ein geübtes Ohr unterscheidet Ironie von bloßer Höflichkeit im Bruchteil einer Sekunde.', 'ü, ch', 6),
('C2', 'Sprachliche Eleganz entsteht, wo Präzision und Rhythmus einander tragen.', 'z, ch', 7),
('C2', 'Wer Stil beherrscht, kann auch Schweigen beredt machen.', 'sch, ch', 8);

-- Ergänzung: weitere Sätze je Familie (sort_order 9+), ohne Duplikate zum Kernsatz.
INSERT INTO public.pronunciation_prompts (cefr_level, sentence_de, focus, sort_order)
SELECT v.cefr_level, v.sentence_de, v.focus, v.sort_order
FROM (VALUES
  ('A1', 'Eins, zwei, drei, vier.', 'ei, z', 9),
  ('A1', 'Ich bin müde.', 'ü', 10),
  ('A1', 'Wie geht es Ihnen?', 'ie, ch', 11),
  ('A1', 'Danke schön!', 'sch, ö', 12),
  ('A1', 'Wo ist die Toilette?', 'ie, tt', 13),
  ('A1', 'Ich heiße Jürgen.', 'ü, ei', 14),
  ('A1', 'Ich kaufe Brot, Milch und Käse.', 'au, ch', 15),
  ('A1', 'Wir wohnen in einer kleinen Wohnung.', 'ö, w', 16),
  ('A1', 'Kannst du das bitte wiederholen?', 'ie, ö', 17),
  ('A1', 'Meine Schwester spricht Deutsch.', 'sch, ch', 18),
  ('A1', 'Der Apfel ist süß und rot.', 'pf, ü', 19),
  ('A1', 'Ich möchte einen Tee, bitte.', 'ö, ch', 20),
  ('A2', 'Ich stehe um sieben Uhr auf.', 'st, ie', 9),
  ('A2', 'Im Sommer fahren wir an die Ostsee.', 'mm, ee', 10),
  ('A2', 'Hast du Lust auf einen Spaziergang?', 'st, z', 11),
  ('A2', 'Die Küche ist hell und freundlich.', 'ü, ch', 12),
  ('A2', 'Wir treffen uns nach der Arbeit.', 'ff, ei', 13),
  ('A2', 'Könntest du das Fenster zumachen?', 'ö, ch', 14),
  ('A2', 'Trotz des Regens gehen wir spazieren.', 'z, z', 15),
  ('A2', 'Ich habe gestern einen interessanten Film gesehen.', 'g, ie', 16),
  ('A2', 'Nächste Woche besuchen wir unsere Großeltern.', 'ch, ß', 17),
  ('A2', 'Sie spricht schnell, aber sehr deutlich.', 'ch, eu', 18),
  ('A2', 'Das Frühstück schmeckt besonders gut.', 'ü, sch', 19),
  ('A2', 'Bitte sprechen Sie etwas langsamer.', 'ch, er', 20),
  ('B1', 'Weil ich krank war, habe ich den Kurs verpasst.', 'ei, st', 9),
  ('B1', 'Manchmal fällt es mir schwer, ruhig zu bleiben.', 'ch, ei', 10),
  ('B1', 'Wir haben uns lange über das Thema unterhalten.', 'th, h', 11),
  ('B1', 'Ich versuche, jeden Tag ein bisschen Deutsch zu sprechen.', 'ch, ü', 12),
  ('B1', 'Die Aussprache übe ich am liebsten laut vor dem Spiegel.', 'ss, ü', 13),
  ('B1', 'Es wäre schön, wenn wir uns nächste Woche treffen könnten.', 'ä, ö', 14),
  ('B1', 'Ich würde vorschlagen, die Übung noch einmal zu machen.', 'ü, sch', 15),
  ('B1', 'Je genauer man zuhört, desto besser versteht man die Melodie.', 'au, ie', 16),
  ('B1', 'Nach der Prüfung fühle ich mich erleichtert und müde.', 'ü, ch', 17),
  ('B1', 'Man sollte nicht voreilig urteilen, bevor alle Fakten da sind.', 'ei, g', 18),
  ('B1', 'Die Aussprache klappt besser, wenn man langsam und klar spricht.', 'ch, a', 19),
  ('B2', 'Die Betonung verschiebt die Bedeutung oft um eine ganze Nuance.', 'ö, z', 9),
  ('B2', 'Wer bewusst artikuliert, wird auch in schwierigen Sätzen verstanden.', 'z, ch', 10),
  ('C1', 'Die Prosodie trägt oft mehr Bedeutung als das einzelne Lexem.', 's, ie', 9),
  ('C1', 'Ein geübtes Ohr hört den Unterschied zwischen Distanz und Wärme.', 'ü, ä', 10),
  ('C2', 'Die Kunst liegt darin, schwere Laute leicht und leichte Laute gewichtig zu sprechen.', 'ch, ei', 9),
  ('C2', 'Nur wer die Satzmelodie beherrscht, klingt wirklich idiomatisch.', 'ch, t', 10)
) AS v(cefr_level, sentence_de, focus, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pronunciation_prompts existing
  WHERE existing.sentence_de = v.sentence_de
);
