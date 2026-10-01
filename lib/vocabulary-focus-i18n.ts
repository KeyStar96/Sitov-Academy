import { toUiLocale } from './locale-routing'
import { interpolate, type TranslationVariables } from './i18n-runtime'

/**
 * Texte des Problemwörter-Trainings (Phase 11.3). Russisch und Ukrainisch
 * schreiben Zahlen als „Bezeichnung: Zahl" (keine falschen Pluralformen).
 * Die Aufgaben selbst (Artikel, Wörter) bleiben immer Deutsch.
 */
const de = {
  title: 'Problemwörter',
  intro: 'Wörter, die dir schwerfallen, und Artikel, die du oft vergisst – hier übst du sie gezielt in kleinen Aufgaben.',
  rule: 'Ein Wort kommt hierher nach 3 Fehlern im Vokabeltrainer oder nach 2 falschen Artikeln. Gemeistert ist es, wenn du es viermal hintereinander richtig weißt: sofort, nach 1, nach 3 und nach 7 Tagen.',
  due: 'Fällig', active: 'In Training', mastered: 'Gemeistert', article_words: 'Artikel',
  start: 'Training starten', start_count: 'Training starten ({count})', none_due: 'Heute ist nichts fällig – gut gemacht.', next_due: 'Nächste Wiederholung: {date}',
  empty_title: 'Keine Problemwörter', empty_text: 'Sobald dir ein Wort mehrmals schwerfällt oder ein Artikel nicht sitzt, erscheint es hier – mit eigenen kleinen Aufgaben.',
  list_active: 'In Training', list_mastered: 'Gemeistert ({count})',
  reason_article: 'Artikel', reason_hard: 'Schwer zu merken', stage: 'Stufe {value} von 4', due_now: 'Heute', due_on: 'Am {date}',
  format_article: 'Welcher Artikel?', format_choice: 'Welches Wort passt?', format_build: 'Lege das Wort', format_type: 'Schreib das Wort',
  hint_type: 'Beginnt mit „{letter}“ · {count} Buchstaben', hint_type_noun: 'Mit Artikel: der, die oder das', answer_label: 'Deine Antwort',
  check: 'Prüfen', next: 'Weiter', finish: 'Auswerten', end: 'Beenden', reset: 'Zurücksetzen',
  add_letter: 'Buchstabe {letter} hinzufügen', remove_letter: 'Buchstabe {letter} entfernen', placed: 'Dein Wort',
  correct: 'Richtig!', wrong: 'Nicht ganz.', solution: 'Richtig ist: {solution}', article_missing: 'Der Artikel fehlt.', article_wrong: 'Der Artikel stimmt nicht.',
  stage_up: 'Stufe {value} von 4 · nächste Wiederholung {date}', mastered_now: 'Gemeistert! Das Wort ist aus dem Training raus.', again_later: 'Das Wort kommt in dieser Runde gleich noch einmal.',
  progress: 'Aufgabe {current} von {total}', done_title: 'Runde geschafft', done_score: '{correct} von {total} richtig', reload: 'Neue Runde laden', back: 'Zur Übersicht',
  failed: 'Das hat nicht geklappt. Bitte versuch es noch einmal.', retry: 'Erneut senden', load_failed: 'Die Problemwörter konnten nicht geladen werden.', not_due: 'Dieses Wort ist heute schon erledigt.',
  tomorrow: 'morgen', list_label: 'Deine Problemwörter',
}
type Key = keyof typeof de
type Copy = Record<Key, string>

const en: Copy = {
  title: 'Problem words',
  intro: 'Words you find hard and articles you often forget – practise them here in small, focused tasks.',
  rule: 'A word lands here after 3 mistakes in the vocabulary trainer or after 2 wrong articles. It is mastered when you get it right four times in a row: right away, after 1, after 3 and after 7 days.',
  due: 'Due', active: 'In training', mastered: 'Mastered', article_words: 'Articles',
  start: 'Start training', start_count: 'Start training ({count})', none_due: 'Nothing is due today – well done.', next_due: 'Next review: {date}',
  empty_title: 'No problem words', empty_text: 'As soon as a word keeps tripping you up or an article does not stick, it appears here – with its own small tasks.',
  list_active: 'In training', list_mastered: 'Mastered ({count})',
  reason_article: 'Article', reason_hard: 'Hard to remember', stage: 'Step {value} of 4', due_now: 'Today', due_on: 'On {date}',
  format_article: 'Which article?', format_choice: 'Which word fits?', format_build: 'Build the word', format_type: 'Write the word',
  hint_type: 'Starts with “{letter}” · {count} letters', hint_type_noun: 'With article: der, die or das', answer_label: 'Your answer',
  check: 'Check', next: 'Next', finish: 'See results', end: 'Stop', reset: 'Reset',
  add_letter: 'Add letter {letter}', remove_letter: 'Remove letter {letter}', placed: 'Your word',
  correct: 'Correct!', wrong: 'Not quite.', solution: 'Correct: {solution}', article_missing: 'The article is missing.', article_wrong: 'The article is wrong.',
  stage_up: 'Step {value} of 4 · next review {date}', mastered_now: 'Mastered! The word leaves the training.', again_later: 'This word comes back once more in this round.',
  progress: 'Task {current} of {total}', done_title: 'Round complete', done_score: '{correct} of {total} correct', reload: 'Load a new round', back: 'Back to overview',
  failed: 'That did not work. Please try again.', retry: 'Send again', load_failed: 'Problem words could not be loaded.', not_due: 'This word is already done for today.',
  tomorrow: 'tomorrow', list_label: 'Your problem words',
}
const ru: Copy = {
  title: 'Проблемные слова',
  intro: 'Слова, которые даются трудно, и артикли, которые часто забываются, – здесь вы тренируете их в коротких заданиях.',
  rule: 'Слово попадает сюда после 3 ошибок в тренажёре или 2 неверных артиклей. Оно освоено, когда вы ответите верно четыре раза подряд: сразу, через 1, 3 и 7 дней.',
  due: 'Пора повторить', active: 'На тренировке', mastered: 'Освоено', article_words: 'Артикли',
  start: 'Начать тренировку', start_count: 'Начать тренировку ({count})', none_due: 'Сегодня повторять нечего – отлично.', next_due: 'Следующее повторение: {date}',
  empty_title: 'Проблемных слов нет', empty_text: 'Как только слово будет даваться трудно или артикль не запомнится, оно появится здесь – со своими короткими заданиями.',
  list_active: 'На тренировке', list_mastered: 'Освоено: {count}',
  reason_article: 'Артикль', reason_hard: 'Трудно запомнить', stage: 'Ступень {value} из 4', due_now: 'Сегодня', due_on: 'Дата: {date}',
  format_article: 'Какой артикль?', format_choice: 'Какое слово подходит?', format_build: 'Соберите слово', format_type: 'Напишите слово',
  hint_type: 'Начинается с «{letter}» · букв: {count}', hint_type_noun: 'С артиклем: der, die или das', answer_label: 'Ваш ответ',
  check: 'Проверить', next: 'Дальше', finish: 'Итоги', end: 'Завершить', reset: 'Сбросить',
  add_letter: 'Добавить букву {letter}', remove_letter: 'Убрать букву {letter}', placed: 'Ваше слово',
  correct: 'Верно!', wrong: 'Не совсем.', solution: 'Правильно: {solution}', article_missing: 'Не хватает артикля.', article_wrong: 'Артикль неверный.',
  stage_up: 'Ступень {value} из 4 · следующее повторение: {date}', mastered_now: 'Освоено! Слово больше не нужно тренировать.', again_later: 'Это слово ещё раз появится в этом раунде.',
  progress: 'Задание {current} из {total}', done_title: 'Раунд завершён', done_score: 'Верно: {correct} из {total}', reload: 'Загрузить новый раунд', back: 'К обзору',
  failed: 'Не получилось. Попробуйте ещё раз.', retry: 'Отправить снова', load_failed: 'Не удалось загрузить проблемные слова.', not_due: 'Это слово на сегодня уже выполнено.',
  tomorrow: 'завтра', list_label: 'Ваши проблемные слова',
}
const uk: Copy = {
  title: 'Проблемні слова',
  intro: 'Слова, які даються важко, і артиклі, які часто забуваються, – тут ви тренуєте їх у коротких завданнях.',
  rule: 'Слово потрапляє сюди після 3 помилок у тренажері або 2 неправильних артиклів. Воно опановане, коли ви відповісте правильно чотири рази поспіль: одразу, через 1, 3 і 7 днів.',
  due: 'Час повторити', active: 'На тренуванні', mastered: 'Опановано', article_words: 'Артиклі',
  start: 'Почати тренування', start_count: 'Почати тренування ({count})', none_due: 'Сьогодні повторювати нічого – чудово.', next_due: 'Наступне повторення: {date}',
  empty_title: 'Проблемних слів немає', empty_text: 'Щойно слово даватиметься важко або артикль не запам’ятається, воно з’явиться тут – із власними короткими завданнями.',
  list_active: 'На тренуванні', list_mastered: 'Опановано: {count}',
  reason_article: 'Артикль', reason_hard: 'Важко запам’ятати', stage: 'Щабель {value} з 4', due_now: 'Сьогодні', due_on: 'Дата: {date}',
  format_article: 'Який артикль?', format_choice: 'Яке слово підходить?', format_build: 'Складіть слово', format_type: 'Напишіть слово',
  hint_type: 'Починається з «{letter}» · літер: {count}', hint_type_noun: 'З артиклем: der, die або das', answer_label: 'Ваша відповідь',
  check: 'Перевірити', next: 'Далі', finish: 'Підсумки', end: 'Завершити', reset: 'Скинути',
  add_letter: 'Додати літеру {letter}', remove_letter: 'Прибрати літеру {letter}', placed: 'Ваше слово',
  correct: 'Правильно!', wrong: 'Не зовсім.', solution: 'Правильно: {solution}', article_missing: 'Бракує артикля.', article_wrong: 'Артикль неправильний.',
  stage_up: 'Щабель {value} з 4 · наступне повторення: {date}', mastered_now: 'Опановано! Слово більше не треба тренувати.', again_later: 'Це слово ще раз з’явиться в цьому раунді.',
  progress: 'Завдання {current} з {total}', done_title: 'Раунд завершено', done_score: 'Правильно: {correct} з {total}', reload: 'Завантажити новий раунд', back: 'До огляду',
  failed: 'Не вдалося. Спробуйте ще раз.', retry: 'Надіслати знову', load_failed: 'Не вдалося завантажити проблемні слова.', not_due: 'Це слово на сьогодні вже виконано.',
  tomorrow: 'завтра', list_label: 'Ваші проблемні слова',
}
const tr: Copy = {
  title: 'Sorunlu kelimeler',
  intro: 'Zorlandığın kelimeler ve sık unuttuğun artikeller – burada kısa, hedefli görevlerle çalışırsın.',
  rule: 'Bir kelime, kelime alıştırmasında 3 hatadan veya 2 yanlış artikelden sonra buraya gelir. Arka arkaya dört kez doğru bildiğinde öğrenilmiş sayılır: hemen, 1, 3 ve 7 gün sonra.',
  due: 'Sırada', active: 'Çalışılıyor', mastered: 'Öğrenildi', article_words: 'Artikeller',
  start: 'Çalışmaya başla', start_count: 'Çalışmaya başla ({count})', none_due: 'Bugün tekrar edilecek bir şey yok – harika.', next_due: 'Sonraki tekrar: {date}',
  empty_title: 'Sorunlu kelime yok', empty_text: 'Bir kelime seni birkaç kez zorlarsa veya bir artikel akılda kalmazsa burada görünür – kendi kısa görevleriyle.',
  list_active: 'Çalışılıyor', list_mastered: 'Öğrenildi ({count})',
  reason_article: 'Artikel', reason_hard: 'Akılda kalmıyor', stage: 'Adım {value} / 4', due_now: 'Bugün', due_on: '{date}',
  format_article: 'Hangi artikel?', format_choice: 'Hangi kelime uyuyor?', format_build: 'Kelimeyi oluştur', format_type: 'Kelimeyi yaz',
  hint_type: '“{letter}” ile başlıyor · {count} harf', hint_type_noun: 'Artikeliyle: der, die veya das', answer_label: 'Cevabın',
  check: 'Kontrol et', next: 'İleri', finish: 'Sonuçlar', end: 'Bitir', reset: 'Sıfırla',
  add_letter: '{letter} harfini ekle', remove_letter: '{letter} harfini çıkar', placed: 'Kelimen',
  correct: 'Doğru!', wrong: 'Tam değil.', solution: 'Doğrusu: {solution}', article_missing: 'Artikel eksik.', article_wrong: 'Artikel yanlış.',
  stage_up: 'Adım {value} / 4 · sonraki tekrar {date}', mastered_now: 'Öğrenildi! Kelime çalışmadan çıktı.', again_later: 'Bu kelime bu turda bir kez daha gelecek.',
  progress: 'Görev {current} / {total}', done_title: 'Tur tamamlandı', done_score: '{total} cevaptan {correct} doğru', reload: 'Yeni tur yükle', back: 'Genel bakışa dön',
  failed: 'Olmadı. Lütfen tekrar dene.', retry: 'Tekrar gönder', load_failed: 'Sorunlu kelimeler yüklenemedi.', not_due: 'Bu kelime bugün zaten tamamlandı.',
  tomorrow: 'yarın', list_label: 'Sorunlu kelimelerin',
}

export type VocabularyFocusTranslator = (key: Key, variables?: TranslationVariables) => string

export function vocabularyFocusCopy(lang: string): VocabularyFocusTranslator {
  const messages = { de, en, ru, uk, tr }[toUiLocale(lang)]
  return (key, variables) => interpolate(messages[key], variables)
}
