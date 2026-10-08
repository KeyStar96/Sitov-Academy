export type SitovLearningTargetError = 'unavailable' | 'retryable'
const sitovCopy = {
  de: { unavailable: 'Dieses Lernziel ist nicht verfügbar.', retryable: 'Das Lernziel konnte nicht geladen werden.', retry: 'Erneut versuchen', selected: 'Ausgewähltes Lernziel', practice: 'Dieses Verb im Präsens üben', noDue: 'Für dieses Verb ist im Präsens gerade keine Wiederholung fällig.' },
  en: { unavailable: 'This learning target is unavailable.', retryable: 'The learning target could not be loaded.', retry: 'Try again', selected: 'Selected learning target', practice: 'Practice this verb in the present tense', noDue: 'No present tense review is due for this verb right now.' },
  ru: { unavailable: 'Эта учебная цель недоступна.', retryable: 'Не удалось загрузить учебную цель.', retry: 'Повторить', selected: 'Выбранная учебная цель', practice: 'Тренировать этот глагол в настоящем времени', noDue: 'Повторение этого глагола в настоящем времени пока не требуется.' },
  uk: { unavailable: 'Ця навчальна ціль недоступна.', retryable: 'Не вдалося завантажити навчальну ціль.', retry: 'Спробувати знову', selected: 'Вибрана навчальна ціль', practice: 'Тренувати це дієслово в теперішньому часі', noDue: 'Повторення цього дієслова в теперішньому часі поки не потрібне.' },
  tr: { unavailable: 'Bu öğrenme hedefi kullanılamıyor.', retryable: 'Öğrenme hedefi yüklenemedi.', retry: 'Tekrar dene', selected: 'Seçilen öğrenme hedefi', practice: 'Bu fiili şimdiki zamanda çalış', noDue: 'Bu fiil için şu anda şimdiki zaman tekrarı gerekmiyor.' },
}
export function sitovLearningTargetCopy(lang?: string) { return sitovCopy[lang as keyof typeof sitovCopy] ?? sitovCopy.de }
