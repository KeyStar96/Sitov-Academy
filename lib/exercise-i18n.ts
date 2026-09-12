import { createTranslator, type Translations, type Translator } from '@/lib/i18n-runtime'

/**
 * Zentrale Textbausteine des Übungsmoduls. Die Werte hier sind ausschließlich
 * Notfall-Fallbacks: Im Regelfall kommen die Texte aus den Dictionaries unter
 * `dictionaries/*.json` (Key `exercises`). So bleibt die UI selbst frei von
 * fest codierten Strings.
 */
export const EXERCISE_FALLBACKS = {
  no_exercises: 'Aktuell sind keine Übungen verfügbar.',
  no_exercises_hint: 'Deine Lehrerin stellt hier bald neue Aufgaben für dich ein.',
  great: 'Großartig!',
  all_completed: 'Du hast alle Übungen für heute abgeschlossen.',
  exercise: 'Übung',
  of: 'von',
  progress_label: 'Übung {current} von {total}',
  tip_mother_tongue: 'Tipp für deine Muttersprache',
  correct_well_done: 'Richtig! Gut gemacht.',
  check_answer: 'Antwort prüfen',
  next_exercise: 'Nächste Übung',
  back_to_dashboard: 'Zurück zum Dashboard',
  back_to_level: 'Zurück zur Übersicht',
  title: 'Interaktive Übungen',
  subtitle: 'Trainiere Grammatik und Wortschatz gezielt.',
  completed_count: 'Abgeschlossen',
  choose_word: 'Wähle das passende Wort',
  choose_word_aria: 'Wort „{word}" auswählen',
  chip_wrong_aria: '„{word}" passt hier nicht',
  blank_label: 'Lücke',
  clear_selection: 'Auswahl aufheben',
  try_again: 'Fast! Versuche es noch einmal.',
  try_again_detail: 'Das ausgeschlossene Wort ist ausgegraut – wähle ein anderes.',
  hint_title: 'Kleiner Hinweis',
  hint_gender: 'Das gesuchte Wort gehört zum Artikel „{article}".',
  hint_noun: 'Gesucht ist ein Nomen mit {length} Buchstaben.',
  hint_verb: 'Gesucht ist eine Verbform mit {length} Buchstaben. Achte auf die Person.',
  hint_first_letter: 'Das Wort beginnt mit „{letter}" und hat {length} Buchstaben.',
  listen_word: 'Wort anhören',
  listen_word_aria: 'Das Wort „{word}" anhören',
  listen_sentence: 'Ganzen Satz anhören',
  listen_sentence_aria: 'Den ganzen Satz langsam anhören',
  audio_unavailable: 'Die Audio-Wiedergabe wird von diesem Gerät nicht unterstützt.',
  loading: 'Die Übungen werden geladen …',
  error_title: 'Diese Übungen konnten leider nicht geladen werden.',
  error_description: 'Das lag nicht an dir. Versuche es bitte noch einmal.',
  error_retry: 'Nochmal versuchen',
  your_answer_label: 'Deine Eingabe:',
  alternative_answer_hint: 'Richtig! Oft wird hierfür auch diese Form verwendet:',
} as const

export type ExerciseTranslationKey = Extract<keyof typeof EXERCISE_FALLBACKS, string>

export type ExerciseTranslations = Translations

export type ExerciseTranslator = Translator<ExerciseTranslationKey>

export function createExerciseTranslator(translations: ExerciseTranslations): ExerciseTranslator {
  return createTranslator(EXERCISE_FALLBACKS, translations)
}
