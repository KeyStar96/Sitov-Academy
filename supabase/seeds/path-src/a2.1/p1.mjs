import { I, gap, mc, sb } from '../shared.mjs'

const AUX = 'haben / sein'
const SAMIR = 'Samir schreibt: „Heute Morgen habe ich verschlafen, weil mein Handy aus war. Dann habe ich die S-Bahn verpasst. Zum Glück hat mich meine Nachbarin mit dem Auto mitgenommen. Ich bin nur zehn Minuten zu spät gekommen.“'
const MARTA = 'Marta erzählt: „Ich wohne seit einem Jahr in Leipzig. Zuerst habe ich allein gewohnt, aber das hat mir nicht gefallen. Jetzt lebe ich in einer WG mit zwei Studentinnen. Das finde ich toll, weil wir oft zusammen kochen.“'
const JONAS = 'Nachricht von Jonas: „Stell dir vor, ich habe gestern im Supermarkt eingekauft und an der Kasse bemerkt: Mein Geldbeutel liegt zu Hause! Wie peinlich! Eine Frau hinter mir hat für mich bezahlt. Heute habe ich ihr das Geld gebracht.“'

/** A2.1 · Pfad 1 · Ankommen – Lektionen. Wiederholung und Test: p1-check.mjs */
const path = {
  n: 1,
  slug: 'ankommen',
  title: 'Ankommen',
  t: ['Settling in', 'Первые шаги на новом месте', 'Перші кроки на новому місці', 'Yeni bir yere alışmak'],
  objectives: {
    G1: 'Gründe nennen mit weil: Nebensatz mit dem Verb am Ende – auch mit Modalverb, im Perfekt und mit trennbaren Verben.',
    G2: 'Perfekt der trennbaren Verben: eingekauft, angerufen, aufgestanden, kennengelernt.',
    G3: 'Perfekt der Verben auf -ieren ohne ge-: telefoniert, studiert, passiert.',
    G4: 'Perfekt der nicht trennbaren Verben ohne ge-: erlebt, bemerkt, verpasst, verstanden.',
    G5: "Zugehörigkeit bei Namen: Pauls Vater – und mit von + Dativ: der Vater von Paul.",
    K1: 'Von Pannen im Alltag erzählen und darauf reagieren: Stell dir vor … So ein Pech! Und was ist dann passiert?',
    K2: 'Von Wohn- und Lebensformen erzählen: allein, als Paar, in einer WG; ledig, verheiratet, geschieden; berufstätig, in Rente.',
    K3: "Sagen, wie jemand etwas findet: Das findet er toll. Das gefällt ihm nicht.",
    K4: 'Eine Erzählung gliedern: zuerst, dann, später, schließlich.',
    Z1: 'Kann-Ziele: kurze Erzählungen und Nachrichten über den Alltag verstehen.',
    W1: 'Wortschatz: Familienmitglieder und Lebensformen.',
  },
  nodes: [
    {
      title: 'Familie',
      t: ['Family', 'Семья', 'Родина', 'Aile'],
      card: {
        id: 'p1_familie',
        rule: 'Familie: Der Onkel und die Tante sind die Geschwister von Vater oder Mutter. Ihre Kinder sind der Cousin und die Cousine. Die Kinder von Bruder oder Schwester sind der Neffe und die Nichte. Der Mann von der Schwester ist der Schwager, die Frau vom Bruder ist die Schwägerin. Die Eltern von Ehemann oder Ehefrau sind die Schwiegereltern. Die Kinder von den eigenen Kindern sind die Enkel: der Enkel, die Enkelin.',
        examples: ['Mein Onkel Paul ist der Bruder von meiner Mutter.', 'Die Tochter von meiner Schwester ist meine Nichte.', 'Am Sonntag besuchen wir die Schwiegereltern.'],
        highlight: 'article',
        t: [
          'Family: der Onkel (uncle) and die Tante (aunt) are the brothers and sisters of your father or mother. Their children are der Cousin and die Cousine (cousins). The children of your brother or sister are der Neffe (nephew) and die Nichte (niece). Your sister’s husband is der Schwager (brother-in-law), your brother’s wife is die Schwägerin (sister-in-law). The parents of your husband or wife are die Schwiegereltern (parents-in-law). The children of your own children are die Enkel: der Enkel (grandson), die Enkelin (granddaughter).',
          'Семья: der Onkel (дядя) и die Tante (тётя) – братья и сёстры отца или матери. Их дети – der Cousin (двоюродный брат) и die Cousine (двоюродная сестра). Дети брата или сестры – der Neffe (племянник) и die Nichte (племянница). Муж сестры – der Schwager, жена брата – die Schwägerin. Родители мужа или жены – die Schwiegereltern (свёкор и свекровь, тесть и тёща). Дети своих детей – die Enkel: der Enkel (внук), die Enkelin (внучка).',
          'Родина: der Onkel (дядько) і die Tante (тітка) – брати й сестри батька або матері. Їхні діти – der Cousin (двоюрідний брат) і die Cousine (двоюрідна сестра). Діти брата чи сестри – der Neffe (племінник) і die Nichte (племінниця). Чоловік сестри – der Schwager, дружина брата – die Schwägerin. Батьки чоловіка або дружини – die Schwiegereltern (свекор і свекруха, тесть і теща). Діти власних дітей – die Enkel: der Enkel (онук), die Enkelin (онука).',
          'Aile: der Onkel (amca, dayı) ve die Tante (hala, teyze) anne ya da babanın kardeşleridir. Onların çocukları der Cousin ve die Cousine’dir (kuzen). Kardeşin çocukları der Neffe (erkek yeğen) ve die Nichte’dir (kız yeğen). Kız kardeşin kocası der Schwager (enişte), erkek kardeşin karısı die Schwägerin’dir (yenge). Eşin anne babası die Schwiegereltern’dir (kayınvalide ve kayınpeder). Kendi çocuklarının çocukları die Enkel’dir: der Enkel (erkek torun), die Enkelin (kız torun).',
        ],
        hint: ['Überleg: Wer ist das in der Familie – Geschwister von den Eltern oder Kinder von den Geschwistern?', 'Think: who is it in the family – a brother or sister of your parents, or a child of your brother or sister?', 'Подумайте: кто это в семье – брат или сестра родителей или ребёнок брата или сестры?', 'Подумайте: хто це в родині – брат чи сестра батьків або дитина брата чи сестри?', 'Düşünün: Ailede bu kim – anne babanın kardeşi mi, yoksa kardeşin çocuğu mu?'],
      },
      ex: [
        mc('W1', 'Onkel', I.choose, 'Der Bruder von meinem Vater ist mein …', ['Onkel', 'Neffe', 'Schwager'],
          ['My father’s brother is my …', 'Брат моего отца – это мой …', 'Брат мого батька – це мій …', 'Babamın erkek kardeşi benim …']),
        mc('W1', 'Nichte', I.choose, 'Die Tochter von meinem Bruder ist meine …', ['Nichte', 'Cousine', 'Tante'],
          ['My brother’s daughter is my …', 'Дочь моего брата – это моя …', 'Донька мого брата – це моя …', 'Erkek kardeşimin kızı benim …']),
        mc('W1', 'Schwiegereltern', I.choose, 'Die Eltern von meiner Frau sind meine …', ['Schwiegereltern', 'Großeltern', 'Enkel'],
          ['My wife’s parents are my …', 'Родители моей жены – это мои …', 'Батьки моєї дружини – це мої …', 'Karımın anne babası benim …']),
        mc('W1', 'Familie', I.odd, 'Drei Wörter sind Familienmitglieder, ein Wort nicht.', ['Nachbar', 'Cousin', 'Schwager', 'Neffe'], null),
        gap('W1', 'Tante', I.word, 'Die Schwester von meiner Mutter ist meine ', '.', 'Tante', ['Nichte', 'Cousine'],
          ['My mother’s sister is my aunt.', 'Сестра моей матери – это моя тётя.', 'Сестра моєї матері – це моя тітка.', 'Annemin kız kardeşi benim teyzem.'],
          ['aunt', 'тётя', 'тітка', 'teyze']),
        gap('W1', 'Cousin', I.word, 'Der Sohn von meinem Onkel ist mein ', '.', 'Cousin', ['Neffe', 'Enkel'],
          ['My uncle’s son is my cousin.', 'Сын моего дяди – это мой двоюродный брат.', 'Син мого дядька – це мій двоюрідний брат.', 'Amcamın oğlu benim kuzenim.'],
          ['cousin (male)', 'двоюродный брат', 'двоюрідний брат', 'kuzen (erkek)']),
        gap("W1", "Enkelin", I.word, "Die Tochter eines Sohnes oder einer Tochter ist für die Großeltern ihre ", ".", "Enkelin", ["Nichte","Schwägerin"], ["A son’s or daughter’s daughter is the grandparents’ …","Дочь сына или дочери для бабушки и дедушки — их …","Донька сина чи доньки для бабусі й дідуся — їхня …","Bir oğlun ya da kızın kız çocuğu, büyükanne ve büyükbabanın … olur."], ["granddaughter","внучка","онука","kız torun"], {"c":"p1_familie","hint":["Überleg: Welche Beziehung besteht zwischen den Personen – zum Beispiel zwischen Großeltern und den Kindern ihrer Kinder?","Think about the relationship between the people, for example between grandparents and their children’s children.","Подумайте о родственной связи между людьми, например между бабушкой и дедушкой и детьми их детей.","Подумайте про родинний зв’язок між людьми, наприклад між бабусею й дідусем і дітьми їхніх дітей.","Kişiler arasındaki akrabalık ilişkisini düşünün; örneğin büyükanne ve büyükbaba ile çocuklarının çocukları arasındaki ilişkiyi."],"overrideReason":"Bewahrt den freigegebenen aufgabenspezifischen Text; die gemeinsame Merkkarte hat einen anderen didaktischen Kontext."}),
        gap('W1', 'Schwager', I.word, 'Der Mann von meiner Schwester ist mein ', '.', 'Schwager', ['Neffe', 'Onkel'],
          ['My sister’s husband is my brother-in-law.', 'Муж моей сестры – это мой зять.', 'Чоловік моєї сестри – це мій зять.', 'Kız kardeşimin kocası benim eniştem.'],
          ['brother-in-law', 'зять (муж сестры)', 'зять (чоловік сестри)', 'enişte']),
        sb('W1', 'Cousine', I.order, 'Meine Cousine / wohnt / seit zwei Jahren / in Hamburg.',
          ['My cousin has been living in Hamburg for two years.', 'Моя двоюродная сестра уже два года живёт в Гамбурге.', 'Моя двоюрідна сестра вже два роки живе в Гамбурзі.', 'Kuzenim iki yıldır Hamburg’da yaşıyor.'],
          { alt: ['Seit zwei Jahren wohnt meine Cousine in Hamburg.', 'In Hamburg wohnt meine Cousine seit zwei Jahren.'] }),
      ],
    },
    {
      title: "Antons Vater",
      t: ["Anton’s father","Отец Антона","Батько Антона","Anton’un babası"],
      card: {
  "id": "p1_genitiv",
  "rule": "Wer gehört zu wem? Bei Namen: Name + s, ohne Apostroph: Antons Vater, Pauls Auto, Herrn Kayas Büro. Du kannst auch von + Name sagen: der Vater von Anton. Bei Nomen mit Artikel sagt man von + Dativ: das Auto von meinem Bruder, die Wohnung von meiner Tante, das Haus von meinen Eltern.",
  "examples": [
    "Das ist Leons Cousin.",
    "Das ist der Cousin von Leon.",
    "Die Wohnung von meiner Tante ist groß."
  ],
  "highlight": null,
  "t": [
    "Who belongs to whom? With names: name + s, without an apostrophe: Antons Vater (Anton’s father), Pauls Auto, Herrn Kayas Büro. You can also say von + name: der Vater von Anton. With nouns that have an article you say von + dative: das Auto von meinem Bruder, die Wohnung von meiner Tante, das Haus von meinen Eltern.",
    "Кто кому принадлежит? С именами: имя + s, без апострофа: Antons Vater (отец Антона), Pauls Auto, Herrn Kayas Büro. Можно сказать и von + имя: der Vater von Anton. С существительными с артиклем говорят von + Dativ: das Auto von meinem Bruder, die Wohnung von meiner Tante, das Haus von meinen Eltern.",
    "Хто кому належить? З іменами: ім’я + s, без апострофа: Antons Vater (батько Антона), Pauls Auto, Herrn Kayas Büro. Можна сказати й von + ім’я: der Vater von Anton. З іменниками з артиклем кажуть von + Dativ: das Auto von meinem Bruder, die Wohnung von meiner Tante, das Haus von meinen Eltern.",
    "Kim kime ait? İsimlerde: isim + s, kesme işareti olmadan: Antons Vater (Anton’un babası), Pauls Auto, Herrn Kayas Büro. von + isim de denir: der Vater von Anton. Artikelli adlarda von + Dativ kullanılır: das Auto von meinem Bruder, die Wohnung von meiner Tante, das Haus von meinen Eltern."
  ],
  "hint": [
    "Name + s: Annas Mutter. Mit Artikel: von + Dativ – von meinem Bruder, von meiner Tante.",
    "Name + s: Annas Mutter. With an article: von + dative – von meinem Bruder, von meiner Tante.",
    "Имя + s: Annas Mutter. С артиклем: von + Dativ – von meinem Bruder, von meiner Tante.",
    "Ім’я + s: Annas Mutter. З артиклем: von + Dativ – von meinem Bruder, von meiner Tante.",
    "İsim + s: Annas Mutter. Artikelle: von + Dativ – von meinem Bruder, von meiner Tante."
  ],
  "hints": {
    "dative": [
      "Nach von steht der Dativ: von meinem Bruder / Kind, von meiner Tante, von meinen Eltern.",
      "von takes the dative: von meinem Bruder / Kind, von meiner Tante, von meinen Eltern.",
      "После von стоит Dativ: von meinem Bruder / Kind, von meiner Tante, von meinen Eltern.",
      "Після von стоїть Dativ: von meinem Bruder / Kind, von meiner Tante, von meinen Eltern.",
      "von’dan sonra Dativ gelir: von meinem Bruder / Kind, von meiner Tante, von meinen Eltern."
    ]
  }
},
      ex: [
        mc("G5", "Name + s", I.choose, "Das ist der Vater von Anton. = Das ist ___", ["Antons Vater","Anton Vater","Vaters Anton"], ["This is the father of Anton. = This is …","Это отец Антона. = Это …","Це батько Антона. = Це …","Bu Anton’un babası. = Bu …"], {"c":"p1_genitiv","hint":["Name + s: Antons Vater. Mit Artikel: von + Dativ – von meinem Bruder, von meiner Tante.","Name + s: Antons Vater. With an article: von + dative – von meinem Bruder, von meiner Tante.","Имя + s: Antons Vater. С артиклем: von + Dativ – von meinem Bruder, von meiner Tante.","Ім’я + s: Antons Vater. З артиклем: von + Dativ – von meinem Bruder, von meiner Tante.","İsim + s: Antons Vater. Artikelle: von + Dativ – von meinem Bruder, von meiner Tante."],"overrideReason":"Bewahrt den freigegebenen aufgabenspezifischen Text; die gemeinsame Merkkarte hat einen anderen didaktischen Kontext."}),
        mc("G5", "Name + s", I.choose, "Das Auto gehört Paul. Das ist ___", ["Pauls Auto","Paul Auto","Autos Paul"], ["The car belongs to Paul. It is …","Машина принадлежит Paul. Это …","Машина належить Paul. Це …","Araba Paul’a ait. Bu …"], {"c":"p1_genitiv","hint":["Name + s: Antons Vater. Mit Artikel: von + Dativ – von meinem Bruder, von meiner Tante.","Name + s: Antons Vater. With an article: von + dative – von meinem Bruder, von meiner Tante.","Имя + s: Antons Vater. С артиклем: von + Dativ – von meinem Bruder, von meiner Tante.","Ім’я + s: Antons Vater. З артиклем: von + Dativ – von meinem Bruder, von meiner Tante.","İsim + s: Antons Vater. Artikelle: von + Dativ – von meinem Bruder, von meiner Tante."],"overrideReason":"Bewahrt den freigegebenen aufgabenspezifischen Text; die gemeinsame Merkkarte hat einen anderen didaktischen Kontext."}),
        mc("G5", "von + Dativ", I.choose, "Das ist das Fahrrad ___ meinem Bruder.", ["von","bei","aus"], ["This is my brother’s bike.","Это велосипед моего брата.","Це велосипед мого брата.","Bu erkek kardeşimin bisikleti."], {"h":"dative","c":"p1_genitiv"}),
        mc("G5", "Name + s", I.sentence, "Milan zeigt ein Familienfoto.", ["Das ist Leons Onkel.","Das ist Leon Onkel.","Das ist der Leons Onkel."], ["Milan is showing a family photo.","Milan показывает семейное фото.","Milan показує сімейне фото.","Milan bir aile fotoğrafı gösteriyor."], {"c":"p1_genitiv","hint":["Name + s: Antons Vater. Mit Artikel: von + Dativ – von meinem Bruder, von meiner Tante.","Name + s: Antons Vater. With an article: von + dative – von meinem Bruder, von meiner Tante.","Имя + s: Antons Vater. С артиклем: von + Dativ – von meinem Bruder, von meiner Tante.","Ім’я + s: Antons Vater. З артиклем: von + Dativ – von meinem Bruder, von meiner Tante.","İsim + s: Antons Vater. Artikelle: von + Dativ – von meinem Bruder, von meiner Tante."],"overrideReason":"Bewahrt den freigegebenen aufgabenspezifischen Text; die gemeinsame Merkkarte hat einen anderen didaktischen Kontext."}),
        gap("G5", "Name + s", I.form, "Das ist der Bruder von Emre. Das ist ", " Bruder.", "Emres", ["Emre","Emren"], ["This is the brother of Emre. This is Emre’s brother.","Это брат Emre. Скажите то же самое по-другому: имя + s.","Це брат Emre. Скажіть те саме по-іншому: ім’я + s.","Bu Emre’nin erkek kardeşi. Aynı şeyi başka biçimde söyleyin: isim + s."], "Emre", {"c":"p1_genitiv","hint":["Name + s: Antons Vater. Mit Artikel: von + Dativ – von meinem Bruder, von meiner Tante.","Name + s: Antons Vater. With an article: von + dative – von meinem Bruder, von meiner Tante.","Имя + s: Antons Vater. С артиклем: von + Dativ – von meinem Bruder, von meiner Tante.","Ім’я + s: Antons Vater. З артиклем: von + Dativ – von meinem Bruder, von meiner Tante.","İsim + s: Antons Vater. Artikelle: von + Dativ – von meinem Bruder, von meiner Tante."],"overrideReason":"Bewahrt den freigegebenen aufgabenspezifischen Text; die gemeinsame Merkkarte hat einen anderen didaktischen Kontext."}),
        gap("G5", "Name + s", I.form, "Der Sohn von Oleg heißt Milan. ", " Sohn heißt Milan.", "Olegs", ["Olegn","Oleg"], ["Oleg’s son is called Milan.","Сына Oleg зовут Milan.","Сина Oleg звати Milan.","Oleg’in oğlunun adı Milan."], "Oleg", {"c":"p1_genitiv","hint":["Name + s: Antons Vater. Mit Artikel: von + Dativ – von meinem Bruder, von meiner Tante.","Name + s: Antons Vater. With an article: von + dative – von meinem Bruder, von meiner Tante.","Имя + s: Antons Vater. С артиклем: von + Dativ – von meinem Bruder, von meiner Tante.","Ім’я + s: Antons Vater. З артиклем: von + Dativ – von meinem Bruder, von meiner Tante.","İsim + s: Antons Vater. Artikelle: von + Dativ – von meinem Bruder, von meiner Tante."],"overrideReason":"Bewahrt den freigegebenen aufgabenspezifischen Text; die gemeinsame Merkkarte hat einen anderen didaktischen Kontext.","sitovOptionOrder":["Olegs","Olegn","Oleg"]}),
        gap("G5", "von", I.prep, "Das ist die Wohnung ", " meiner Tante.", "von", ["bei","mit"], ["This is my aunt’s flat.","Это квартира моей тёти.","Це квартира моєї тітки.","Bu teyzemin dairesi."], "von / bei / mit", {"h":"dative","c":"p1_genitiv"}),
        gap("G5", "von + Dativ", I.possessive, "Das ist das Zimmer von ", " Schwester.", "meiner", ["meine","meinem"], ["This is my sister’s room.","Это комната моей сестры.","Це кімната моєї сестри.","Bu kız kardeşimin odası."], "mein", {"h":"dative","c":"p1_genitiv"}),
        gap("G5", "von + Dativ", I.possessive, "Das sind die Kinder von ", " Bruder.", "meinem", ["meinen","meiner"], ["These are my brother’s children.","Это дети моего брата.","Це діти мого брата.","Bunlar erkek kardeşimin çocukları."], "mein", {"h":"dative","c":"p1_genitiv"}),
        sb("G5", "Name + s", I.order, "Das / ist / Antons / Schwager.", ["This is Anton’s brother-in-law, his husband’s brother.","Это брат мужа Антона.","Це брат чоловіка Антона.","Bu Anton’un kayınbiraderi, kocasının erkek kardeşi."], {"c":"p1_genitiv","hint":["Name + s: Antons Vater. Mit Artikel: von + Dativ – von meinem Bruder, von meiner Tante. Hier ist der Schwager der Bruder von Antons Mann.","Name + s: Antons Vater. With an article: von + dative – von meinem Bruder, von meiner Tante. Here the brother-in-law is the brother of Anton’s husband.","Имя + s: Antons Vater. С артиклем: von + Dativ – von meinem Bruder, von meiner Tante. Здесь Schwager — брат мужа Антона.","Ім’я + s: Antons Vater. З артиклем: von + Dativ – von meinem Bruder, von meiner Tante. Тут Schwager — брат чоловіка Антона.","İsim + s: Antons Vater. Artikelle: von + Dativ – von meinem Bruder, von meiner Tante. Burada Schwager, Anton’un kocasının erkek kardeşidir."],"overrideReason":"Bewahrt den freigegebenen aufgabenspezifischen Text; die gemeinsame Merkkarte hat einen anderen didaktischen Kontext."}),
      ],
    },
    {
      title: 'Allein, als Paar oder in der WG',
      t: ['Alone, as a couple or in a shared flat', 'Один, вдвоём или в съёмной квартире с соседями', 'Сам, удвох чи в спільній квартирі', 'Yalnız, çift olarak ya da ortak evde'],
      card: {
  "id": "p1_leben",
  "rule": "So leben Menschen: Ich lebe allein. Ich bin Single. Wir leben als Paar zusammen. Ich wohne in einer Wohngemeinschaft (WG). In einer Großfamilie wohnen Großeltern, Eltern und Kinder zusammen. Familienstand: ledig (nie verheiratet), verheiratet, getrennt, geschieden. Alleinerziehend: Eine Mutter oder ein Vater lebt allein mit dem Kind. Arbeit: berufstätig sein, arbeitslos sein, in Rente sein, studieren, als Koch arbeiten. Zeit: Ich lebe seit drei Jahren allein.",
  "examples": [
    "Mein Onkel ist geschieden und lebt allein.",
    "Wir wohnen zu viert in einer WG.",
    "Mein Opa ist seit zwei Jahren in Rente."
  ],
  "highlight": null,
  "t": [
    "How people live: Ich lebe allein (alone). Ich bin Single. Wir leben als Paar zusammen (together as a couple). Ich wohne in einer Wohngemeinschaft (WG = shared flat). In a Großfamilie (extended family) grandparents, parents and children live together. Marital status: ledig (never married), verheiratet (married), getrennt (separated), geschieden (divorced). Alleinerziehend: a mother or father lives alone with the child (single parent). Work: berufstätig (working), arbeitslos (unemployed), in Rente (retired), studieren, als Koch arbeiten (work as a cook). Time: Ich lebe seit drei Jahren allein.",
    "Как живут люди: Ich lebe allein (один). Ich bin Single. Wir leben als Paar zusammen (вместе как пара). Ich wohne in einer Wohngemeinschaft (WG = квартира, которую снимают вместе). В Großfamilie (большой семье) вместе живут бабушки и дедушки, родители и дети. Семейное положение: ledig (никогда не был в браке), verheiratet (в браке), getrennt (живут раздельно), geschieden (в разводе). Alleinerziehend: мать или отец живёт с ребёнком без партнёра. Работа: berufstätig (работает), arbeitslos (безработный), in Rente (на пенсии), studieren, als Koch arbeiten (работать поваром). Время: Ich lebe seit drei Jahren allein.",
    "Як живуть люди: Ich lebe allein (сам). Ich bin Single. Wir leben als Paar zusammen (разом як пара). Ich wohne in einer Wohngemeinschaft (WG = квартира, яку винаймають разом). У Großfamilie (великій родині) разом живуть бабусі й дідусі, батьки та діти. Сімейний стан: ledig (ніколи не був у шлюбі), verheiratet (у шлюбі), getrennt (живуть окремо), geschieden (розлучений). Alleinerziehend: мати або батько живе з дитиною без партнера. Робота: berufstätig (працює), arbeitslos (безробітний), in Rente (на пенсії), studieren, als Koch arbeiten (працювати кухарем). Час: Ich lebe seit drei Jahren allein.",
    "İnsanlar nasıl yaşar: Ich lebe allein (yalnız). Ich bin Single. Wir leben als Paar zusammen (çift olarak birlikte). Ich wohne in einer Wohngemeinschaft (WG = ortak ev). Bir Großfamilie’de (geniş aile) büyükanne ve büyükbaba, anne baba ve çocuklar birlikte yaşar. Medeni durum: ledig (hiç evlenmemiş), verheiratet (evli), getrennt (ayrı yaşayan), geschieden (boşanmış). Alleinerziehend: Anne ya da baba çocuğuyla yalnız yaşar. İş: berufstätig (çalışan), arbeitslos (işsiz), in Rente (emekli), studieren, als Koch arbeiten (aşçı olarak çalışmak). Zaman: Ich lebe seit drei Jahren allein."
  ],
  "hint": [
    "Familienstand: ledig, verheiratet, getrennt, geschieden. Arbeit: berufstätig, arbeitslos, in Rente.",
    "Marital status: ledig, verheiratet, getrennt, geschieden. Work: berufstätig, arbeitslos, in Rente.",
    "Семейное положение: ledig, verheiratet, getrennt, geschieden. Работа: berufstätig, arbeitslos, in Rente.",
    "Сімейний стан: ledig, verheiratet, getrennt, geschieden. Робота: berufstätig, arbeitslos, in Rente.",
    "Medeni durum: ledig, verheiratet, getrennt, geschieden. İş: berufstätig, arbeitslos, in Rente."
  ]
},
      ex: [
        mc('K2', 'geschieden', I.choose, 'Herr Lindner war verheiratet. Seit einem Jahr ist er nicht mehr verheiratet. Er ist …', ['geschieden', 'ledig', 'berufstätig'],
          ['Mr Lindner was married. For a year he has no longer been married. He is …', 'Господин Lindner был женат. Уже год он не женат. Он …', 'Пан Lindner був одружений. Уже рік він не одружений. Він …', 'Lindner Bey evliydi. Bir yıldır evli değil. O …']),
        mc("K2", "alleinerziehend", I.choose, "Herr Rojas lebt ohne Partner mit seinen zwei Kindern. Er ist ___", ["alleinerziehend","eine Großfamilie","in Rente"], ["Mr Rojas lives with his two children and without a partner. He is …","Господин Rojas живёт с двумя детьми без партнёра. Он …","Пан Rojas живе з двома дітьми без партнера. Він …","Rojas Bey iki çocuğuyla, partneri olmadan yaşıyor. O …"], {"c":"p1_leben"}),
        mc('K2', 'Wohngemeinschaft', I.choose, 'Tim wohnt mit drei Studenten zusammen. Jeder hat ein Zimmer, die Küche benutzen alle. Tim wohnt in einer …', ['Wohngemeinschaft', 'Großfamilie', 'Rente'],
          ['Tim lives with three students. Everyone has a room, they all use the kitchen. Tim lives in a …', 'Tim живёт вместе с тремя студентами. У каждого своя комната, кухня общая. Tim живёт в …', 'Tim живе разом із трьома студентами. У кожного своя кімната, кухня спільна. Tim живе в …', 'Tim üç öğrenciyle birlikte oturuyor. Herkesin bir odası var, mutfağı hep birlikte kullanıyorlar. Tim … oturuyor.']),
        mc('K2', 'in Rente', I.choose, 'Meine Oma ist 70 Jahre alt und arbeitet nicht mehr. Sie ist …', ['in Rente', 'berufstätig', 'ledig'],
          ['My grandma is 70 years old and no longer works. She is …', 'Моей бабушке 70 лет, она больше не работает. Она …', 'Моїй бабусі 70 років, вона більше не працює. Вона …', 'Büyükannem 70 yaşında ve artık çalışmıyor. O …']),
        mc('K2', 'Familienstand', I.react, '„Sind Sie verheiratet?“', ['Nein, ich bin ledig.', 'Nein, ich bin berufstätig.', 'Ja, ich lebe allein.'],
          ['“Are you married?”', '«Вы женаты (замужем)?»', '«Ви одружені?»', '“Evli misiniz?”']),
        gap('K2', 'seit', I.prep, 'Wir leben ', ' fünf Jahren zusammen.', 'seit', ['vor', 'für'],
          ['We have been living together for five years.', 'Мы живём вместе уже пять лет.', 'Ми живемо разом уже п’ять років.', 'Beş yıldır birlikte yaşıyoruz.'], 'seit / vor / für'),
        gap('K2', 'berufstätig', I.word, 'Meine Mutter arbeitet als Ärztin. Sie ist ', '.', 'berufstätig', ['arbeitslos', 'geschieden'],
          ['My mother works as a doctor. She is in work.', 'Моя мама работает врачом. Она работающий человек.', 'Моя мама працює лікаркою. Вона працююча людина.', 'Annem doktor olarak çalışıyor. O çalışan biri.'],
          ['working, in work', 'работающий', 'працюючий', 'çalışan']),
        gap('K2', 'ledig', I.word, 'Jonas ist nicht verheiratet und war nie verheiratet. Er ist ', '.', 'ledig', ['geschieden', 'getrennt'],
          ['Jonas is not married and has never been married. He is single.', 'Jonas не женат и никогда не был женат. Он холост.', 'Jonas не одружений і ніколи не був одружений. Він неодружений.', 'Jonas evli değil ve hiç evlenmedi. O bekâr.'],
          ['single (never married)', 'холост, не замужем', 'неодружений, незаміжня', 'bekâr']),
        gap('K2', 'als', I.word, 'Mein Schwager arbeitet ', ' Busfahrer.', 'als', ['wie', 'bei'],
          ['My brother-in-law works as a bus driver.', 'Мой зять работает водителем автобуса.', 'Мій зять працює водієм автобуса.', 'Eniştem otobüs şoförü olarak çalışıyor.'], 'als / wie / bei'),
        sb('K2', 'allein leben', I.order, 'Ich / lebe / seit einem Jahr / allein.',
          ['I have been living alone for a year.', 'Я уже год живу один.', 'Я вже рік живу сам.', 'Bir yıldır yalnız yaşıyorum.'],
          { alt: ['Seit einem Jahr lebe ich allein.'] }),
      ],
    },
    {
      title: 'weil',
      t: ['weil (because)', 'weil (потому что)', 'weil (тому що)', 'weil (çünkü)'],
      card: {
  "id": "p1_weil",
  "rule": "weil nennt den Grund. Die Frage heißt: Warum? Der weil-Satz ist ein Nebensatz: Das Verb steht am Ende. Zwischen Hauptsatz und weil-Satz steht ein Komma. Ich bleibe zu Hause. Ich bin krank. → Ich bleibe zu Hause, weil ich krank bin. Im Gespräch reicht oft der Nebensatz: Warum kommst du nicht? – Weil ich keine Zeit habe.",
  "examples": [
    "Leon lernt Deutsch, weil er in Berlin arbeitet.",
    "Ich nehme den Bus, weil mein Auto kaputt ist.",
    "Warum bist du müde? – Weil ich wenig schlafe."
  ],
  "highlight": "verb",
  "t": [
    "weil (because) gives the reason. The question is: Warum? (why?) The weil clause is a subordinate clause: the verb goes to the end. A comma separates the main clause from the weil clause. Ich bleibe zu Hause. Ich bin krank. → Ich bleibe zu Hause, weil ich krank bin. In conversation the weil clause alone is often enough: Warum kommst du nicht? – Weil ich keine Zeit habe.",
    "weil (потому что) называет причину. Вопрос: Warum? (почему?) Предложение с weil – придаточное: глагол стоит в конце. Главное предложение и придаточное с weil разделяются запятой. Ich bleibe zu Hause. Ich bin krank. → Ich bleibe zu Hause, weil ich krank bin. В разговоре часто достаточно одного придаточного: Warum kommst du nicht? – Weil ich keine Zeit habe.",
    "weil (тому що) називає причину. Запитання: Warum? (чому?) Речення з weil – підрядне: дієслово стоїть у кінці. Головне речення та підрядне з weil відокремлюються комою. Ich bleibe zu Hause. Ich bin krank. → Ich bleibe zu Hause, weil ich krank bin. У розмові часто достатньо самого підрядного речення: Warum kommst du nicht? – Weil ich keine Zeit habe.",
    "weil (çünkü) nedeni söyler. Soru: Warum? (neden?) weil cümlesi bir yan cümledir: Fiil sonda durur. Ana cümle ile weil yan cümlesi arasına virgül konur. Ich bleibe zu Hause. Ich bin krank. → Ich bleibe zu Hause, weil ich krank bin. Konuşmada çoğu zaman yalnızca yan cümle yeter: Warum kommst du nicht? – Weil ich keine Zeit habe."
  ],
  "hint": [
    "Nach weil steht das Verb am Ende: …, weil ich krank bin.",
    "After weil the verb goes to the end: …, weil ich krank bin.",
    "После weil глагол стоит в конце: …, weil ich krank bin.",
    "Після weil дієслово стоїть у кінці: …, weil ich krank bin.",
    "weil’den sonra fiil sonda durur: …, weil ich krank bin."
  ]
},
      ex: [
        mc('G1', 'Verb am Ende', I.sentence, 'Paul erklärt, warum er nichts isst.', ['Ich esse nichts, weil ich keinen Hunger habe.', 'Ich esse nichts, weil ich habe keinen Hunger.', 'Ich esse nichts, weil habe ich keinen Hunger.'],
          ['Paul explains why he is not eating anything.', 'Paul объясняет, почему он ничего не ест.', 'Paul пояснює, чому він нічого не їсть.', 'Paul neden hiçbir şey yemediğini açıklıyor.']),
        mc('G1', 'Warum? – Weil …', I.react, '„Warum lernst du Deutsch?“', ['Weil ich in Deutschland arbeite.', 'Weil ich arbeite in Deutschland.', 'Weil arbeite ich in Deutschland.'],
          ['“Why are you learning German?”', '«Почему ты учишь немецкий?»', '«Чому ти вчиш німецьку?»', '“Neden Almanca öğreniyorsun?”']),
        mc("G1", "Verb am Ende", I.choose, "Milan geht nicht zur Party. Er ist müde. → Milan geht nicht zur Party, ___", ["weil er müde ist.","weil er ist müde.","weil ist er müde."], ["Milan is not going to the party. He is tired. → Milan is not going to the party because he is tired.","Milan не идёт на вечеринку. Он устал. → Milan не идёт на вечеринку, потому что устал.","Milan не йде на вечірку. Він втомився. → Milan не йде на вечірку, тому що втомився.","Milan partiye gitmiyor. Yorgun. → Milan partiye gitmiyor, çünkü yorgun."], {"c":"p1_weil","sitovOptionOrder":["weil er ist müde.","weil ist er müde.","weil er müde ist."]}),
        mc("G1", "weil", I.choose, "Ich nehme den Bus, ___ mein Fahrrad kaputt ist.", ["weil","und","aber"], ["I am taking the bus because my bike is broken.","Я еду на автобусе, потому что мой велосипед сломан.","Я їду автобусом, тому що мій велосипед зламаний.","Otobüse biniyorum, çünkü bisikletim bozuk."], {"c":"p1_weil","sitovOptionOrder":["und","aber","weil"]}),
        gap('G1', 'weil', I.conjunction, 'Wir bleiben heute zu Hause, ', ' es regnet.', 'weil', ['aber', 'oder'],
          ['We are staying at home today because it is raining.', 'Сегодня мы остаёмся дома, потому что идёт дождь.', 'Сьогодні ми залишаємося вдома, тому що йде дощ.', 'Bugün evde kalıyoruz, çünkü yağmur yağıyor.'], 'weil / aber / oder'),
        gap('G1', 'Verb am Ende', I.verb, 'Paul kauft kein Auto, weil er kein Geld ', '.', 'hat', ['haben', 'hast'],
          ['Paul is not buying a car because he has no money.', 'Paul не покупает машину, потому что у него нет денег.', 'Paul не купує машину, тому що в нього немає грошей.', 'Paul araba almıyor, çünkü parası yok.'], 'haben'),
        gap('G1', 'Verb am Ende', I.verb, 'Ich rufe dich später an, weil ich jetzt im Kurs ', '.', 'bin', ['ist', 'sein'],
          ['I will call you later because I am in class now.', 'Я позвоню тебе позже, потому что сейчас я на курсе.', 'Я зателефоную тобі пізніше, тому що зараз я на курсі.', 'Seni sonra arayacağım, çünkü şimdi kurstayım.'], 'sein'),
        gap("G1", "Verb am Ende", I.verb, "Oleg ist glücklich, weil seine Familie ihn ", ".", "besucht", ["besuchst","besuchen"], ["Oleg is happy because his family is visiting him.","Oleg счастлив, потому что его навещает семья.","Oleg щасливий, тому що його відвідує родина.","Oleg mutlu, çünkü ailesi onu ziyaret ediyor."], "besuchen", {"c":"p1_weil"}),
        sb('G1', 'weil-Satz', I.order, 'Ich / bleibe / im Bett, / weil / ich / krank / bin.',
          ['I am staying in bed because I am ill.', 'Я остаюсь в постели, потому что я болен.', 'Я залишаюся в ліжку, тому що я хворий.', 'Yatakta kalıyorum, çünkü hastayım.'],
          { alt: ['Weil ich krank bin, bleibe ich im Bett.'] }),
      ],
    },
    {
      title: 'Warum? – Weil ich arbeiten muss.',
      t: ['Why? – Because I have to work.', 'Почему? – Потому что мне нужно работать.', 'Чому? – Тому що мені треба працювати.', 'Neden? – Çünkü çalışmam gerekiyor.'],
      card: {
  "id": "p1_weil2",
  "rule": "Im weil-Satz stehen alle Verbteile am Ende. Mit Modalverb: Infinitiv + Modalverb: …, weil ich arbeiten muss. Im Perfekt: Partizip + haben oder sein: …, weil ich den Bus verpasst habe. …, weil wir spät gekommen sind. Trennbare Verben schreibt man zusammen: …, weil er früh aufsteht.",
  "examples": [
    "Ich komme nicht, weil ich lernen muss.",
    "Er ist müde, weil er schlecht geschlafen hat.",
    "Er hat Hunger, weil er nie frühstückt."
  ],
  "highlight": "verb",
  "t": [
    "In a weil clause all parts of the verb go to the end. With a modal verb: infinitive + modal verb: …, weil ich arbeiten muss. In the perfect tense: participle + haben or sein: …, weil ich den Bus verpasst habe. …, weil wir spät gekommen sind. Separable verbs are written as one word: …, weil er früh aufsteht.",
    "В предложении с weil все части сказуемого стоят в конце. С модальным глаголом: инфинитив + модальный глагол: …, weil ich arbeiten muss. В Perfekt: причастие + haben или sein: …, weil ich den Bus verpasst habe. …, weil wir spät gekommen sind. Глаголы с отделяемой приставкой пишутся слитно: …, weil er früh aufsteht.",
    "У реченні з weil усі частини присудка стоять у кінці. З модальним дієсловом: інфінітив + модальне дієслово: …, weil ich arbeiten muss. У Perfekt: дієприкметник + haben або sein: …, weil ich den Bus verpasst habe. …, weil wir spät gekommen sind. Дієслова з відокремлюваним префіксом пишуться разом: …, weil er früh aufsteht.",
    "weil cümlesinde fiilin bütün parçaları sonda durur. Kip fiiliyle: mastar + kip fiili: …, weil ich arbeiten muss. Perfekt’te: Partizip + haben ya da sein: …, weil ich den Bus verpasst habe. …, weil wir spät gekommen sind. Ayrılabilen fiiller bitişik yazılır: …, weil er früh aufsteht."
  ],
  "hint": [
    "Alle Verbteile ans Ende – das konjugierte Verb ganz zum Schluss: arbeiten muss, verpasst habe.",
    "All verb parts go to the end – the conjugated verb comes last: arbeiten muss, verpasst habe.",
    "Все части сказуемого – в конец, спрягаемый глагол самый последний: arbeiten muss, verpasst habe.",
    "Усі частини присудка – в кінець, відмінюване дієслово останнє: arbeiten muss, verpasst habe.",
    "Fiilin bütün parçaları sona gelir – çekimli fiil en sonda: arbeiten muss, verpasst habe."
  ],
  "hints": {
    "aux": [
      "Perfekt: Bewegung von A nach B (kommen, fahren, gehen) → sein. Sonst meistens haben.",
      "Perfect tense: movement from A to B (kommen, fahren, gehen) → sein. Otherwise usually haben.",
      "Perfekt: движение из A в B (kommen, fahren, gehen) → sein. В остальных случаях обычно haben.",
      "Perfekt: рух з A в B (kommen, fahren, gehen) → sein. В інших випадках зазвичай haben.",
      "Perfekt: A’dan B’ye hareket (kommen, fahren, gehen) → sein. Diğer durumlarda genellikle haben."
    ]
  }
},
      ex: [
        mc('G1', 'mit Modalverb', I.choose, 'Emre kann nicht kommen. Er muss arbeiten. → Emre kann nicht kommen, …', ['weil er arbeiten muss.', 'weil er muss arbeiten.', 'weil muss er arbeiten.'],
          ['Emre cannot come. He has to work. → Emre cannot come because he has to work.', 'Emre не может прийти. Ему нужно работать. → Emre не может прийти, потому что ему нужно работать.', 'Emre не може прийти. Йому треба працювати. → Emre не може прийти, тому що йому треба працювати.', 'Emre gelemiyor. Çalışması gerekiyor. → Emre gelemiyor, çünkü çalışması gerekiyor.']),
        mc('G1', 'im Perfekt', I.react, '„Warum bist du so müde?“', ['Weil ich nicht geschlafen habe.', 'Weil ich habe nicht geschlafen.', 'Weil habe ich nicht geschlafen.'],
          ['“Why are you so tired?”', '«Почему ты такой уставший?»', '«Чому ти такий втомлений?»', '“Neden bu kadar yorgunsun?”']),
        mc('G1', 'trennbares Verb', I.choose, 'Tom ist oft müde, weil er jeden Tag um fünf Uhr …', ['aufsteht.', 'steht auf.', 'auf steht.'],
          ['Tom is often tired because he gets up at five every day.', 'Tom часто устаёт, потому что каждый день встаёт в пять часов.', 'Tom часто втомлений, тому що щодня встає о п’ятій.', 'Tom sık sık yorgun, çünkü her gün saat beşte kalkıyor.']),
        mc('G1', 'Warum?', I.matchQuestion, '„Weil ich meinen Schlüssel suche.“', ['Warum bist du noch zu Hause?', 'Wann gehst du nach Hause?', 'Wo ist dein Schlüssel?'],
          ['“Because I am looking for my key.”', '«Потому что я ищу свой ключ».', '«Тому що я шукаю свій ключ».', '“Çünkü anahtarımı arıyorum.”']),
        gap('G1', 'mit Modalverb', I.modal, 'Ich gehe heute früh ins Bett, weil ich morgen früh aufstehen ', '.', 'muss', ['müssen', 'musst'],
          ['I am going to bed early today because I have to get up early tomorrow.', 'Сегодня я рано ложусь спать, потому что завтра мне рано вставать.', 'Сьогодні я рано лягаю спати, тому що завтра мені рано вставати.', 'Bugün erken yatıyorum, çünkü yarın erken kalkmam gerekiyor.'], 'müssen'),
        gap("G1", "im Perfekt", I.auxiliary, "Leon kommt zu spät, weil er den Bus verpasst ", ".", "hat", ["haben","ist"], ["Leon is late because he missed the bus.","Leon опаздывает, потому что пропустил автобус.","Leon запізнюється, тому що пропустив автобус.","Leon geç kalıyor, çünkü otobüsü kaçırdı."], "haben / sein", {"h":"aux","c":"p1_weil2"}),
        gap('G1', 'im Perfekt', I.auxiliary, 'Wir sind müde, weil wir gestern spät nach Hause gekommen ', '.', 'sind', ['haben', 'seid'],
          ['We are tired because we came home late yesterday.', 'Мы устали, потому что вчера поздно пришли домой.', 'Ми втомилися, тому що вчора пізно прийшли додому.', 'Yorgunuz, çünkü dün eve geç geldik.'], AUX, { h: 'aux' }),
        gap("G1", "trennbares Verb", I.verb, "Milan ist nicht zu Hause, weil er gerade im Supermarkt ", ".", "einkauft", ["kauft ein","einkaufen"], ["Milan is not at home because he is shopping at the supermarket right now.","Milan нет дома, потому что он сейчас делает покупки в супермаркете.","Milan немає вдома, тому що він зараз купує продукти в супермаркеті.","Milan evde değil, çünkü şu anda süpermarkette alışveriş yapıyor."], "einkaufen", {"c":"p1_weil2"}),
        sb('G1', 'mit Modalverb', I.order, 'Ich / komme / später, / weil / ich / noch / arbeiten / muss.',
          ['I am coming later because I still have to work.', 'Я приду позже, потому что мне ещё нужно поработать.', 'Я прийду пізніше, тому що мені ще треба попрацювати.', 'Daha sonra geleceğim, çünkü daha çalışmam gerekiyor.'],
          { alt: ['Weil ich noch arbeiten muss, komme ich später.'] }),
      ],
    },
    {
      title: 'eingekauft, angerufen',
      t: ['eingekauft, angerufen (perfect tense of separable verbs)', 'eingekauft, angerufen (Perfekt глаголов с отделяемой приставкой)', 'eingekauft, angerufen (Perfekt дієслів із відокремлюваним префіксом)', 'eingekauft, angerufen (ayrılabilen fiillerin Perfekt’i)'],
      card: {
  "id": "p1_trennbar",
  "rule": "Perfekt der trennbaren Verben: Das ge- steht zwischen Präfix und Verb. einkaufen → eingekauft, aufräumen → aufgeräumt, abholen → abgeholt, kennenlernen → kennengelernt. Unregelmäßig mit -en: anrufen → angerufen, aufstehen → aufgestanden, einladen → eingeladen, fernsehen → ferngesehen, ankommen → angekommen, einschlafen → eingeschlafen. Die hier verwendeten intransitiven Verben aufstehen, ankommen und einschlafen bilden das Perfekt mit sein. einkaufen, aufräumen, abholen, kennenlernen, anrufen, einladen und fernsehen bilden es hier mit haben.",
  "examples": [
    "Ich habe gestern meinen Onkel angerufen.",
    "Wir haben im Kurs viele Leute kennengelernt.",
    "Heute bin ich zu spät aufgestanden."
  ],
  "highlight": "verb",
  "t": [
    "Perfect tense of separable verbs: ge- goes between the prefix and the verb. einkaufen → eingekauft (shopped), aufräumen → aufgeräumt (tidied up), abholen → abgeholt (picked up), kennenlernen → kennengelernt (got to know). Irregular with -en: anrufen → angerufen (called), aufstehen → aufgestanden (got up), einladen → eingeladen (invited), fernsehen → ferngesehen (watched TV), ankommen → angekommen (arrived), einschlafen → eingeschlafen (fell asleep). The intransitive verbs aufstehen, ankommen and einschlafen used here form the perfect with sein. einkaufen, aufräumen, abholen, kennenlernen, anrufen, einladen and fernsehen use haben here.",
    "Perfekt глаголов с отделяемой приставкой: ge- стоит между приставкой и глаголом. einkaufen → eingekauft (сделал покупки), aufräumen → aufgeräumt (убрал), abholen → abgeholt (забрал), kennenlernen → kennengelernt (познакомился). Неправильные на -en: anrufen → angerufen (позвонил), aufstehen → aufgestanden (встал), einladen → eingeladen (пригласил), fernsehen → ferngesehen (смотрел телевизор), ankommen → angekommen (прибыл), einschlafen → eingeschlafen (заснул). Используемые здесь непереходные глаголы aufstehen, ankommen и einschlafen образуют Perfekt с sein. einkaufen, aufräumen, abholen, kennenlernen, anrufen, einladen и fernsehen здесь образуют его с haben.",
    "Perfekt дієслів із відокремлюваним префіксом: ge- стоїть між префіксом і дієсловом. einkaufen → eingekauft (зробив покупки), aufräumen → aufgeräumt (прибрав), abholen → abgeholt (забрав), kennenlernen → kennengelernt (познайомився). Неправильні на -en: anrufen → angerufen (зателефонував), aufstehen → aufgestanden (встав), einladen → eingeladen (запросив), fernsehen → ferngesehen (дивився телевізор), ankommen → angekommen (прибув), einschlafen → eingeschlafen (заснув). Ужиті тут неперехідні дієслова aufstehen, ankommen та einschlafen утворюють Perfekt із sein. einkaufen, aufräumen, abholen, kennenlernen, anrufen, einladen та fernsehen тут утворюють його з haben.",
    "Ayrılabilen fiillerin Perfekt’i: ge- ön ek ile fiilin arasına girer. einkaufen → eingekauft (alışveriş yaptı), aufräumen → aufgeräumt (topladı), abholen → abgeholt (aldı, karşıladı), kennenlernen → kennengelernt (tanıştı). -en ile düzensiz olanlar: anrufen → angerufen (aradı), aufstehen → aufgestanden (kalktı), einladen → eingeladen (davet etti), fernsehen → ferngesehen (televizyon izledi), ankommen → angekommen (vardı), einschlafen → eingeschlafen (uykuya daldı). Burada kullanılan geçişsiz aufstehen, ankommen ve einschlafen fiilleri Perfekt’i sein ile kurar. einkaufen, aufräumen, abholen, kennenlernen, anrufen, einladen ve fernsehen burada haben kullanır."
  ],
  "hint": [
    "Trennbar: Präfix + ge + Verb: ein-ge-kauft, an-ge-rufen, auf-ge-standen.",
    "Separable: prefix + ge + verb: ein-ge-kauft, an-ge-rufen, auf-ge-standen.",
    "Отделяемая приставка: приставка + ge + глагол: ein-ge-kauft, an-ge-rufen, auf-ge-standen.",
    "Відокремлюваний префікс: префікс + ge + дієслово: ein-ge-kauft, an-ge-rufen, auf-ge-standen.",
    "Ayrılabilen fiil: ön ek + ge + fiil: ein-ge-kauft, an-ge-rufen, auf-ge-standen."
  ],
  "hints": {
    "aux": [
      "Bewegung oder Veränderung (aufstehen, ankommen, einschlafen) → sein. Sonst → haben.",
      "Movement or change (aufstehen, ankommen, einschlafen) → sein. Otherwise → haben.",
      "Движение или изменение состояния (aufstehen, ankommen, einschlafen) → sein. Иначе → haben.",
      "Рух або зміна стану (aufstehen, ankommen, einschlafen) → sein. Інакше → haben.",
      "Hareket ya da değişim (aufstehen, ankommen, einschlafen) → sein. Diğerlerinde → haben."
    ]
  }
},
      ex: [
        mc("G2", "einkaufen", I.choose, "Ich habe im Supermarkt ___", ["eingekauft.","einkauft.","geeinkauft."], ["I did the shopping at the supermarket.","Я сделал покупки в супермаркете.","Я зробив покупки в супермаркеті.","Süpermarkette alışveriş yaptım."], {"c":"p1_trennbar","sitovOptionOrder":["eingekauft.","einkauft.","geeinkauft."]}),
        mc("G2", "anrufen", I.choose, "Hast du deinen Vater schon ___?", ["angerufen","anrufen","geanruft"], ["Have you called your father yet?","Ты уже позвонил отцу?","Ти вже зателефонував батькові?","Babanı aradın mı?"], {"c":"p1_trennbar"}),
        mc("G2", "sein oder haben", I.choose, "Heute ___ ich schon um sechs Uhr aufgestanden.", ["bin","hat","habe"], ["Today I got up at six o’clock already.","Сегодня я встал уже в шесть часов.","Сьогодні я встав уже о шостій.","Bugün daha saat altıda kalktım."], {"h":"aux","c":"p1_trennbar","hint":["Die hier geübten intransitiven Verben aufstehen, ankommen und einschlafen bilden das Perfekt mit sein.","The intransitive verbs aufstehen, ankommen and einschlafen practised here form the perfect with sein.","Изучаемые здесь непереходные глаголы aufstehen, ankommen и einschlafen образуют Perfekt с sein.","Неперехідні дієслова aufstehen, ankommen та einschlafen, які тут вивчаємо, утворюють Perfekt із sein.","Burada çalışılan geçişsiz aufstehen, ankommen ve einschlafen fiilleri Perfekt’i sein ile kurar."],"overrideReason":"Bewahrt den freigegebenen aufgabenspezifischen Text; die gemeinsame Merkkarte hat einen anderen didaktischen Kontext."}),
        mc("G2", "kennenlernen", I.sentence, "Oleg erzählt von einem neuen Freund.", ["Wir haben Leon in Köln kennengelernt.","Wir haben Leon in Köln gekennenlernt.","Wir sind Leon in Köln kennengelernt."], ["Oleg is talking about a new male friend.","Oleg рассказывает о новом друге.","Oleg розповідає про нового друга.","Oleg yeni bir erkek arkadaşından söz ediyor."], {"c":"p1_trennbar","sitovOptionOrder":["Wir haben Leon in Köln gekennenlernt.","Wir haben Leon in Köln kennengelernt.","Wir sind Leon in Köln kennengelernt."]}),
        gap('G2', 'aufräumen', I.participle, 'Paul hat am Samstag sein Zimmer ', '.', 'aufgeräumt', ['geaufräumt', 'aufräumt'],
          ['Paul tidied up his room on Saturday.', 'В субботу Paul убрал свою комнату.', 'У суботу Paul прибрав свою кімнату.', 'Paul cumartesi günü odasını topladı.'], 'aufräumen'),
        gap('G2', 'abholen', I.participle, 'Ich habe die Kinder von der Schule ', '.', 'abgeholt', ['geabholt', 'abholt'],
          ['I picked the children up from school.', 'Я забрал детей из школы.', 'Я забрав дітей зі школи.', 'Çocukları okuldan aldım.'], 'abholen'),
        gap('G2', 'ankommen', I.participle, 'Der Zug ist pünktlich in München ', '.', 'angekommen', ['angekommt', 'geankommen'],
          ['The train arrived in Munich on time.', 'Поезд прибыл в Мюнхен вовремя.', 'Потяг прибув до Мюнхена вчасно.', 'Tren Münih’e zamanında vardı.'], 'ankommen'),
        gap('G2', 'einladen', I.participle, 'Wir haben unsere Nachbarn zum Essen ', '.', 'eingeladen', ['eingeladet', 'geeinladen'],
          ['We invited our neighbours for a meal.', 'Мы пригласили соседей на обед.', 'Ми запросили сусідів на обід.', 'Komşularımızı yemeğe davet ettik.'], 'einladen'),
        gap("G2", "sein oder haben", I.auxiliary, "Das Kind ", " schnell eingeschlafen.", "ist", ["hat","sind"], ["The child fell asleep quickly.","Ребёнок быстро заснул.","Дитина швидко заснула.","Çocuk çabucak uykuya daldı."], "haben / sein", {"h":"aux","c":"p1_trennbar","hint":["Die hier geübten intransitiven Verben aufstehen, ankommen und einschlafen bilden das Perfekt mit sein.","The intransitive verbs aufstehen, ankommen and einschlafen practised here form the perfect with sein.","Изучаемые здесь непереходные глаголы aufstehen, ankommen и einschlafen образуют Perfekt с sein.","Неперехідні дієслова aufstehen, ankommen та einschlafen, які тут вивчаємо, утворюють Perfekt із sein.","Burada çalışılan geçişsiz aufstehen, ankommen ve einschlafen fiilleri Perfekt’i sein ile kurar."],"overrideReason":"Bewahrt den freigegebenen aufgabenspezifischen Text; die gemeinsame Merkkarte hat einen anderen didaktischen Kontext."}),
        sb('G2', 'fernsehen', I.order, 'Ich / habe / gestern / lange / ferngesehen.',
          ['I watched TV for a long time yesterday.', 'Вчера я долго смотрел телевизор.', 'Учора я довго дивився телевізор.', 'Dün uzun süre televizyon izledim.'],
          { alt: ['Gestern habe ich lange ferngesehen.'] }),
      ],
    },
    {
      title: 'passiert, telefoniert',
      t: ['passiert, telefoniert (perfect tense of verbs ending in -ieren)', 'passiert, telefoniert (Perfekt глаголов на -ieren)', 'passiert, telefoniert (Perfekt дієслів на -ieren)', 'passiert, telefoniert (-ieren ile biten fiillerin Perfekt’i)'],
      card: {
        id: 'p1_ieren',
        rule: 'Perfekt der Verben auf -ieren: ohne ge-, immer mit -t. telefonieren → telefoniert, studieren → studiert, reparieren → repariert, probieren → probiert, fotografieren → fotografiert, gratulieren → gratuliert, funktionieren → funktioniert. Fast alle bilden das Perfekt mit haben: Ich habe telefoniert. Aber: passieren → ist passiert: Was ist passiert?',
        examples: ['Ich habe lange mit meiner Schwester telefoniert.', 'Was ist denn passiert?', 'Der Hausmeister hat die Lampe repariert.'],
        highlight: 'verb',
        t: [
          'Perfect tense of verbs ending in -ieren: no ge-, always with -t. telefonieren → telefoniert (phoned), studieren → studiert (studied), reparieren → repariert (repaired), probieren → probiert (tried), fotografieren → fotografiert (took photos), gratulieren → gratuliert (congratulated), funktionieren → funktioniert (worked). Almost all of them form the perfect with haben: Ich habe telefoniert. But: passieren → ist passiert: Was ist passiert? (What happened?)',
          'Perfekt глаголов на -ieren: без ge-, всегда с -t. telefonieren → telefoniert (говорил по телефону), studieren → studiert (учился в вузе), reparieren → repariert (починил), probieren → probiert (попробовал), fotografieren → fotografiert (фотографировал), gratulieren → gratuliert (поздравил), funktionieren → funktioniert (работал). Почти все образуют Perfekt с haben: Ich habe telefoniert. Но: passieren → ist passiert: Was ist passiert? (Что случилось?)',
          'Perfekt дієслів на -ieren: без ge-, завжди з -t. telefonieren → telefoniert (говорив телефоном), studieren → studiert (навчався у виші), reparieren → repariert (полагодив), probieren → probiert (спробував), fotografieren → fotografiert (фотографував), gratulieren → gratuliert (привітав), funktionieren → funktioniert (працював). Майже всі утворюють Perfekt із haben: Ich habe telefoniert. Але: passieren → ist passiert: Was ist passiert? (Що сталося?)',
          '-ieren ile biten fiillerin Perfekt’i: ge- almaz, her zaman -t ile biter. telefonieren → telefoniert (telefonla konuştu), studieren → studiert (üniversitede okudu), reparieren → repariert (tamir etti), probieren → probiert (denedi, tattı), fotografieren → fotografiert (fotoğraf çekti), gratulieren → gratuliert (kutladı), funktionieren → funktioniert (çalıştı). Neredeyse hepsi Perfekt’i haben ile kurar: Ich habe telefoniert. Ama: passieren → ist passiert: Was ist passiert? (Ne oldu?)',
        ],
        hint: ['Verben auf -ieren: kein ge-, Endung -t: telefoniert, passiert.', 'Verbs ending in -ieren: no ge-, ending -t: telefoniert, passiert.', 'Глаголы на -ieren: без ge-, окончание -t: telefoniert, passiert.', 'Дієслова на -ieren: без ge-, закінчення -t: telefoniert, passiert.', '-ieren ile biten fiiller: ge- yok, sonda -t: telefoniert, passiert.'],
      },
      ex: [
        mc('G3', 'telefonieren', I.choose, 'Gestern habe ich zwei Stunden mit Olga …', ['telefoniert.', 'getelefoniert.', 'telefonieren.'],
          ['Yesterday I talked to Olga on the phone for two hours.', 'Вчера я два часа говорил с Olga по телефону.', 'Учора я дві години говорив з Olga телефоном.', 'Dün Olga ile iki saat telefonda konuştum.']),
        mc('G3', 'passieren', I.choose, 'Du siehst traurig aus. Was … passiert?', ['ist', 'hat', 'bist'],
          ['You look sad. What happened?', 'Ты выглядишь грустным. Что случилось?', 'Ти виглядаєш сумним. Що сталося?', 'Üzgün görünüyorsun. Ne oldu?']),
        mc('G3', 'studieren', I.choose, 'Mein Onkel hat in Wien Medizin …', ['studiert.', 'gestudiert.', 'studieren.'],
          ['My uncle studied medicine in Vienna.', 'Мой дядя изучал медицину в Вене.', 'Мій дядько вивчав медицину у Відні.', 'Amcam Viyana’da tıp okudu.']),
        mc('G3', 'reparieren', I.sentence, 'Im Haus war es kalt. Jetzt ist es wieder warm.', ['Der Techniker hat die Heizung repariert.', 'Der Techniker hat die Heizung gerepariert.', 'Der Techniker ist die Heizung repariert.'],
          ['It was cold in the house. Now it is warm again.', 'В доме было холодно. Теперь снова тепло.', 'У будинку було холодно. Тепер знову тепло.', 'Ev soğuktu. Şimdi yine sıcak.']),
        gap('G3', 'probieren', I.participle, 'Hast du die Suppe schon ', '? Sie ist sehr lecker.', 'probiert', ['geprobiert', 'probieren'],
          ['Have you tried the soup yet? It is very tasty.', 'Ты уже попробовал суп? Он очень вкусный.', 'Ти вже скуштував суп? Він дуже смачний.', 'Çorbayı tattın mı? Çok lezzetli.'], 'probieren'),
        gap('G3', 'fotografieren', I.participle, 'Im Urlaub haben wir viel ', '. Die Bilder sind sehr schön.', 'fotografiert', ['gefotografiert', 'fotografieren'],
          ['We took a lot of photos on holiday. The pictures are very nice.', 'В отпуске мы много фотографировали. Снимки очень красивые.', 'У відпустці ми багато фотографували. Знімки дуже гарні.', 'Tatilde çok fotoğraf çektik. Resimler çok güzel.'], 'fotografieren'),
        gap('G3', 'funktionieren', I.participle, 'Mein Handy ist kaputt. Gestern hat es noch ', '.', 'funktioniert', ['gefunktioniert', 'funktionieren'],
          ['My mobile is broken. Yesterday it was still working.', 'Мой телефон сломался. Вчера он ещё работал.', 'Мій телефон зламався. Учора він ще працював.', 'Cep telefonum bozuk. Dün hâlâ çalışıyordu.'], 'funktionieren'),
        gap('G3', 'gratulieren', I.participle, 'Alle Kollegen haben mir zum Geburtstag ', '.', 'gratuliert', ['gegratuliert', 'gratulieren'],
          ['All my colleagues wished me a happy birthday.', 'Все коллеги поздравили меня с днём рождения.', 'Усі колеги привітали мене з днем народження.', 'Bütün iş arkadaşlarım doğum günümü kutladı.'], 'gratulieren'),
        sb('G3', 'passieren', I.question, 'Was / ist / denn / gestern / passiert?',
          ['So what happened yesterday?', 'Что же случилось вчера?', 'Що ж сталося вчора?', 'Dün ne oldu peki?'],
          { alt: ['Was ist gestern denn passiert?'] }),
      ],
    },
    {
      title: 'erlebt, verstanden',
      t: ['erlebt, verstanden (perfect tense of inseparable verbs)', 'erlebt, verstanden (Perfekt глаголов с неотделяемой приставкой)', 'erlebt, verstanden (Perfekt дієслів із невідокремлюваним префіксом)', 'erlebt, verstanden (ayrılmayan fiillerin Perfekt’i)'],
      card: {
        id: 'p1_untrennbar',
        rule: 'Perfekt der Verben mit be-, emp-, ent-, er-, ge-, ver-, zer-: Diese Präfixe sind nicht trennbar. Das Partizip hat kein ge-. erleben → erlebt, bemerken → bemerkt, besuchen → besucht, bezahlen → bezahlt, erzählen → erzählt, verpassen → verpasst, verkaufen → verkauft. Unregelmäßig mit -en: verstehen → verstanden, vergessen → vergessen, verlieren → verloren, beginnen → begonnen, bekommen → bekommen.',
        examples: ['So etwas habe ich noch nie erlebt!', 'Ich habe die S-Bahn verpasst.', 'Hast du die Frage verstanden?'],
        highlight: 'verb',
        t: [
          'Perfect tense of verbs with be-, emp-, ent-, er-, ge-, ver-, zer-: these prefixes cannot be separated. The participle has no ge-. erleben → erlebt (experienced), bemerken → bemerkt (noticed), besuchen → besucht (visited), bezahlen → bezahlt (paid), erzählen → erzählt (told), verpassen → verpasst (missed), verkaufen → verkauft (sold). Irregular with -en: verstehen → verstanden (understood), vergessen → vergessen (forgot), verlieren → verloren (lost), beginnen → begonnen (began), bekommen → bekommen (got).',
          'Perfekt глаголов с be-, emp-, ent-, er-, ge-, ver-, zer-: эти приставки не отделяются. В причастии нет ge-. erleben → erlebt (пережил), bemerken → bemerkt (заметил), besuchen → besucht (навестил), bezahlen → bezahlt (заплатил), erzählen → erzählt (рассказал), verpassen → verpasst (пропустил), verkaufen → verkauft (продал). Неправильные на -en: verstehen → verstanden (понял), vergessen → vergessen (забыл), verlieren → verloren (потерял), beginnen → begonnen (начал), bekommen → bekommen (получил).',
          'Perfekt дієслів із be-, emp-, ent-, er-, ge-, ver-, zer-: ці префікси не відокремлюються. У дієприкметнику немає ge-. erleben → erlebt (пережив), bemerken → bemerkt (помітив), besuchen → besucht (відвідав), bezahlen → bezahlt (заплатив), erzählen → erzählt (розповів), verpassen → verpasst (пропустив), verkaufen → verkauft (продав). Неправильні на -en: verstehen → verstanden (зрозумів), vergessen → vergessen (забув), verlieren → verloren (загубив), beginnen → begonnen (почав), bekommen → bekommen (отримав).',
          'be-, emp-, ent-, er-, ge-, ver-, zer- ile başlayan fiillerin Perfekt’i: Bu ön ekler ayrılmaz. Partizip ge- almaz. erleben → erlebt (yaşadı), bemerken → bemerkt (fark etti), besuchen → besucht (ziyaret etti), bezahlen → bezahlt (ödedi), erzählen → erzählt (anlattı), verpassen → verpasst (kaçırdı), verkaufen → verkauft (sattı). -en ile düzensiz olanlar: verstehen → verstanden (anladı), vergessen → vergessen (unuttu), verlieren → verloren (kaybetti), beginnen → begonnen (başladı), bekommen → bekommen (aldı).',
        ],
        hint: ['be-, er-, ver-, ent-, emp-, ge-, zer-: Partizip ohne ge-: besucht, erlebt, verstanden.', 'be-, er-, ver-, ent-, emp-, ge-, zer-: participle without ge-: besucht, erlebt, verstanden.', 'be-, er-, ver-, ent-, emp-, ge-, zer-: причастие без ge-: besucht, erlebt, verstanden.', 'be-, er-, ver-, ent-, emp-, ge-, zer-: дієприкметник без ge-: besucht, erlebt, verstanden.', 'be-, er-, ver-, ent-, emp-, ge-, zer-: Partizip ge- almaz: besucht, erlebt, verstanden.'],
      },
      ex: [
        mc('G4', 'vergessen', I.choose, 'Ich stehe vor der Tür und kann sie nicht öffnen. Ich habe meinen Schlüssel …', ['vergessen.', 'gevergessen.', 'vergesst.'],
          ['I am standing at the door and cannot open it. I forgot my key.', 'Я стою перед дверью и не могу её открыть. Я забыл ключ.', 'Я стою перед дверима й не можу їх відчинити. Я забув ключ.', 'Kapının önündeyim ve onu açamıyorum. Anahtarımı unuttum.']),
        mc('G4', 'besuchen', I.choose, 'Wir haben am Wochenende unsere Großeltern …', ['besucht.', 'gebesucht.', 'besuchen.'],
          ['We visited our grandparents at the weekend.', 'В выходные мы навестили бабушку и дедушку.', 'На вихідних ми відвідали бабусю й дідуся.', 'Hafta sonu büyükannemizle büyükbabamızı ziyaret ettik.']),
        mc('G4', 'nicht trennbar', I.choose, 'Welches Verb ist nicht trennbar?', ['verkaufen', 'einkaufen', 'anrufen'],
          ['Which verb cannot be separated?', 'Какой глагол не имеет отделяемой приставки?', 'Яке дієслово не має відокремлюваного префікса?', 'Hangi fiil ayrılmaz?']),
        mc('G4', 'bemerken', I.sentence, 'Im Brief steht ein falsches Datum.', ['Ich habe den Fehler nicht bemerkt.', 'Ich habe den Fehler nicht gebemerkt.', 'Ich habe den Fehler nicht bemerken.'],
          ['There is a wrong date in the letter.', 'В письме стоит неправильная дата.', 'У листі стоїть неправильна дата.', 'Mektupta yanlış bir tarih var.']),
        gap('G4', 'verstehen', I.participle, 'Entschuldigung, ich habe Sie nicht ', '. Können Sie das bitte wiederholen?', 'verstanden', ['geverstanden', 'verstehen'],
          ['Sorry, I did not understand you. Could you repeat that, please?', 'Извините, я вас не понял. Повторите, пожалуйста.', 'Вибачте, я вас не зрозумів. Повторіть, будь ласка.', 'Affedersiniz, sizi anlamadım. Tekrar eder misiniz lütfen?'], 'verstehen'),
        gap('G4', 'verpassen', I.participle, 'Der Bus war schon weg. Ich habe ihn ', '.', 'verpasst', ['geverpasst', 'verpassen'],
          ['The bus had already gone. I missed it.', 'Автобус уже ушёл. Я на него опоздал.', 'Автобус уже поїхав. Я на нього запізнився.', 'Otobüs gitmişti. Onu kaçırdım.'], 'verpassen'),
        gap('G4', 'erzählen', I.participle, 'Oma hat uns eine Geschichte ', '.', 'erzählt', ['geerzählt', 'erzählen'],
          ['Grandma told us a story.', 'Бабушка рассказала нам историю.', 'Бабуся розповіла нам історію.', 'Büyükannem bize bir hikâye anlattı.'], 'erzählen'),
        gap('G4', 'beginnen', I.participle, 'Der Film hat um acht Uhr ', '.', 'begonnen', ['gebegonnen', 'beginnt'],
          ['The film began at eight o’clock.', 'Фильм начался в восемь часов.', 'Фільм почався о восьмій годині.', 'Film saat sekizde başladı.'], 'beginnen'),
        gap('G4', 'verlieren', I.participle, 'Wo ist mein Geld? Ich habe meinen Geldbeutel ', '!', 'verloren', ['geverloren', 'verliert'],
          ['Where is my money? I have lost my purse!', 'Где мои деньги? Я потерял кошелёк!', 'Де мої гроші? Я загубив гаманець!', 'Param nerede? Cüzdanımı kaybettim!'], 'verlieren'),
        sb('G4', 'bezahlen', I.order, 'Ich / habe / die Rechnung / schon / bezahlt.',
          ['I have already paid the bill.', 'Я уже оплатил счёт.', 'Я вже оплатив рахунок.', 'Faturayı ödedim bile.'],
          { alt: ['Die Rechnung habe ich schon bezahlt.'] }),
      ],
    },
    {
      title: 'So ein Pech!',
      t: ['What bad luck!', 'Вот не повезло!', 'От не пощастило!', 'Ne şanssızlık!'],
      card: {
        id: 'p1_panne',
        rule: 'Von einer Panne erzählen: Stell dir vor, … / Du glaubst es nicht! / So was hast du noch nicht erlebt! Dann erzählst du im Perfekt: Ich habe den Zug verpasst. Reagieren: Oje! So ein Pech! So ein Mist! Wie peinlich! Nachfragen: Und was ist dann passiert? Und was hast du dann gemacht? Ein gutes Ende: Zum Glück hat mir eine Nachbarin geholfen.',
        examples: ['Stell dir vor, ich habe meinen Koffer im Zug vergessen!', 'Oje, so ein Pech! Und was hast du dann gemacht?', 'Zum Glück hat ein Mann den Koffer gefunden.'],
        highlight: null,
        t: [
          'Telling someone about a mishap: Stell dir vor, … (Just imagine …) / Du glaubst es nicht! (You won’t believe it!) / So was hast du noch nicht erlebt! (You have never seen anything like it!) Then you tell the story in the perfect tense: Ich habe den Zug verpasst. Reacting: Oje! (Oh dear!) So ein Pech! (What bad luck!) So ein Mist! (Damn!) Wie peinlich! (How embarrassing!) Asking for more: Und was ist dann passiert? Und was hast du dann gemacht? A good ending: Zum Glück (luckily) hat mir eine Nachbarin geholfen.',
          'Как рассказать о неприятности: Stell dir vor, … (Представь себе …) / Du glaubst es nicht! (Ты не поверишь!) / So was hast du noch nicht erlebt! (Такого с тобой ещё не было!) Дальше рассказывают в Perfekt: Ich habe den Zug verpasst. Реакция: Oje! (Ой!) So ein Pech! (Вот не повезло!) So ein Mist! (Вот чёрт!) Wie peinlich! (Как неловко!) Расспросить: Und was ist dann passiert? Und was hast du dann gemacht? Хороший конец: Zum Glück (к счастью) hat mir eine Nachbarin geholfen.',
          'Як розповісти про прикрість: Stell dir vor, … (Уяви собі …) / Du glaubst es nicht! (Ти не повіриш!) / So was hast du noch nicht erlebt! (Такого з тобою ще не було!) Далі розповідають у Perfekt: Ich habe den Zug verpasst. Реакція: Oje! (Ой!) So ein Pech! (От не пощастило!) So ein Mist! (От халепа!) Wie peinlich! (Як ніяково!) Розпитати: Und was ist dann passiert? Und was hast du dann gemacht? Добрий кінець: Zum Glück (на щастя) hat mir eine Nachbarin geholfen.',
          'Bir aksiliği anlatmak: Stell dir vor, … (Düşünsene …) / Du glaubst es nicht! (İnanmayacaksın!) / So was hast du noch nicht erlebt! (Böylesini daha görmedin!) Sonra Perfekt ile anlatırsınız: Ich habe den Zug verpasst. Tepki vermek: Oje! (Eyvah!) So ein Pech! (Ne şanssızlık!) So ein Mist! (Hay aksi!) Wie peinlich! (Ne utanç verici!) Devamını sormak: Und was ist dann passiert? Und was hast du dann gemacht? İyi bir son: Zum Glück (neyse ki) hat mir eine Nachbarin geholfen.',
        ],
        hint: ['Pech = etwas Schlechtes ist passiert. Zum Glück = es ist gut ausgegangen.', 'Pech = something bad happened. Zum Glück = it turned out well.', 'Pech = случилось что-то плохое. Zum Glück = всё закончилось хорошо.', 'Pech = сталося щось погане. Zum Glück = усе закінчилося добре.', 'Pech = kötü bir şey oldu. Zum Glück = sonu iyi bitti.'],
      },
      ex: [
        mc('K1', 'reagieren', I.react, '„Ich habe heute meinen Geldbeutel verloren.“', ['Oje, so ein Pech!', 'Herzlichen Glückwunsch!', 'Guten Appetit!'],
          ['“I lost my purse today.”', '«Сегодня я потерял кошелёк».', '«Сьогодні я загубив гаманець».', '“Bugün cüzdanımı kaybettim.”']),
        mc('K1', 'Wie peinlich!', I.react, '„Ich habe heute zu meiner Chefin ‚Mama‘ gesagt.“', ['Wie peinlich!', 'Zum Glück!', 'Gute Besserung!'],
          ['“Today I called my boss ‘Mum’.”', '«Сегодня я назвал начальницу „мамой“».', '«Сьогодні я назвав начальницю „мамою“».', '“Bugün patronuma ‘anne’ dedim.”']),
        mc('K1', 'eine Geschichte beginnen', I.situation, 'Du möchtest von einer Panne erzählen. Wie fängst du an?', ['Stell dir vor, was mir heute passiert ist!', 'Und was hast du dann gemacht?', 'So ein Pech!'],
          ['You want to tell someone about a mishap. How do you start?', 'Вы хотите рассказать о неприятности. С чего вы начнёте?', 'Ви хочете розповісти про прикрість. З чого ви почнете?', 'Bir aksiliği anlatmak istiyorsunuz. Nasıl başlarsınız?']),
        mc('K1', 'nachfragen', I.situation, 'Deine Freundin erzählt: „Der Zug ist ohne mich abgefahren.“ Du möchtest mehr wissen. Was fragst du?', ['Und was hast du dann gemacht?', 'Wie heißt du?', 'Wie spät ist es?'],
          ['Your friend says: “The train left without me.” You want to know more. What do you ask?', 'Подруга рассказывает: «Поезд уехал без меня». Вы хотите узнать больше. Что вы спросите?', 'Подруга розповідає: «Потяг поїхав без мене». Ви хочете дізнатися більше. Що ви запитаєте?', 'Arkadaşınız anlatıyor: “Tren bensiz kalktı.” Daha fazlasını öğrenmek istiyorsunuz. Ne sorarsınız?']),
        mc('K1', 'Zum Glück', I.choose, 'Ich habe den Schlüssel vergessen. … war meine Nachbarin zu Hause. Sie hat einen zweiten Schlüssel.', ['Zum Glück', 'So ein Mist', 'Wie peinlich'],
          ['I forgot the key. Luckily my neighbour was at home. She has a second key.', 'Я забыл ключ. К счастью, соседка была дома. У неё есть второй ключ.', 'Я забув ключ. На щастя, сусідка була вдома. У неї є другий ключ.', 'Anahtarı unuttum. Neyse ki komşum evdeydi. Onda ikinci bir anahtar var.']),
        gap('K1', 'So ein Pech!', I.word, 'So ein ', '! Jetzt regnet es und ich habe keinen Schirm.', 'Pech', ['Glück', 'Spaß'],
          ['What bad luck! Now it is raining and I have no umbrella.', 'Вот не повезло! Пошёл дождь, а у меня нет зонта.', 'От не пощастило! Пішов дощ, а в мене немає парасольки.', 'Ne şanssızlık! Şimdi yağmur yağıyor ve şemsiyem yok.'],
          ['bad luck', 'невезение', 'невезіння', 'şanssızlık']),
        gap('K1', 'Stell dir vor', I.word, 'Stell dir ', ', mein Fahrrad ist weg!', 'vor', ['an', 'auf'],
          ['Just imagine, my bike is gone!', 'Представь себе, мой велосипед пропал!', 'Уяви собі, мій велосипед зник!', 'Düşünsene, bisikletim yok olmuş!'], 'vor / an / auf'),
        gap('K1', 'Du glaubst es nicht', I.verb, 'Du ', ' es nicht: Ich habe im Bus meinen alten Lehrer getroffen!', 'glaubst', ['glaubt', 'glauben'],
          ['You won’t believe it: I met my old teacher on the bus!', 'Ты не поверишь: я встретил в автобусе своего старого учителя!', 'Ти не повіриш: я зустрів в автобусі свого старого вчителя!', 'İnanmayacaksın: Otobüste eski öğretmenimle karşılaştım!'], 'glauben'),
        sb('K1', 'nachfragen', I.question, 'Und / was / ist / dann / passiert?',
          ['And what happened then?', 'И что случилось потом?', 'І що сталося потім?', 'Peki sonra ne oldu?']),
      ],
    },
    {
      title: 'Zuerst, dann, schließlich',
      t: ['First, then, finally', 'Сначала, потом, наконец', 'Спочатку, потім, нарешті', 'Önce, sonra, sonunda'],
      card: {
  "id": "p1_gliedern",
  "rule": "Eine Geschichte ordnen: Zuerst … Dann … Danach … Später … Schließlich … Diese Wörter stehen oft auf Position 1. Dann kommt das Verb auf Position 2 und danach das Subjekt: Zuerst habe ich gefrühstückt. Dann bin ich zum Bahnhof gefahren. Später habe ich Leon getroffen. Schließlich sind wir nach Hause gegangen.",
  "examples": [
    "Zuerst habe ich verschlafen.",
    "Dann habe ich den Bus verpasst.",
    "Schließlich bin ich mit dem Taxi gefahren."
  ],
  "highlight": "verb",
  "t": [
    "Putting a story in order: Zuerst (first) … Dann (then) … Danach (after that) … Später (later) … Schließlich (finally) … These words often stand in position 1. Then the verb comes in position 2, followed by the subject: Zuerst habe ich gefrühstückt. Dann bin ich zum Bahnhof gefahren. Später habe ich Leon getroffen. Schließlich sind wir nach Hause gegangen.",
    "Как выстроить рассказ: Zuerst (сначала) … Dann (потом) … Danach (после этого) … Später (позже) … Schließlich (наконец) … Эти слова часто стоят на первом месте. Затем на втором месте идёт глагол, а после него подлежащее: Zuerst habe ich gefrühstückt. Dann bin ich zum Bahnhof gefahren. Später habe ich Leon getroffen. Schließlich sind wir nach Hause gegangen.",
    "Як вибудувати розповідь: Zuerst (спочатку) … Dann (потім) … Danach (після цього) … Später (пізніше) … Schließlich (нарешті) … Ці слова часто стоять на першому місці. Далі на другому місці йде дієслово, а після нього підмет: Zuerst habe ich gefrühstückt. Dann bin ich zum Bahnhof gefahren. Später habe ich Leon getroffen. Schließlich sind wir nach Hause gegangen.",
    "Bir hikâyeyi sıralamak: Zuerst (önce) … Dann (sonra) … Danach (ondan sonra) … Später (daha sonra) … Schließlich (sonunda) … Bu kelimeler çoğu zaman 1. sırada durur. Ardından fiil 2. sıraya, özne de onun arkasına gelir: Zuerst habe ich gefrühstückt. Dann bin ich zum Bahnhof gefahren. Später habe ich Leon getroffen. Schließlich sind wir nach Hause gegangen."
  ],
  "hint": [
    "Zuerst = am Anfang, dann und später = in der Mitte, schließlich = am Ende. Danach: Verb, dann Subjekt.",
    "Zuerst = at the beginning, dann and später = in the middle, schließlich = at the end. After it: verb, then subject.",
    "Zuerst = в начале, dann и später = в середине, schließlich = в конце. После них: глагол, затем подлежащее.",
    "Zuerst = на початку, dann і später = у середині, schließlich = у кінці. Після них: дієслово, потім підмет.",
    "Zuerst = başta, dann ve später = ortada, schließlich = sonda. Ardından: fiil, sonra özne."
  ]
},
      ex: [
        mc('K4', 'Anfang', I.choose, 'Welches Wort passt am Anfang von einer Geschichte?', ['Zuerst', 'Schließlich', 'Später'],
          ['Which word fits at the beginning of a story?', 'Какое слово подходит в начале рассказа?', 'Яке слово підходить на початку розповіді?', 'Bir hikâyenin başına hangi kelime uyar?']),
        mc('K4', 'Ende', I.choose, 'Welches Wort passt am Ende von einer Geschichte?', ['Schließlich', 'Zuerst', 'Am Anfang'],
          ['Which word fits at the end of a story?', 'Какое слово подходит в конце рассказа?', 'Яке слово підходить у кінці розповіді?', 'Bir hikâyenin sonuna hangi kelime uyar?']),
        mc("K4", "Verb auf Position 2", I.sentence, "Leon erzählt von seinem Abend.", ["Dann habe ich meinen Bruder angerufen.","Dann meinen Bruder habe ich angerufen.","Dann ich habe meinen Bruder angerufen."], ["Leon is talking about his evening.","Leon рассказывает о своём вечере.","Leon розповідає про свій вечір.","Leon akşamını anlatıyor."], {"c":"p1_gliedern","sitovOptionOrder":["Dann meinen Bruder habe ich angerufen.","Dann habe ich meinen Bruder angerufen.","Dann ich habe meinen Bruder angerufen."]}),
        mc('K4', 'Reihenfolge', I.choose, 'Was ist die richtige Reihenfolge?', ['zuerst – dann – schließlich', 'schließlich – zuerst – dann', 'dann – schließlich – zuerst'],
          ['What is the correct order?', 'Какой порядок правильный?', 'Який порядок правильний?', 'Doğru sıra hangisi?']),
        gap("K4", "zuerst", {"de":"Ergänze das Wort für den ersten Schritt der Erzählung.","t":["Fill in the missing word.","Вставьте подходящее слово.","Вставте відповідне слово.","Uygun kelimeyi yazın."]}, "", " bin ich aufgestanden, dann habe ich geduscht.", "Zuerst", ["Später","Schließlich"], ["First I got up, then I had a shower.","Сначала я встал, потом принял душ.","Спочатку я встав, потім прийняв душ.","Önce kalktım, sonra duş aldım."], ["first","сначала","спочатку","önce"], {"c":"p1_gliedern"}),
        gap("K4", "schließlich", {"de":"Ergänze das Wort für den letzten Schritt der Erzählung.","t":["Fill in the missing word.","Вставьте подходящее слово.","Вставте відповідне слово.","Uygun kelimeyi yazın."]}, "Zuerst haben wir gekocht, dann gegessen und ", " haben wir einen Film gesehen.", "schließlich", ["gestern","zuerst"], ["First we cooked, then we ate, and finally we watched a film.","Сначала мы готовили, потом ели и наконец посмотрели фильм.","Спочатку ми готували, потім їли й нарешті подивилися фільм.","Önce yemek yaptık, sonra yedik ve sonunda bir film izledik."], ["finally","наконец","нарешті","sonunda"], {"c":"p1_gliedern","sitovOptionOrder":["gestern","zuerst","schließlich"]}),
        gap('K4', 'Verb auf Position 2', I.auxiliary, 'Später ', ' wir ins Kino gegangen.', 'sind', ['haben', 'seid'],
          ['Later we went to the cinema.', 'Позже мы пошли в кино.', 'Пізніше ми пішли в кіно.', 'Daha sonra sinemaya gittik.'], AUX),
        gap('K4', 'dann', I.word, 'Zuerst habe ich Kaffee gemacht. ', ' habe ich die Zeitung gelesen.', ['Dann', 'Danach', 'Später'], ['Zuerst', 'Weil'],
          ['First I made coffee. Then I read the newspaper.', 'Сначала я сварил кофе. Потом почитал газету.', 'Спочатку я зварив каву. Потім почитав газету.', 'Önce kahve yaptım. Sonra gazete okudum.'],
          ['then', 'потом', 'потім', 'sonra']),
        sb('K4', 'schließlich', I.order, 'Schließlich / sind / wir / nach Hause / gefahren.',
          ['Finally we went home.', 'Наконец мы поехали домой.', 'Нарешті ми поїхали додому.', 'Sonunda eve gittik.'],
          { alt: ['Wir sind schließlich nach Hause gefahren.'] }),
      ],
    },
    {
      title: 'Das gefällt ihm.',
      t: ['He likes that.', 'Ему это нравится.', 'Йому це подобається.', 'Bu onun hoşuna gidiyor.'],
      card: {
  "id": "p1_bewerten",
  "rule": "Sagen, wie jemand etwas findet: Das findet er toll. Das findet sie nicht so toll. Das gefällt ihm. Das gefällt ihr nicht. finden + Akkusativ: Er findet die Wohnung schön. gefallen + Dativ: Die Wohnung gefällt ihm (einem Mann), ihr (einer Frau), ihnen (mehreren Personen).",
  "examples": [
    "Leon wohnt allein. Das findet er toll.",
    "Paul steht um fünf Uhr auf. Das gefällt ihm nicht.",
    "Meine Eltern leben auf dem Land. Das gefällt ihnen."
  ],
  "highlight": null,
  "t": [
    "Saying what someone thinks of something: Das findet er toll. (He thinks that is great.) Das findet sie nicht so toll. Das gefällt ihm. (He likes that.) Das gefällt ihr nicht. finden + accusative: Er findet die Wohnung schön. gefallen + dative: Die Wohnung gefällt ihm (a man), ihr (a woman), ihnen (several people).",
    "Как сказать, что человек о чём-то думает: Das findet er toll. (Он считает, что это здорово.) Das findet sie nicht so toll. Das gefällt ihm. (Ему это нравится.) Das gefällt ihr nicht. finden + Akkusativ: Er findet die Wohnung schön. gefallen + Dativ: Die Wohnung gefällt ihm (мужчине), ihr (женщине), ihnen (нескольким людям).",
    "Як сказати, що людина про щось думає: Das findet er toll. (Він вважає, що це чудово.) Das findet sie nicht so toll. Das gefällt ihm. (Йому це подобається.) Das gefällt ihr nicht. finden + Akkusativ: Er findet die Wohnung schön. gefallen + Dativ: Die Wohnung gefällt ihm (чоловікові), ihr (жінці), ihnen (кільком людям).",
    "Birinin bir şeyi nasıl bulduğunu söylemek: Das findet er toll. (Bunu harika buluyor.) Das findet sie nicht so toll. Das gefällt ihm. (Bu onun hoşuna gidiyor.) Das gefällt ihr nicht. finden + Akkusativ: Er findet die Wohnung schön. gefallen + Dativ: Die Wohnung gefällt ihm (bir erkeğin), ihr (bir kadının), ihnen (birkaç kişinin) hoşuna gidiyor."
  ],
  "hint": [
    "finden: er / sie + findet. gefallen: ihm (Mann), ihr (Frau), ihnen (mehrere).",
    "finden: er / sie + findet. gefallen: ihm (man), ihr (woman), ihnen (several people).",
    "finden: er / sie + findet. gefallen: ihm (мужчина), ihr (женщина), ihnen (несколько человек).",
    "finden: er / sie + findet. gefallen: ihm (чоловік), ihr (жінка), ihnen (кілька людей).",
    "finden: er / sie + findet. gefallen: ihm (erkek), ihr (kadın), ihnen (birkaç kişi)."
  ]
},
      ex: [
        mc('K3', 'positiv', I.choose, 'Emre wohnt in einer WG und hat dort viele Freunde. Wie findet er das?', ['Das findet er toll.', 'Das gefällt ihm nicht.', 'Das findet er nicht so toll.'],
          ['Emre lives in a shared flat and has many friends there. What does he think of that?', 'Emre живёт в общей квартире, там у него много друзей. Как он к этому относится?', 'Emre живе у спільній квартирі, там у нього багато друзів. Як він до цього ставиться?', 'Emre ortak bir evde oturuyor ve orada birçok arkadaşı var. Bunu nasıl buluyor?']),
        mc("K3", "negativ", I.choose, "Für „sie (Singular)“: Welche Aussage über eine lange, anstrengende Fahrt zur Arbeit ist negativ?", ["Das gefällt ihr nicht.","Das gefällt ihr sehr.","Das findet sie super."], ["For sie (singular): which statement about a long, exhausting journey to work is negative?","Для sie (ед. число): какое высказывание о долгой утомительной поездке на работу выражает отрицательное отношение?","Для sie (однина): яке висловлювання про довгу виснажливу поїздку на роботу виражає негативне ставлення?","sie (tekil) için: İşe yapılan uzun ve yorucu yolculuk hakkında hangi ifade olumsuzdur?"], {"c":"p1_bewerten"}),
        mc('K3', 'ihr', I.choose, 'Olga lebt allein. Das gefällt … gut.', ['ihr', 'ihm', 'sie'],
          ['Olga lives alone. She likes that.', 'Olga живёт одна. Ей это нравится.', 'Olga живе сама. Їй це подобається.', 'Olga yalnız yaşıyor. Bu onun hoşuna gidiyor.']),
        mc('K3', 'er', I.choose, 'Mein Bruder wohnt bei den Schwiegereltern. Das findet … nicht so toll.', ['er', 'ihm', 'ihn'],
          ['My brother lives with his parents-in-law. He does not think that is so great.', 'Мой брат живёт у родителей жены. Ему это не очень нравится.', 'Мій брат живе в батьків дружини. Йому це не дуже подобається.', 'Erkek kardeşim kayınvalidesiyle kayınpederinin yanında oturuyor. Bunu pek iyi bulmuyor.']),
        gap('K3', 'ihm', I.pronoun, 'Tom arbeitet am Wochenende. Das gefällt ', ' nicht.', 'ihm', ['ihn', 'er'],
          ['Tom works at the weekend. He does not like that.', 'Tom работает по выходным. Ему это не нравится.', 'Tom працює на вихідних. Йому це не подобається.', 'Tom hafta sonu çalışıyor. Bu onun hoşuna gitmiyor.'], 'er'),
        gap('K3', 'ihnen', I.pronoun, 'Meine Großeltern wohnen mit uns zusammen. Das gefällt ', ' sehr.', 'ihnen', ['sie', 'ihr'],
          ['My grandparents live with us. They like that very much.', 'Мои бабушка и дедушка живут вместе с нами. Им это очень нравится.', 'Мої бабуся й дідусь живуть разом із нами. Їм це дуже подобається.', 'Büyükannemle büyükbabam bizimle birlikte oturuyor. Bu onların çok hoşuna gidiyor.'], 'sie (Plural)'),
        gap("K3", "finden", I.verb, "Milan hat ein eigenes Zimmer. Das ", " er super.", "findet", ["gefällt","finden"], ["Milan has a room of his own. He thinks that is great.","У Milan есть своя комната. Он считает, что это здорово.","У Milan є власна кімната. Він вважає, що це чудово.","Milan’ın kendi odası var. Bunu harika buluyor."], "finden / gefallen", {"c":"p1_bewerten"}),
        gap('K3', 'gefallen', I.verb, 'Paul hat eine neue Wohnung. Die Wohnung ', ' ihm sehr gut.', 'gefällt', ['findet', 'gefallen'],
          ['Paul has a new flat. He likes the flat very much.', 'У Paul новая квартира. Квартира ему очень нравится.', 'У Paul нова квартира. Квартира йому дуже подобається.', 'Paul’un yeni bir dairesi var. Daire çok hoşuna gidiyor.'], 'finden / gefallen'),
        sb('K3', 'nicht so toll', I.order, 'Das / findet / sie / nicht so toll.',
          ['She does not think that is so great.', 'Ей это не очень нравится.', 'Їй це не дуже подобається.', 'Bunu pek iyi bulmuyor.'],
          { alt: ['Sie findet das nicht so toll.'] }),
      ],
    },
    {
      title: 'Eine Geschichte lesen',
      t: ['Reading a story', 'Читаем рассказ', 'Читаємо розповідь', 'Bir hikâye okumak'],
      card: {
        id: 'p1_lesen',
        rule: 'Eine Erzählung verstehen: Such zuerst die wichtigen Informationen: Wer? Wo? Wann? Was ist passiert? Warum? Die Wörter zuerst, dann, später und schließlich zeigen die Reihenfolge. Leider und so ein Pech zeigen ein Problem, zum Glück zeigt ein gutes Ende. Nach weil steht der Grund.',
        examples: ['Leider habe ich den Wecker nicht gehört.', 'Zum Glück hat der Chef nichts bemerkt.'],
        highlight: null,
        t: [
          'Understanding a story: first look for the important information: Wer? (who?) Wo? (where?) Wann? (when?) Was ist passiert? (what happened?) Warum? (why?) The words zuerst, dann, später and schließlich show the order. Leider (unfortunately) and so ein Pech point to a problem, zum Glück (luckily) points to a good ending. The reason comes after weil.',
          'Как понять рассказ: сначала найдите главное: Wer? (кто?) Wo? (где?) Wann? (когда?) Was ist passiert? (что случилось?) Warum? (почему?) Слова zuerst, dann, später и schließlich показывают порядок событий. Leider (к сожалению) и so ein Pech указывают на проблему, zum Glück (к счастью) – на хороший конец. После weil стоит причина.',
          'Як зрозуміти розповідь: спочатку знайдіть головне: Wer? (хто?) Wo? (де?) Wann? (коли?) Was ist passiert? (що сталося?) Warum? (чому?) Слова zuerst, dann, später і schließlich показують порядок подій. Leider (на жаль) і so ein Pech вказують на проблему, zum Glück (на щастя) – на добрий кінець. Після weil стоїть причина.',
          'Bir hikâyeyi anlamak: Önce önemli bilgileri arayın: Wer? (kim?) Wo? (nerede?) Wann? (ne zaman?) Was ist passiert? (ne oldu?) Warum? (neden?) zuerst, dann, später ve schließlich kelimeleri sırayı gösterir. Leider (maalesef) ve so ein Pech bir soruna, zum Glück (neyse ki) iyi bir sona işaret eder. Neden weil’den sonra gelir.',
        ],
        hint: ['Lies die Frage genau: Wer? Wann? Warum? Such dann die Stelle im Text.', 'Read the question carefully: who? when? why? Then find the place in the text.', 'Внимательно прочитайте вопрос: кто? когда? почему? Затем найдите это место в тексте.', 'Уважно прочитайте запитання: хто? коли? чому? Потім знайдіть це місце в тексті.', 'Soruyu dikkatle okuyun: Kim? Ne zaman? Neden? Sonra metinde o yeri bulun.'],
      },
      ex: [
        mc('Z1', 'Grund', I.read, `${SAMIR} Warum hat Samir verschlafen?`, ['Sein Handy war aus.', 'Er hat die S-Bahn verpasst.', 'Seine Nachbarin hat ihn angerufen.'],
          ['Why did Samir oversleep?', 'Почему Samir проспал?', 'Чому Samir проспав?', 'Samir neden uyuyakaldı?']),
        mc('Z1', 'Verkehrsmittel', I.read, `${SAMIR} Wie ist Samir zur Arbeit gekommen?`, ['Mit dem Auto von seiner Nachbarin.', 'Mit der S-Bahn.', 'Mit dem Taxi.'],
          ['How did Samir get to work?', 'Как Samir добрался до работы?', 'Як Samir дістався на роботу?', 'Samir işe nasıl gitti?']),
        mc('Z1', 'Wohnform', I.read, `${MARTA} Wie wohnt Marta jetzt?`, ['In einer Wohngemeinschaft.', 'Allein.', 'Bei ihren Eltern.'],
          ['How does Marta live now?', 'Как Marta живёт сейчас?', 'Як Marta живе зараз?', 'Marta şimdi nasıl yaşıyor?']),
        mc('Z1', 'Grund', I.read, `${MARTA} Warum gefällt Marta die WG?`, ['Sie kocht dort oft mit den anderen.', 'Sie wohnt gern allein.', 'Die Wohnung ist billig.'],
          ['Why does Marta like the shared flat?', 'Почему Marta нравится жить в общей квартире?', 'Чому Marta подобається жити у спільній квартирі?', 'Marta ortak evi neden seviyor?']),
        mc('Z1', 'Problem', I.read, `${JONAS} Was war das Problem?`, ['Jonas hatte kein Geld dabei.', 'Der Supermarkt war geschlossen.', 'Jonas hat seinen Geldbeutel verloren.'],
          ['What was the problem?', 'В чём была проблема?', 'У чому була проблема?', 'Sorun neydi?']),
        mc('Z1', 'Wer?', I.read, `${JONAS} Wer hat an der Kasse bezahlt?`, ['Eine andere Kundin.', 'Jonas.', 'Die Verkäuferin.'],
          ['Who paid at the checkout?', 'Кто заплатил на кассе?', 'Хто заплатив на касі?', 'Kasada kim ödedi?']),
        gap('Z1', 'Wortschatz', I.participle, `${JONAS} Jonas hat den Geldbeutel nicht verloren. Er hat ihn zu Hause `, '.', 'vergessen', ['verpasst', 'verkauft'],
          ['Jonas did not lose his purse. He forgot it at home.', 'Jonas не потерял кошелёк. Он забыл его дома.', 'Jonas не загубив гаманець. Він забув його вдома.', 'Jonas cüzdanını kaybetmedi. Onu evde unuttu.'],
          ['forgotten', 'забыл', 'забув', 'unuttu']),
      ],
    },
  ],
}

export default path
