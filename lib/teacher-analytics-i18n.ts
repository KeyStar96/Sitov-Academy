import { toUiLocale } from './locale-routing'
const de = {
  title: 'Lernanalyse', intro: 'Tageswerte mit Prozent, Lernverlauf und Fortschritt je Lernmodus – für jede lernende Person und jedes unabhängig freigeschaltete Trainer-Niveau.',
  student: 'Schüler', unknown: 'Schüler ohne Namen', level: 'Trainer-Niveau', allLevels: 'Alle Lernniveaus',
  empty: 'Noch keine Schüler vorhanden.', loading: 'Lernanalyse wird geladen …', failed: 'Die Lernanalyse konnte nicht geladen werden.', retry: 'Erneut laden',
  scope: 'Die Auswertung zeigt ausschließlich das gewählte Trainer-Niveau. Kursanmeldungen und Kurszuordnungen sind davon unabhängig.',
  scopeAll: 'Tageswerte aller Niveaus; Gesamtstände beziehen sich auf die freigeschalteten Trainer-Niveaus.',
  openProfile: 'Schülerprofil öffnen',
}
type Copy = typeof de
const en: Copy = {
  title: 'Learning analytics', intro: 'Daily values with percentages, learning history and progress by learning mode – for every learner and every independently unlocked trainer level.',
  student: 'Student', unknown: 'Student without a name', level: 'Trainer level', allLevels: 'All learning levels',
  empty: 'No students yet.', loading: 'Loading learning analytics …', failed: 'Learning analytics could not be loaded.', retry: 'Try again',
  scope: 'This view covers only the selected trainer level. Course enrollments and course assignments are independent.',
  scopeAll: 'Daily values of all levels; totals refer to the unlocked trainer levels.',
  openProfile: 'Open student profile',
}
const ru: Copy = {
  title: 'Аналитика обучения', intro: 'Данные за день в процентах, история и прогресс по учебным режимам – для каждого ученика и каждого отдельно открытого уровня тренажёра.',
  student: 'Ученик', unknown: 'Ученик без имени', level: 'Уровень тренажёра', allLevels: 'Все уровни обучения',
  empty: 'Учеников пока нет.', loading: 'Загрузка аналитики …', failed: 'Не удалось загрузить аналитику.', retry: 'Повторить',
  scope: 'Показаны результаты только выбранного уровня тренажёра. Запись на курсы и назначение курсов независимы.',
  scopeAll: 'Данные за день по всем уровням; итоги относятся к открытым уровням тренажёра.',
  openProfile: 'Открыть профиль ученика',
}
const uk: Copy = {
  title: 'Аналітика навчання', intro: 'Дані за день у відсотках, історія та прогрес за навчальними режимами – для кожного учня й кожного окремо відкритого рівня тренажера.',
  student: 'Учень', unknown: 'Учень без імені', level: 'Рівень тренажера', allLevels: 'Усі рівні навчання',
  empty: 'Учнів поки немає.', loading: 'Завантаження аналітики …', failed: 'Не вдалося завантажити аналітику.', retry: 'Спробувати знову',
  scope: 'Показано результати лише вибраного рівня тренажера. Запис на курси та призначення курсів незалежні.',
  scopeAll: 'Дані за день з усіх рівнів; підсумки стосуються відкритих рівнів тренажера.',
  openProfile: 'Відкрити профіль учня',
}
const tr: Copy = {
  title: 'Öğrenme analizi', intro: 'Yüzdeli günlük değerler, öğrenme geçmişi ve öğrenme moduna göre ilerleme – her öğrenci ve bağımsız açılan her alıştırma seviyesi için.',
  student: 'Öğrenci', unknown: 'İsimsiz öğrenci', level: 'Alıştırma seviyesi', allLevels: 'Tüm öğrenme seviyeleri',
  empty: 'Henüz öğrenci yok.', loading: 'Öğrenme analizi yükleniyor …', failed: 'Öğrenme analizi yüklenemedi.', retry: 'Tekrar dene',
  scope: 'Bu görünüm yalnızca seçilen alıştırma seviyesini kapsar. Kurs kayıtları ve kurs atamaları bağımsızdır.',
  scopeAll: 'Tüm seviyelerin günlük değerleri; toplamlar açılmış alıştırma seviyelerine göredir.',
  openProfile: 'Öğrenci profilini aç',
}
export function teacherAnalyticsCopy(lang: string): Copy { return { de, en, ru, uk, tr }[toUiLocale(lang)] }
