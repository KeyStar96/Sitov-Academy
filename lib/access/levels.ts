/**
 * Zentrale Zugriffssteuerung für Sprachniveaus.
 *
 * Rechtemodell (seit Ablösung von Free/Premium):
 * - Jeder Nutzer kann sich registrieren/anmelden.
 * - Zugriff auf gebührenpflichtige Sprachniveaus wird pro Nutzer explizit über
 *   `profiles.allowed_levels` (feingranular, z. B. `"A1.1"`) freigeschaltet.
 * - Pro Niveau können Trainer durch `student_trainer_access` gesperrt werden.
 *   Ohne Override gilt die bestehende Niveau-Freigabe für alle vier Trainer.
 * - Ein frisch registrierter Nutzer hat ein leeres Array → kein Zugriff.
 * - Admins und Lehrer (role `admin`/`teacher`) haben unabhängig davon Vollzugriff.
 *
 * Diese Datei ist bewusst frei von Server-/Client-spezifischen Imports, damit
 * sie in Server Components, Server Actions, Middleware-Helfern und Client
 * Components gleichermaßen genutzt werden kann.
 */

/**
 * Alle feingranularen Sprachniveaus, die als Route (`/dashboard/level/<id>`)
 * und im Dashboard existieren. Quelle der Wahrheit für Freigabe-UI und Guards.
 */
export const ACCESS_LEVELS = [
  'A1.1',
  'A1.2',
  'A2.1',
  'A2.2',
  'B1.1',
  'B1.2',
] as const

export type AccessLevel = (typeof ACCESS_LEVELS)[number]

/** Rollen mit uneingeschränktem Zugriff auf alle Niveaus. */
const FULL_ACCESS_ROLES: ReadonlySet<string> = new Set(['admin', 'teacher'])

/** Prüft, ob ein Wert ein bekanntes, verwaltbares Sprachniveau ist. */
export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === 'string' && (ACCESS_LEVELS as readonly string[]).includes(value)
}

/**
 * Nur bekannte, eindeutige Niveaus zulassen – schützt die Freigabe-Action vor
 * beliebigen Client-Eingaben.
 */
export function sanitizeAllowedLevels(input: readonly unknown[] | null | undefined): AccessLevel[] {
  if (!input) return []
  const seen = new Set<AccessLevel>()
  for (const value of input) {
    if (isAccessLevel(value)) seen.add(value)
  }
  // Stabile Reihenfolge gemäß ACCESS_LEVELS.
  return ACCESS_LEVELS.filter(level => seen.has(level))
}

/** Minimale Profilform, die für die Zugriffsentscheidung nötig ist. */
export interface LevelAccessProfile {
  role: string | null
  native_language?: string | null
  ui_language?: string | null
  allowed_levels: string[] | null
  student_trainer_access?: readonly TrainerAccessRule[] | null
}

/**
 * Kernentscheidung: Darf dieses Profil auf das (feingranulare) Niveau zugreifen?
 * Admin/Teacher immer, sonst nur bei expliziter Freigabe.
 */
export function hasLevelAccess(
  profile: LevelAccessProfile | null | undefined,
  level: string
): boolean {
  if (!profile) return false
  if (profile.role && FULL_ACCESS_ROLES.has(profile.role)) return true
  const normalized = level.trim()
  return (profile.allowed_levels ?? []).includes(normalized)
}

/** Ob eine Rolle grundsätzlich Vollzugriff besitzt (z. B. für UI-Hinweise). */
export function hasFullAccessRole(role: string | null | undefined): boolean {
  return !!role && FULL_ACCESS_ROLES.has(role)
}

/** Missing overrides preserve the existing whole-level entitlement. */
export const TRAINERS = ['vocabulary', 'exercises', 'pronunciation', 'videos'] as const
export type Trainer = (typeof TRAINERS)[number]
export interface TrainerAccessRule { level: string; trainer: string; enabled: boolean; allowed_lessons?: string[] | null }

/** Configuration shown to teachers is independent from a student's interface choice. */
export function hasConfiguredTrainerAccess(profile: LevelAccessProfile | null | undefined, level: string, trainer: Trainer): boolean {
  if (!hasLevelAccess(profile, level)) return false
  if (hasFullAccessRole(profile?.role)) return true
  return profile?.student_trainer_access?.find(rule => rule.level === level.trim() && rule.trainer === trainer)?.enabled ?? true
}

export function hasTrainerAccess(profile: LevelAccessProfile | null | undefined, level: string, trainer: Trainer): boolean {
  if (hasFullAccessRole(profile?.role)) return true
  if (profile?.ui_language === 'de' || !hasConfiguredTrainerAccess(profile, level, trainer)) return false
  const restriction = profile?.student_trainer_access?.find(rule => rule.level === level.trim() && rule.trainer === trainer)?.allowed_lessons
  return trainer === 'videos' || restriction == null || restriction.length > 0
}

export function getAllowedLessons(profile: LevelAccessProfile | null | undefined, level: string, trainer: Trainer): string[] | null {
  if (!hasTrainerAccess(profile, level, trainer)) return []
  if (hasFullAccessRole(profile?.role)) return null // null means all lessons are allowed
  const rule = profile?.student_trainer_access?.find(rule => rule.level === level.trim() && rule.trainer === trainer)
  if (!rule || rule.allowed_lessons == null) return null
  return rule.allowed_lessons
}

export function hasUnitAccess(profile: LevelAccessProfile | null | undefined, level: string, trainer: Trainer, unit: string): boolean {
  const allowed = getAllowedLessons(profile, level, trainer)
  return allowed === null || allowed.includes(unit)
}
