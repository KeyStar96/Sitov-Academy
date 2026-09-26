import { interpolate, type TranslationVariables } from '@/lib/i18n-runtime'
import { toUiLocale, type UiLocale } from '@/lib/locale-routing'

const de = {
  title: 'Lernpfad', intro: 'Schritt für Schritt: lernen, üben und dein Wissen festigen.',
  path: 'Pfad {number}', practice: 'Üben', review: 'Wiederholen', test: 'Test', special: 'Extra',
  locked: 'Noch gesperrt', ready: 'Bereit', completed: 'Abgeschlossen', resume: 'Fortsetzen',
  rule: 'Merkkarte', begin: 'Übungen starten', back: 'Zurück zum Lernpfad', next: 'Weiter',
  check: 'Antwort prüfen', answer: 'Deine Antwort', article: 'Schreibe den Artikel mit.',
  choose: 'Wähle eine Antwort.', arrange: 'Bringe die Wörter in die richtige Reihenfolge.',
  add: 'Wort hinzufügen: {word}', remove: 'Wort entfernen: {word}', selected: 'Dein Satz', words: 'Wörter',
  progress: '{done} von {total} Aufgaben erledigt', correct: 'Richtig! Gut gemacht.',
  incorrect: 'Das passt noch nicht. Diese Aufgabe kommt noch einmal.', incorrect_test: 'Das passt noch nicht. Vergleiche deine Antwort mit der Lösung.', solution: 'Lösung',
  umlaut: 'Richtig erkannt. Achte noch auf die Umlaute.', typo: 'Richtig erkannt. Achte noch auf die Schreibweise.',
  node_done: 'Knoten abgeschlossen', stars: 'Sterne: {count} von 3',
  save: 'Antwort speichern', finish: 'Test abschließen', test_intro: 'Im Test bekommst du die Bewertung am Ende. Ab 80 % ist der Test bestanden.',
  test_ready: 'Alle Antworten sind gespeichert. Du kannst den Test jetzt abschließen.',
  passed: 'Test bestanden', retry_test: 'Du kannst den Test erneut versuchen.', percentage: 'Ergebnis: {value} %',
  recommendations: 'Diese Knoten helfen dir beim Wiederholen:', results: 'Deine Antworten',
  empty: 'Hier werden bald neue Lernpfade freigeschaltet.', loading: 'Wird geladen …',
  retry: 'Erneut versuchen', error: 'Das hat gerade nicht geklappt. Bitte versuche es erneut.',
  error_auth: 'Bitte melde dich erneut an.', error_locked: 'Schließe zuerst die vorherigen Schritte ab. Die Niveau-Freigabe übernimmt deine Lehrkraft.',
  error_unavailable: 'Dieser Lernschritt ist gerade nicht verfügbar. Kehre zum Lernpfad zurück.',
  error_input: 'Bitte vervollständige deine Antwort.', error_reset: 'Dein Lernfortschritt wird gerade zurückgesetzt. Lade die Seite anschließend neu.',
  error_conflict: 'Der Lernstand hat sich geändert. Kehre zum Lernpfad zurück und setze dort fort.',
  all_done: 'Du hast alle Pfade dieses Niveaus abgeschlossen.', next_level: 'Weiter zu {level}',
  teacher_level: 'Deine Lehrkraft schaltet das nächste Niveau für dich frei.',
}
type Messages = Record<keyof typeof de, string>
const en: Messages = {
  title: 'Learning path', intro: 'Step by step: learn, practise and build your confidence.',
  path: 'Path {number}', practice: 'Practice', review: 'Review', test: 'Test', special: 'Extra',
  locked: 'Not yet available', ready: 'Ready', completed: 'Completed', resume: 'Continue',
  rule: 'Rule card', begin: 'Start practising', back: 'Back to the learning path', next: 'Next',
  check: 'Check answer', answer: 'Your answer', article: 'Include the article.',
  choose: 'Choose an answer.', arrange: 'Put the words in the correct order.',
  add: 'Add word: {word}', remove: 'Remove word: {word}', selected: 'Your sentence', words: 'Words',
  progress: '{done} of {total} exercises completed', correct: 'Correct! Well done.',
  incorrect: 'Not quite yet. You will see this exercise again.', incorrect_test: 'Not quite yet. Compare your answer with the solution.', solution: 'Answer',
  umlaut: 'You got it. Take another look at the umlauts.', typo: 'You got it. Take another look at the spelling.',
  node_done: 'Step completed', stars: 'Stars: {count} out of 3',
  save: 'Save answer', finish: 'Finish test', test_intro: 'You will receive your results at the end. You need 80% to pass.',
  test_ready: 'All answers are saved. You can finish the test now.',
  passed: 'Test passed', retry_test: 'You can try the test again.', percentage: 'Result: {value}%',
  recommendations: 'Review these steps for more practice:', results: 'Your answers',
  empty: 'New learning paths will be available here soon.', loading: 'Loading …',
  retry: 'Try again', error: 'That did not work. Please try again.',
  error_auth: 'Please sign in again.', error_locked: 'Complete the earlier steps first. Your teacher unlocks access to each level.',
  error_unavailable: 'This step is currently unavailable. Return to the learning path.',
  error_input: 'Please complete your answer.', error_reset: 'Your progress is being reset. Reload the page when it is finished.',
  error_conflict: 'Your progress has changed. Return to the learning path to continue.',
  all_done: 'You have completed every path in this level.', next_level: 'Continue to {level}',
  teacher_level: 'Your teacher will unlock the next level for you.',
}
const ru: Messages = {
  title: 'Учебный маршрут', intro: 'Шаг за шагом: изучай, практикуйся и закрепляй знания.',
  path: 'Маршрут {number}', practice: 'Практика', review: 'Повторение', test: 'Тест', special: 'Дополнительно',
  locked: 'Пока недоступно', ready: 'Можно начинать', completed: 'Завершено', resume: 'Продолжить',
  rule: 'Карточка с правилом', begin: 'Начать упражнения', back: 'К учебному маршруту', next: 'Далее',
  check: 'Проверить ответ', answer: 'Твой ответ', article: 'Напиши слово с артиклем.',
  choose: 'Выбери ответ.', arrange: 'Расставь слова в правильном порядке.',
  add: 'Добавить слово: {word}', remove: 'Убрать слово: {word}', selected: 'Твоё предложение', words: 'Слова',
  progress: 'Выполнено заданий: {done} из {total}', correct: 'Правильно! Молодец.',
  incorrect: 'Пока не совсем верно. Это задание появится ещё раз.', incorrect_test: 'Пока не совсем верно. Сравни свой ответ с правильным.', solution: 'Правильный ответ',
  umlaut: 'Ответ засчитан. Обрати внимание на умлауты.', typo: 'Ответ засчитан. Обрати внимание на написание.',
  node_done: 'Шаг завершён', stars: 'Звёзды: {count} из 3',
  save: 'Сохранить ответ', finish: 'Завершить тест', test_intro: 'Результаты появятся в конце теста. Для прохождения нужно набрать 80 %.',
  test_ready: 'Все ответы сохранены. Теперь можно завершить тест.',
  passed: 'Тест пройден', retry_test: 'Можно попробовать пройти тест ещё раз.', percentage: 'Результат: {value} %',
  recommendations: 'Повтори эти шаги, чтобы закрепить знания:', results: 'Твои ответы',
  empty: 'Скоро здесь появятся новые учебные маршруты.', loading: 'Загрузка …',
  retry: 'Попробовать снова', error: 'Не получилось. Попробуй ещё раз.',
  error_auth: 'Войди в аккаунт ещё раз.', error_locked: 'Сначала заверши предыдущие шаги. Доступ к уровню открывает преподаватель.',
  error_unavailable: 'Этот шаг сейчас недоступен. Вернись к учебному маршруту.',
  error_input: 'Пожалуйста, заполни ответ.', error_reset: 'Прогресс сейчас сбрасывается. После завершения обнови страницу.',
  error_conflict: 'Прогресс изменился. Вернись к учебному маршруту и продолжи оттуда.',
  all_done: 'Все маршруты этого уровня завершены.', next_level: 'Перейти к {level}',
  teacher_level: 'Преподаватель откроет тебе следующий уровень.',
}
const uk: Messages = {
  title: 'Навчальний маршрут', intro: 'Крок за кроком: вивчай, практикуйся та закріплюй знання.',
  path: 'Маршрут {number}', practice: 'Практика', review: 'Повторення', test: 'Тест', special: 'Додатково',
  locked: 'Поки недоступно', ready: 'Можна починати', completed: 'Завершено', resume: 'Продовжити',
  rule: 'Картка з правилом', begin: 'Почати вправи', back: 'До навчального маршруту', next: 'Далі',
  check: 'Перевірити відповідь', answer: 'Твоя відповідь', article: 'Напиши слово з артиклем.',
  choose: 'Вибери відповідь.', arrange: 'Розташуй слова в правильному порядку.',
  add: 'Додати слово: {word}', remove: 'Прибрати слово: {word}', selected: 'Твоє речення', words: 'Слова',
  progress: 'Виконано завдань: {done} із {total}', correct: 'Правильно! Молодець.',
  incorrect: 'Поки не зовсім правильно. Це завдання з’явиться ще раз.', incorrect_test: 'Поки не зовсім правильно. Порівняй свою відповідь із правильною.', solution: 'Правильна відповідь',
  umlaut: 'Відповідь зараховано. Зверни увагу на умлаути.', typo: 'Відповідь зараховано. Зверни увагу на написання.',
  node_done: 'Крок завершено', stars: 'Зірки: {count} із 3',
  save: 'Зберегти відповідь', finish: 'Завершити тест', test_intro: 'Результати з’являться наприкінці тесту. Для проходження потрібно набрати 80 %.',
  test_ready: 'Усі відповіді збережено. Тепер можна завершити тест.',
  passed: 'Тест пройдено', retry_test: 'Можна спробувати пройти тест ще раз.', percentage: 'Результат: {value} %',
  recommendations: 'Повтори ці кроки, щоб закріпити знання:', results: 'Твої відповіді',
  empty: 'Незабаром тут з’являться нові навчальні маршрути.', loading: 'Завантаження …',
  retry: 'Спробувати знову', error: 'Не вдалося. Спробуй ще раз.',
  error_auth: 'Увійди в обліковий запис ще раз.', error_locked: 'Спочатку заверши попередні кроки. Доступ до рівня відкриває викладач.',
  error_unavailable: 'Цей крок зараз недоступний. Повернися до навчального маршруту.',
  error_input: 'Будь ласка, заповни відповідь.', error_reset: 'Прогрес зараз скидається. Після завершення онови сторінку.',
  error_conflict: 'Прогрес змінився. Повернися до навчального маршруту та продовж звідти.',
  all_done: 'Усі маршрути цього рівня завершено.', next_level: 'Перейти до {level}',
  teacher_level: 'Викладач відкриє тобі наступний рівень.',
}
const tr: Messages = {
  title: 'Öğrenme yolu', intro: 'Adım adım öğren, alıştırma yap ve bilgilerini pekiştir.',
  path: 'Yol {number}', practice: 'Alıştırma', review: 'Tekrar', test: 'Test', special: 'Ek çalışma',
  locked: 'Henüz açık değil', ready: 'Hazır', completed: 'Tamamlandı', resume: 'Devam et',
  rule: 'Kural kartı', begin: 'Alıştırmalara başla', back: 'Öğrenme yoluna dön', next: 'İleri',
  check: 'Yanıtı kontrol et', answer: 'Yanıtın', article: 'Artikeli de yaz.',
  choose: 'Bir yanıt seç.', arrange: 'Kelimeleri doğru sıraya koy.',
  add: 'Kelime ekle: {word}', remove: 'Kelimeyi kaldır: {word}', selected: 'Cümlen', words: 'Kelimeler',
  progress: '{total} alıştırmadan {done} tanesi tamamlandı', correct: 'Doğru! Aferin.',
  incorrect: 'Henüz tam doğru değil. Bu alıştırma tekrar karşına çıkacak.', incorrect_test: 'Henüz tam doğru değil. Yanıtını doğru yanıtla karşılaştır.', solution: 'Doğru yanıt',
  umlaut: 'Yanıtın kabul edildi. Ünlü harflerin üzerindeki noktalara dikkat et.', typo: 'Yanıtın kabul edildi. Yazılışa bir daha bak.',
  node_done: 'Adım tamamlandı', stars: 'Yıldızlar: {count} / 3',
  save: 'Yanıtı kaydet', finish: 'Testi bitir', test_intro: 'Sonuçlarını testin sonunda göreceksin. Geçmek için %80 gerekiyor.',
  test_ready: 'Tüm yanıtlar kaydedildi. Şimdi testi bitirebilirsin.',
  passed: 'Testi geçtin', retry_test: 'Testi tekrar deneyebilirsin.', percentage: 'Sonuç: %{value}',
  recommendations: 'Pekiştirmek için bu adımları tekrar et:', results: 'Yanıtların',
  empty: 'Yeni öğrenme yolları yakında burada açılacak.', loading: 'Yükleniyor …',
  retry: 'Tekrar dene', error: 'İşlem tamamlanamadı. Lütfen tekrar dene.',
  error_auth: 'Lütfen tekrar giriş yap.', error_locked: 'Önce önceki adımları tamamla. Seviye erişimini öğretmenin açar.',
  error_unavailable: 'Bu adım şu anda kullanılamıyor. Öğrenme yoluna dön.',
  error_input: 'Lütfen yanıtını tamamla.', error_reset: 'İlerlemen sıfırlanıyor. İşlem tamamlandığında sayfayı yenile.',
  error_conflict: 'İlerlemen değişti. Öğrenme yoluna dönerek devam et.',
  all_done: 'Bu seviyedeki tüm yolları tamamladın.', next_level: '{level} seviyesine geç',
  teacher_level: 'Öğretmenin bir sonraki seviyeyi senin için açacak.',
}
export const learningPathMessages: Record<UiLocale, Messages> = { de, en, ru, uk, tr }
export function pathTranslator(locale: string) {
  const messages = learningPathMessages[toUiLocale(locale)]
  return (key: keyof Messages, variables?: TranslationVariables) => interpolate(messages[key], variables)
}
export function pathErrorText(locale: string, error: string) {
  const t = pathTranslator(locale)
  if (error === 'authentication_required') return t('error_auth')
  if (['path_locked', 'node_locked', 'not_authorized'].includes(error)) return t('error_locked')
  if (['node_unavailable', 'attempt_unavailable', 'test_pool_invalid'].includes(error)) return t('error_unavailable')
  if (['invalid_input', 'invalid_answer', 'answers_incomplete'].includes(error)) return t('error_input')
  if (error === 'learning_reset_in_progress') return t('error_reset')
  if (['answer_out_of_order', 'request_conflict'].includes(error)) return t('error_conflict')
  return t('error')
}
