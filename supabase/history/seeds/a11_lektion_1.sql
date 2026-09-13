-- A1.1 Lektion 1: Begrüßung, Personen, Verben, Herkunft, Länder, Sprachen, Formular, Sätze
-- Ersetzt das Demo-Set "Schritte plus neu". Nur Daten, kein Schema.

DELETE FROM public.vocabulary_cards
WHERE level = 'A1.1'
  AND (
    lesson ILIKE 'Schritte plus neu%'
    OR lesson = 'Lektion 1'
  );

INSERT INTO public.vocabulary_cards
  (lesson, level, word_de, article, plural, translation_ru, translation_tr, translation_en, is_hard_for_ru, is_hard_for_tr)
VALUES
-- Begrüßung und Abschied
('Lektion 1', 'A1.1', 'Hallo', 'none', NULL, 'привет', 'merhaba', 'hello', false, false),
('Lektion 1', 'A1.1', 'Guten Morgen', 'none', NULL, 'доброе утро', 'günaydın', 'good morning', false, false),
('Lektion 1', 'A1.1', 'Guten Tag', 'none', NULL, 'добрый день', 'iyi günler', 'good day', false, false),
('Lektion 1', 'A1.1', 'Guten Abend', 'none', NULL, 'добрый вечер', 'iyi akşamlar', 'good evening', false, false),
('Lektion 1', 'A1.1', 'Gute Nacht', 'none', NULL, 'спокойной ночи', 'iyi geceler', 'good night', false, false),
('Lektion 1', 'A1.1', 'Auf Wiedersehen', 'none', NULL, 'до свидания', 'hoşça kalın', 'goodbye', false, false),
('Lektion 1', 'A1.1', 'Tschüss', 'none', NULL, 'пока', 'hoşça kal', 'bye', false, false),
('Lektion 1', 'A1.1', 'Willkommen', 'none', NULL, 'добро пожаловать', 'hoş geldiniz', 'welcome', false, false),
('Lektion 1', 'A1.1', 'danke', 'none', NULL, 'спасибо', 'teşekkür ederim', 'thank you', false, false),
('Lektion 1', 'A1.1', 'Entschuldigung', 'none', NULL, 'извините', 'affedersiniz', 'excuse me', false, false),
('Lektion 1', 'A1.1', 'Tut mir leid', 'none', NULL, 'мне жаль', 'üzgünüm', 'I am sorry', false, false),
('Lektion 1', 'A1.1', 'Freut mich', 'none', NULL, 'очень приятно', 'memnun oldum', 'nice to meet you', false, false),
-- Personen und Anrede
('Lektion 1', 'A1.1', 'Name', 'der', 'Namen', 'имя', 'ad / isim', 'name', true, false),
('Lektion 1', 'A1.1', 'Vorname', 'der', 'Vornamen', 'имя (личное)', 'ad', 'first name', true, false),
('Lektion 1', 'A1.1', 'Familienname', 'der', 'Familiennamen', 'фамилия', 'soyadı', 'family name', true, false),
('Lektion 1', 'A1.1', 'Nachname', 'der', 'Nachnamen', 'фамилия', 'soyadı', 'last name', true, false),
('Lektion 1', 'A1.1', 'Herr', 'der', 'Herren', 'господин', 'bey', 'Mr / gentleman', false, false),
('Lektion 1', 'A1.1', 'Frau', 'die', 'Frauen', 'женщина / госпожа', 'kadın / hanım', 'woman / Mrs', false, false),
('Lektion 1', 'A1.1', 'Dame', 'die', 'Damen', 'дама', 'hanımefendi', 'lady', false, false),
('Lektion 1', 'A1.1', 'Kind', 'das', 'Kinder', 'ребёнок', 'çocuk', 'child', true, false),
('Lektion 1', 'A1.1', 'Papa', 'der', 'Papas', 'папа', 'baba', 'dad', false, false),
('Lektion 1', 'A1.1', 'ich', 'none', NULL, 'я', 'ben', 'I', false, false),
('Lektion 1', 'A1.1', 'du', 'none', NULL, 'ты', 'sen', 'you (informal)', false, false),
('Lektion 1', 'A1.1', 'Sie', 'none', NULL, 'Вы (вежливая форма)', 'siz (resmi)', 'you (formal)', false, true),
('Lektion 1', 'A1.1', 'wer?', 'none', NULL, 'кто?', 'kim?', 'who?', false, false),
('Lektion 1', 'A1.1', 'wie?', 'none', NULL, 'как?', 'nasıl?', 'how?', false, false),
('Lektion 1', 'A1.1', 'was?', 'none', NULL, 'что?', 'ne?', 'what?', false, false),
('Lektion 1', 'A1.1', 'woher?', 'none', NULL, 'откуда?', 'nereden?', 'where from?', false, false),
-- Verben
('Lektion 1', 'A1.1', 'heißen', 'none', NULL, 'звать(ся) (ich heiße, du heißt, Sie heißen)', 'adım … (ben …, sen …, siz …)', 'to be called', false, false),
('Lektion 1', 'A1.1', 'sein', 'none', NULL, 'быть (ich bin, du bist, Sie sind)', 'olmak (ben …im, sen …sin, siz …siniz)', 'to be', false, true),
('Lektion 1', 'A1.1', 'kommen', 'none', NULL, 'приходить / быть родом (ich komme, du kommst, Sie kommen)', 'gelmek (ben geliyorum, sen geliyorsun, siz geliyorsunuz)', 'to come', false, false),
('Lektion 1', 'A1.1', 'sprechen', 'none', NULL, 'говорить (ich spreche, du sprichst, Sie sprechen)', 'konuşmak (ben konuşuyorum, sen konuşuyorsun, siz konuşuyorsunuz)', 'to speak', false, false),
('Lektion 1', 'A1.1', 'buchstabieren', 'none', NULL, 'произносить по буквам', 'hecelemek', 'to spell', false, false),
('Lektion 1', 'A1.1', 'leben', 'none', NULL, 'жить', 'yaşamak', 'to live', false, false),
-- Herkunft und Sprachen (Partikeln)
('Lektion 1', 'A1.1', 'aus', 'none', NULL, 'из', '…-den / …-dan', 'from', false, false),
('Lektion 1', 'A1.1', 'und', 'none', NULL, 'и', 've', 'and', false, false),
('Lektion 1', 'A1.1', 'auch', 'none', NULL, 'тоже', 'de / da', 'also', false, false),
('Lektion 1', 'A1.1', 'ein bisschen', 'none', NULL, 'немного', 'biraz', 'a little', false, false),
('Lektion 1', 'A1.1', 'ja', 'none', NULL, 'да', 'evet', 'yes', false, false),
('Lektion 1', 'A1.1', 'nein', 'none', NULL, 'нет', 'hayır', 'no', false, false),
('Lektion 1', 'A1.1', 'aha', 'none', NULL, 'ага / понятно', 'anladım', 'I see', false, false),
('Lektion 1', 'A1.1', 'toll', 'none', NULL, 'здорово / класс', 'harika', 'great', false, false),
('Lektion 1', 'A1.1', 'interessant', 'none', NULL, 'интересно', 'ilginç', 'interesting', false, false),
-- Länder
('Lektion 1', 'A1.1', 'Deutschland', 'none', NULL, 'Германия', 'Almanya', 'Germany', false, false),
('Lektion 1', 'A1.1', 'Österreich', 'none', NULL, 'Австрия', 'Avusturya', 'Austria', false, false),
('Lektion 1', 'A1.1', 'Schweiz', 'die', NULL, 'Швейцария', 'İsviçre', 'Switzerland', true, true),
('Lektion 1', 'A1.1', 'Polen', 'none', NULL, 'Польша', 'Polonya', 'Poland', false, false),
('Lektion 1', 'A1.1', 'Türkei', 'die', NULL, 'Турция', 'Türkiye', 'Turkey', true, false),
('Lektion 1', 'A1.1', 'Spanien', 'none', NULL, 'Испания', 'İspanya', 'Spain', false, false),
('Lektion 1', 'A1.1', 'Griechenland', 'none', NULL, 'Греция', 'Yunanistan', 'Greece', false, false),
('Lektion 1', 'A1.1', 'Syrien', 'none', NULL, 'Сирия', 'Suriye', 'Syria', false, false),
('Lektion 1', 'A1.1', 'Italien', 'none', NULL, 'Италия', 'İtalya', 'Italy', false, false),
('Lektion 1', 'A1.1', 'Rumänien', 'none', NULL, 'Румыния', 'Romanya', 'Romania', false, false),
('Lektion 1', 'A1.1', 'Ungarn', 'none', NULL, 'Венгрия', 'Macaristan', 'Hungary', false, false),
('Lektion 1', 'A1.1', 'Bulgarien', 'none', NULL, 'Болгария', 'Bulgaristan', 'Bulgaria', false, false),
-- Sprachen
('Lektion 1', 'A1.1', 'Deutsch', 'none', NULL, 'немецкий', 'Almanca', 'German', false, false),
('Lektion 1', 'A1.1', 'Polnisch', 'none', NULL, 'польский', 'Lehçe', 'Polish', false, false),
('Lektion 1', 'A1.1', 'Türkisch', 'none', NULL, 'турецкий', 'Türkçe', 'Turkish', false, false),
('Lektion 1', 'A1.1', 'Spanisch', 'none', NULL, 'испанский', 'İspanyolca', 'Spanish', false, false),
('Lektion 1', 'A1.1', 'Griechisch', 'none', NULL, 'греческий', 'Yunanca', 'Greek', false, false),
('Lektion 1', 'A1.1', 'Arabisch', 'none', NULL, 'арабский', 'Arapça', 'Arabic', false, false),
('Lektion 1', 'A1.1', 'Englisch', 'none', NULL, 'английский', 'İngilizce', 'English', false, false),
('Lektion 1', 'A1.1', 'Französisch', 'none', NULL, 'французский', 'Fransızca', 'French', false, false),
('Lektion 1', 'A1.1', 'Italienisch', 'none', NULL, 'итальянский', 'İtalyanca', 'Italian', false, false),
('Lektion 1', 'A1.1', 'Sprache', 'die', 'Sprachen', 'язык', 'dil', 'language', true, false),
-- Adresse / Formular
('Lektion 1', 'A1.1', 'Adresse', 'die', 'Adressen', 'адрес', 'adres', 'address', false, false),
('Lektion 1', 'A1.1', 'Straße', 'die', 'Straßen', 'улица', 'sokak / cadde', 'street', false, false),
('Lektion 1', 'A1.1', 'Hausnummer', 'die', 'Hausnummern', 'номер дома', 'kapı numarası', 'house number', false, false),
('Lektion 1', 'A1.1', 'Stadt', 'die', 'Städte', 'город', 'şehir', 'city', true, true),
('Lektion 1', 'A1.1', 'Land', 'das', 'Länder', 'страна', 'ülke', 'country', true, true),
('Lektion 1', 'A1.1', 'Telefon', 'das', 'Telefone', 'телефон', 'telefon', 'telephone', true, false),
('Lektion 1', 'A1.1', 'Telefonnummer', 'die', 'Telefonnummern', 'номер телефона', 'telefon numarası', 'phone number', false, false),
('Lektion 1', 'A1.1', 'E-Mail', 'die', 'E-Mails', 'электронная почта', 'e-posta', 'email', false, false),
('Lektion 1', 'A1.1', 'Anmeldeformular', 'das', 'Anmeldeformulare', 'бланк регистрации', 'kayıt formu', 'registration form', false, false),
('Lektion 1', 'A1.1', 'Visitenkarte', 'die', 'Visitenkarten', 'визитная карточка', 'kartvizit', 'business card', false, false),
('Lektion 1', 'A1.1', 'Buchstabe', 'der', 'Buchstaben', 'буква', 'harf', 'letter (of the alphabet)', false, false),
('Lektion 1', 'A1.1', 'Alphabet', 'das', NULL, 'алфавит', 'alfabe', 'alphabet', true, false),
-- Wichtige Sätze
('Lektion 1', 'A1.1', 'Wie heißen Sie? – Ich heiße …', 'none', NULL, 'Как вас зовут? – Меня зовут …', 'Adınız ne? – Benim adım …', 'What is your name? – My name is …', false, false),
('Lektion 1', 'A1.1', 'Wie heißt du? – Ich heiße …', 'none', NULL, 'Как тебя зовут? – Меня зовут …', 'Adın ne? – Benim adım …', 'What is your name? (informal) – My name is …', false, false),
('Lektion 1', 'A1.1', 'Mein Name ist …', 'none', NULL, 'Меня зовут … / Моё имя …', 'Benim adım …', 'My name is …', false, false),
('Lektion 1', 'A1.1', 'Wer ist das? – Das ist …', 'none', NULL, 'Кто это? – Это …', 'Bu kim? – Bu …', 'Who is that? – That is …', false, false),
('Lektion 1', 'A1.1', 'Woher kommen Sie? – Ich komme aus …', 'none', NULL, 'Откуда вы? – Я из …', 'Nerelisiniz? – Ben …liyim.', 'Where are you from? – I come from …', false, false),
('Lektion 1', 'A1.1', 'Was sprechen Sie? – Ich spreche …', 'none', NULL, 'На каком языке вы говорите? – Я говорю на …', 'Hangi dili konuşuyorsunuz? – … konuşuyorum.', 'What language do you speak? – I speak …', false, false),
('Lektion 1', 'A1.1', 'Ich spreche ein bisschen Deutsch', 'none', NULL, 'Я немного говорю по-немецки', 'Biraz Almanca konuşuyorum', 'I speak a little German', false, false);
