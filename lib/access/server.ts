import 'server-only'

import { createClient } from '@/utils/supabase/server'
import {
  hasLevelAccess, hasTrainerAccess, type Trainer,
  type LevelAccessProfile,
} from '@/lib/access/levels'

/**
 * Serverseitige Zugriffshilfen für Sprachniveaus.
 *
 * Bewusst getrennt von `lib/access/levels.ts` (reine Logik ohne Imports),
 * damit die Kernlogik auch im Client nutzbar bleibt.
 */

/** Lädt die für die Zugriffsentscheidung nötigen Profilfelder. */
export async function loadLevelAccessProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<LevelAccessProfile | null> {
  try {
    const [{ data, error }, rules] = await Promise.all([
      supabase.from('profile_details').select('role, native_language, ui_language, allowed_levels').eq('id', userId).single(),
      supabase.from('student_trainer_access').select('level,trainer,enabled,allowed_lessons').eq('user_id', userId),
    ])

    if (error || rules.error) {
      console.error(`Zugriffsprofil für Nutzer ${userId} nicht ladbar:`, error?.code ?? rules.error?.code)
      return null
    }

    if (!data) return null
    return { ...data, student_trainer_access: (rules.data ?? []).flatMap(rule =>
      rule.level && rule.trainer && typeof rule.enabled === 'boolean'
        ? [{ level: rule.level, trainer: rule.trainer, enabled: rule.enabled, allowed_lessons: rule.allowed_lessons }] : []) }
  } catch (err) {
    console.error('Unerwarteter Fehler beim Laden des Zugriffsprofils:', err)
    return null
  }
}

/**
 * Prüft anhand der aktuellen Session, ob auf ein Niveau zugegriffen werden darf.
 * Fehlt die Anmeldung oder die Freigabe, ist das Ergebnis `false`.
 * Wird als Defense-in-Depth in level-bezogenen Server Actions genutzt, ergänzend
 * zum Route-Guard im Layout.
 */
export async function currentUserHasLevelAccess(level: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    const profile = await loadLevelAccessProfile(supabase, user.id)
    return hasLevelAccess(profile, level)
  } catch (err) {
    console.error('Unerwarteter Fehler bei der Niveau-Zugriffsprüfung:', err)
    return false
  }
}

export async function currentUserHasTrainerAccess(level: string, trainer: Trainer): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return !!user && hasTrainerAccess(await loadLevelAccessProfile(supabase, user.id), level, trainer)
  } catch (error) {
    console.error('Trainer access check failed:', error)
    return false
  }
}
