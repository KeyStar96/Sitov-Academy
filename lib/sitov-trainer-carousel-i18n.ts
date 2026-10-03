import { toUiLocale } from '@/lib/locale-routing'
import type { LearningMode } from '@/lib/mode-targets'

interface SitovCarouselCopy {
  previous: string
  next: string
  choose: string
  show: string
  position: string
  hint: string
  carousel: string
  slide: string
  descriptions: Record<LearningMode, string>
}

const sitovCopy: Record<ReturnType<typeof toUiLocale>, SitovCarouselCopy> = {
  de: {
    previous: 'Vorheriger Trainer', next: 'Nächster Trainer', choose: 'Trainer auswählen', show: '{trainer} anzeigen',
    position: '{trainer}, {current} von {total}', hint: 'Wischen, entdecken, loslernen.', carousel: 'Karussell', slide: 'Trainer',
    descriptions: { vocabulary: 'Wörter, die im Alltag bleiben.', verbs: 'Verbformen werden vertraut.', path: 'Schritt für Schritt weiterkommen.', pronunciation: 'Deine Stimme. Dein Deutsch.', media: 'Deutsch hören, sehen und erleben.' },
  },
  en: {
    previous: 'Previous trainer', next: 'Next trainer', choose: 'Choose a trainer', show: 'Show {trainer}',
    position: '{trainer}, {current} of {total}', hint: 'Swipe, discover, start learning.', carousel: 'Carousel', slide: 'Trainer',
    descriptions: { vocabulary: 'Words that stay with you.', verbs: 'Make verb forms your own.', path: 'Move forward, step by step.', pronunciation: 'Your voice. Your German.', media: 'Hear, see and experience German.' },
  },
  ru: {
    previous: 'Предыдущий тренажёр', next: 'Следующий тренажёр', choose: 'Выбрать тренажёр', show: 'Показать: {trainer}',
    position: '{trainer}, {current} из {total}', hint: 'Листай, открывай, учись.', carousel: 'Карусель', slide: 'Тренажёр',
    descriptions: { vocabulary: 'Слова, которые остаются с тобой.', verbs: 'Формы глаголов становятся привычными.', path: 'Шаг за шагом вперёд.', pronunciation: 'Твой голос. Твой немецкий.', media: 'Смотри, слушай и открывай немецкий.' },
  },
  uk: {
    previous: 'Попередній тренажер', next: 'Наступний тренажер', choose: 'Вибрати тренажер', show: 'Показати: {trainer}',
    position: '{trainer}, {current} із {total}', hint: 'Гортай, відкривай, навчайся.', carousel: 'Карусель', slide: 'Тренажер',
    descriptions: { vocabulary: 'Слова, які залишаються з тобою.', verbs: 'Форми дієслів стають звичними.', path: 'Крок за кроком уперед.', pronunciation: 'Твій голос. Твоя німецька.', media: 'Дивись, слухай та відкривай німецьку.' },
  },
  tr: {
    previous: 'Önceki çalışma alanı', next: 'Sonraki çalışma alanı', choose: 'Çalışma alanı seç', show: '{trainer} göster',
    position: '{trainer}, {total} alandan {current}.', hint: 'Kaydır, keşfet, öğrenmeye başla.', carousel: 'Karusel', slide: 'Çalışma alanı',
    descriptions: { vocabulary: 'Seninle kalan kelimeler.', verbs: 'Fiil biçimlerini benimse.', path: 'Adım adım ilerle.', pronunciation: 'Senin sesin. Senin Almancan.', media: 'Almancayı dinle, gör ve yaşa.' },
  },
}

export function getSitovTrainerCarouselCopy(lang: string): SitovCarouselCopy {
  return sitovCopy[toUiLocale(lang)]
}
