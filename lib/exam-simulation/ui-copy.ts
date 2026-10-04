import type { SimulationLevel, SimulationSkill, SimulationResult } from './types'

// Interface labels and assessment guidance follow the interface language.
// German tasks, source excerpts, learner answers and solutions stay unchanged.
const messages = {
  title: ['Simulierte Prüfung','Simulated exam','Пробный экзамен','Пробний іспит','Deneme sınavı'],
  level: ['Niveau','Level','Уровень','Рівень','Seviye'],
  start: ['Start','Start','Начало','Початок','Başlangıç'],
  chooseLevel: ['Wähle dein Niveau. Alle vier Fertigkeiten in einer Prüfung.','Choose your level. All four skills in one exam.','Выбери уровень. Все четыре навыка в одном экзамене.','Обери рівень. Усі чотири навички в одному іспиті.','Seviyeni seç. Dört beceri tek sınavda.'],
  examLevel: ['Dein Prüfungsniveau','Your exam level','Твой уровень экзамена','Твій рівень іспиту','Sınav seviyen'],
  changeLevel: ['Niveau ändern','Change level','Изменить уровень','Змінити рівень','Seviyeyi değiştir'],
  ready: ['2. Bereit zum Start','2. Ready to start','2. Готов к началу','2. Готовий до початку','2. Başlamaya hazır'],
  selectedExam: ['Deine simulierte Prüfung · {level}','Your simulated exam · {level}','Твой пробный экзамен · {level}','Твій пробний іспит · {level}','Deneme sınavın · {level}'],
  minutes: ['{count} Minuten','{count} minutes','{count} мин.','{count} хв.','{count} dakika'],
  newTasks: ['Neue Aufgaben','New tasks','Новые задания','Нові завдання','Yeni sorular'],
  skillsIntro: ['Lesen, Hören, Schreiben und Sprechen – in einer gemeinsamen Prüfung für dein Niveau.','Reading, listening, writing and speaking in one exam for your level.','Чтение, аудирование, письмо и говорение в одном экзамене твоего уровня.','Читання, аудіювання, письмо й говоріння в одному іспиті твого рівня.','Seviyene uygun tek sınavda okuma, dinleme, yazma ve konuşma.'],
  germanNotice: ['Die Prüfung ist auf Deutsch. Aufgaben, Texte, Hörbeispiele und deine Antworten bleiben auf Deutsch. Die Bedienung folgt deiner Oberflächensprache.','The exam is in German. Tasks, texts, audio and your answers stay in German. The controls use your interface language.','Экзамен проходит на немецком. Задания, тексты, аудио и твои ответы остаются на немецком. Управление — на языке интерфейса.','Іспит проходить німецькою. Завдання, тексти, аудіо й твої відповіді залишаються німецькою. Керування — мовою інтерфейсу.','Sınav Almancadır. Sorular, metinler, ses kayıtları ve yanıtların Almanca kalır. Kontroller arayüz dilini kullanır.'],
  germanNoticeTitle: ['Prüfungssprache: Deutsch','Exam language: German','Язык экзамена: немецкий','Мова іспиту: німецька','Sınav dili: Almanca'],
  startExam: ['Prüfung starten','Start exam','Начать экзамен','Почати іспит','Sınavı başlat'],
  assembling: ['Aufgaben werden zusammengestellt …','Preparing tasks …','Подбираем задания …','Добираємо завдання …','Sorular hazırlanıyor …'],
  startHint: ['Eine Aufgabe nach der anderen. Die Lösungen erscheinen am Schluss.','One task at a time. Solutions appear at the end.','По одному заданию. Решения появятся в конце.','По одному завданню. Розв’язання з’являться наприкінці.','Sorular sırayla gösterilir. Çözümler sınav sonunda görünür.'],
  how: ['So läuft die Prüfung ab','How the exam works','Как проходит экзамен','Як проходить іспит','Sınav nasıl işler'],
  profileDescription: ['Eine umfassende Prüfung von Sitov Academy mit wichtigen Aufgabenformen verschiedener Prüfungsinstitute. Alle Fertigkeiten gehören dazu.','A comprehensive Sitov Academy exam covering important task formats and all skills.','Полный экзамен Sitov Academy с основными типами заданий и всеми навыками.','Повний іспит Sitov Academy з основними типами завдань і всіма навичками.','Tüm becerileri ve temel soru türlerini içeren kapsamlı bir Sitov Academy sınavı.'],
  teacherAssessment: ['Bewertung durch Lehrkraft','Teacher assessment','Оценка преподавателя','Оцінювання викладачем','Öğretmen değerlendirmesi'],
  automaticAssessment: ['Automatische Auswertung','Automatic assessment','Автоматическая оценка','Автоматичне оцінювання','Otomatik değerlendirme'],
  privacy: ['Texte und private Aufnahmen werden für die Rückmeldung deiner Lehrkraft gespeichert.','Texts and private recordings are saved for your teacher’s feedback.','Тексты и личные записи сохраняются для обратной связи преподавателя.','Тексти й особисті записи зберігаються для зворотного зв’язку викладача.','Metinler ve özel kayıtlar öğretmeninin geri bildirimi için saklanır.'],
  assessment: ['Deine Einschätzung:','Your assessment:','Твоя оценка:','Твоє оцінювання:','Değerlendirmen:'],
  passRule: ['Mindestens 70 % je Fertigkeit und 50 % je Schreib- und Sprechaufgabe. Alle Texte, Aufnahmen und echten Gespräche müssen eingereicht und bewertet sein. Eine reale Prüfung kann andere Regeln haben.','At least 70% in each skill and 50% in each writing and speaking task. All texts, recordings and real dialogues must be submitted and assessed. A real exam may use different rules.','Не менее 70 % по каждому навыку и 50 % за каждое письменное и устное задание. Все тексты, записи и реальные диалоги нужно сдать для оценки. Правила настоящего экзамена могут отличаться.','Щонайменше 70 % з кожної навички й 50 % за кожне письмове та усне завдання. Усі тексти, записи й справжні діалоги потрібно подати для оцінювання. Правила справжнього іспиту можуть відрізнятися.','Her beceride en az %70, her yazma ve konuşma sorusunda en az %50 gerekir. Tüm metinler, kayıtlar ve gerçek diyaloglar teslim edilip değerlendirilmelidir. Gerçek sınavın kuralları farklı olabilir.'],
  examDisclaimer: ['Die Simulation verbindet Aufgabenarten verschiedener Institute. Die genaue Reihenfolge und Bewertung deiner echten Prüfung können abweichen.','The simulation combines task formats from different institutes. Your real exam’s order and assessment may differ.','Пробный экзамен сочетает типы заданий разных институтов. Порядок и оценивание настоящего экзамена могут отличаться.','Пробний іспит поєднує типи завдань різних інститутів. Порядок і оцінювання справжнього іспиту можуть відрізнятися.','Deneme sınavı farklı kurumların soru türlerini birleştirir. Gerçek sınavın sıralaması ve değerlendirmesi farklı olabilir.'],
  history: ['Deine bisherigen Durchgänge ({count})','Your previous attempts ({count})','Предыдущие попытки ({count})','Попередні спроби ({count})','Önceki denemelerin ({count})'],
  preparation: ['Zur Prüfungsvorbereitung','Go to exam preparation','К подготовке к экзамену','До підготовки до іспиту','Sınav hazırlığına git'],
  gateTitle: ['Deine Lehrkraft schaltet dich frei','Your teacher grants access','Преподаватель откроет тебе доступ','Викладач відкриє тобі доступ','Öğretmenin erişim izni verir'],
  gateBody: ['Die Simulierte Prüfung ist für dein Konto noch gesperrt. Bitte wende dich an deine Lehrkraft.','The simulated exam is still locked for your account. Please contact your teacher.','Пробный экзамен пока закрыт для твоего аккаунта. Обратись к преподавателю.','Пробний іспит поки закритий для твого облікового запису. Звернися до викладача.','Deneme sınavı hesabın için henüz açılmadı. Öğretmeninle iletişime geç.'],
  gateHint: ['Nach der Freigabe kannst du hier deine vollständige Prüfung beginnen.','Once access is granted, you can start your full exam here.','После открытия доступа ты сможешь начать здесь полный экзамен.','Після відкриття доступу ти зможеш почати тут повний іспит.','Erişim açıldığında tam sınavını burada başlatabilirsin.'],
  levelLocked: ['Für dieses Niveau fehlt deine Freigabe. Bitte wende dich an deine Lehrkraft.','You do not have access to this level yet. Please contact your teacher.','Доступ к этому уровню ещё не открыт. Обратись к преподавателю.','Доступ до цього рівня ще не відкрито. Звернися до викладача.','Bu seviyeye henüz erişimin yok. Öğretmeninle iletişime geç.'],
  preparing: ['Diese Prüfung wird noch vorbereitet. Du kannst starten, sobald alle Aufgaben und Hörteile geprüft sind.','This exam is being prepared. You can start once all tasks and audio have been checked.','Экзамен ещё готовится. Ты сможешь начать, когда все задания и аудио будут проверены.','Іспит ще готується. Ти зможеш почати, коли всі завдання й аудіо будуть перевірені.','Bu sınav hazırlanıyor. Tüm sorular ve ses kayıtları kontrol edilince başlayabilirsin.'],
  preview: ['Vorschau · keine gespeicherte Prüfungsleistung','Preview · no saved exam performance','Предпросмотр · результат не сохраняется','Попередній перегляд · результат не зберігається','Önizleme · sınav sonucu kaydedilmez'],
  uiPreview: ['Oberflächenvorschau · keine gespeicherte Prüfungsleistung','Interface preview · no saved exam performance','Предпросмотр интерфейса · результат не сохраняется','Перегляд інтерфейсу · результат не зберігається','Arayüz önizlemesi · sınav sonucu kaydedilmez'],
  journey: ['Dein Weg zur Prüfung','Your exam journey','Твой путь к экзамену','Твій шлях до іспиту','Sınava giden yolun'],
  skill_reading: ['Lesen','Reading','Чтение','Читання','Okuma'],
  skill_listening: ['Hören','Listening','Аудирование','Аудіювання','Dinleme'],
  skill_writing: ['Schreiben','Writing','Письмо','Письмо','Yazma'],
  skill_speaking: ['Sprechen','Speaking','Говорение','Говоріння','Konuşma'],
  skill_language: ['Sprachgebrauch','Language use','Использование языка','Використання мови','Dil kullanımı'],
  level_A1: ['Erste Schritte','First steps','Первые шаги','Перші кроки','İlk adımlar'],
  level_A2: ['Vertrauter Alltag','Familiar everyday life','Знакомые повседневные ситуации','Знайомі повсякденні ситуації','Tanıdık günlük yaşam'],
  level_B1: ['Selbstständig im Alltag','Independent in everyday life','Самостоятельность в повседневной жизни','Самостійність у повсякденному житті','Günlük yaşamda bağımsızlık'],
  level_B2: ['Sicher argumentieren','Confident arguments','Уверенная аргументация','Упевнена аргументація','Güvenle fikir savunma'],
  level_C1: ['Komplexe Themen','Complex topics','Сложные темы','Складні теми','Karmaşık konular'],
  level_C2: ['Sehr differenziert','Highly nuanced','Тонкое владение языком','Тонке володіння мовою','İleri düzey dil kullanımı'],
  taskCount: ['Aufgabe {count}/{total}','Task {count}/{total}','Задание {count}/{total}','Завдання {count}/{total}','Soru {count}/{total}'],
  answered: ['{count} beantwortet','{count} answered','Отвечено: {count}','Відповідей: {count}','{count} yanıtlandı'],
  answeredTasks: ['Beantwortete Aufgaben','Answered tasks','Задания с ответом','Завдання з відповіддю','Yanıtlanan sorular'],
  timerLoading: ['Zeit wird geladen','Loading time','Загружаем время','Завантажуємо час','Süre yükleniyor'],
  overview: ['Übersicht','Overview','Обзор','Огляд','Genel bakış'],
  taskOverview: ['Aufgabenübersicht','Task overview','Обзор заданий','Огляд завдань','Soru listesi'],
  reopen: ['Du kannst eine Aufgabe erneut öffnen.','You can open a task again.','Ты можешь снова открыть задание.','Ти можеш знову відкрити завдання.','Bir soruyu tekrar açabilirsin.'],
  taskState: ['Aufgabe {count}: {state}','Task {count}: {state}','Задание {count}: {state}','Завдання {count}: {state}','Soru {count}: {state}'],
  stateAnswered: ['beantwortet','answered','есть ответ','є відповідь','yanıtlandı'],
  stateOpen: ['offen','open','без ответа','без відповіді','yanıtlanmadı'],
  timeOver: ['Die Bearbeitungszeit ist vorbei.','The exam time is over.','Время экзамена закончилось.','Час іспиту закінчився.','Sınav süresi doldu.'],
  finishQuestion: ['Durchgang abschließen?','Finish this attempt?','Завершить попытку?','Завершити спробу?','Bu deneme bitirilsin mi?'],
  answeredOf: ['{count} von {total} Aufgaben beantwortet.','{count} of {total} tasks answered.','Ответов: {count} из {total} заданий.','Відповідей: {count} із {total} завдань.','{total} sorudan {count} tanesi yanıtlandı.'],
  unansweredCount: ['Offene Aufgaben zählen als nicht beantwortet.','Open tasks count as unanswered.','Открытые задания считаются неотвеченными.','Відкриті завдання вважаються без відповіді.','Açık sorular yanıtlanmamış sayılır.'],
  finishHint: ['Nach dem Abschluss siehst du deine Lösungen und die Erklärungen. Schreiben und Sprechen bewertet deine Lehrkraft.','After finishing, you see your answers and explanations. Your teacher assesses writing and speaking.','После завершения ты увидишь ответы и объяснения. Письмо и говорение оценит преподаватель.','Після завершення ти побачиш відповіді й пояснення. Письмо й говоріння оцінить викладач.','Bitirdikten sonra yanıtlarını ve açıklamaları görürsün. Yazma ve konuşmayı öğretmenin değerlendirir.'],
  assessing: ['Wird ausgewertet …','Assessing …','Оцениваем …','Оцінюємо …','Değerlendiriliyor …'],
  finish: ['Abschließen und auswerten','Finish and see results','Завершить и посмотреть результат','Завершити й переглянути результат','Bitir ve sonuçları gör'],
  continue: ['Weiter bearbeiten','Continue working','Продолжить работу','Продовжити роботу','Devam et'],
  back: ['Zurück','Back','Назад','Назад','Geri'],
  next: ['Weiter','Next','Далее','Далі','İleri'],
  saveNext: ['Speichern & weiter','Save and continue','Сохранить и продолжить','Зберегти й продовжити','Kaydet ve devam et'],
  toResults: ['Zur Auswertung','See results','К результатам','До результатів','Sonuçlara git'],
  saving: ['Wird gespeichert …','Saving …','Сохраняем …','Зберігаємо …','Kaydediliyor …'],
  skip: ['Ohne Antwort weiter','Continue without an answer','Продолжить без ответа','Продовжити без відповіді','Yanıt vermeden devam et'],
  endAttempt: ['Durchgang beenden','End attempt','Завершить попытку','Завершити спробу','Denemeyi bitir'],
  answer: ['Deine Antwort','Your answer','Твой ответ','Твоя відповідь','Yanıtın'],
  choose: ['Bitte wählen','Please choose','Выбери','Обери','Seç'],
  orderingHint: ['Wähle die Textteile in der richtigen Reihenfolge. Erneutes Antippen entfernt einen Teil.','Select the text parts in the correct order. Tap again to remove a part.','Выбирай части текста в правильном порядке. Повторное нажатие убирает часть.','Обирай частини тексту в правильному порядку. Повторне натискання прибирає частину.','Metin parçalarını doğru sırayla seç. Tekrar dokunarak bir parçayı kaldırabilirsin.'],
  yourText: ['Dein Text','Your text','Твой текст','Твій текст','Metnin'],
  textPlaceholder: ['Schreibe deine Antwort hier …','Write your answer in German here …','Напиши здесь ответ на немецком …','Напиши тут відповідь німецькою …','Almanca yanıtını buraya yaz …'],
  wordCount: ['{count} Wörter · Bewertung durch deine Lehrkraft','{count} words · assessed by your teacher','{count} слов · оценка преподавателя','{count} слів · оцінювання викладачем','{count} kelime · öğretmenin değerlendirir'],
  criterionFallback: ['Besprich dieses Bewertungskriterium mit deiner Lehrkraft.','Discuss this assessment criterion with your teacher.','Обсуди этот критерий оценивания с преподавателем.','Обговори цей критерій оцінювання з викладачем.','Bu değerlendirme ölçütünü öğretmeninle konuş.'],
  criteria: ['Worauf wird bei der Bewertung geachtet?','What is assessed?','Что учитывается при оценке?','Що враховується під час оцінювання?','Neler değerlendirilir?'],
  examAudio: ['Prüfungshörtext','Exam audio','Аудио экзамена','Аудіо іспиту','Sınav ses kaydı'],
  audioPlays: ['Je Aufgabe {count} Mal hören.','Listen {count} times per task.','Слушать {count} раз на задание.','Слухати {count} разів на завдання.','Her soruda {count} kez dinle.'],
  reloadAudio: ['Hörtext erneut laden','Reload audio','Загрузить аудио снова','Завантажити аудіо знову','Ses kaydını yeniden yükle'],
  results: ['Auswertung','Results','Результаты','Результати','Sonuçlar'],
  resultRing: ['{count} von {total} geschlossenen Aufgaben richtig','{count} of {total} closed-answer tasks correct','Правильных ответов на закрытые задания: {count} из {total}','Правильних відповідей на закриті завдання: {count} із {total}','{total} kapalı sorudan {count} tanesi doğru'],
  headlinePending: ['Ihre Lehrkraft bewertet noch','Your teacher is still assessing','Преподаватель ещё оценивает','Викладач ще оцінює','Öğretmenin değerlendirmeye devam ediyor'],
  headlinePassed: ['Die Sitov-Prüfung bestanden','Sitov exam passed','Экзамен Sitov пройден','Іспит Sitov складено','Sitov sınavını geçtin'],
  headlineNotPassed: ['Vor der Prüfung noch gezielt üben','Practise before your exam','Перед экзаменом стоит ещё потренироваться','Перед іспитом варто ще потренуватися','Sınavdan önce biraz daha çalış'],
  headlineStrong: ['Stark in diesen Aufgaben','Strong performance in these tasks','Хорошие результаты в этих заданиях','Гарні результати в цих завданнях','Bu sorularda başarılısın'],
  headlinePractice: ['Hier können Sie gezielt weiterüben','Here is what to practise next','Вот над чем можно поработать','Ось над чим можна попрацювати','Sıradaki çalışma alanların'],
  passedBody: ['Du hast diese vollständige Sitov-Prüfung bestanden.','You passed this complete Sitov exam.','Ты прошёл этот полный экзамен Sitov.','Ти склав цей повний іспит Sitov.','Bu tam Sitov sınavını geçtin.'],
  pendingBody: ['Sieh dir deine Stärken und Fehler an. Deine Lehrkraft ergänzt noch offene Bewertungen.','Review your strengths and mistakes. Your teacher will add pending assessments.','Посмотри сильные стороны и ошибки. Преподаватель дополнит оставшиеся оценки.','Переглянь сильні сторони й помилки. Викладач додасть решту оцінок.','Güçlü yönlerini ve hatalarını incele. Öğretmenin bekleyen değerlendirmeleri ekleyecek.'],
  practiceBody: ['Sieh dir deine Stärken und die Aufgaben zum Weiterüben an.','Review your strengths and tasks to practise next.','Посмотри сильные стороны и задания для дальнейшей практики.','Переглянь сильні сторони й завдання для подальшої практики.','Güçlü yönlerini ve çalışman gereken soruları incele.'],
  ringHint: ['Der Ring zeigt die vollständig richtig gelösten geschlossenen Aufgaben. Offene Antworten werden separat bewertet.','The ring shows fully correct closed-answer tasks. Open answers are assessed separately.','Круг показывает полностью правильные ответы на закрытые задания. Открытые ответы оцениваются отдельно.','Коло показує повністю правильні відповіді на закриті завдання. Відкриті відповіді оцінюються окремо.','Halka, tam doğru yanıtlanan kapalı soruları gösterir. Açık yanıtlar ayrıca değerlendirilir.'],
  refreshReviews: ['Bewertungen aktualisieren','Refresh assessments','Обновить оценки','Оновити оцінки','Değerlendirmeleri yenile'],
  loadingReviews: ['Bewertungen werden geladen …','Loading assessments …','Загружаем оценки …','Завантажуємо оцінки …','Değerlendirmeler yükleniyor …'],
  pendingReview: ['Bewertung offen','Assessment pending','Оценка ожидается','Очікує оцінювання','Değerlendirme bekleniyor'],
  notIncluded: ['Noch nicht enthalten','Not included yet','Ещё не включено','Ще не включено','Henüz dahil değil'],
  noAutomatic: ['keine automatische Bewertung','no automatic assessment','нет автоматической оценки','немає автоматичного оцінювання','otomatik değerlendirme yok'],
  percent: ['Prozent','percent','процентов','відсотків','yüzde'],
  teacherAnswers: ['{count} Antwort(en) für die Lehrkraft','{count} answer(s) for your teacher','Ответов для преподавателя: {count}','Відповідей для викладача: {count}','Öğretmenin için {count} yanıt'],
  points: ['{count} von {total} Punkten','{count} of {total} points','{count} из {total} баллов','{count} із {total} балів','{total} üzerinden {count} puan'],
  tasksMissing: ['Geprüfte Aufgaben fehlen noch','Verified tasks are still missing','Проверенные задания пока отсутствуют','Перевірених завдань поки немає','Kontrol edilmiş sorular henüz eksik'],
  howAssessed: ['Wie wird bewertet?','How is it assessed?','Как оценивается результат?','Як оцінюється результат?','Nasıl değerlendirilir?'],
  resultDisclaimer: ['Dieses Ergebnis beschreibt ausschließlich den Lerncheck und erlaubt keine Aussage über das Bestehen einer realen Prüfung.','This result describes this practice check only and does not predict passing a real exam.','Этот результат относится только к данной проверке и не гарантирует сдачу настоящего экзамена.','Цей результат стосується лише цієї перевірки й не гарантує складання справжнього іспиту.','Bu sonuç yalnızca bu alıştırmayı değerlendirir; gerçek sınavı geçeceğini göstermez.'],
  fullRubric: ['Eigene Sitov-Rubrik: mindestens 70 % je Fertigkeit sowie mindestens 50 % je Schreib- und Sprechaufgabe; alle produktiven Leistungen und echten Gespräche sind erforderlich. Diese Einschätzung ersetzt keine reale Zertifikatsprüfung und garantiert deren Bestehen nicht.','Sitov rubric: at least 70% per skill and 50% per writing and speaking task; all productive work and real dialogues are required. This assessment does not replace a real certificate exam or guarantee a pass.','Критерии Sitov: не менее 70 % по каждому навыку и 50 % за каждое письменное и устное задание; все продуктивные работы и реальные диалоги обязательны. Эта оценка не заменяет сертификационный экзамен и не гарантирует его сдачу.','Критерії Sitov: щонайменше 70 % з кожної навички й 50 % за кожне письмове та усне завдання; усі продуктивні роботи й справжні діалоги обов’язкові. Це оцінювання не замінює сертифікаційного іспиту й не гарантує його складання.','Sitov ölçütleri: her beceride en az %70 ve her yazma ile konuşma sorusunda %50; tüm üretim görevleri ve gerçek diyaloglar gereklidir. Bu değerlendirme gerçek sertifika sınavının yerini tutmaz ve başarıyı garanti etmez.'],
  incompleteResult: ['Die gesamte Prüfung ist noch nicht bewertet.','The full exam has not been assessed yet.','Экзамен ещё не оценён полностью.','Іспит ще не оцінено повністю.','Sınavın tamamı henüz değerlendirilmedi.'],
  missingCoverage: ['Einige Prüfungsbereiche fehlen in diesem gespeicherten Durchgang.','Some exam areas are missing from this saved attempt.','В этой сохранённой попытке отсутствуют некоторые разделы экзамена.','У цій збереженій спробі відсутні деякі розділи іспиту.','Bu kayıtlı denemede bazı sınav alanları eksik.'],
  understandAnswers: ['Deine Antworten verstehen','Understand your answers','Разобраться в своих ответах','Розібратися у своїх відповідях','Yanıtlarını anla'],
  filterResults: ['Auswertung filtern','Filter results','Фильтр результатов','Фільтр результатів','Sonuçları filtrele'],
  all: ['Alle','All','Все','Усі','Tümü'],
  correct: ['Richtig','Correct','Правильно','Правильно','Doğru'],
  practise: ['Noch üben','Practise more','Ещё потренироваться','Ще потренуватися','Biraz daha çalış'],
  teacher: ['Lehrkraft','Teacher','Преподаватель','Викладач','Öğretmen'],
  answerCount: ['Antwort {count} von {total}','Answer {count} of {total}','Ответ {count} из {total}','Відповідь {count} із {total}','Yanıt {count}/{total}'],
  previousAnswer: ['Vorherige Antwort','Previous answer','Предыдущий ответ','Попередня відповідь','Önceki yanıt'],
  nextAnswer: ['Nächste Antwort','Next answer','Следующий ответ','Наступна відповідь','Sonraki yanıt'],
  noAnswers: ['Hier gibt es keine Antworten in dieser Gruppe.','There are no answers in this group.','В этой группе нет ответов.','У цій групі немає відповідей.','Bu grupta yanıt yok.'],
  nextStep: ['Dein nächster Schritt','Your next step','Твой следующий шаг','Твій наступний крок','Sıradaki adımın'],
  newAttempt: ['Neuer Durchgang','New attempt','Новая попытка','Нова спроба','Yeni deneme'],
  choosingNew: ['Neue Aufgaben werden gewählt …','Choosing new tasks …','Выбираем новые задания …','Обираємо нові завдання …','Yeni sorular seçiliyor …'],
  targetedPreparation: ['Gezielt vorbereiten','Targeted preparation','Целенаправленная подготовка','Цілеспрямована підготовка','Hedefli hazırlık'],
  nextPractise: ['{skill}: Besprich die markierten Fehler und übe diese Aufgabenform gezielt.','{skill}: discuss the highlighted mistakes and practise this task format.','{skill}: обсуди отмеченные ошибки и потренируй этот тип заданий.','{skill}: обговори позначені помилки й потренуй цей тип завдань.','{skill}: işaretli hataları konuş ve bu soru türünü çalış.'],
  nextReview: ['Lass deine eingereichten Schreib- und Sprechleistungen durch deine Lehrkraft bewerten.','Ask your teacher to assess your submitted writing and speaking work.','Попроси преподавателя оценить сданные письменные и устные работы.','Попроси викладача оцінити подані письмові й усні роботи.','Öğretmeninden teslim ettiğin yazma ve konuşma çalışmalarını değerlendirmesini iste.'],
  nextListening: ['Übe die freigegebenen Hörteile, sobald die vorbereiteten Aufnahmen verfügbar sind.','Practise the released listening tasks once prepared recordings are available.','Потренируй открытые задания на аудирование, когда записи будут доступны.','Потренуй відкриті завдання з аудіювання, коли записи будуть доступні.','Hazır kayıtlar sunulduğunda açılmış dinleme sorularını çalış.'],
  nextSubmit: ['Reiche im nächsten Durchgang alle Texte und Sprechaufnahmen ein.','Submit all texts and speaking recordings in your next attempt.','В следующей попытке сдай все тексты и устные записи.','У наступній спробі подай усі тексти й усні записи.','Sonraki denemende tüm metinleri ve konuşma kayıtlarını teslim et.'],
  nextDiscuss: ['Besprich die Einschätzung mit deiner Lehrkraft. Die Regeln deiner realen Prüfung können abweichen.','Discuss the assessment with your teacher. Your real exam’s rules may differ.','Обсуди оценку с преподавателем. Правила настоящего экзамена могут отличаться.','Обговори оцінку з викладачем. Правила справжнього іспиту можуть відрізнятися.','Değerlendirmeyi öğretmeninle konuş. Gerçek sınavının kuralları farklı olabilir.'],
  nextOfficial: ['Nutze danach einen vollständigen offiziellen Modellsatz deiner Zielprüfung mit den Originalzeiten.','Then practise a complete official model exam using its original time limits.','Затем пройди полный официальный пробный вариант своего экзамена с установленным временем.','Потім пройди повний офіційний пробний варіант свого іспиту з установленим часом.','Ardından asıl süreleri kullanarak tam bir resmî örnek sınav çöz.'],
  teacherFeedback: ['Rückmeldung deiner Lehrkraft','Your teacher’s feedback','Обратная связь преподавателя','Зворотний зв’язок викладача','Öğretmeninin geri bildirimi'],
  correctFeedback: ['Richtig gelöst','Correctly solved','Решено правильно','Розв’язано правильно','Doğru çözüldü'],
  practiseFeedback: ['Hier kannst du noch üben','You can practise this further','Здесь можно ещё потренироваться','Тут можна ще потренуватися','Bu alanda biraz daha çalışabilirsin'],
  teacherWillAssess: ['Deine Lehrkraft bewertet diese Antwort','Your teacher assesses this answer','Этот ответ оценит преподаватель','Цю відповідь оцінить викладач','Bu yanıtı öğretmenin değerlendirir'],
  listenOwn: ['Deine Aufnahme anhören','Listen to your recording','Прослушать свою запись','Прослухати свій запис','Kaydını dinle'],
  evidence: ['Die entscheidende Stelle:','The key passage:','Ключевой фрагмент:','Ключовий фрагмент:','Belirleyici bölüm:'],
  showTask: ['Aufgabentext noch einmal ansehen','View the task text again','Снова посмотреть текст задания','Знову переглянути текст завдання','Soru metnini tekrar görüntüle'],
  solution: ['Passende Lösung','Correct solution','Правильное решение','Правильне розв’язання','Doğru çözüm'],
  unanswered: ['Nicht beantwortet','Not answered','Нет ответа','Немає відповіді','Yanıtlanmadı'],
  recordingSubmitted: ['Audioaufnahme eingereicht','Audio recording submitted','Аудиозапись сдана','Аудіозапис подано','Ses kaydı teslim edildi'],
  part: ['Teil {count}','Part {count}','Часть {count}','Частина {count}','Bölüm {count}'],
  solutionPhrase: ['Die passende Aussage ist:','The correct statement is:','Правильное утверждение:','Правильне твердження:','Doğru ifade:'],
  mainThemePhrase: ['Das Hauptthema ist:','The main topic is:','Основная тема:','Основна тема:','Ana konu:'],
  trueStatement: ['Die Aussage stimmt.','The statement is correct.','Утверждение верно.','Твердження правильне.','İfade doğrudur.'],
  falseStatement: ['Die Aussage stimmt nicht.','The statement is incorrect.','Утверждение неверно.','Твердження неправильне.','İfade yanlıştır.'],
  missingSpeaking: ['Keine mündliche Aufnahme eingereicht. Ein Vorbereitungstext ersetzt diese Leistung nicht.','No speaking recording was submitted. A preparation text does not replace this performance.','Устная запись не сдана. Подготовительный текст не заменяет устный ответ.','Усного запису не подано. Підготовчий текст не замінює усної відповіді.','Konuşma kaydı teslim edilmedi. Hazırlık metni bu performansın yerini tutmaz.'],
  missingWriting: ['Kein Text eingereicht. Diese Leistung wurde mit null Punkten erfasst.','No text was submitted. This performance received zero points.','Текст не сдан. За эту работу начислено ноль баллов.','Тексту не подано. За цю роботу нараховано нуль балів.','Metin teslim edilmedi. Bu görev sıfır puan olarak kaydedildi.'],
  missingInteraction: ['Für diese Gesprächsaufgabe fehlt die Bestätigung einer echten Interaktion. Positive Punkte allein belegen keine ausreichende Gesprächsleistung.','Real interaction has not been confirmed for this conversation task. Positive points alone do not prove sufficient conversational performance.','Для этого диалога не подтверждено реальное взаимодействие. Положительная оценка сама по себе не доказывает достаточный уровень диалогической речи.','Для цього діалогу не підтверджено справжню взаємодію. Позитивна оцінка сама по собі не доводить достатнього рівня діалогічного мовлення.','Bu konuşma görevi için gerçek etkileşim doğrulanmadı. Tek başına pozitif puan, yeterli konuşma performansını kanıtlamaz.'],
  explanationFallback: ['Vergleiche deine Antwort mit der passenden Lösung und der entscheidenden Stelle.','Compare your answer with the correct solution and key passage.','Сравни свой ответ с правильным решением и ключевым фрагментом.','Порівняй свою відповідь із правильним розв’язанням і ключовим фрагментом.','Yanıtını doğru çözümle ve belirleyici bölümle karşılaştır.'],
  recordingHint: ['Maximal 5 Minuten. Deine Lehrkraft bewertet die private Aufnahme.','Up to 5 minutes. Your teacher assesses the private recording.','До 5 минут. Личную запись оценит преподаватель.','До 5 хвилин. Особистий запис оцінить викладач.','En fazla 5 dakika. Özel kaydı öğretmenin değerlendirir.'],
  recordingPreview: ['Vorschau: Aufnahmen werden hier nicht gespeichert. Notizen ersetzen keine Sprechleistung.','Preview: recordings are not saved here. Notes do not replace a speaking performance.','Предпросмотр: записи здесь не сохраняются. Заметки не заменяют устный ответ.','Попередній перегляд: записи тут не зберігаються. Нотатки не замінюють усну відповідь.','Önizleme: kayıtlar burada saklanmaz. Notlar konuşma performansının yerini tutmaz.'],
  stopRecording: ['Aufnahme stoppen','Stop recording','Остановить запись','Зупинити запис','Kaydı durdur'],
  openingMic: ['Mikrofon wird geöffnet …','Opening microphone …','Включаем микрофон …','Вмикаємо мікрофон …','Mikrofon açılıyor …'],
  recordAgain: ['Neu aufnehmen','Record again','Записать заново','Записати знову','Yeniden kaydet'],
  record: ['Aufnahme starten','Start recording','Начать запись','Почати запис','Kaydı başlat'],
  volume: ['Lautstärke deiner Aufnahme','Recording volume','Громкость записи','Гучність запису','Kayıt ses düzeyi'],
  playRecording: ['Eigene Sprechaufnahme anhören','Listen to your speaking recording','Прослушать свою устную запись','Прослухати свій усний запис','Konuşma kaydını dinle'],
  uploading: ['Aufnahme wird hochgeladen …','Uploading recording …','Загружаем запись …','Завантажуємо запис …','Kayıt yükleniyor …'],
  useRecording: ['Diese Aufnahme verwenden','Use this recording','Использовать эту запись','Використати цей запис','Bu kaydı kullan'],
  discardRecording: ['Neue Aufnahme verwerfen','Discard new recording','Удалить новую запись','Відкинути новий запис','Yeni kaydı iptal et'],
  recordingChosen: ['Aufnahme ausgewählt. Mit „Weiter“ einreichen.','Recording selected. Submit it with “Next”.','Запись выбрана. Отправь её кнопкой «Далее».','Запис обрано. Надішли його кнопкою «Далі».','Kayıt seçildi. “İleri” ile teslim et.'],
  uploadExisting: ['Vorhandene Aufnahme hochladen','Upload an existing recording','Загрузить готовую запись','Завантажити готовий запис','Mevcut bir kaydı yükle'],
  audioFile: ['Audiodatei bis 20 MB','Audio file up to 20 MB','Аудиофайл до 20 МБ','Аудіофайл до 20 МБ','En fazla 20 MB ses dosyası'],
  notesSummary: ['Notizen oder Sprechskript (optional)','Notes or speaking script (optional)','Заметки или план речи (необязательно)','Нотатки або план мовлення (необов’язково)','Notlar veya konuşma metni (isteğe bağlı)'],
  notes: ['Deine Notizen','Your notes','Твои заметки','Твої нотатки','Notların'],
  recordingRequired: ['Für eine Sprechbewertung ist eine Aufnahme erforderlich.','A recording is required for speaking assessment.','Для оценки говорения нужна запись.','Для оцінювання говоріння потрібен запис.','Konuşmanın değerlendirilmesi için kayıt gerekir.'],
  errorGeneric: ['Das hat gerade nicht funktioniert. Bitte versuche es erneut.','That did not work. Please try again.','Не получилось. Попробуй ещё раз.','Не вдалося. Спробуй ще раз.','İşlem başarısız oldu. Tekrar dene.'],
  errorUnavailable: ['Dein Prüfungsbereich ist gerade nicht verfügbar.','Your exam area is currently unavailable.','Раздел экзамена сейчас недоступен.','Розділ іспиту зараз недоступний.','Sınav alanın şu anda kullanılamıyor.'],
  errorStart: ['Der Durchgang konnte nicht gestartet werden. Bitte versuche es erneut.','The attempt could not be started. Please try again.','Не удалось начать попытку. Попробуй ещё раз.','Не вдалося почати спробу. Спробуй ще раз.','Deneme başlatılamadı. Tekrar dene.'],
  errorSave: ['Deine Antwort konnte nicht gespeichert werden. Sie bleibt hier erhalten. Versuche es erneut.','Your answer could not be saved. It stays here so you can try again.','Не удалось сохранить ответ. Он остаётся здесь. Попробуй ещё раз.','Не вдалося зберегти відповідь. Вона залишається тут. Спробуй ще раз.','Yanıtın kaydedilemedi. Tekrar deneyebilmen için burada korunur.'],
  errorResults: ['Die Auswertung konnte nicht geladen werden. Deine gespeicherten Antworten bleiben erhalten.','Results could not be loaded. Your saved answers are preserved.','Не удалось загрузить результаты. Сохранённые ответы остаются.','Не вдалося завантажити результати. Збережені відповіді залишаються.','Sonuçlar yüklenemedi. Kaydedilmiş yanıtların korunur.'],
  errorReviews: ['Die Bewertungen konnten nicht geladen werden. Versuche es erneut.','Assessments could not be loaded. Try again.','Не удалось загрузить оценки. Попробуй ещё раз.','Не вдалося завантажити оцінки. Спробуй ще раз.','Değerlendirmeler yüklenemedi. Tekrar dene.'],
  errorNoTasks: ['Dieser Durchgang enthält keine Aufgaben. Bitte lade die Seite erneut.','This attempt has no tasks. Please reload the page.','В этой попытке нет заданий. Обнови страницу.','У цій спробі немає завдань. Онови сторінку.','Bu denemede soru yok. Sayfayı yeniden yükle.'],
  errorResultPending: ['Die Auswertung ist noch nicht verfügbar. Bitte lade die Seite erneut.','Results are not available yet. Please reload the page.','Результаты пока недоступны. Обнови страницу.','Результати поки недоступні. Онови сторінку.','Sonuçlar henüz hazır değil. Sayfayı yeniden yükle.'],
  errorAudio: ['Der Hörtext lädt nicht. Bitte lade ihn erneut, bevor du antwortest.','The audio is not loading. Reload it before answering.','Аудио не загружается. Загрузи его снова перед ответом.','Аудіо не завантажується. Завантаж його знову перед відповіддю.','Ses kaydı yüklenmiyor. Yanıtlamadan önce yeniden yükle.'],
  errorFile: ['Bitte wähle eine Audiodatei bis 20 MB: MP3, M4A, WAV, WebM oder Ogg.','Choose an audio file up to 20 MB: MP3, M4A, WAV, WebM or Ogg.','Выбери аудиофайл до 20 МБ: MP3, M4A, WAV, WebM или Ogg.','Обери аудіофайл до 20 МБ: MP3, M4A, WAV, WebM або Ogg.','En fazla 20 MB boyutunda MP3, M4A, WAV, WebM veya Ogg ses dosyası seç.'],
  errorRecordingPrepare: ['Deine Aufnahme konnte nicht vorbereitet werden.','Your recording could not be prepared.','Не удалось подготовить запись.','Не вдалося підготувати запис.','Kaydın hazırlanamadı.'],
  errorUploadQuota: ['Dein Uploadkontingent ist erreicht. Bitte versuche es später erneut.','You have reached your upload allowance. Please try again later.','Лимит загрузок исчерпан. Попробуй позже.','Ліміт завантажень вичерпано. Спробуй пізніше.','Yükleme sınırına ulaştın. Lütfen daha sonra tekrar dene.'],
  errorRecordingUpload: ['Die Aufnahme konnte nicht hochgeladen werden. Sie bleibt hier zum erneuten Speichern erhalten.','The recording could not be uploaded. It stays here so you can retry.','Не удалось загрузить запись. Она остаётся здесь для повторной попытки.','Не вдалося завантажити запис. Він залишається тут для повторної спроби.','Kayıt yüklenemedi. Tekrar deneyebilmen için burada korunur.'],
  micDenied: ['Dein Mikrofon ist gesperrt. Du kannst eine Audiodatei hochladen.','Your microphone is blocked. You can upload an audio file.','Микрофон заблокирован. Можно загрузить аудиофайл.','Мікрофон заблокований. Можна завантажити аудіофайл.','Mikrofonun engellendi. Bir ses dosyası yükleyebilirsin.'],
  micUnsupported: ['Dieser Browser kann nicht aufnehmen. Lade eine Audiodatei hoch.','This browser cannot record. Upload an audio file.','Браузер не поддерживает запись. Загрузи аудиофайл.','Браузер не підтримує запис. Завантаж аудіофайл.','Bu tarayıcı kayıt yapamıyor. Bir ses dosyası yükle.'],
  micFailed: ['Die Aufnahme hat nicht funktioniert. Bitte versuche es erneut.','Recording failed. Please try again.','Запись не получилась. Попробуй ещё раз.','Запис не вдався. Спробуй ще раз.','Kayıt başarısız oldu. Tekrar dene.'],
  errorLogin: ['Bitte melde dich an.','Please sign in.','Войди в аккаунт.','Увійди до облікового запису.','Lütfen giriş yap.'],
  errorReset: ['Deine Lehrkraft setzt den Prüfungsfortschritt gerade zurück. Bitte warte, bis der Vorgang beendet ist.','Your teacher is resetting exam progress. Please wait until it finishes.','Преподаватель сбрасывает прогресс экзамена. Подожди завершения.','Викладач скидає прогрес іспиту. Зачекай завершення.','Öğretmenin sınav ilerlemesini sıfırlıyor. İşlem bitene kadar bekle.'],
  errorReload: ['Der Prüfungsfortschritt wurde von deiner Lehrkraft zurückgesetzt. Bitte lade die Seite erneut.','Your teacher reset exam progress. Please reload the page.','Преподаватель сбросил прогресс экзамена. Обнови страницу.','Викладач скинув прогрес іспиту. Онови сторінку.','Öğretmenin sınav ilerlemesini sıfırladı. Sayfayı yeniden yükle.'],
  errorExpired: ['Die Prüfungszeit ist abgelaufen. Beende den Durchgang, um deine Auswertung zu sehen.','Exam time has expired. Finish the attempt to see your results.','Время экзамена истекло. Заверши попытку, чтобы увидеть результат.','Час іспиту минув. Заверши спробу, щоб побачити результат.','Sınav süresi doldu. Sonuçlarını görmek için denemeyi bitir.'],
  errorActive: ['Beende zuerst deinen laufenden Durchgang. Danach kannst du eine neue Prüfung starten.','Finish your active attempt before starting a new exam.','Сначала заверши текущую попытку, затем начни новый экзамен.','Спочатку заверши поточну спробу, потім почни новий іспит.','Yeni bir sınav başlatmadan önce devam eden denemeni bitir.'],
  errorConflict: ['Der Durchgang wurde auf einem anderen Gerät aktualisiert. Bitte speichere deine Antwort erneut.','The attempt was updated on another device. Please save your answer again.','Попытка обновлена на другом устройстве. Сохрани ответ ещё раз.','Спробу оновлено на іншому пристрої. Збережи відповідь ще раз.','Deneme başka bir cihazda güncellendi. Yanıtını yeniden kaydet.'],
} as const

export type SitovSimulationCopyKey = keyof typeof messages
export const SITOV_SIMULATION_UI_LANGUAGES = ['de','en','ru','uk','tr'] as const
export function sitovSimulationCopy(lang: string) {
  const index = Math.max(0, SITOV_SIMULATION_UI_LANGUAGES.indexOf(lang as typeof SITOV_SIMULATION_UI_LANGUAGES[number]))
  const language = SITOV_SIMULATION_UI_LANGUAGES[index]
  const t = (key: SitovSimulationCopyKey, values: Record<string, string | number> = {}) => messages[key][index].replace(/\{(\w+)\}/g, (_, field: string) => String(values[field] ?? `{${field}}`))
  return { lang: language, locale: {de:'de-DE',en:'en-GB',ru:'ru-RU',uk:'uk-UA',tr:'tr-TR'}[language], t,
    skill: (skill: SimulationSkill) => t(`skill_${skill}`), level: (level: SimulationLevel) => t(`level_${level}`) }
}

export function sitovSimulationError(lang: string, message?: string, fallback: SitovSimulationCopyKey = 'errorGeneric') {
  const copy = sitovSimulationCopy(lang)
  if (copy.lang === 'de' && message) return message
  if (!message) return copy.t(fallback)
  const patterns: [RegExp, SitovSimulationCopyKey][] = [
    [/Uploadkontingent/i,'errorUploadQuota'],
    [/melde dich an/i,'errorLogin'], [/noch nicht freigegeben|noch gesperrt/i,'gateBody'], [/Niveau-Freigabe/i,'levelLocked'],
    [/gerade zurück|Reset.*fort|gerade zurückgesetzt/i,'errorReset'], [/wurde.*zurückgesetzt/i,'errorReload'],
    [/Prüfungszeit.*(?:abgelaufen|beendet)|Zeit ist abgelaufen/i,'errorExpired'], [/laufenden Durchgang/i,'errorActive'],
    [/ander.*Gerät|parallel|Durchgang wurde aktualisiert/i,'errorConflict'], [/werden noch vorbereitet/i,'preparing'],
    [/Aufnahme.*(?:Hochladen|vorbereitet)/i,'errorRecordingPrepare'], [/Durchgang.*gestartet/i,'errorStart'],
    [/Antwort.*gespeichert|Durchgang.*gespeichert/i,'errorSave'], [/Bewertungen.*geladen/i,'errorReviews'],
  ]
  return copy.t(patterns.find(([pattern]) => pattern.test(message))?.[1] ?? fallback)
}

export function sitovSimulationHeadline(lang: string, result: SimulationResult) {
  if (sitovSimulationCopy(lang).lang === 'de') return result.headline
  const keys: Record<SimulationResult['status'], SitovSimulationCopyKey> = { 'teacher-review-required':'headlinePending',passed:'headlinePassed','not-passed':'headlineNotPassed','practice-strong':'headlineStrong','practice-needed':'headlinePractice' }
  return sitovSimulationCopy(lang).t(keys[result.status])
}

export function sitovSimulationDescription(lang: string, result: SimulationResult) {
  const copy = sitovSimulationCopy(lang)
  if (copy.lang === 'de') return result.description
  return copy.t(result.description.startsWith('Eigene Sitov-Rubrik:') ? 'fullRubric' : 'resultDisclaimer')
}

export function sitovSimulationNextStep(lang: string, step: string) {
  const copy = sitovSimulationCopy(lang)
  if (copy.lang === 'de') return step
  const skill = (['reading','listening','writing','speaking','language'] as const).find(item => step.startsWith(sitovSimulationCopy('de').skill(item) + ':'))
  if (skill) return copy.t('nextPractise', { skill:copy.skill(skill) })
  if (/bewerten|Rückmeldung|Bewertung abwarten/i.test(step)) return copy.t('nextReview')
  if (/Hören|Hörteile/i.test(step)) return copy.t('nextListening')
  if (/Reichen Sie|schriftlichen Texte/i.test(step)) return copy.t('nextSubmit')
  if (/offiziellen Modellsatz/i.test(step)) return copy.t('nextOfficial')
  return copy.t('nextDiscuss')
}
