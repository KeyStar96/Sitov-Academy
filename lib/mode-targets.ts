import type { Trainer } from '@/lib/access/levels'

/**
 * Die vier gleichberechtigten Modi eines Niveaus (D6) und ihre Ziele.
 *
 * Das ist die **einzige** Stelle mit den Routen der Modi: Modus-Dock,
 * Modus-Karten, Brotkrumen, Home und „Weiter, wo du aufgehört hast" lesen
 * sie von hier. Der Lernpfad liegt unter `path`; `exercises` bleibt als
 * Weiterleitung und Alias für alte Lesezeichen erhalten.
 */
export const LEARNING_MODES = ['vocabulary', 'path', 'pronunciation', 'media'] as const
export type LearningMode = (typeof LEARNING_MODES)[number]

export const MODE_SEGMENTS: Record<LearningMode, string> = {
  vocabulary: 'vocabulary',
  path: 'path',
  pronunciation: 'pronunciation',
  media: 'videos',
}

/** Weitere Routen, die zu einem Modus gehören (alte Lesezeichen, Weiterleitungen). */
const MODE_ALIASES: Record<string, LearningMode> = {
  exercises: 'path',
  media: 'media',
}

/** Der Trainer, dessen Freischaltung einen Modus öffnet. */
export const MODE_TRAINERS: Record<LearningMode, Trainer> = {
  vocabulary: 'vocabulary',
  path: 'exercises',
  pronunciation: 'pronunciation',
  media: 'videos',
}

/** Modus der Lernhandlung aus `get_last_active_level()` (Trainer-Namen der Datenbank). */
export function modeFromActivity(value: string | null | undefined): LearningMode | null {
  switch (value) {
    case 'vocabulary': return 'vocabulary'
    case 'exercises': case 'path': return 'path'
    case 'pronunciation': return 'pronunciation'
    case 'videos': case 'media': return 'media'
    default: return null
  }
}

export function levelHref(lang: string, level: string): string {
  return `/${lang}/dashboard/level/${encodeURIComponent(level)}`
}

export function modeHref(lang: string, level: string, mode: LearningMode): string {
  return `${levelHref(lang, level)}/${MODE_SEGMENTS[mode]}`
}

/** Unterseite „Lektionen" im Modus Vokabeln (bis Phase 2 auf der Niveau-Seite). */
export function lessonsHref(lang: string, level: string): string {
  return `${modeHref(lang, level, 'vocabulary')}/lessons`
}

/** Der Modus, in dem ein Pfad liegt; `null` auf der Niveau-Übersicht und außerhalb eines Niveaus. */
export function modeFromPathname(pathname: string): LearningMode | null {
  const segment = pathname.match(/\/dashboard\/level\/[^/]+\/([^/?#]+)/)?.[1]
  if (!segment) return null
  return LEARNING_MODES.find(mode => MODE_SEGMENTS[mode] === segment) ?? MODE_ALIASES[segment] ?? null
}
