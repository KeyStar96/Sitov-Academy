import { toUiLocale } from './locale-routing'

const sitovHelpCopy = {
  de: { label: 'Hilfe', vocabulary: 'Dein Vokabel-Lernkasten', verbs: 'Dein Verb-Lernkasten', pathTitle: 'Dein Lernpfad', pathBody: 'Öffne einen verfügbaren Abschnitt zum Üben. Setze einen begonnenen Durchgang fort. Im Test erhältst du das Ergebnis nach der Abgabe und kannst danach deine Antworten ansehen.', recordingTitle: 'Lesen und aufnehmen', recordingBody: 'Höre die Referenz und lies mit. Nimm deine Stimme auf, höre die Aufnahme an und sende sie an deine Lehrkraft. Die Antwort deiner Lehrkraft findest du im Postfach.' },
  en: { label: 'Help', vocabulary: 'Your vocabulary learning box', verbs: 'Your verb learning box', pathTitle: 'Your learning path', pathBody: 'Open an available section to practise. Continue an attempt you have already started. In a test, you receive the result after submitting and can then review your answers.', recordingTitle: 'Read and record', recordingBody: 'Listen to the reference and read along. Record your voice, listen to the recording and send it to your teacher. Your teacher’s reply appears in your inbox.' },
  ru: { label: 'Помощь', vocabulary: 'Твоя копилка слов', verbs: 'Твоя копилка глаголов', pathTitle: 'Твой учебный путь', pathBody: 'Открой доступный раздел для тренировки. Продолжи уже начатую попытку. В тесте результат появляется после отправки, затем можно посмотреть свои ответы.', recordingTitle: 'Чтение и запись', recordingBody: 'Слушай образец и читай вместе с ним. Запиши свой голос, прослушай запись и отправь её преподавателю. Ответ преподавателя появится в почтовом ящике.' },
  uk: { label: 'Допомога', vocabulary: 'Твоя скарбничка слів', verbs: 'Твоя скарбничка дієслів', pathTitle: 'Твій навчальний шлях', pathBody: 'Відкрий доступний розділ для тренування. Продовж уже розпочату спробу. У тесті результат з’являється після надсилання, потім можна переглянути свої відповіді.', recordingTitle: 'Читання та запис', recordingBody: 'Слухай зразок і читай разом із ним. Запиши свій голос, прослухай запис і надішли його викладачу. Відповідь викладача з’явиться в поштовій скриньці.' },
  tr: { label: 'Yardım', vocabulary: 'Kelime öğrenme kutun', verbs: 'Fiil öğrenme kutun', pathTitle: 'Öğrenme yolun', pathBody: 'Çalışmak için kullanılabilir bir bölümü aç. Başladığın denemeye devam et. Testte sonucu gönderdikten sonra alırsın ve ardından yanıtlarını inceleyebilirsin.', recordingTitle: 'Oku ve kaydet', recordingBody: 'Örneği dinle ve birlikte oku. Sesini kaydet, kaydı dinle ve öğretmenine gönder. Öğretmeninin yanıtı gelen kutunda görünür.' },
} as const

export function sitovTrainerHelpCopy(lang: string) { return sitovHelpCopy[toUiLocale(lang)] }

// The existing vocabulary caller supplies its translated disclosure title, not
// a locale. Keep that API until its owner can pass lang explicitly.
export function sitovVocabularyHelpCopy(title: string) {
  const titles = {
    de: ['Wie funktioniert dein Lernkasten?', 'So funktioniert die Lernbox'],
    en: ['How does your learning box work?', 'How the learning box works'],
    ru: ['Как работает твоя коробка для учёбы?', 'Как работает копилка'],
    uk: ['Як працює твоя коробка для навчання?', 'Як працює скарбничка'],
    tr: ['Öğrenme kutun nasıl çalışır?', 'Öğrenme kutusu nasıl çalışır'],
  }
  const locale = (Object.keys(titles) as Array<keyof typeof titles>).find(lang => titles[lang].includes(title)) ?? 'de'
  return sitovHelpCopy[locale]
}
