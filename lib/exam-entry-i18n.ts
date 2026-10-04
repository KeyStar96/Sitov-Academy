import { toUiLocale, type UiLocale } from '@/lib/locale-routing'

const de = {
  region: 'Prüfungen',
  simulation: 'Simulierte Prüfung',
  title: 'Wie gut bist du auf deine Prüfung vorbereitet?',
  referenceTitle: 'Bist du bereit für deine B1-Prüfung?',
  description: 'Niveau wählen. Lesen, Hören, Schreiben und Sprechen bearbeiten. Stärken und Fehler verstehen.',
  action: 'Prüfung simulieren',
  preparation: 'Prüfungsvorbereitung',
  preparationTitle: 'Schritt für Schritt üben',
  preparationDescription: 'Einzelne Bereiche trainieren und Rückmeldung erhalten.',
  preparationAction: 'Vorbereitung öffnen',
  reading: 'Lesen', listening: 'Hören', writing: 'Schreiben', speaking: 'Sprechen',
}
export type SitovExamEntryCopy = { [Key in keyof typeof de]: string }

export const SITOV_EXAM_ENTRY_COPY: Record<UiLocale, SitovExamEntryCopy> = {
  de,
  en: {
    region: 'Exams', simulation: 'Simulated exam',
    title: 'How ready are you for your exam?', referenceTitle: 'Are you ready for your B1 exam?',
    description: 'Choose your level. Work on reading, listening, writing and speaking. Understand your strengths and mistakes.',
    action: 'Simulate an exam', preparation: 'Exam preparation', preparationTitle: 'Practise step by step',
    preparationDescription: 'Train individual skills and get feedback.', preparationAction: 'Open preparation',
    reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking',
  },
  ru: {
    region: 'Экзамены', simulation: 'Пробный экзамен',
    title: 'Насколько ты готов к экзамену?', referenceTitle: 'Ты готов к экзамену B1?',
    description: 'Выбери уровень. Выполни задания по чтению, аудированию, письму и говорению. Разберись в своих сильных сторонах и ошибках.',
    action: 'Пройти пробный экзамен', preparation: 'Подготовка к экзамену', preparationTitle: 'Практикуйся шаг за шагом',
    preparationDescription: 'Тренируй отдельные навыки и получай обратную связь.', preparationAction: 'Открыть подготовку',
    reading: 'Чтение', listening: 'Аудирование', writing: 'Письмо', speaking: 'Говорение',
  },
  uk: {
    region: 'Іспити', simulation: 'Пробний іспит',
    title: 'Наскільки ти готовий до іспиту?', referenceTitle: 'Ти готовий до іспиту B1?',
    description: 'Обери рівень. Виконай завдання з читання, аудіювання, письма та говоріння. Зрозумій свої сильні сторони й помилки.',
    action: 'Пройти пробний іспит', preparation: 'Підготовка до іспиту', preparationTitle: 'Практикуйся крок за кроком',
    preparationDescription: 'Тренуй окремі навички та отримуй зворотний зв’язок.', preparationAction: 'Відкрити підготовку',
    reading: 'Читання', listening: 'Аудіювання', writing: 'Письмо', speaking: 'Говоріння',
  },
  tr: {
    region: 'Sınavlar', simulation: 'Deneme sınavı',
    title: 'Sınavına ne kadar hazırsın?', referenceTitle: 'B1 sınavına hazır mısın?',
    description: 'Seviyeni seç. Okuma, dinleme, yazma ve konuşma görevlerini tamamla. Güçlü yönlerini ve hatalarını anla.',
    action: 'Deneme sınavına gir', preparation: 'Sınav hazırlığı', preparationTitle: 'Adım adım çalış',
    preparationDescription: 'Becerilerini ayrı ayrı geliştir ve geri bildirim al.', preparationAction: 'Hazırlığı aç',
    reading: 'Okuma', listening: 'Dinleme', writing: 'Yazma', speaking: 'Konuşma',
  },
}

/** Entry cards describe the exam in the interface language; tasks stay German. */
export function getSitovExamEntryCopy(lang: string): SitovExamEntryCopy {
  return SITOV_EXAM_ENTRY_COPY[toUiLocale(lang)]
}
