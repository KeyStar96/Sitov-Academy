import { toUiLocale, type UiLocale } from '@/lib/locale-routing'

const de = {
  vocabularyEyebrow: 'Deine Lernbox', vocabularyTitle: 'Deine Wörter. Dein Deutsch.', vocabularyEmpty: 'Wähle eine Lektion.',
  mediaEyebrow: 'Videos & Unterlagen',
  pathAction: 'Weiterlernen',
}
export type SitovTrainerHeroCopy = { [Key in keyof typeof de]: string }
const sitovTrainerHero: Record<UiLocale, SitovTrainerHeroCopy> = {
  de,
  en: { vocabularyEyebrow: 'Your learning box', vocabularyTitle: 'Your words. Your German.', vocabularyEmpty: 'Choose a lesson.', mediaEyebrow: 'Videos & materials', pathAction: 'Continue learning' },
  ru: { vocabularyEyebrow: 'Твоя учебная копилка', vocabularyTitle: 'Твои слова. Твой немецкий.', vocabularyEmpty: 'Выбери урок.', mediaEyebrow: 'Видео и материалы', pathAction: 'Продолжить обучение' },
  uk: { vocabularyEyebrow: 'Твоя навчальна скринька', vocabularyTitle: 'Твої слова. Твоя німецька.', vocabularyEmpty: 'Обери урок.', mediaEyebrow: 'Відео й матеріали', pathAction: 'Продовжити навчання' },
  tr: { vocabularyEyebrow: 'Öğrenme kutun', vocabularyTitle: 'Kelimelerin. Almancan.', vocabularyEmpty: 'Bir ders seç.', mediaEyebrow: 'Videolar ve materyaller', pathAction: 'Öğrenmeye devam et' },
}
export function sitovTrainerHeroCopy(lang: string): SitovTrainerHeroCopy { return sitovTrainerHero[toUiLocale(lang)] }
