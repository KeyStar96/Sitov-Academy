import { toUiLocale } from '@/lib/locale-routing'

const de = {
  title: 'Deine Verb-Lernbox', intro: 'Jedes Verb hat seinen Platz. Die Zeitform mit dem niedrigsten Lernstand bestimmt das Fach.',
  scope: 'Dein Verbfortschritt', progress: 'Durchschnittlicher Fortschritt der Formen', tap: 'Öffne ein Fach und sieh, welche Verben darin liegen.',
  names: ['Neu', 'Frisch', 'Vertraut', 'Gefestigt', 'Sicherer', 'Sicher', 'Gelernt'],
  phase: 'Fach {box}', learned: 'Gelernt', verbCount: '{count} Verben', verbCountOne: '1 Verb', formCount: '{count} Formen', dueVerbs: '{count} bereit', ahead: '{count} mit fortgeschrittenen Zeitformen', open: '{name} öffnen',
  selected: 'Verben in deiner Box', practiced: 'Bereits geübte Formen', learnedVerbs: 'Vollständig gelernte Verben', dueForms: 'Formen bereit',
  formSummary: '{learned} von {total} Formen gelernt · {fresh} noch ungeübt', nextReview: 'Nächste geplante Wiederholung',
  initial: 'Neu oder in Wiederholung', day: '1 Tag Abstand', days: '{days} Tage Abstand', longTerm: 'Alle 60 Tage wiederholen',
  guide: 'So wandern deine Verben', guideText: 'Präsens, Perfekt und Präteritum haben eigene Lernstände. Ein Verb steigt erst weiter, wenn jede freigeschaltete Zeitform weiter ist. Neue Zeitformen beginnen in Fach 1; dein bisheriger Fortschritt bleibt erhalten.',
  rules: 'Eine richtige, fällige Antwort bringt die Form ein Fach weiter. Frühes Wiederholen festigt sie, ohne ein Fach zu überspringen. Eine falsche Antwort bringt diese Zeitform in Fach 1 zurück; nach 5 Minuten ist sie wieder bereit.',
  learnedRules: 'Ein Verb ist vollständig gelernt, sobald alle freigeschalteten Zeitformen Fach 7 erreicht haben. Gelernte Formen werden alle 60 Tage wiederholt.',
  search: 'Im Fach nach Verb oder Bedeutung suchen', allTenses: 'Alle Zeitformen', readyOnly: 'Nur bereit', close: 'Fach schließen', practice: 'Dieses Fach trainieren', empty: 'Dieses Fach ist noch leer.', noResults: 'Keine Verben für diese Auswahl.',
  newForm: 'Noch ungeübt', dueNow: 'Jetzt bereit', lastAnswer: 'Zuletzt geübt', tries: '{count} Versuche', correct: '{count} richtig',
  partlyAhead: 'Einige Zeitformen sind schon weiter', remove: 'Aus der Verbbox entfernen', retained: 'Lernstand bleibt beim Entfernen erhalten',
} as const
type Copy = { [K in keyof typeof de]: K extends 'names' ? readonly string[] : string }
const en: Copy = {
  title: 'Your verb learning box', intro: 'Every verb has its place. Its least advanced tense determines the compartment.',
  scope: 'Your verb progress', progress: 'Average progress across forms', tap: 'Open a compartment to see the verbs inside.',
  names: ['New', 'Fresh', 'Familiar', 'Established', 'Stronger', 'Confident', 'Learned'],
  phase: 'Box {box}', learned: 'Learned', verbCount: '{count} verbs', verbCountOne: '1 verb', formCount: '{count} forms', dueVerbs: '{count} ready', ahead: '{count} with more advanced tenses', open: 'Open {name}',
  selected: 'Verbs in your box', practiced: 'Forms already practised', learnedVerbs: 'Fully learned verbs', dueForms: 'Forms ready',
  formSummary: '{learned} of {total} forms learned · {fresh} still unpractised', nextReview: 'Next scheduled review',
  initial: 'New or being reviewed', day: '1-day interval', days: '{days}-day interval', longTerm: 'Review every 60 days',
  guide: 'How your verbs move', guideText: 'Present, perfect and simple past each have their own progress. A verb moves up when every unlocked tense has advanced. New tenses begin in box 1; your existing progress is kept.',
  rules: 'A correct answer to a due form advances it by one box. Early practice reinforces it without skipping a box. A wrong answer returns that tense to box 1; it is ready again after 5 minutes.',
  learnedRules: 'A verb is fully learned when all its unlocked tenses reach box 7. Learned forms are reviewed every 60 days.',
  search: 'Search this box for a verb or meaning', allTenses: 'All tenses', readyOnly: 'Only ready', close: 'Close compartment', practice: 'Practise this compartment', empty: 'This compartment is still empty.', noResults: 'No verbs match this selection.',
  newForm: 'Not practised yet', dueNow: 'Ready now', lastAnswer: 'Last practised', tries: '{count} attempts', correct: '{count} correct',
  partlyAhead: 'Some tenses are already further along', remove: 'Remove from verb box', retained: 'Removing a verb keeps its progress',
}
const ru: Copy = {
  title: 'Твоя учебная копилка глаголов', intro: 'У каждого глагола своё место. Отсек определяет время с наименьшим прогрессом.',
  scope: 'Твой прогресс по глаголам', progress: 'Средний прогресс форм', tap: 'Открой отсек, чтобы увидеть глаголы внутри.',
  names: ['Новые', 'Начатые', 'Знакомые', 'Закреплённые', 'Увереннее', 'Уверенно', 'Выученные'],
  phase: 'Отсек {box}', learned: 'Выучено', verbCount: 'Глаголов: {count}', verbCountOne: 'Глагол: 1', formCount: 'Форм: {count}', dueVerbs: 'Готовы: {count}', ahead: 'С опережающими временами: {count}', open: 'Открыть: {name}',
  selected: 'Глаголов в копилке', practiced: 'Уже отработанные формы', learnedVerbs: 'Полностью выученные глаголы', dueForms: 'Формы для повторения',
  formSummary: 'Выучено форм: {learned} из {total} · ещё не отработано: {fresh}', nextReview: 'Следующее запланированное повторение',
  initial: 'Новые или на повторении', day: 'Интервал: 1 день', days: 'Интервал в днях: {days}', longTerm: 'Повторять каждые 60 дней',
  guide: 'Как перемещаются глаголы', guideText: 'У Präsens, Perfekt и Präteritum свой прогресс. Глагол продвигается, когда продвигаются все доступные времена. Новые времена начинают с отсека 1; прежний прогресс сохраняется.',
  rules: 'Правильный ответ на форму, срок которой наступил, продвигает её на один отсек. Раннее повторение закрепляет форму без перехода. Ошибка возвращает это время в отсек 1; повторить можно через 5 минут.',
  learnedRules: 'Глагол полностью выучен, когда все доступные времена достигли отсека 7. Выученные формы повторяются каждые 60 дней.',
  search: 'Найти в отсеке глагол или значение', allTenses: 'Все времена', readyOnly: 'Только готовые', close: 'Закрыть отсек', practice: 'Тренировать этот отсек', empty: 'Этот отсек пока пуст.', noResults: 'Нет глаголов для этой выборки.',
  newForm: 'Ещё не отработано', dueNow: 'Можно повторить сейчас', lastAnswer: 'Последняя тренировка', tries: 'Попыток: {count}', correct: 'Правильно: {count}',
  partlyAhead: 'Некоторые времена уже продвинулись дальше', remove: 'Убрать из копилки глаголов', retained: 'При удалении прогресс сохраняется',
}
const uk: Copy = {
  title: 'Твоя навчальна скринька дієслів', intro: 'Кожне дієслово має своє місце. Відсік визначає час із найменшим прогресом.',
  scope: 'Твій прогрес із дієсловами', progress: 'Середній прогрес форм', tap: 'Відкрий відсік, щоб побачити дієслова всередині.',
  names: ['Нові', 'Розпочаті', 'Знайомі', 'Закріплені', 'Впевненіше', 'Впевнено', 'Вивчені'],
  phase: 'Відсік {box}', learned: 'Вивчено', verbCount: 'Дієслів: {count}', verbCountOne: 'Дієслово: 1', formCount: 'Форм: {count}', dueVerbs: 'Готові: {count}', ahead: 'Із випереджальними часами: {count}', open: 'Відкрити: {name}',
  selected: 'Дієслів у скриньці', practiced: 'Уже відпрацьовані форми', learnedVerbs: 'Повністю вивчені дієслова', dueForms: 'Форми для повторення',
  formSummary: 'Вивчено форм: {learned} із {total} · ще не відпрацьовано: {fresh}', nextReview: 'Наступне заплановане повторення',
  initial: 'Нові або на повторенні', day: 'Інтервал: 1 день', days: 'Інтервал у днях: {days}', longTerm: 'Повторювати кожні 60 днів',
  guide: 'Як переміщуються дієслова', guideText: 'Präsens, Perfekt і Präteritum мають власний прогрес. Дієслово просувається, коли просуваються всі доступні часи. Нові часи починають із відсіку 1; попередній прогрес зберігається.',
  rules: 'Правильна відповідь на форму, термін якої настав, просуває її на один відсік. Раннє повторення закріплює форму без переходу. Помилка повертає цей час у відсік 1; повторити можна через 5 хвилин.',
  learnedRules: 'Дієслово повністю вивчене, коли всі доступні часи досягли відсіку 7. Вивчені форми повторюються кожні 60 днів.',
  search: 'Знайти у відсіку дієслово або значення', allTenses: 'Усі часи', readyOnly: 'Лише готові', close: 'Закрити відсік', practice: 'Тренувати цей відсік', empty: 'Цей відсік поки порожній.', noResults: 'Немає дієслів для цієї вибірки.',
  newForm: 'Ще не відпрацьовано', dueNow: 'Можна повторити зараз', lastAnswer: 'Останнє тренування', tries: 'Спроб: {count}', correct: 'Правильно: {count}',
  partlyAhead: 'Деякі часи вже просунулися далі', remove: 'Прибрати зі скриньки дієслів', retained: 'При видаленні прогрес зберігається',
}
const tr: Copy = {
  title: 'Fiil öğrenme kutun', intro: 'Her fiilin bir yeri var. Bölmeyi en az ilerlemiş zaman belirler.',
  scope: 'Fiil ilerlemen', progress: 'Biçimlerin ortalama ilerlemesi', tap: 'İçindeki fiilleri görmek için bir bölme aç.',
  names: ['Yeni', 'Başlangıç', 'Tanıdık', 'Pekişmiş', 'Daha güçlü', 'Güvenli', 'Öğrenildi'],
  phase: 'Bölme {box}', learned: 'Öğrenildi', verbCount: '{count} fiil', verbCountOne: '1 fiil', formCount: '{count} biçim', dueVerbs: '{count} hazır', ahead: '{count} fiilde ileride olan zamanlar', open: '{name} bölmesini aç',
  selected: 'Kutundaki fiiller', practiced: 'Çalışılmış biçimler', learnedVerbs: 'Tam öğrenilmiş fiiller', dueForms: 'Hazır biçimler',
  formSummary: '{total} biçimden {learned} öğrenildi · {fresh} henüz çalışılmadı', nextReview: 'Sonraki planlanmış tekrar',
  initial: 'Yeni veya tekrarda', day: '1 gün aralık', days: '{days} gün aralık', longTerm: 'Her 60 günde tekrar',
  guide: 'Fiiller nasıl ilerler?', guideText: 'Präsens, Perfekt ve Präteritum ayrı ilerlemeye sahiptir. Bir fiil, açık olan her zaman ilerlediğinde sonraki bölmeye geçer. Yeni zamanlar bölme 1’de başlar; önceki ilerlemen korunur.',
  rules: 'Zamanı gelmiş bir biçime doğru yanıt, onu bir bölme ilerletir. Erken tekrar bölme atlamadan pekiştirir. Yanlış yanıt o zamanı bölme 1’e geri getirir; 5 dakika sonra tekrar hazır olur.',
  learnedRules: 'Açık olan tüm zamanlar bölme 7’ye ulaştığında fiil tamamen öğrenilir. Öğrenilen biçimler her 60 günde tekrar edilir.',
  search: 'Bölmede fiil veya anlam ara', allTenses: 'Tüm zamanlar', readyOnly: 'Yalnızca hazır', close: 'Bölmeyi kapat', practice: 'Bu bölmeyi çalış', empty: 'Bu bölme henüz boş.', noResults: 'Bu seçim için fiil bulunamadı.',
  newForm: 'Henüz çalışılmadı', dueNow: 'Şimdi hazır', lastAnswer: 'Son çalışma', tries: '{count} deneme', correct: '{count} doğru',
  partlyAhead: 'Bazı zamanlar daha ileride', remove: 'Fiil kutusundan çıkar', retained: 'Fiili çıkardığında ilerleme korunur',
}

export function getSitovVerbBoxCopy(lang: string): Copy { return ({ de, en, ru, uk, tr })[toUiLocale(lang)] }
export function sitovVerbBoxText(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] == null ? match : String(values[key]))
}
