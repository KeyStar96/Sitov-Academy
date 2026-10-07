import { I, gap, mc, sb } from '../shared.mjs'

const INTERVIEW = 'Aus einem Interview mit einem Psychologen: „Dauerhafte Belastung ist selten auf eine einzige Ursache zurückzuführen. Meist beruht sie auf dem Zusammenspiel von Zeitdruck, fehlender Anerkennung und mangelnder Erholung. Viele Betroffene bemerken die Überlastung lange nicht, zumal sie Warnsignale wie Schlafstörungen verdrängen. Die ständige Anspannung hat schließlich körperliche Beschwerden zur Folge. Aus Scham sprechen manche nicht einmal mit ihren Angehörigen darüber. Dabei hängt die Bewältigung von Stress entscheidend von der Unterstützung durch das Umfeld ab. Dank regelmäßiger Gespräche lernen die Betroffenen, ihre Grenzen wahrzunehmen. Folglich sollte niemand zögern, sich rechtzeitig Hilfe zu suchen. Wer früh handelt, erholt sich in der Regel deutlich schneller.“'
const FOLGE = ['demzufolge', 'folglich', 'somit', 'mithin', 'deshalb', 'daher', 'also']

/** C1.2 · Pfad 2 · Psychologie – Wiederholung und Testpool. */
const check = {
  review: [
    mc('W1', 'Bewusstsein', I.choose, 'Nach dem Sturz lag er einige Minuten ohne … am Boden.', ['Bewusstsein', 'Selbstbewusstsein', 'Unterbewusstsein'],
      ['After the fall he lay unconscious on the ground for a few minutes.', 'После падения он несколько минут лежал на земле без сознания.', 'Після падіння він кілька хвилин лежав на землі непритомний.', 'Düştükten sonra birkaç dakika bilinçsiz hâlde yerde yattı.']),
    mc('G1', 'mangels', I.prep, 'Die Untersuchung wurde … finanzieller Mittel nicht fortgesetzt.', ['mangels', 'dank', 'infolge'],
      ['The study was not continued for lack of financial resources.', 'Исследование не было продолжено из-за нехватки финансовых средств.', 'Дослідження не було продовжено через брак фінансових коштів.', 'Araştırma mali kaynak yetersizliği nedeniyle sürdürülmedi.'], { h: 'mangels' }),
    mc('G2', 'vor Aufregung', I.prep, 'Er konnte … Aufregung kaum sprechen.', ['vor', 'aus', 'für'],
      ['He could hardly speak for nervousness.', 'От волнения он едва мог говорить.', 'Від хвилювання він ледве міг говорити.', 'Heyecandan neredeyse konuşamıyordu.'], { h: 'reaktion' }),
    mc('G3', 'nämlich', I.choose, 'Er bleibt heute zu Hause. Er fühlt sich … nicht wohl.', ['nämlich', 'zumal', 'mithin'],
      ['He is staying at home today. You see, he does not feel well.', 'Сегодня он остаётся дома. Дело в том, что он плохо себя чувствует.', 'Сьогодні він залишається вдома. Річ у тім, що він погано почувається.', 'Bugün evde kalıyor. Çünkü kendini iyi hissetmiyor.'], { h: 'naemlich' }),
    mc('G4', 'folglich', I.choose, 'Die Stichprobe war sehr klein; … sind die Ergebnisse mit Vorsicht zu lesen.', ['folglich', 'nämlich', 'zumal'],
      ['The sample was very small; consequently the results should be read with caution.', 'Выборка была очень маленькой; следовательно, к результатам нужно относиться осторожно.', 'Вибірка була дуже малою; отже, до результатів слід ставитися обережно.', 'Örneklem çok küçüktü; dolayısıyla sonuçlar dikkatle okunmalıdır.'], { h: 'richtung' }),
    mc('G5', 'zurückgehen auf', I.verb, 'Die Konflikte im Team … auf fehlende Absprachen zurück.', ['gehen', 'geben', 'rufen'],
      ['The conflicts in the team go back to a lack of agreements.', 'Конфликты в команде объясняются отсутствием договорённостей.', 'Конфлікти в команді пояснюються браком домовленостей.', 'Ekipteki çatışmalar eksik anlaşmalardan kaynaklanıyor.'], { h: 'richtung' }),
    mc('G6', 'weil → aufgrund', I.choose, 'Weil der Druck ständig zunahm, kündigte er. = … kündigte er.', ['Aufgrund des ständig zunehmenden Drucks', 'Aufgrund den ständig zunehmenden Druck', 'Trotz des ständig zunehmenden Drucks'],
      ['Because the pressure kept increasing, he handed in his notice.', 'Поскольку давление постоянно росло, он уволился.', 'Оскільки тиск постійно зростав, він звільнився.', 'Baskı sürekli arttığı için istifa etti.'], { h: 'rektion' }),
    mc('G7', 'aufmerksam → die Aufmerksamkeit', I.choose, 'aufmerksam → …', ['die Aufmerksamkeit', 'die Aufmerksamheit', 'die Aufmerkung'],
      ['attentive → attention', 'внимательный → внимание', 'уважний → увага', 'dikkatli → dikkat'], { h: 'suffix' }),
    mc('G8', 'zweifeln an → der Zweifel an', I.choose, 'Die Mitarbeiter zweifeln am Sinn der Maßnahme. → die Zweifel der Mitarbeiter …', ['am Sinn der Maßnahme', 'den Sinn der Maßnahme', 'zum Sinn der Maßnahme'],
      ['The staff doubt the point of the measure. → the staff’s doubts about the point of the measure', 'Сотрудники сомневаются в смысле этой меры. → сомнения сотрудников в смысле этой меры', 'Працівники сумніваються в сенсі цього заходу. → сумніви працівників у сенсі цього заходу', 'Çalışanlar önlemin anlamından şüphe ediyor. → çalışanların önlemin anlamına ilişkin şüpheleri'], { h: 'praep' }),
    mc('G9', 'Kern mit zwei Attributen', I.choose, 'Was ist der Kern? „der Zusammenhang zwischen der Dauer des Schlafs und der Leistung“', ['der Zusammenhang', 'die Dauer', 'die Leistung'],
      ['What is the head? “der Zusammenhang zwischen der Dauer des Schlafs und der Leistung”', 'Что является ядром? «der Zusammenhang zwischen der Dauer des Schlafs und der Leistung»', 'Що є ядром? «der Zusammenhang zwischen der Dauer des Schlafs und der Leistung»', 'Çekirdek hangisi? “der Zusammenhang zwischen der Dauer des Schlafs und der Leistung”'], { h: 'kern' }),
    mc('Z1', 'Interview: Ursachen der Belastung', I.read, `${INTERVIEW} Worauf beruht dauerhafte Belastung nach Ansicht des Psychologen meist?`, ['auf dem Zusammenwirken mehrerer Ursachen', 'auf einer einzigen, klar erkennbaren Ursache', 'auf der Unterstützung durch das Umfeld'],
      ['In the psychologist’s view, what is permanent strain usually based on?', 'На чём, по мнению психолога, обычно основана длительная нагрузка?', 'На чому, на думку психолога, зазвичай ґрунтується тривале навантаження?', 'Psikoloğa göre kalıcı yük çoğunlukla neye dayanır?']),
    gap('G1', 'Wegen', I.prep, '', ' der langen Krankheit musste er sein Studium unterbrechen.', ['Wegen', 'Aufgrund', 'Infolge'], ['Dank', 'Mangels'],
      ['Because of his long illness he had to interrupt his studies.', 'Из-за долгой болезни ему пришлось прервать учёбу.', 'Через тривалу хворобу йому довелося перервати навчання.', 'Uzun süren hastalığı yüzünden öğrenimine ara vermek zorunda kaldı.'], 'Wegen / Dank / Mangels', { h: 'dank' }),
    sb('G4', 'derart …, dass', I.order, 'Der Student / war / derart / erschöpft, / dass / er / sofort / einschlief.',
      ['The student was so exhausted that he fell asleep at once.', 'Студент был настолько измотан, что сразу уснул.', 'Студент був настільки виснажений, що одразу заснув.', 'Öğrenci o kadar bitkindi ki hemen uyuyakaldı.'], { h: 'derart' }),
  ],
  size: 13,
  test: [
    mc('W1', 'Bewältigung', I.choose, 'Was bedeutet „Bewältigung“?', ['das erfolgreiche Umgehen mit einer schwierigen Lage', 'das Vermeiden jeder schwierigen Lage im Alltag', 'das Entstehen einer schwierigen Lage im Beruf'],
      ['What does “Bewältigung” mean?', 'Что означает «Bewältigung»?', 'Що означає «Bewältigung»?', '“Bewältigung” ne demek?']),
    mc('W1', 'Unterbewusstsein', I.choose, 'Träume zeigen nach Ansicht mancher Forscher, was im … vor sich geht.', ['Unterbewusstsein', 'Untergeschoss', 'Unterricht'],
      ['In the view of some researchers, dreams show what is going on in the …', 'По мнению некоторых исследователей, сны показывают, что происходит в …', 'На думку деяких дослідників, сни показують, що відбувається в …', 'Bazı araştırmacılara göre rüyalar … neler olup bittiğini gösterir.']),
    gap('W1', 'Verhalten', I.word, 'Belohnungen beeinflussen das ', ' von Kindern stärker als Strafen.', 'Verhalten', ['Verhältnis', 'Verfahren'],
      ['Rewards influence children’s behaviour more strongly than punishments.', 'Поощрения влияют на поведение детей сильнее, чем наказания.', 'Заохочення впливають на поведінку дітей сильніше, ніж покарання.', 'Ödüller çocukların davranışını cezalardan daha güçlü etkiler.'],
      ['behaviour', 'поведение', 'поведінка', 'davranış']),

    mc('G1', 'infolge + Genitiv', I.choose, 'Infolge … mussten mehrere Sitzungen ausfallen.', ['einer Erkrankung des Therapeuten', 'eine Erkrankung des Therapeuten', 'einer Erkrankung dem Therapeuten'],
      ['As a result of the therapist’s illness several sessions had to be cancelled.', 'Вследствие болезни терапевта пришлось отменить несколько сеансов.', 'Унаслідок хвороби терапевта довелося скасувати кілька сеансів.', 'Terapistin hastalanması sonucunda birkaç seans iptal edilmek zorunda kaldı.'], { h: 'kasus' }),
    mc('G1', 'Bedeutung von dank', I.choose, 'Was drückt „dank“ aus? „Dank der Gespräche fand er neuen Mut.“', ['eine Ursache mit positiver Folge', 'eine Ursache mit negativer Folge', 'eine fehlende Voraussetzung'],
      ['What does “dank” express? “Dank der Gespräche fand er neuen Mut.”', 'Что выражает «dank»? «Dank der Gespräche fand er neuen Mut.»', 'Що виражає «dank»? «Dank der Gespräche fand er neuen Mut.»', '“dank” neyi ifade eder? “Dank der Gespräche fand er neuen Mut.”'], { h: 'dank' }),
    gap('G1', 'Mangels', I.prep, '', ' ausreichender Erfahrung traute er sich die Leitung der Gruppe nicht zu.', 'Mangels', ['Dank', 'Trotz'],
      ['For lack of sufficient experience he did not feel able to lead the group.', 'Из-за недостатка опыта он не решался руководить группой.', 'Через брак досвіду він не наважувався керувати групою.', 'Yeterli deneyimi olmadığı için grubu yönetmeye cesaret edemedi.'], 'Mangels / Dank / Trotz', { h: 'mangels' }),

    mc('G2', 'aus Mitleid', I.prep, 'Er half dem Fremden … Mitleid.', ['aus', 'vor', 'bei'],
      ['He helped the stranger out of pity.', 'Он помог незнакомцу из жалости.', 'Він допоміг незнайомцеві з жалю.', 'Yabancıya acıdığı için yardım etti.'], { h: 'motiv' }),
    mc('G2', 'vor Kälte zittern', I.sentence, 'Welcher Satz ist richtig?', ['Die Kinder zitterten vor Kälte.', 'Die Kinder zitterten aus Kälte.', 'Die Kinder zitterten vor der Kälte.'],
      ['Which sentence is correct?', 'Какое предложение правильное?', 'Яке речення правильне?', 'Hangi cümle doğru?'], { h: 'reaktion' }),
    gap('G2', 'aus Angst', I.prep, 'Er hat den Fehler nicht gemeldet – ', ' Angst vor den Folgen.', 'aus', ['vor', 'mit'],
      ['He did not report the mistake – out of fear of the consequences.', 'Он не сообщил об ошибке – из страха перед последствиями.', 'Він не повідомив про помилку – зі страху перед наслідками.', 'Hatayı bildirmedi – sonuçlarından korktuğu için.'], 'aus / vor / mit', { h: 'motiv' }),

    mc('G3', 'zumal', I.choose, 'Er sollte das Angebot annehmen, … er schon lange eine neue Aufgabe sucht.', ['zumal', 'nämlich', 'folglich'],
      ['He ought to accept the offer, especially as he has long been looking for a new challenge.', 'Ему стоит принять предложение, тем более что он давно ищет новую задачу.', 'Йому варто прийняти пропозицію, тим паче що він давно шукає нове завдання.', 'Teklifi kabul etmeli, hele de uzun zamandır yeni bir görev aradığı için.'], { h: 'zumal' }),
    mc('G3', 'Funktion von schließlich', I.choose, 'Was drückt „schließlich“ aus? „Lass ihn entscheiden – es ist schließlich sein Leben.“', ['eine Begründung, die der Hörer anerkennen muss', 'eine Folge, die erst viel später eintritt', 'eine Bedingung, die noch nicht erfüllt ist'],
      ['What does “schließlich” express? “Lass ihn entscheiden – es ist schließlich sein Leben.”', 'Что выражает «schließlich»? «Lass ihn entscheiden – es ist schließlich sein Leben.»', 'Що виражає «schließlich»? «Lass ihn entscheiden – es ist schließlich sein Leben.»', '“schließlich” neyi ifade eder? “Lass ihn entscheiden – es ist schließlich sein Leben.”'], { h: 'schliesslich' }),
    gap('G3', 'nämlich', I.adverb, 'Ich kann dir leider nicht helfen. Ich kenne mich damit ', ' selbst nicht aus.', 'nämlich', ['zumal', 'folglich'],
      ['Unfortunately I cannot help you. You see, I do not know my way around it myself.', 'К сожалению, я не могу тебе помочь. Дело в том, что я сам в этом не разбираюсь.', 'На жаль, я не можу тобі допомогти. Річ у тім, що я сам на цьому не знаюся.', 'Ne yazık ki sana yardım edemem. Çünkü bu konudan ben de anlamıyorum.'], 'nämlich / zumal / folglich', { h: 'naemlich' }),

    mc('G4', 'somit + Verb', I.sentence, 'Welcher Satz ist richtig?', ['Die Frist ist abgelaufen; somit kann der Antrag nicht mehr bearbeitet werden.', 'Die Frist ist abgelaufen; somit der Antrag kann nicht mehr bearbeitet werden.', 'Die Frist ist abgelaufen; somit der Antrag nicht mehr bearbeitet werden kann.'],
      ['Which sentence is correct?', 'Какое предложение правильное?', 'Яке речення правильне?', 'Hangi cümle doğru?'], { h: 'position' }),
    mc('G4', 'derart stark, dass', I.choose, 'Der Lärm war … stark, dass niemand mehr arbeiten konnte.', ['derart', 'mithin', 'zumal'],
      ['The noise was so loud that nobody could work any more.', 'Шум был настолько сильным, что никто больше не мог работать.', 'Шум був настільки сильним, що ніхто більше не міг працювати.', 'Gürültü o kadar şiddetliydi ki artık kimse çalışamıyordu.'], { h: 'derart' }),
    gap('G4', 'demzufolge', I.adverb, 'Er hat die Therapie abgebrochen; ', ' ist keine Aussage über ihren Erfolg möglich.', FOLGE, ['zumal', 'nämlich'],
      ['He broke off the therapy; consequently no statement about its success is possible.', 'Он прервал терапию; следовательно, судить о её успехе невозможно.', 'Він перервав терапію; отже, судити про її успіх неможливо.', 'Terapiyi yarıda bıraktı; dolayısıyla başarısı hakkında bir şey söylemek mümkün değil.'], 'demzufolge / zumal / nämlich', { h: 'richtung' }),

    mc('G5', 'hervorrufen', I.verb, 'Die Nachricht … bei den Angehörigen große Erleichterung hervor.', ['rief', 'führte', 'ging'],
      ['The news caused great relief among the relatives.', 'Новость вызвала у родственников большое облегчение.', 'Новина викликала в родичів велике полегшення.', 'Haber yakınlarda büyük bir rahatlama yarattı.'], { h: 'akkusativ' }),
    mc('G5', 'Ursache bei beruhen auf', I.choose, 'Was ist die Ursache? „Der Erfolg beruht auf jahrelanger Übung.“', ['die jahrelange Übung', 'der Erfolg', 'das lässt der Satz offen'],
      ['What is the cause? “Der Erfolg beruht auf jahrelanger Übung.”', 'Что является причиной? «Der Erfolg beruht auf jahrelanger Übung.»', 'Що є причиною? «Der Erfolg beruht auf jahrelanger Übung.»', 'Neden hangisi? “Der Erfolg beruht auf jahrelanger Übung.”'], { h: 'richtung' }),
    gap('G5', 'zurückzuführen auf', I.prep, 'Der Rückgang der Leistung ist ', ' die fehlenden Pausen zurückzuführen.', 'auf', ['zu', 'aus'],
      ['The drop in performance can be traced back to the lack of breaks.', 'Снижение продуктивности объясняется отсутствием перерывов.', 'Зниження продуктивності пояснюється браком перерв.', 'Verimdeki düşüş mola eksikliğinden kaynaklanıyor.'], 'auf / zu / aus', { h: 'praep' }),

    mc('G6', 'sodass → zur Folge haben', I.choose, 'Er wurde ständig unterbrochen, sodass er Fehler machte. = Die ständigen Unterbrechungen …', ['hatten Fehler zur Folge.', 'waren auf Fehler zurückzuführen.', 'beruhten auf seinen Fehlern.'],
      ['He was constantly interrupted, so that he made mistakes.', 'Его постоянно прерывали, так что он делал ошибки.', 'Його постійно переривали, тож він робив помилки.', 'Sürekli bölündüğü için hata yaptı.'], { h: 'relation' }),
    mc('G6', 'infolge → weil', I.choose, 'Infolge der Trennung zog er sich von seinen Freunden zurück. = …', ['Weil er sich getrennt hatte, zog er sich von seinen Freunden zurück.', 'Obwohl er sich getrennt hatte, zog er sich von seinen Freunden zurück.', 'Damit er sich trennen konnte, zog er sich von seinen Freunden zurück.'],
      ['As a result of the separation he withdrew from his friends.', 'Вследствие расставания он отдалился от друзей.', 'Унаслідок розлучення він віддалився від друзів.', 'Ayrılığın sonucunda arkadaşlarından uzaklaştı.'], { h: 'relation' }),

    mc('G7', 'erleben → das Erlebnis', I.choose, 'erleben → …', ['das Erlebnis', 'die Erlebung', 'die Erlebheit'],
      ['to experience → experience', 'переживать → переживание', 'переживати → переживання', 'yaşamak → yaşantı'], { h: 'suffix' }),
    mc('G7', 'empfindlich → die Empfindlichkeit', I.choose, 'Er ist gegen Lärm sehr empfindlich. → seine große … gegen Lärm', ['Empfindlichkeit', 'Empfindlichheit', 'Empfindnis'],
      ['He is very sensitive to noise. → his great sensitivity to noise', 'Он очень чувствителен к шуму. → его высокая чувствительность к шуму', 'Він дуже чутливий до шуму. → його висока чутливість до шуму', 'Gürültüye karşı çok hassastır. → gürültüye karşı büyük hassasiyeti'], { h: 'suffix' }),
    gap('G7', 'zweifeln → Zweifel', I.form, 'zweifeln → An seiner Ehrlichkeit besteht kein ', '.', 'Zweifel', ['Zweifelung', 'Zweifelheit'],
      ['to doubt → There is no doubt about his honesty.', 'сомневаться → В его честности нет никаких сомнений.', 'сумніватися → У його чесності немає жодного сумніву.', 'şüphe etmek → Dürüstlüğünden hiç şüphe yok.'], 'zweifeln', { h: 'stamm' }),

    mc('G8', 'abhängen von → die Abhängigkeit von', I.choose, 'Er hängt von der Meinung anderer ab. → seine Abhängigkeit …', ['von der Meinung anderer', 'der Meinung anderer', 'auf die Meinung anderer'],
      ['He depends on the opinion of others. → his dependence on the opinion of others', 'Он зависит от мнения других. → его зависимость от мнения других', 'Він залежить від думки інших. → його залежність від думки інших', 'Başkalarının görüşüne bağımlıdır. → başkalarının görüşüne bağımlılığı'], { h: 'praep' }),
    mc('G8', 'von + Dativ Plural', I.choose, 'Man nimmt Gerüche wahr. → die Wahrnehmung …', ['von Gerüchen', 'Gerüche', 'den Gerüchen'],
      ['People perceive smells. → the perception of smells', 'Человек воспринимает запахи. → восприятие запахов', 'Людина сприймає запахи. → сприйняття запахів', 'İnsan kokuları algılar. → kokuların algılanması'], { h: 'von' }),
    gap('G8', 'Handelnder → durch', I.prep, 'Der Therapeut behandelt den Patienten. → die Behandlung des Patienten ', ' den Therapeuten', 'durch', ['von', 'mit'],
      ['The therapist treats the patient. → the treatment of the patient by the therapist', 'Терапевт лечит пациента. → лечение пациента терапевтом', 'Терапевт лікує пацієнта. → лікування пацієнта терапевтом', 'Terapist hastayı tedavi ediyor. → hastanın terapist tarafından tedavisi'], 'durch / von / mit', { h: 'durch' }),

    mc('G9', 'lange Gruppe auflösen', I.choose, 'Was bedeutet: „der Einfluss der Stimmung auf die Bewertung der eigenen Leistung“?', ['Wie man gelaunt ist, beeinflusst, wie man die eigene Leistung beurteilt.', 'Wie man die eigene Leistung beurteilt, beeinflusst, wie andere gelaunt sind.', 'Wer viel leistet, wird von anderen besser bewertet und ist besser gelaunt.'],
      ['What does this mean: “der Einfluss der Stimmung auf die Bewertung der eigenen Leistung”?', 'Что означает: «der Einfluss der Stimmung auf die Bewertung der eigenen Leistung»?', 'Що означає: «der Einfluss der Stimmung auf die Bewertung der eigenen Leistung»?', 'Şu ne demek: “der Einfluss der Stimmung auf die Bewertung der eigenen Leistung”?'], { h: 'bezug' }),
    mc('G9', 'Verb nach Kern im Plural', I.verb, 'Die Erwartungen der Eltern an die Leistung des Kindes … oft zu hoch.', ['sind', 'ist', 'seid'],
      ['The parents’ expectations of the child’s performance are often too high.', 'Ожидания родителей в отношении успехов ребёнка часто слишком высоки.', 'Очікування батьків щодо успіхів дитини часто надто високі.', 'Anne babanın çocuğun başarısına ilişkin beklentileri çoğu zaman fazla yüksektir.'], { h: 'kern' }),

    mc('Z1', 'Interview: Warnsignale', I.read, `${INTERVIEW} Warum bemerken viele Betroffene die Überlastung lange nicht?`, ['weil sie Warnsignale wie Schlafstörungen verdrängen', 'weil sie regelmäßig mit ihren Angehörigen sprechen', 'weil sie sich rechtzeitig um Hilfe bemühen'],
      ['Why do many of those affected fail to notice the overload for a long time?', 'Почему многие пострадавшие долго не замечают перегрузки?', 'Чому багато постраждалих довго не помічає перевантаження?', 'Etkilenenlerin çoğu aşırı yükü neden uzun süre fark etmiyor?']),
    mc('Z1', 'Interview: Bewältigung', I.read, `${INTERVIEW} Wovon hängt die Bewältigung von Stress entscheidend ab?`, ['von der Unterstützung durch das Umfeld', 'von der Dauer der körperlichen Beschwerden', 'von der Höhe des Zeitdrucks im Beruf'],
      ['What does coping with stress depend on crucially?', 'От чего решающим образом зависит преодоление стресса?', 'Від чого вирішальною мірою залежить подолання стресу?', 'Stresle başa çıkma belirleyici olarak neye bağlıdır?']),
  ],
}

export default check
