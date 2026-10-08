import { toUiLocale, type UiLocale } from '@/lib/locale-routing'

const de = {
  title: 'Trainer', hint: 'Lernrunden und Audio', device: 'Auf diesem Gerät',
  vocabulary: 'Vokabeln', roundSize: 'Karten pro Runde', all: 'Alle',
  studyMode: 'Antworten auf Deutsch', flashcard: 'Aufdecken', typed: 'Ausschreiben',
  audio: 'Audio', speed: 'Tempo', automatic: 'Automatisch nach Niveau',
  applied: 'Übernommen',
}

export type SitovTrainerSettingsCopy = { [Key in keyof typeof de]: string }

export const SITOV_TRAINER_SETTINGS_COPY: Record<UiLocale, SitovTrainerSettingsCopy> = {
  de,
  en: {
    title: 'Trainers', hint: 'Learning rounds and audio', device: 'On this device',
    vocabulary: 'Vocabulary', roundSize: 'Cards per round', all: 'All',
    studyMode: 'Answers in German', flashcard: 'Reveal', typed: 'Type the answer',
    audio: 'Audio', speed: 'Speed', automatic: 'Automatic by level',
    applied: 'Applied',
  },
  ru: {
    title: 'Тренажёры', hint: 'Учебные раунды и аудио', device: 'На этом устройстве',
    vocabulary: 'Слова', roundSize: 'Карточек за раунд', all: 'Все',
    studyMode: 'Ответы на немецком', flashcard: 'Открывать ответ', typed: 'Вводить ответ',
    audio: 'Аудио', speed: 'Темп', automatic: 'Автоматически по уровню',
    applied: 'Применено',
  },
  uk: {
    title: 'Тренажери', hint: 'Навчальні раунди й аудіо', device: 'На цьому пристрої',
    vocabulary: 'Слова', roundSize: 'Карток за раунд', all: 'Усі',
    studyMode: 'Відповіді німецькою', flashcard: 'Відкривати відповідь', typed: 'Вводити відповідь',
    audio: 'Аудіо', speed: 'Темп', automatic: 'Автоматично за рівнем',
    applied: 'Застосовано',
  },
  tr: {
    title: 'Alıştırmalar', hint: 'Çalışma turları ve ses', device: 'Bu cihazda',
    vocabulary: 'Kelimeler', roundSize: 'Tur başına kart', all: 'Tümü',
    studyMode: 'Almanca yanıtlar', flashcard: 'Yanıtı aç', typed: 'Yanıtı yaz',
    audio: 'Ses', speed: 'Hız', automatic: 'Seviyeye göre otomatik',
    applied: 'Uygulandı',
  },
}

export function getSitovTrainerSettingsCopy(lang: string): SitovTrainerSettingsCopy {
  return SITOV_TRAINER_SETTINGS_COPY[toUiLocale(lang)]
}
