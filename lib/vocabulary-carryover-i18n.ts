const messages = {
  de: {
    title: 'Aus früheren Niveaus', count: '{count} offene Wörter', countOne: '1 offenes Wort', empty: 'In früheren Niveaus sind keine begonnenen, offenen Wörter verfügbar.',
    hint: 'Du lernst diese Wörter im bisherigen Fach weiter. Pausierte Lektionen bleiben pausiert.',
    on: 'In deiner Lernbox', off: 'Nicht in deiner Lernbox', switch: 'Wörter aus früheren Niveaus mitnehmen',
    question: '{count} offene Wörter aus {levels} mitnehmen?', questionOne: '1 offenes Wort aus {levels} mitnehmen?', decline: 'Nein, danke', accept: 'Mitnehmen',
    error: 'Die Entscheidung konnte nicht gespeichert werden. Bitte versuche es noch einmal.', retry: 'Erneut versuchen', loading: 'Lernrunde wird vorbereitet …',
    origin: 'Aus {level}', phase: 'Fach {phase}: {count} Wörter', phaseOne: 'Fach {phase}: 1 Wort', separate: 'Zusätzlich: {count} Wörter aus früheren Niveaus. Sie zählen nicht zum Fortschritt dieses Niveaus.', separateOne: 'Zusätzlich: 1 Wort aus einem früheren Niveau. Es zählt nicht zum Fortschritt dieses Niveaus.',
  },
  en: {
    title: 'From earlier levels', count: '{count} words still to learn', countOne: '1 word still to learn', empty: 'There are no unfinished words you have started in earlier levels.',
    hint: 'Continue learning these words in their current box. Paused lessons stay paused.',
    on: 'In your learning box', off: 'Not in your learning box', switch: 'Include words from earlier levels',
    question: 'Bring along {count} unfinished words from {levels}?', questionOne: 'Bring along 1 unfinished word from {levels}?', decline: 'No, thanks', accept: 'Bring along',
    error: 'Your choice could not be saved. Please try again.', retry: 'Try again', loading: 'Preparing your learning round …',
    origin: 'From {level}', phase: 'Box {phase}: {count} words', phaseOne: 'Box {phase}: 1 word', separate: 'Also included: {count} words from earlier levels. They do not count towards this level’s progress.', separateOne: 'Also included: 1 word from an earlier level. It does not count towards this level’s progress.',
  },
  ru: {
    title: 'Из предыдущих уровней', count: 'Слов осталось: {count}', countOne: 'Осталось 1 слово', empty: 'В предыдущих уровнях нет начатых слов, которые ещё нужно выучить.',
    hint: 'Продолжайте учить эти слова в прежних ячейках. Приостановленные уроки остаются на паузе.',
    on: 'В вашей учебной картотеке', off: 'Не в вашей учебной картотеке', switch: 'Добавить слова из предыдущих уровней',
    question: 'Слов из {levels} осталось: {count}. Взять их с собой?', questionOne: 'Взять с собой 1 неизученное слово из {levels}?', decline: 'Нет, спасибо', accept: 'Взять с собой',
    error: 'Не удалось сохранить ваш выбор. Попробуйте ещё раз.', retry: 'Попробовать снова', loading: 'Подготавливаем учебный раунд …',
    origin: 'Из {level}', phase: 'Ячейка {phase} · слов: {count}', phaseOne: 'Ячейка {phase}: 1 слово', separate: 'Слов из предыдущих уровней: {count}. Они не учитываются в прогрессе этого уровня.', separateOne: 'Дополнительно: 1 слово из предыдущего уровня. Оно не учитывается в прогрессе этого уровня.',
  },
  uk: {
    title: 'З попередніх рівнів', count: 'Залишилося слів: {count}', countOne: 'Залишилося 1 слово', empty: 'У попередніх рівнях немає розпочатих слів, які ще потрібно вивчити.',
    hint: 'Продовжуйте вчити ці слова в тих самих комірках. Призупинені уроки залишаються на паузі.',
    on: 'У вашій навчальній картотеці', off: 'Не у вашій навчальній картотеці', switch: 'Додати слова з попередніх рівнів',
    question: 'Залишилося слів із {levels}: {count}. Взяти їх із собою?', questionOne: 'Взяти із собою 1 невивчене слово з {levels}?', decline: 'Ні, дякую', accept: 'Взяти із собою',
    error: 'Не вдалося зберегти ваш вибір. Спробуйте ще раз.', retry: 'Спробувати знову', loading: 'Готуємо навчальний раунд …',
    origin: 'З {level}', phase: 'Комірка {phase} · слів: {count}', phaseOne: 'Комірка {phase}: 1 слово', separate: 'Слів із попередніх рівнів: {count}. Вони не враховуються в прогресі цього рівня.', separateOne: 'Додатково: 1 слово з попереднього рівня. Воно не враховується в прогресі цього рівня.',
  },
  tr: {
    title: 'Önceki seviyelerden', count: 'Öğrenilecek {count} kelime', countOne: 'Öğrenilecek 1 kelime', empty: 'Önceki seviyelerde çalışmaya başladığınız, öğrenilmemiş kelime yok.',
    hint: 'Bu kelimeleri mevcut kutularında öğrenmeye devam edersiniz. Duraklatılan dersler duraklatılmış kalır.',
    on: 'Öğrenme kutunuzda', off: 'Öğrenme kutunuzda değil', switch: 'Önceki seviyelerden kelimeleri ekle',
    question: '{levels} seviyesinden öğrenilmemiş {count} kelimeyi yanınıza almak ister misiniz?', questionOne: '{levels} seviyesinden öğrenilmemiş 1 kelimeyi yanınıza almak ister misiniz?', decline: 'Hayır, teşekkürler', accept: 'Yanıma al',
    error: 'Seçiminiz kaydedilemedi. Lütfen tekrar deneyin.', retry: 'Tekrar dene', loading: 'Çalışma turu hazırlanıyor …',
    origin: '{level} seviyesinden', phase: 'Kutu {phase}: {count} kelime', phaseOne: 'Kutu {phase}: 1 kelime', separate: 'Ek olarak: önceki seviyelerden {count} kelime. Bunlar bu seviyenin ilerlemesine dahil edilmez.', separateOne: 'Ek olarak: önceki seviyeden 1 kelime. Bu kelime bu seviyenin ilerlemesine dahil edilmez.',
  },
} as const

export const VOCABULARY_CARRYOVER_MESSAGES = messages
export function carryoverTranslator(lang: string) {
  const dictionary = messages[lang as keyof typeof messages] ?? messages.de
  return (key: keyof typeof messages.de, values: Record<string, string | number> = {}) => {
    const singular = `${key}One` as keyof typeof messages.de
    const template = values.count === 1 && singular in dictionary ? dictionary[singular] : dictionary[key]
    return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template as string)
  }
}
