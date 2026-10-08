import { toUiLocale } from './locale-routing'

const sitovHelpCopy = {
  de: { label: 'Hilfe', vocabulary: 'Dein Vokabel-Lernkasten', verbs: 'Dein Verb-Lernkasten' },
  en: { label: 'Help', vocabulary: 'Your vocabulary learning box', verbs: 'Your verb learning box' },
  ru: { label: 'Помощь', vocabulary: 'Твоя копилка слов', verbs: 'Твоя копилка глаголов' },
  uk: { label: 'Допомога', vocabulary: 'Твоя скарбничка слів', verbs: 'Твоя скарбничка дієслів' },
  tr: { label: 'Yardım', vocabulary: 'Kelime öğrenme kutun', verbs: 'Fiil öğrenme kutun' },
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
