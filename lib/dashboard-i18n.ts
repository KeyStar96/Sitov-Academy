import { createTranslator, type Translations, type Translator } from '@/lib/i18n-runtime'

/**
 * Texte der Lernplattform-Hülle: Header, Niveau-Übersicht, Kacheln.
 * Fallbacks nur als Sicherheitsnetz – die Oberfläche liest die Dictionaries.
 */
export const DASHBOARD_FALLBACKS = {
  trainer_locked_title: 'Dieser Trainer ist noch gesperrt.',
  trainer_locked_text: 'Deine Lehrkraft kann diesen Trainer für {level} freischalten.',
  trainer_locked_badge: 'Gesperrt',
  back_to_level: 'Zur Niveau-Übersicht',
  title_before: 'Wähle dein',
  title_highlight: 'Sprachniveau',
  subtitle: 'Womit möchtest du heute starten?',
  continue_learning: 'Weiterlernen',
  start: 'Starten',
  finished: 'erledigt',
  hello: 'Hallo, {name}',
  logout: 'Abmelden',
  logout_aria: 'Abmelden',
  toggle_theme: 'Darstellung wechseln',
  toggle_theme_light: 'Helles Design aktivieren',
  toggle_theme_dark: 'Dunkles Design aktivieren',
  nav_dashboard: 'Übersicht',
  nav_profile: 'Profil',
  nav_exercises: 'Übungen',
  nav_vocabulary: 'Vokabeln',
  nav_videos: 'Videos',
  nav_pronunciation: 'Aussprache',
  nav_train: 'Lernen',
  nav_assess: 'Einstufen',
  nav_lessons: 'Lektionen',
  nav_path: 'Lernpfad',
  nav_path_n: 'Pfad {n}',
  nav_node: 'Knoten',
  nav_test: 'Test',
  nav_home: 'Start',
  nav_media: 'Mediathek',
  nav_calendar: 'Kalender',
  nav_back: 'Zurück',
  nav_back_aria: 'Eine Seite zurück',
  open_profile: 'Profil',
  open_profile_aria: 'Profil öffnen',
  level_heading: 'Niveau {level}',
  level_subtitle: 'Wähle einen Lernbereich aus, um fortzufahren.',
  cat_videos_title: 'Lernvideos',
  cat_videos_desc: 'Schau dir Erklärvideos zu Grammatik und Vokabeln an.',
  cat_vocabulary_title: 'Vokabeltrainer',
  cat_vocabulary_desc: 'Lerne und wiederhole wichtige Wörter für dieses Niveau.',
  cat_exercises_title: 'Grammatikübungen',
  cat_exercises_desc: 'Festige dein Wissen mit Lückentexten und Multiple Choice.',
  cat_pronunciation_title: 'Aussprache-Training',
  cat_pronunciation_desc: 'Nimm deine Stimme auf und erhalte Feedback von deiner Lehrkraft.',
  back_to_dashboard: 'Zurück zur Übersicht',
  // Zugriffssteuerung: gesperrte Sprachniveaus
  level_locked_badge: 'Gesperrt',
  level_locked_title: 'Dieses Sprachniveau ist noch nicht freigeschaltet',
  level_locked_text:
    'Dein Zugang zu Niveau {level} wurde noch nicht freigegeben. Bitte wende dich an deine Lehrkraft, damit dieses Niveau für dich freigeschaltet wird.',
  level_locked_hint: 'Zum Freischalten bitte an die Lehrkraft wenden.',
} as const

export type DashboardTranslationKey = Extract<keyof typeof DASHBOARD_FALLBACKS, string>

export type DashboardTranslations = Translations

export type DashboardTranslator = Translator<DashboardTranslationKey>

export function createDashboardTranslator(translations: DashboardTranslations): DashboardTranslator {
  return createTranslator(DASHBOARD_FALLBACKS, translations)
}

/**
 * Beschriftung je Pfadsegment für die Brotkrumen (D7). Der Lernpfad liegt bis
 * Phase 3 unter `exercises` und heißt schon jetzt wie im Modus-Dock. Phase 3
 * ergänzt `path/<n>/<knoten>/test`: Pfad n (`nav_path_n`), Knoten, Test.
 */
export const DASHBOARD_ROUTE_KEYS = {
  dashboard: 'nav_home',
  profile: 'nav_profile',
  exercises: 'nav_path',
  path: 'nav_path',
  node: 'nav_node',
  test: 'nav_test',
  vocabulary: 'nav_vocabulary',
  videos: 'nav_media',
  media: 'nav_media',
  calendar: 'nav_calendar',
  pronunciation: 'nav_pronunciation',
  train: 'nav_train',
  assess: 'nav_assess',
  lessons: 'nav_lessons',
} as const

export type DashboardRouteSegment = keyof typeof DASHBOARD_ROUTE_KEYS
