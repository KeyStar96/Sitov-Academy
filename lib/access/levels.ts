/**
 * Zentrale Zugriffssteuerung für Sprachniveaus.
 *
 * Rechtemodell (seit Ablösung von Free/Premium):
 * - Jeder Nutzer kann sich registrieren/anmelden.
 * - Zugriff auf gebührenpflichtige Sprachniveaus wird pro Nutzer explizit über
 *   `student_level_access` (feingranular, z. B. `"A1.1"`) freigeschaltet.
 * - Pro Niveau können Trainer durch `learning_trainer_grants` gesperrt werden.
 *   Ohne Override gilt die bestehende Niveau-Freigabe für alle fünf Trainer.
 * - Trainer-Niveaus sind unabhängig von Kursen und Kursanmeldungen.
 *   Ein gleichlautendes Kursniveau erzeugt oder entzieht keine Freigabe.
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
  'B2.1',
  'B2.2',
  'C1.1',
  'C1.2',
] as const

export type AccessLevel = (typeof ACCESS_LEVELS)[number]
/**
 * Niveaus in Vorbereitung: Sie existieren als Grundstruktur (inaktive Zeilen in `learning_levels`),
 * Lehrkräfte können Inhalte vorbereiten und Lernpfad-Seeds importieren. Für Lernende sind sie
 * unsichtbar und nicht freischaltbar, solange sie nicht in ACCESS_LEVELS stehen.
 * Freigabe eines Niveaus: hier nach ACCESS_LEVELS verschieben, in der Datenbank `is_active` setzen
 * und die Schüler-Niveaulisten der Zugriffsfunktionen erweitern (Vorlage: Migration 86).
 * B2.1, B2.2, C1.1 und C1.2 sind seit Migration 86 freigegeben; aktuell ist nichts in Vorbereitung.
 */
export const SITOV_UPCOMING_LEVELS = [] as const
/** Alle feingranularen Niveaus der Plattform in Lernreihenfolge: freigegebene, dann vorbereitete. */
export const SITOV_PLATFORM_LEVELS = [...ACCESS_LEVELS, ...SITOV_UPCOMING_LEVELS] as const
export type SitovPlatformLevel = (typeof SITOV_PLATFORM_LEVELS)[number]
/** Trainer grants only use the platform's sublevels; coarse levels belong to the exam catalogue. */
export const SITOV_VERB_LEVELS = ACCESS_LEVELS
export type SitovTrainerLevel = (typeof SITOV_VERB_LEVELS)[number]

/** Rollen mit uneingeschränktem Zugriff auf alle Niveaus. */
const FULL_ACCESS_ROLES: ReadonlySet<string> = new Set(['admin', 'teacher'])

/** Prüft, ob ein Wert ein bekanntes, verwaltbares Sprachniveau ist. */
export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === 'string' && (ACCESS_LEVELS as readonly string[]).includes(value)
}

/** Prüft, ob ein Wert ein Niveau der Plattform ist – freigegeben oder noch in Vorbereitung. */
export function isSitovPlatformLevel(value: unknown): value is SitovPlatformLevel {
  return typeof value === 'string' && (SITOV_PLATFORM_LEVELS as readonly string[]).includes(value)
}

/** Schlüssel in `dictionaries/*.json` → `dashboard` für Titel und Beschreibung: B2.1 → level_b21_title, level_b21_desc. */
export function sitovLevelCopyKeys(level: SitovPlatformLevel): readonly [title: string, description: string] {
  const key = level.replace('.', '').toLowerCase()
  return [`level_${key}_title`, `level_${key}_desc`]
}

/** Spanne der freigegebenen Niveaus als Kurzangabe über der Niveau-Übersicht: „A1—C1". */
export function sitovLevelRange(): string {
  return `${ACCESS_LEVELS[0].slice(0, 2)}—${ACCESS_LEVELS[ACCESS_LEVELS.length - 1].slice(0, 2)}`
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
  trainer_grants?: readonly TrainerAccessRule[] | null
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
  // Only released levels: a stored grant for a level in preparation or for a coarse
  // verb context (B2, C1) never opens student navigation.
  if (!isAccessLevel(normalized)) return false
  return (profile.allowed_levels ?? []).includes(normalized)
}

/** Ob eine Rolle grundsätzlich Vollzugriff besitzt (z. B. für UI-Hinweise). */
export function hasFullAccessRole(role: string | null | undefined): boolean {
  return !!role && FULL_ACCESS_ROLES.has(role)
}

/** Missing overrides preserve the existing whole-level entitlement. */
export const TRAINERS = ['vocabulary', 'exercises', 'pronunciation', 'videos', 'verbs'] as const
export type Trainer = (typeof TRAINERS)[number]
export interface TrainerAccessRule { level: string; trainer: string; enabled: boolean; unit_ids?: string[] | null }

/**
 * Trainer, die es auf einem Niveau nicht gibt. Ab C1 kommen keine neuen Verben mehr hinzu, deshalb
 * haben C1.1 und C1.2 keinen Verbtrainer: Er erscheint dort weder im Dock noch im Karussell noch in
 * den Freigaben, und die Datenbank (Migration 86) lässt ihn für diese Niveaus nicht zu.
 */
const SITOV_ABSENT_TRAINERS: Readonly<Record<string, readonly Trainer[]>> = { 'C1.1': ['verbs'], 'C1.2': ['verbs'] }

/** Ob es den Trainer auf dem Niveau überhaupt gibt – unabhängig von Rolle und Freigabe. */
export function sitovLevelHasTrainer(level: string, trainer: Trainer): boolean {
  const normalized = level.trim()
  return isAccessLevel(normalized) && !SITOV_ABSENT_TRAINERS[normalized]?.includes(trainer)
}

/** Die Trainer eines Niveaus in der festen Reihenfolge von TRAINERS. */
export function sitovLevelTrainers(level: string): Trainer[] {
  return TRAINERS.filter(trainer => sitovLevelHasTrainer(level, trainer))
}

/** Configuration shown to teachers is independent from a student's interface choice. */
export function hasConfiguredTrainerAccess(profile: LevelAccessProfile | null | undefined, level: string, trainer: Trainer): boolean {
  if (!profile || !sitovLevelHasTrainer(level, trainer)) return false
  if (hasFullAccessRole(profile.role)) return true
  if (!isAccessLevel(level.trim())) return false
  if (!hasLevelAccess(profile, level)) return false
  return profile?.trainer_grants?.find(rule => rule.level === level.trim() && rule.trainer === trainer)?.enabled ?? true
}

export function hasTrainerAccess(profile: LevelAccessProfile | null | undefined, level: string, trainer: Trainer): boolean {
  if (!sitovLevelHasTrainer(level, trainer)) return false
  if (hasFullAccessRole(profile?.role)) return true
  if ((trainer !== 'verbs' && profile?.ui_language === 'de') || !hasConfiguredTrainerAccess(profile, level, trainer)) return false
  const restriction = profile?.trainer_grants?.find(rule => rule.level === level.trim() && rule.trainer === trainer)?.unit_ids
  return trainer === 'videos' || restriction == null || restriction.length > 0
}

export function getAllowedLessons(profile: LevelAccessProfile | null | undefined, level: string, trainer: Trainer): string[] | null {
  if (!hasTrainerAccess(profile, level, trainer)) return []
  if (hasFullAccessRole(profile?.role)) return null // null means all lessons are allowed
  const rule = profile?.trainer_grants?.find(rule => rule.level === level.trim() && rule.trainer === trainer)
  if (!rule || rule.unit_ids == null) return null
  return rule.unit_ids
}

export function hasUnitAccess(profile: LevelAccessProfile | null | undefined, level: string, trainer: Trainer, unit: string): boolean {
  const allowed = getAllowedLessons(profile, level, trainer)
  return allowed === null || allowed.includes(unit)
}
