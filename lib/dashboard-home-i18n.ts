import { toUiLocale, type UiLocale } from '@/lib/locale-routing'
import { interpolate, type TranslationVariables } from '@/lib/i18n-runtime'

/**
 * Texte der neuen Start-Übersicht (Bento-Grid) für Schüler:innen.
 *
 * Bewusst als eigenständige Nachrichten-Map je Sprache – wie
 * `profile-calendar-i18n.ts`. So bleiben die fünf großen Dictionaries
 * strukturgleich (Parity-Test) und die neuen Widget-Texte an einem Ort.
 */
const de = {
  greeting_morning: 'Guten Morgen, {name}!',
  greeting_afternoon: 'Schön, dass du da bist, {name}!',
  greeting_evening: 'Guten Abend, {name}!',
  greeting_night: 'Schön, dass du da bist, {name}!',
  greeting_sub: 'Ein Wort, ein Satz, ein kleiner Fortschritt – mach heute den nächsten Schritt.',
  clock_aria: 'Aktuelle Uhrzeit',

  next_course_title: 'Dein nächster Kurs',
  next_course_none: 'Aktuell sind keine Kurstermine geplant.',
  next_course_today: 'Heute um {time} Uhr',
  next_course_tomorrow: 'Morgen um {time} Uhr',
  next_course_when: 'Am {date} um {time} Uhr',
  next_course_pending: 'Bestätigung ausstehend',

  trainers_title: 'Meine Lern-Trainer',
  trainers_intro: 'Wähle einen Lernbereich für dein Niveau {level} und leg direkt los.',
  trainers_no_level: 'Deine Lehrkraft schaltet dein passendes Niveau in Kürze frei.',
  trainer_open: 'Öffnen',
  trainer_locked: 'Gesperrt',
  trainers_all: 'Alle Niveaus ansehen',

  support_title: 'Brauchst du Hilfe?',
  support_intro: 'Wir sind für dich da. Melde dich einfach – wir helfen dir gern bei allen Fragen zur Plattform.',

  theme_title: 'Darstellung',
  theme_hint: 'Wechsle zwischen hellem und dunklem Design.',
}
export type DashboardHomeMessages = { [Key in keyof typeof de]: string }

export const DASHBOARD_HOME_MESSAGES: Record<UiLocale, DashboardHomeMessages> = {
  de,
  en: {
    greeting_morning: 'Good morning, {name}!',
    greeting_afternoon: 'Good to see you, {name}!',
    greeting_evening: 'Good evening, {name}!',
    greeting_night: 'Good to see you, {name}!',
    greeting_sub: 'One word, one sentence, one small step – take the next step today.',
    clock_aria: 'Current time',
    next_course_title: 'Your next course',
    next_course_none: 'No course dates are scheduled right now.',
    next_course_today: 'Today at {time}',
    next_course_tomorrow: 'Tomorrow at {time}',
    next_course_when: 'On {date} at {time}',
    next_course_pending: 'Awaiting confirmation',
    trainers_title: 'My learning trainers',
    trainers_intro: 'Pick a learning area for your level {level} and get started right away.',
    trainers_no_level: 'Your teacher will unlock the right level for you soon.',
    trainer_open: 'Open',
    trainer_locked: 'Locked',
    trainers_all: 'View all levels',
    support_title: 'Need help?',
    support_intro: 'We are here for you. Just reach out – we are happy to help with any questions about the platform.',
    theme_title: 'Appearance',
    theme_hint: 'Switch between the light and dark design.',
  },
  ru: {
    greeting_morning: 'Доброе утро, {name}!',
    greeting_afternoon: 'Рады видеть вас, {name}!',
    greeting_evening: 'Добрый вечер, {name}!',
    greeting_night: 'Рады видеть вас, {name}!',
    greeting_sub: 'Одно слово, одна фраза, маленький шаг — сделайте следующий шаг сегодня.',
    clock_aria: 'Текущее время',
    next_course_title: 'Ваше ближайшее занятие',
    next_course_none: 'Сейчас нет запланированных занятий.',
    next_course_today: 'Сегодня в {time}',
    next_course_tomorrow: 'Завтра в {time}',
    next_course_when: '{date} в {time}',
    next_course_pending: 'Ожидает подтверждения',
    trainers_title: 'Мои тренажёры',
    trainers_intro: 'Выберите раздел для вашего уровня {level} и начните заниматься.',
    trainers_no_level: 'Преподаватель скоро откроет вам нужный уровень.',
    trainer_open: 'Открыть',
    trainer_locked: 'Закрыто',
    trainers_all: 'Все уровни',
    support_title: 'Нужна помощь?',
    support_intro: 'Мы рядом. Просто напишите нам — с радостью поможем с любыми вопросами о платформе.',
    theme_title: 'Оформление',
    theme_hint: 'Переключайте светлое и тёмное оформление.',
  },
  uk: {
    greeting_morning: 'Доброго ранку, {name}!',
    greeting_afternoon: 'Раді бачити вас, {name}!',
    greeting_evening: 'Доброго вечора, {name}!',
    greeting_night: 'Раді бачити вас, {name}!',
    greeting_sub: 'Одне слово, одне речення, маленький крок — зробіть наступний крок сьогодні.',
    clock_aria: 'Поточний час',
    next_course_title: 'Ваше найближче заняття',
    next_course_none: 'Наразі немає запланованих занять.',
    next_course_today: 'Сьогодні о {time}',
    next_course_tomorrow: 'Завтра о {time}',
    next_course_when: '{date} о {time}',
    next_course_pending: 'Очікує підтвердження',
    trainers_title: 'Мої тренажери',
    trainers_intro: 'Оберіть напрям для вашого рівня {level} і почніть навчання.',
    trainers_no_level: 'Викладач невдовзі відкриє вам потрібний рівень.',
    trainer_open: 'Відкрити',
    trainer_locked: 'Закрито',
    trainers_all: 'Усі рівні',
    support_title: 'Потрібна допомога?',
    support_intro: 'Ми поруч. Просто напишіть нам — залюбки допоможемо з будь-якими питаннями щодо платформи.',
    theme_title: 'Оформлення',
    theme_hint: 'Перемикайте світле та темне оформлення.',
  },
  tr: {
    greeting_morning: 'Günaydın, {name}!',
    greeting_afternoon: 'Hoş geldin, {name}!',
    greeting_evening: 'İyi akşamlar, {name}!',
    greeting_night: 'Hoş geldin, {name}!',
    greeting_sub: 'Bir kelime, bir cümle, küçük bir adım – bugün bir sonraki adımı at.',
    clock_aria: 'Şu anki saat',
    next_course_title: 'Bir sonraki dersin',
    next_course_none: 'Şu anda planlanmış ders yok.',
    next_course_today: 'Bugün saat {time}',
    next_course_tomorrow: 'Yarın saat {time}',
    next_course_when: '{date} saat {time}',
    next_course_pending: 'Onay bekleniyor',
    trainers_title: 'Öğrenme araçlarım',
    trainers_intro: '{level} seviyen için bir öğrenme alanı seç ve hemen başla.',
    trainers_no_level: 'Öğretmenin uygun seviyeyi yakında senin için açacak.',
    trainer_open: 'Aç',
    trainer_locked: 'Kilitli',
    trainers_all: 'Tüm seviyeler',
    support_title: 'Yardım mı lazım?',
    support_intro: 'Buradayız. Bize ulaşman yeterli – platformla ilgili tüm sorularında yardımcı oluruz.',
    theme_title: 'Görünüm',
    theme_hint: 'Açık ve koyu tasarım arasında geçiş yap.',
  },
}

export function dashboardHomeMessages(lang: string): DashboardHomeMessages {
  return DASHBOARD_HOME_MESSAGES[toUiLocale(lang)]
}

/** Kleiner Helfer mit derselben Platzhalter-Syntax wie das Dictionary. */
export function dashboardHomeTranslator(lang: string) {
  const messages = dashboardHomeMessages(lang)
  return (key: keyof DashboardHomeMessages, variables?: TranslationVariables) =>
    interpolate(messages[key], variables)
}
