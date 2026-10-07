import { I, gap, mc, sb } from '../shared.mjs'

const VORTRAG = 'Aus einem Vortrag für Schüler: „Wie prüft man, ob eine Brücke noch sicher ist? Früher mussten Ingenieure jede Brücke selbst besichtigen. Heute kleben wir kleine Sensoren auf den Beton. Sie messen, wie stark sich die Brücke bewegt, wenn Lastwagen darüberfahren. Weil die Sensoren ihre Daten per Funk senden, sehen wir jede Veränderung sofort. Obwohl die Technik teuer ist, lohnt sie sich: Wenn wir einen Schaden früh entdecken, kostet die Reparatur viel weniger. Damit die Messung genau bleibt, tauschen wir die Sensoren alle fünf Jahre aus. In einem Fachaufsatz würde ich das anders sagen: Die Früherkennung von Schäden ermöglicht eine Senkung der Instandhaltungskosten.“'
const FOLGE = ['deshalb', 'daher', 'folglich', 'somit', 'infolgedessen', 'deswegen', 'also']

/** C1.2 · Pfad 6 · Forschung und Technik – Wiederholung und Testpool. */
const check = {
  review: [
    mc('W1', 'Fehlerquelle', I.choose, 'Schwankungen der Temperatur sind bei dieser Messung die wichtigste …', ['Fehlerquelle', 'Fehlermeldung', 'Wasserquelle'],
      ['Fluctuations in temperature are the most important … in this measurement.', 'Колебания температуры – главный … при этом измерении.', 'Коливання температури – головне … під час цього вимірювання.', 'Bu ölçümde sıcaklık dalgalanmaları en önemli …']),
    mc('G1', 'erfolgen entschlüsseln', I.choose, 'Die Inbetriebnahme der Anlage erfolgt im Juni. = …', ['Die Anlage wird im Juni in Betrieb genommen.', 'Die Anlage hat im Juni großen Erfolg.', 'Die Anlage folgt im Juni dem Betrieb.'],
      ['The plant will be put into operation in June.', 'Ввод установки в эксплуатацию состоится в июне.', 'Введення установки в експлуатацію відбудеться в червні.', 'Tesis haziranda işletmeye alınacak.'], { h: 'funktionsverb' }),
    mc('G2', 'bevor → vor + Nomen', I.choose, 'Bevor man das Gerät ausliefert, testet man es. = … wird es getestet.', ['Vor der Auslieferung des Geräts', 'Vor die Auslieferung das Gerät', 'Nach der Auslieferung des Geräts'],
      ['Before the device is delivered, it is tested.', 'Прежде чем прибор отгружают, его испытывают.', 'Перш ніж прилад відвантажують, його випробовують.', 'Cihaz teslim edilmeden önce test edilir.'], { h: 'schritte' }),
    mc('G3', 'kann nicht festgestellt werden → lässt sich nicht feststellen', I.choose, 'Die Ursache kann nicht festgestellt werden. = Die Ursache …', ['lässt sich nicht feststellen.', 'lässt nicht sich feststellen.', 'lässt sich nicht festgestellt.'],
      ['The cause cannot be established.', 'Причину установить невозможно.', 'Причину встановити неможливо.', 'Neden saptanamıyor.'], { h: 'passiv' }),
    mc('G4', 'verständlichste Fassung', I.choose, 'Welche Fassung ist am verständlichsten?', ['Weil das Kabel beschädigt war, fiel die Anlage aus.', 'Der Ausfall der Anlage war in der Beschädigung des Kabels begründet.', 'Infolge des Vorliegens einer Beschädigung des Kabels kam es zum Ausfall der Anlage.'],
      ['Which version is the easiest to understand?', 'Какой вариант самый понятный?', 'Який варіант найзрозуміліший?', 'Hangi biçim en anlaşılır?'], { h: 'kette' }),
    mc('G5', 'damit → final', I.choose, 'Welche Relation? „Damit die Messung genau bleibt, werden die Sensoren regelmäßig ausgetauscht.“', ['final (Zweck)', 'konzessiv (Gegengrund ohne Wirkung)', 'konsekutiv (Folge)'],
      ['Which relation? “Damit die Messung genau bleibt, werden die Sensoren regelmäßig ausgetauscht.”', 'Какое отношение? «Damit die Messung genau bleibt, werden die Sensoren regelmäßig ausgetauscht.»', 'Яке відношення? «Damit die Messung genau bleibt, werden die Sensoren regelmäßig ausgetauscht.»', 'Hangi ilişki? “Damit die Messung genau bleibt, werden die Sensoren regelmäßig ausgetauscht.”'], { h: 'signal' }),
    mc('G6', 'dennoch → obwohl', I.choose, 'Das Verfahren ist teuer; dennoch wird es eingesetzt. = …', ['Obwohl das Verfahren teuer ist, wird es eingesetzt.', 'Weil das Verfahren teuer ist, wird es eingesetzt.', 'Sofern das Verfahren teuer ist, wird es eingesetzt.'],
      ['The method is expensive; nevertheless it is used.', 'Метод дорогой; тем не менее его применяют.', 'Метод дорогий; проте його застосовують.', 'Yöntem pahalı; yine de kullanılıyor.'], { h: 'gleiche' }),
    mc('G7', 'doppelte Markierung: weil … deshalb', I.choose, 'Welcher Satz enthält eine doppelte Markierung?', ['Weil der Sensor defekt war, deshalb wurde er ersetzt.', 'Weil der Sensor defekt war, wurde er ersetzt.', 'Der Sensor war defekt; deshalb wurde er ersetzt.'],
      ['Which sentence contains a double marker?', 'В каком предложении отношение отмечено дважды?', 'У якому реченні відношення позначено двічі?', 'Hangi cümlede çifte işaretleme var?'], { h: 'diagnose' }),
    mc('G8', 'wegen des Ausfalls → weil … ausfiel', I.choose, 'Wegen des Ausfalls der Kühlung wurde der Versuch abgebrochen. = …', ['Weil die Kühlung ausfiel, wurde der Versuch abgebrochen.', 'Obwohl die Kühlung ausfiel, wurde der Versuch abgebrochen.', 'Damit die Kühlung ausfiel, wurde der Versuch abgebrochen.'],
      ['Because of the failure of the cooling system the experiment was broken off.', 'Из-за отказа охлаждения опыт прервали.', 'Через відмову охолодження дослід перервали.', 'Soğutmanın devre dışı kalması yüzünden deney yarıda kesildi.'], { h: 'schritte' }),
    mc('G9', 'Textsorte für Nominalstil', I.choose, 'In welchem Text ist Nominalstil üblich?', ['in einem Forschungsbericht', 'in einem Gespräch mit Schülern', 'in einer Nachricht an einen Freund'],
      ['In which text is nominal style usual?', 'В каком тексте именной стиль обычен?', 'У якому тексті іменний стиль звичний?', 'İsimli üslup hangi metinde olağandır?'], { h: 'adressat' }),
    mc('Z1', 'Vortrag: Grund', I.read, `${VORTRAG} Warum sehen die Ingenieure jede Veränderung sofort?`, ['weil die Sensoren ihre Daten per Funk senden', 'weil sie jede Brücke täglich besichtigen', 'weil Lastwagen die Brücke nicht mehr befahren'],
      ['Why do the engineers see every change at once?', 'Почему инженеры сразу видят любое изменение?', 'Чому інженери одразу бачать будь-яку зміну?', 'Mühendisler her değişikliği neden hemen görüyor?']),
    gap('G6', 'deshalb', I.adverb, 'Die Probe war zu klein; ', ' konnte sie nicht untersucht werden.', FOLGE, ['dennoch', 'obwohl'],
      ['The sample was too small; therefore it could not be examined.', 'Проба была слишком маленькой; поэтому её не удалось исследовать.', 'Проба була надто малою; тому її не вдалося дослідити.', 'Numune çok küçüktü; bu yüzden incelenemedi.'], 'deshalb / dennoch / obwohl', { h: 'gleiche' }),
    sb('G3', 'lässt sich + Infinitiv', I.order, 'Die Abweichung / lässt / sich / leicht / erklären.',
      ['The deviation can easily be explained.', 'Отклонение легко объясняется.', 'Відхилення легко пояснюється.', 'Sapma kolaylıkla açıklanabiliyor.'], { h: 'passiv' }),
  ],
  size: 13,
  test: [
    mc('W1', 'Verfahren', I.choose, 'Was ist ein „Verfahren“ in der Technik?', ['die Methode, nach der man vorgeht', 'die Strecke, die ein Fahrzeug zurücklegt', 'der Fehler, den ein Gerät macht'],
      ['What is a “Verfahren” in technology?', 'Что такое «Verfahren» в технике?', 'Що таке «Verfahren» у техніці?', 'Teknikte “Verfahren” nedir?']),
    mc('W1', 'nachweisen', I.choose, 'Die Forscher konnten …, dass das Material auch bei großer Hitze stabil bleibt.', ['nachweisen', 'nachschlagen', 'nachgeben'],
      ['The researchers were able to … that the material remains stable even in great heat.', 'Исследователи смогли …, что материал остаётся стабильным даже при сильной жаре.', 'Дослідники змогли …, що матеріал залишається стабільним навіть за великої спеки.', 'Araştırmacılar malzemenin yüksek ısıda bile dayanıklı kaldığını … başardı.']),
    gap('W1', 'Prototyp', I.word, 'Der erste ', ' des Motors wurde zwei Jahre lang getestet, bevor die Serienfertigung begann.', 'Prototyp', ['Prospekt', 'Protest'],
      ['The first prototype of the engine was tested for two years before series production began.', 'Первый прототип двигателя испытывали два года, прежде чем началось серийное производство.', 'Перший прототип двигуна випробовували два роки, перш ніж почалося серійне виробництво.', 'Motorun ilk prototipi, seri üretim başlamadan önce iki yıl boyunca test edildi.'],
      ['prototype', 'прототип, опытный образец', 'прототип, дослідний зразок', 'prototip, ilk örnek']),

    mc('G1', 'eine Untersuchung durchführen', I.choose, 'eine Untersuchung durchführen = …', ['etwas untersuchen', 'eine Untersuchung verschieben', 'durch eine Untersuchung fahren'],
      ['to carry out an investigation = to investigate something', 'провести исследование = что-либо исследовать', 'провести дослідження = щось дослідити', 'inceleme yapmak = bir şeyi incelemek'], { h: 'funktionsverb' }),
    mc('G1', 'vor + Nomen entschlüsseln', I.choose, 'Vor der Zulassung des Geräts erfolgt eine Prüfung durch die Behörde. = …', ['Bevor das Gerät zugelassen wird, prüft es die Behörde.', 'Nachdem das Gerät zugelassen ist, prüft es die Behörde.', 'Weil die Behörde das Gerät prüft, wird es nicht zugelassen.'],
      ['Before the device is approved it is tested by the authority.', 'Перед допуском прибора ведомство проводит проверку.', 'Перед допуском приладу відомство проводить перевірку.', 'Cihaz ruhsat almadan önce kurum tarafından denetlenir.'], { h: 'zeit' }),
    gap('G1', 'erfolgt', I.verb, 'Die Auswertung der Daten ', ' mithilfe einer speziellen Software.', ['erfolgt', 'erfolgte', 'geschieht', 'geschah'], ['erfolgreich', 'verfolgt'],
      ['The data are evaluated with the help of special software.', 'Обработка данных производится с помощью специальной программы.', 'Опрацювання даних проводиться за допомогою спеціальної програми.', 'Verilerin değerlendirilmesi özel bir yazılımla yapılıyor.'], 'erfolgen', { h: 'funktionsverb' }),

    mc('G2', 'analysieren → die Analyse', I.choose, 'Welches Nomen gehört zu „analysieren“?', ['die Analyse', 'die Analysierung', 'das Analysat'],
      ['Which noun belongs to “analysieren”?', 'Какое существительное соответствует глаголу «analysieren»?', 'Який іменник відповідає дієслову «analysieren»?', '“analysieren” fiiline hangi isim aittir?'], { h: 'schritte' }),
    mc('G2', 'nachdem → nach dem Umbau', I.choose, 'Nachdem man die Anlage umgebaut hatte, stieg die Leistung. = … stieg die Leistung.', ['Nach dem Umbau der Anlage', 'Nach den Umbau die Anlage', 'Trotz des Umbaus der Anlage'],
      ['After the plant had been converted, output rose.', 'После того как установку перестроили, производительность выросла.', 'Після того як установку перебудували, продуктивність зросла.', 'Tesis yeniden düzenlendikten sonra verim arttı.'], { h: 'genitiv' }),
    gap('G2', 'die Messung des Drucks', I.article, 'Man misst den Druck. → die Messung ', ' Drucks', 'des', ['den', 'dem'],
      ['The pressure is measured. → the measurement of the pressure', 'Измеряют давление. → измерение давления', 'Вимірюють тиск. → вимірювання тиску', 'Basınç ölçülüyor. → basıncın ölçülmesi'], 'des / den / dem', { h: 'genitiv' }),

    mc('G3', 'ist nicht zu erkennen', I.choose, 'Ein Zusammenhang ist nicht zu erkennen. = …', ['Ein Zusammenhang kann nicht erkannt werden.', 'Ein Zusammenhang will nicht erkennen.', 'Ein Zusammenhang hat nichts erkannt.'],
      ['No connection can be discerned.', 'Взаимосвязь обнаружить невозможно.', 'Взаємозв’язок виявити неможливо.', 'Bir bağlantı görülemiyor.'], { h: 'passiv' }),
    mc('G3', 'Relativsatz → erweitertes Attribut', I.choose, 'die Proben, die bei 80 Grad getrocknet wurden = …', ['die bei 80 Grad getrockneten Proben', 'die bei 80 Grad trocknenden Proben', 'die bei 80 Grad Proben getrockneten'],
      ['the samples that were dried at 80 degrees = the samples dried at 80 degrees', 'пробы, которые были высушены при 80 градусах = высушенные при 80 градусах пробы', 'проби, які було висушено за 80 градусів = висушені за 80 градусів проби', '80 derecede kurutulan numuneler'], { h: 'attribut' }),
    gap('G3', 'Es lässt sich feststellen', I.verb, 'Es lässt sich ', ', dass der Verbrauch um zehn Prozent gesunken ist.', ['feststellen', 'sagen', 'zeigen', 'beobachten', 'nachweisen', 'erkennen'], ['festgestellt', 'feststellt'],
      ['It can be established that consumption has fallen by ten per cent.', 'Можно констатировать, что расход снизился на десять процентов.', 'Можна констатувати, що витрата зменшилася на десять відсотків.', 'Tüketimin yüzde on azaldığı saptanabiliyor.'], 'feststellen / festgestellt / feststellt', { h: 'es' }),

    mc('G4', 'doppeldeutiger Genitiv bei Kontrolle', I.choose, 'Welche Gruppe ist nicht eindeutig?', ['die Kontrolle der Behörde', 'die Kontrolle durch die Behörde', 'die Kontrolle der Anlage durch die Behörde'],
      ['Which group is not unambiguous?', 'Какая группа неоднозначна?', 'Яка група неоднозначна?', 'Hangi öbek açık değil?'], { h: 'bezug' }),
    mc('G4', 'Nominalkette in einen Satz verwandeln', I.choose, 'die Erhöhung der Sicherheit der Anlage = …', ['Die Anlage wird sicherer gemacht.', 'Die Sicherheit macht die Anlage höher.', 'Die Anlage erhöht ihre eigene Sicherung.'],
      ['the increase in the safety of the plant = The plant is made safer.', 'повышение безопасности установки = Установку делают безопаснее.', 'підвищення безпеки установки = Установку роблять безпечнішою.', 'tesisin güvenliğinin artırılması = Tesis daha güvenli hâle getiriliyor.'], { h: 'kette' }),

    mc('G5', 'trotz → konzessiv', I.choose, 'Welche Relation? „Trotz der Kälte funktionierte der Sensor einwandfrei.“', ['konzessiv (Gegengrund ohne Wirkung)', 'kausal (Grund)', 'final (Zweck)'],
      ['Which relation? “Trotz der Kälte funktionierte der Sensor einwandfrei.”', 'Какое отношение? «Trotz der Kälte funktionierte der Sensor einwandfrei.»', 'Яке відношення? «Trotz der Kälte funktionierte der Sensor einwandfrei.»', 'Hangi ilişki? “Trotz der Kälte funktionierte der Sensor einwandfrei.”'], { h: 'signal' }),
    mc('G5', 'Frage zur finalen Relation', I.qword, 'Welche Frage passt zur finalen Relation?', ['Wozu?', 'Warum?', 'Mit welcher Folge?'],
      ['Which question goes with the final relation?', 'Какой вопрос соответствует целевому отношению?', 'Яке запитання відповідає цільовому відношенню?', 'Amaç ilişkisine hangi soru uyar?'], { h: 'frage' }),
    gap('G5', 'kausal: weil', I.conjunction, 'Kausal: Der Versuch wurde abgebrochen, ', ' die Kühlung ausgefallen war.', ['weil', 'da'], ['damit', 'sodass'],
      ['Causal: The experiment was broken off because the cooling system had failed.', 'Причина: Опыт прервали, потому что отказало охлаждение.', 'Причина: Дослід перервали, бо відмовило охолодження.', 'Neden: Soğutma devre dışı kaldığı için deney yarıda kesildi.'], 'weil / damit / sodass', { h: 'signal' }),

    mc('G6', 'da → infolgedessen', I.choose, 'Da die Leitung beschädigt war, fiel der Strom aus. = Die Leitung war beschädigt; …', ['infolgedessen fiel der Strom aus.', 'dennoch fiel der Strom aus.', 'infolgedessen der Strom fiel aus.'],
      ['As the cable was damaged, the power failed.', 'Поскольку провод был повреждён, электричество отключилось.', 'Оскільки дріт був пошкоджений, електрика вимкнулася.', 'Hat hasarlı olduğu için elektrik kesildi.'], { h: 'gleiche' }),
    mc('G6', 'drei Formen einer Relation', I.choose, 'Welche drei Ausdrücke drücken dieselbe Relation aus?', ['obwohl – trotzdem – trotz', 'obwohl – deshalb – wegen', 'weil – dennoch – trotz'],
      ['Which three expressions convey the same relation?', 'Какие три выражения передают одно и то же отношение?', 'Які три вирази передають те саме відношення?', 'Hangi üç ifade aynı ilişkiyi bildirir?'], { h: 'gleiche' }),
    gap('G6', 'obwohl → Trotz', I.prep, 'Obwohl das Material teuer ist, wird es verwendet. = ', ' des hohen Preises wird das Material verwendet.', ['Trotz', 'Ungeachtet'], ['Wegen', 'Zwecks'],
      ['Although the material is expensive, it is used.', 'Хотя материал дорогой, его используют.', 'Хоча матеріал дорогий, його використовують.', 'Malzeme pahalı olmasına rağmen kullanılıyor.'], 'Trotz / Wegen / Zwecks', { h: 'gleiche' }),

    mc('G7', 'Einräumung + Grund beim Motor', I.choose, 'Verbinde: Der Motor ist klein. Er ist stark. Der Grund: Er nutzt die Energie besser. = …', ['Obwohl der Motor klein ist, ist er stark, weil er die Energie besser nutzt.', 'Weil der Motor klein ist, ist er stark, obwohl er die Energie besser nutzt.', 'Damit der Motor klein ist, ist er stark, sodass er die Energie besser nutzt.'],
      ['Link them: The engine is small. It is powerful. The reason: it uses energy better.', 'Соедините: Двигатель маленький. Он мощный. Причина: он лучше использует энергию.', 'З’єднайте: Двигун малий. Він потужний. Причина: він краще використовує енергію.', 'Birleştirin: Motor küçük. Güçlü. Nedeni: enerjiyi daha iyi kullanıyor.'], { h: 'logik' }),
    mc('G7', 'unlogisches obwohl', I.choose, 'Welcher Satz ist logisch falsch verknüpft?', ['Obwohl der Test gelang, wurde das Gerät zugelassen.', 'Weil der Test gelang, wurde das Gerät zugelassen.', 'Nachdem der Test gelungen war, wurde das Gerät zugelassen.'],
      ['Which sentence is linked in a logically wrong way?', 'В каком предложении логическая связь неверна?', 'У якому реченні логічний зв’язок неправильний?', 'Hangi cümle mantık açısından yanlış bağlanmış?'], { h: 'diagnose' }),

    mc('G8', 'voraussetzen → erst wenn', I.choose, 'Die Reparatur der Anlage setzt die Lieferung der Ersatzteile voraus. = …', ['Die Anlage kann erst repariert werden, wenn die Ersatzteile geliefert sind.', 'Die Anlage wird repariert, obwohl die Ersatzteile geliefert sind.', 'Die Ersatzteile werden geliefert, weil die Anlage repariert ist.'],
      ['The repair of the plant presupposes the delivery of the spare parts.', 'Ремонт установки предполагает поставку запасных частей.', 'Ремонт установки передбачає постачання запасних частин.', 'Tesisin onarımı yedek parçaların teslim edilmesini gerektirir.'], { h: 'erfordern' }),
    mc('G8', 'durch → indem', I.choose, 'Durch die Verwendung von Sensoren lassen sich Schäden früh erkennen. = …', ['Indem man Sensoren verwendet, kann man Schäden früh erkennen.', 'Obwohl man Sensoren verwendet, kann man Schäden früh erkennen.', 'Bevor man Sensoren verwendet, kann man Schäden früh erkennen.'],
      ['By using sensors damage can be detected early.', 'Используя датчики, можно рано обнаруживать повреждения.', 'Використовуючи датчики, можна рано виявляти пошкодження.', 'Sensör kullanılarak hasarlar erken fark edilebilir.'], { h: 'schritte' }),
    gap('G8', 'vor → Bevor', I.conjunction, 'Vor Beginn der Messung wird das Gerät geeicht. = ', ' die Messung beginnt, wird das Gerät geeicht.', ['Bevor', 'Ehe'], ['Nachdem', 'Weil'],
      ['Before the measurement begins, the instrument is calibrated.', 'Перед началом измерения прибор калибруют.', 'Перед початком вимірювання прилад калібрують.', 'Ölçüm başlamadan önce cihaz ayarlanır.'], 'Bevor / Nachdem / Weil', { h: 'zeit' }),

    mc('G9', 'Relation erhalten: zur → um … zu', I.choose, 'Welche Umformung erhält die Bedeutung? „Zur Sicherung der Qualität prüft man jedes Teil.“', ['Um die Qualität zu sichern, prüft man jedes Teil.', 'Weil die Qualität gesichert ist, prüft man jedes Teil.', 'Obwohl man die Qualität sichert, prüft man jedes Teil.'],
      ['Which transformation preserves the meaning? “Zur Sicherung der Qualität prüft man jedes Teil.”', 'Какое преобразование сохраняет смысл? «Zur Sicherung der Qualität prüft man jedes Teil.»', 'Яке перетворення зберігає зміст? «Zur Sicherung der Qualität prüft man jedes Teil.»', 'Hangi dönüştürme anlamı koruyor? “Zur Sicherung der Qualität prüft man jedes Teil.”'], { h: 'relation' }),
    mc('G9', 'Erklärung für ein Kind', I.natural, 'Ein Forscher erklärt seinem zehnjährigen Neffen, warum Eisen rostet.', ['Wenn Eisen lange nass ist, verbindet es sich mit Sauerstoff – und das ist Rost.', 'Die Korrosion von Eisen beruht auf der Oxidation infolge anhaltender Feuchtigkeit.', 'Unter Einwirkung von Feuchtigkeit erfolgt die Bildung von Eisenoxid.'],
      ['A researcher is explaining to his ten-year-old nephew why iron rusts.', 'Исследователь объясняет десятилетнему племяннику, почему железо ржавеет.', 'Дослідник пояснює десятирічному небожеві, чому залізо іржавіє.', 'Bir araştırmacı on yaşındaki yeğenine demirin neden paslandığını anlatıyor.'], { h: 'adressat' }),
    gap('G9', 'weil → Aufgrund', I.prep, 'Vortrag: „Weil der Druck stieg, platzte das Rohr.“ – Fachtext: „', ' des Druckanstiegs platzte das Rohr.“', ['Aufgrund', 'Wegen', 'Infolge'], ['Trotz', 'Zwecks'],
      ['Talk: “Because the pressure rose, the pipe burst.” – Specialist text: “Owing to the rise in pressure the pipe burst.”', 'Доклад: «Поскольку давление выросло, труба лопнула». – Специальный текст: «Вследствие роста давления труба лопнула».', 'Доповідь: «Оскільки тиск зріс, труба луснула». – Фаховий текст: «Унаслідок зростання тиску труба луснула».', 'Konuşma: “Basınç arttığı için boru patladı.” – Uzmanlık metni: “Basınç artışı nedeniyle boru patladı.”'], 'Aufgrund / Trotz / Zwecks', { h: 'relation' }),

    mc('Z1', 'Vortrag: Zweck', I.read, `${VORTRAG} Wozu werden die Sensoren alle fünf Jahre ausgetauscht?`, ['damit die Messung genau bleibt', 'damit die Technik billiger wird', 'damit die Brücke sich weniger bewegt'],
      ['For what purpose are the sensors replaced every five years?', 'С какой целью датчики меняют каждые пять лет?', 'З якою метою датчики міняють кожні п’ять років?', 'Sensörler ne amaçla beş yılda bir değiştiriliyor?']),
    mc('Z1', 'Vortrag: Fachsatz auflösen', I.read, `${VORTRAG} Was bedeutet der Satz aus dem Fachaufsatz in einfachen Worten?`, ['Wenn man Schäden früh erkennt, kostet die Instandhaltung weniger.', 'Wenn man die Kosten senkt, erkennt man Schäden früher.', 'Wenn man Schäden spät erkennt, sinken die Kosten der Instandhaltung.'],
      ['What does the sentence from the specialist paper mean in simple words?', 'Что означает предложение из научной статьи простыми словами?', 'Що означає речення з наукової статті простими словами?', 'Uzmanlık makalesindeki cümle basit sözcüklerle ne demek?']),
  ],
}

export default check
