import { toUiLocale } from './locale-routing'

const sitovTrainerUi = {
  de: { practice: 'Jetzt üben', settings: 'Trainer-Einstellungen', help: 'So funktioniert die Lernbox', progress: 'Lernfortschritt' },
  en: { practice: 'Practise now', settings: 'Trainer settings', help: 'How the learning box works', progress: 'Learning progress' },
  ru: { practice: 'Начать тренировку', settings: 'Настройки тренажёров', help: 'Как работает копилка', progress: 'Прогресс обучения' },
  uk: { practice: 'Почати тренування', settings: 'Налаштування тренажерів', help: 'Як працює скарбничка', progress: 'Прогрес навчання' },
  tr: { practice: 'Şimdi çalış', settings: 'Alıştırma ayarları', help: 'Öğrenme kutusu nasıl çalışır', progress: 'Öğrenme ilerlemesi' },
} as const

export function sitovTrainerUiCopy(lang: string) { return sitovTrainerUi[toUiLocale(lang)] }
