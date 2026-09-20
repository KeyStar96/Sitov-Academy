import { toUiLocale, type UiLocale } from '@/lib/locale-routing'

const de = {
  title: 'Mein Kurskalender', intro: 'Deine gebuchten Kurse und Ausfälle im laufenden und kommenden Monat.',
  timezone: 'Alle Uhrzeiten: Europe/Berlin', months: 'Kalendermonat auswählen', days: 'Tag auswählen',
  all: 'Alle Termine des Monats', empty: 'Keine gebuchten Termine in diesem Monat.', emptyDay: 'Keine Termine an diesem Tag.',
  cancelled: 'Fällt aus', pending: 'Bestätigung ausstehend', trial: 'Probestunde', appointments: 'Termine',
  unscheduled: 'Termin nach Vereinbarung', unresolved: 'Deine Buchungen konnten deinem Konto noch nicht eindeutig zugeordnet werden.',
  failed: 'Der Kurskalender konnte nicht geladen werden.', retry: 'Erneut laden', loading: 'Kalender wird aktualisiert …',
}
type CalendarMessages = { [Key in keyof typeof de]: string }
export const PROFILE_CALENDAR_MESSAGES: Record<UiLocale, CalendarMessages> = {
  de,
  en: {
    title: 'My course calendar', intro: 'Your booked courses and cancellations for this month and next month.',
    timezone: 'All times: Europe/Berlin', months: 'Choose calendar month', days: 'Choose a day',
    all: 'All appointments this month', empty: 'No booked appointments this month.', emptyDay: 'No appointments on this day.',
    cancelled: 'Cancelled', pending: 'Awaiting confirmation', trial: 'Trial lesson', appointments: 'Appointments',
    unscheduled: 'Time to be arranged', unresolved: 'Your bookings could not yet be uniquely linked to your account.',
    failed: 'The course calendar could not be loaded.', retry: 'Try again', loading: 'Updating calendar …',
  },
  ru: {
    title: 'Мой календарь занятий', intro: 'Ваши забронированные занятия и отмены на текущий и следующий месяц.',
    timezone: 'Время указано для Europe/Berlin', months: 'Выбрать месяц', days: 'Выбрать день',
    all: 'Все занятия за месяц', empty: 'В этом месяце нет забронированных занятий.', emptyDay: 'В этот день занятий нет.',
    cancelled: 'Занятие отменено', pending: 'Ожидает подтверждения', trial: 'Пробное занятие', appointments: 'Занятия',
    unscheduled: 'Время по договорённости', unresolved: 'Пока не удалось однозначно связать ваши бронирования с аккаунтом.',
    failed: 'Не удалось загрузить календарь занятий.', retry: 'Повторить', loading: 'Обновление календаря …',
  },
  uk: {
    title: 'Мій календар занять', intro: 'Ваші заброньовані заняття та скасування на поточний і наступний місяць.',
    timezone: 'Час указано для Europe/Berlin', months: 'Вибрати місяць', days: 'Вибрати день',
    all: 'Усі заняття за місяць', empty: 'Цього місяця немає заброньованих занять.', emptyDay: 'Цього дня занять немає.',
    cancelled: 'Заняття скасовано', pending: 'Очікує підтвердження', trial: 'Пробне заняття', appointments: 'Заняття',
    unscheduled: 'Час за домовленістю', unresolved: 'Поки не вдалося однозначно пов’язати ваші бронювання з обліковим записом.',
    failed: 'Не вдалося завантажити календар занять.', retry: 'Спробувати ще раз', loading: 'Оновлення календаря …',
  },
  tr: {
    title: 'Kurs takvimim', intro: 'Bu ay ve gelecek ay için kayıtlı olduğunuz dersler ve iptaller.',
    timezone: 'Tüm saatler: Europe/Berlin', months: 'Takvim ayını seçin', days: 'Gün seçin',
    all: 'Ayın tüm dersleri', empty: 'Bu ay için kayıtlı ders yok.', emptyDay: 'Bu gün ders yok.',
    cancelled: 'İptal edildi', pending: 'Onay bekleniyor', trial: 'Deneme dersi', appointments: 'Dersler',
    unscheduled: 'Saat ayrıca belirlenecek', unresolved: 'Kayıtlarınız henüz hesabınızla kesin olarak eşleştirilemedi.',
    failed: 'Kurs takvimi yüklenemedi.', retry: 'Tekrar dene', loading: 'Takvim güncelleniyor …',
  },
}
export const profileCalendarMessages = (lang: string) => PROFILE_CALENDAR_MESSAGES[toUiLocale(lang)]
