import { toUiLocale } from './locale-routing'
const de = {
  title: 'Lernanalyse', intro: 'Leitner-Verteilung und dokumentierte Lernaktivität je Schüler und Kursniveau.',
  student: 'Schüler', unknown: 'Schüler ohne Namen', course: 'Kurs', allCourses: 'Alle Lernniveaus', manage: 'Kurse & Ausfälle verwalten',
  empty: 'Noch keine Schüler vorhanden.', loading: 'Lernanalyse wird geladen …', failed: 'Die Lernanalyse konnte nicht geladen werden.', retry: 'Erneut laden',
  phases: 'Leitner-Phasen 1–7', phaseHint: 'Pro Wort zählt die niedrigste Phase beider Abfragerichtungen. Phase 7 bedeutet: in beiden Richtungen gelernt. Der Balken zeigt den gewichteten Vokabelfortschritt.',
  scope: 'Die Auswertung umfasst das Lernniveau des Kurses. Kurse desselben Niveaus teilen diesen Lernstand.', noLevel: 'Diesem Kurs ist kein eindeutiges Lernniveau zugeordnet.',
  completion: 'Abgeschlossene Lerninhalte', history: 'Lernverlauf · letzte 30 Tage', historyHint: 'Tatsächlich gespeicherte Vokabelantworten je Tag (Europe/Berlin). Grammatikversuche und gelöschte Lernstände sind hier nicht enthalten.',
  noHistory: 'In diesem Zeitraum sind keine Vokabelantworten gespeichert.', answers: 'Antworten', correct: 'Richtig beantwortet', date: 'Datum', table: 'Tageswerte anzeigen',
}
type Copy = typeof de
const en: Copy = {
  title: 'Learning analytics', intro: 'Leitner distribution and recorded learning activity by student and course level.',
  student: 'Student', unknown: 'Student without a name', course: 'Course', allCourses: 'All learning levels', manage: 'Manage courses & cancellations',
  empty: 'No students yet.', loading: 'Loading learning analytics …', failed: 'Learning analytics could not be loaded.', retry: 'Try again',
  phases: 'Leitner phases 1–7', phaseHint: 'Each word uses the lower phase of its two directions. Phase 7 means learned in both directions. The bar shows weighted vocabulary progress.',
  scope: 'This view covers the course’s learning level. Courses at the same level share this learning progress.', noLevel: 'This course has no exact learning level assigned.',
  completion: 'Completed learning content', history: 'Learning history · last 30 days', historyHint: 'Actual saved vocabulary answers per day (Europe/Berlin). Grammar attempts and deleted learning progress are not included.',
  noHistory: 'No vocabulary answers are saved for this period.', answers: 'Answers', correct: 'Answered correctly', date: 'Date', table: 'Show daily values',
}
const ru: Copy = {
  title: 'Аналитика обучения', intro: 'Распределение по этапам Лейтнера и сохранённая активность ученика по уровню курса.',
  student: 'Ученик', unknown: 'Ученик без имени', course: 'Курс', allCourses: 'Все уровни обучения', manage: 'Курсы и отмены занятий',
  empty: 'Учеников пока нет.', loading: 'Загрузка аналитики …', failed: 'Не удалось загрузить аналитику.', retry: 'Повторить',
  phases: 'Этапы Лейтнера 1–7', phaseHint: 'Для каждого слова показан меньший этап из двух направлений. Этап 7 означает, что слово выучено в обоих направлениях. Полоса показывает взвешенный прогресс по словам.',
  scope: 'Показаны результаты по уровню курса. Курсы одного уровня используют общий прогресс.', noLevel: 'Для этого курса не задан конкретный уровень обучения.',
  completion: 'Завершённые учебные материалы', history: 'История обучения · последние 30 дней', historyHint: 'Сохранённые ответы по словам за каждый день (Europe/Berlin). Попытки по грамматике и удалённый прогресс не включены.',
  noHistory: 'За этот период нет сохранённых ответов по словам.', answers: 'Ответы', correct: 'Верные ответы', date: 'Дата', table: 'Показать данные по дням',
}
const uk: Copy = {
  title: 'Аналітика навчання', intro: 'Розподіл за етапами Лейтнера та збережена активність учня за рівнем курсу.',
  student: 'Учень', unknown: 'Учень без імені', course: 'Курс', allCourses: 'Усі рівні навчання', manage: 'Курси та скасування занять',
  empty: 'Учнів поки немає.', loading: 'Завантаження аналітики …', failed: 'Не вдалося завантажити аналітику.', retry: 'Спробувати знову',
  phases: 'Етапи Лейтнера 1–7', phaseHint: 'Для кожного слова показано нижчий етап із двох напрямків. Етап 7 означає, що слово вивчено в обох напрямках. Смужка показує зважений прогрес зі слів.',
  scope: 'Показано результати за рівнем курсу. Курси одного рівня використовують спільний прогрес.', noLevel: 'Цьому курсу не призначено конкретний рівень навчання.',
  completion: 'Завершені навчальні матеріали', history: 'Історія навчання · останні 30 днів', historyHint: 'Збережені відповіді зі слів за кожен день (Europe/Berlin). Спроби з граматики та видалений прогрес не включено.',
  noHistory: 'За цей період немає збережених відповідей зі слів.', answers: 'Відповіді', correct: 'Правильні відповіді', date: 'Дата', table: 'Показати дані за днями',
}
const tr: Copy = {
  title: 'Öğrenme analizi', intro: 'Öğrenciye ve kurs seviyesine göre Leitner dağılımı ve kayıtlı öğrenme etkinliği.',
  student: 'Öğrenci', unknown: 'İsimsiz öğrenci', course: 'Kurs', allCourses: 'Tüm öğrenme seviyeleri', manage: 'Kursları ve ders iptallerini yönet',
  empty: 'Henüz öğrenci yok.', loading: 'Öğrenme analizi yükleniyor …', failed: 'Öğrenme analizi yüklenemedi.', retry: 'Tekrar dene',
  phases: 'Leitner aşamaları 1–7', phaseHint: 'Her kelime için iki yönden düşük olan aşama gösterilir. Aşama 7, kelimenin iki yönde de öğrenildiğini belirtir. Çubuk ağırlıklı kelime ilerlemesini gösterir.',
  scope: 'Bu görünüm kursun öğrenme seviyesini kapsar. Aynı seviyedeki kurslar bu ilerlemeyi paylaşır.', noLevel: 'Bu kursa belirli bir öğrenme seviyesi atanmamış.',
  completion: 'Tamamlanan öğrenme içeriği', history: 'Öğrenme geçmişi · son 30 gün', historyHint: 'Günlük kaydedilmiş kelime yanıtları (Europe/Berlin). Dil bilgisi denemeleri ve silinen ilerleme dahil değildir.',
  noHistory: 'Bu dönem için kayıtlı kelime yanıtı yok.', answers: 'Yanıtlar', correct: 'Doğru yanıtlanan', date: 'Tarih', table: 'Günlük değerleri göster',
}
export function teacherAnalyticsCopy(lang: string): Copy { return { de, en, ru, uk, tr }[toUiLocale(lang)] }
