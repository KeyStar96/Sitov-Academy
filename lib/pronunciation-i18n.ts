import pronunciationUpdates from '@/lib/pronunciation-translations.json'
import { createTranslator, type Translations, type Translator } from '@/lib/i18n-runtime'

/**
 * Zentrale Textbausteine für Aussprache-Training und Lehrer-Feedback.
 * Die Werte sind Notfall-Fallbacks; im Regelfall kommen die Texte aus
 * `dictionaries/*.json` (Key `pronunciation`).
 */
export const PRONUNCIATION_FALLBACKS = {
  title: 'Aussprache-Training',
  subtitle:
    'Wähle einen Übungssatz deines Niveaus, höre die Referenz und nimm dich selbst auf. Deine Lehrkraft gibt dir persönliches Feedback.',
  back_to_level: 'Zurück zur Übersicht',

  prompts_title: 'Übungssätze',
  prompts_hint: 'Tippe einen Satz an, höre ihn dir an und sprich ihn nach.',
  prompts_empty: 'Für dieses Niveau sind gerade keine Übungssätze hinterlegt.',
  prompts_empty_hint: 'Du kannst trotzdem frei aufnehmen. Deine Lehrkraft hört sich deine Aufnahme an.',
  prompt_focus: 'Schwerpunkt: {focus}',
  reference_label: 'Referenzsatz',
  reference_listen: 'Satz anhören',
  reference_listen_aria: 'Den Übungssatz als Referenz anhören',
  reference_speaking: 'Wird vorgelesen …',

  record_title: 'Deine Aussprache üben',
  record_hint: 'Nimm dich selbst auf, höre es dir an und reiche es zur Korrektur ein.',
  start_recording: 'Aufnahme starten',
  record_again: 'Neu aufnehmen',
  stop_recording: 'Aufnahme stoppen',
  recording_running: 'Aufnahme läuft',
  requesting_mic: 'Bitte erlaube den Zugriff auf das Mikrofon.',
  delete_recording: 'Aufnahme verwerfen',
  delete_recording_aria: 'Diese Aufnahme verwerfen und neu beginnen',

  play: 'Anhören',
  play_aria: 'Aufnahme anhören',
  pause: 'Pause',
  pause_aria: 'Wiedergabe anhalten',
  speed_label: 'Tempo {speed}',
  speed_aria: 'Wiedergabe-Tempo umschalten, aktuell {speed}',
  waveform_aria: 'Tonspur der Aufnahme. Tippe auf eine Stelle, um dorthin zu springen.',
  waveform_live_aria: 'Tonspur der laufenden Aufnahme',

  submit_for_review: 'Zur Korrektur einreichen',
  submitting: 'Wird eingereicht …',
  submitted: 'Erfolgreich abgegeben!',
  submitted_hint: 'Deine Lehrkraft hört sich die Aufnahme an und antwortet dir hier.',

  mic_denied: 'Der Zugriff auf das Mikrofon wurde nicht erlaubt. Du kannst ihn in den Browser-Einstellungen freigeben.',
  mic_unsupported: 'Dieser Browser kann leider keine Aufnahmen machen. Bitte nutze Chrome, Safari oder Firefox.',
  record_failed: 'Die Aufnahme hat nicht funktioniert. Bitte versuche es noch einmal.',
  upload_failed: 'Die Aufnahme konnte gerade nicht hochgeladen werden. Das lag nicht an dir – bitte versuche es erneut.',
  audio_unavailable: 'Diese Aufnahme kann gerade nicht abgespielt werden.',
  audio_loading: 'Audio wird geladen …',
  audio_retry: 'Erneut versuchen',
  audio_format_unsupported:
    'Dieses Audioformat kann dein Browser leider nicht abspielen. Bitte öffne die Seite in Chrome oder aktualisiere deinen Browser.',

  history_title: 'Deine bisherigen Einreichungen',
  history_empty: 'Du hast noch keine Aufnahme eingereicht.',
  history_empty_hint: 'Beginne oben mit deiner ersten Aufnahme – sie muss nicht perfekt sein.',
  your_recording: 'Deine Aufnahme',
  status_pending: 'In Bearbeitung',
  status_reviewed: 'Feedback erhalten',
  attempt_label: '{attempt}. Versuch',
  new_badge: 'Neu',

  teacher_feedback: 'Feedback deiner Lehrkraft',
  voice_message: 'Sprachnachricht',
  previous_attempt: 'Vorheriger Versuch',
  resubmit_hint: 'Möchtest du es mit dem Feedback noch einmal versuchen?',
  resubmit_button: 'Neue Aufnahme machen',
  resubmit_cancel: 'Abbrechen',

  notification_title: 'Du hast eine neue Sprachnachricht erhalten',
  notification_text_one:
    'Deine Lehrkraft hat dir Feedback zu deiner Aufnahme im Niveau {level} hinterlegt.',
  notification_text_many: 'Deine Lehrkraft hat dir {count} neue Rückmeldungen hinterlegt.',
  notification_cta: 'Feedback anhören',

  loading: 'Deine Einreichungen werden geladen …',
  error_title: 'Das Aussprache-Training konnte leider nicht geladen werden.',
  error_description: 'Das lag nicht an dir. Versuche es bitte noch einmal.',
  error_retry: 'Nochmal versuchen',
  ...pronunciationUpdates.de,
} as const

export type PronunciationTranslationKey = Extract<keyof typeof PRONUNCIATION_FALLBACKS, string>

export type PronunciationTranslations = Translations

export type PronunciationTranslator = Translator<PronunciationTranslationKey>

export function getPronunciationTranslations(lang: string, translations: PronunciationTranslations = {}): PronunciationTranslations {
  const key = lang in pronunciationUpdates ? lang as keyof typeof pronunciationUpdates : 'de'
  return { ...translations, ...pronunciationUpdates[key] }
}

export function createPronunciationTranslator(
  translations: PronunciationTranslations
): PronunciationTranslator {
  return createTranslator(PRONUNCIATION_FALLBACKS, translations)
}
