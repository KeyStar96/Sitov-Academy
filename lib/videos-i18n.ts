import { createTranslator, type Translations, type Translator } from '@/lib/i18n-runtime'

export const VIDEO_FALLBACKS = {
  watch_resource: "Lernressource öffnen",
  supplement_label: "Ergänzend zum Kurs",
  watch_youtube: "Auf YouTube ansehen",
  continue_vocabulary: "Vokabeln weiterlernen",
  external_privacy: "Externe Anbieter werden erst beim Öffnen eines Links aufgerufen. Hier werden keine externen Player oder Vorschaubilder geladen.",
  back_to_level: 'Zurück zur Übersicht',
  internal_title: 'Sitov Academy Lektionen',
  internal_subtitle: 'Unsere eigenen Video-Lektionen – passgenau zum Kurs.',
  coming_soon: 'Demnächst',
  empty_internal: 'Aktuell sind keine Videos verfügbar.',
  empty_internal_hint: 'Deine Lehrerin stellt hier bald neue Lernvideos für dich ein.',
  empty_external: 'Aktuell sind keine externen Videos hinterlegt.',
  external_title: 'Nicos Weg (Deutsche Welle)',
  external_badge: 'Externes Angebot',
  external_subtitle:
    'Die passende Ergänzung zum Kurs: ein interaktiver Videokurs der Deutschen Welle.',
  open_external_aria: '„{title}“ in einem neuen Fenster öffnen',
  loading: 'Das Video wird geladen …',
  not_found: 'Dieses Video konnte leider nicht gefunden werden.',
  in_preparation: 'In Vorbereitung',
  in_preparation_hint: 'Dieses Video wird bald veröffentlicht.',
  lesson_label: 'Lektion {lesson}',
  rewind_aria: '10 Sekunden zurück',
  forward_aria: '10 Sekunden vor',
  play_aria: 'Video abspielen',
  pause_aria: 'Video anhalten',
  speed_aria: 'Abspieltempo umschalten, aktuell {speed}',
  error_title: 'Die Videos konnten leider nicht geladen werden.',
  error_description: 'Das lag nicht an dir. Versuche es bitte noch einmal.',
  error_retry: 'Nochmal versuchen',
} as const

export type VideoTranslationKey = Extract<keyof typeof VIDEO_FALLBACKS, string>

export type VideoTranslations = Translations

export type VideoTranslator = Translator<VideoTranslationKey>

export function createVideoTranslator(translations: VideoTranslations): VideoTranslator {
  return createTranslator(VIDEO_FALLBACKS, translations)
}
