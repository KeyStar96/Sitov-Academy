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
      supabase.from('profiles').select('role,native_language,ui_language,level_access:student_level_access(level)').eq('id', userId).single(),
      supabase.from('learning_trainer_grants').select('level,trainer,enabled,unit_mode,units:learning_unit_grants(unit_id)').eq('auth_user_id', userId),
    ])
    if (error || rules.error || !data) {
      console.error(`Zugriffsprofil für Nutzer ${userId} nicht ladbar:`, error?.code ?? rules.error?.code)
      return null
    }
    return { role: data.role, native_language: data.native_language, ui_language: data.ui_language,
      allowed_levels: data.level_access.map(item => item.level),
      trainer_grants: (rules.data ?? []).map(rule => ({ level: rule.level, trainer: rule.trainer,
        enabled: rule.enabled, unit_ids: rule.unit_mode === 'all' ? null : rule.units.map(item => item.unit_id) })) }
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
