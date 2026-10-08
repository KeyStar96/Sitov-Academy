import 'server-only'
import { cache } from 'react'

import { createClient } from '@/utils/supabase/server'
import { requireSitovStaffMfa } from '@/lib/sitov-staff-mfa'
import { z } from 'zod'
import { createAdminClient } from '@/utils/supabase/admin'
import { sitovTrialManifestSchema, SITOV_CONTENT_KINDS, type SitovContentRef } from './sitov-commercial'
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
export const loadLevelAccessProfile = cache(async function loadLevelAccessProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<LevelAccessProfile | null> {
  try {
    const [{ data, error }, rules, commercial] = await Promise.all([
      supabase.from('profiles').select('role,sitov_mfa_required,native_language,ui_language,level_access:student_level_access(level)').eq('id', userId).single(),
      supabase.from('learning_trainer_grants').select('level,trainer,enabled,unit_mode,units:learning_unit_grants(unit_id)').eq('auth_user_id', userId),
      supabase.rpc('get_sitov_access_context', { p_student: userId }),
    ])
    if (error || rules.error || commercial.error || !data) {
      console.error("Zugriffsprofil für Nutzer nicht ladbar:")
      return null
    }
    await requireSitovStaffMfa(supabase, data)
    const rights = z.object({ vip_enabled: z.boolean(), trial: sitovTrialManifestSchema,
      purchased_levels: z.array(z.string()), revision: z.number().int().nonnegative() }).parse(commercial.data)
    return { role: data.role, native_language: data.native_language, ui_language: data.ui_language,
      ...rights,
      allowed_levels: data.level_access.map(item => item.level),
      trainer_grants: (rules.data ?? []).map(rule => ({ level: rule.level, trainer: rule.trainer,
        enabled: rule.enabled, unit_ids: rule.unit_mode === 'all' ? null : rule.units.map(item => item.unit_id) })) }
  } catch (err) {
    console.error("Unerwarteter Fehler beim Laden des Zugriffsprofils:")
    return null
  }
})

/** Commercial predicate only; pronunciation callers must also enforce S3's current text pass. */
export async function currentUserHasContentAccess(ref: SitovContentRef): Promise<boolean> {
  try {
    if (!SITOV_CONTENT_KINDS.includes(ref.kind) || !ref.id || ref.id.length > 160) return false
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return false
    // Privileged lookup returns only canonical scope metadata, never text, solutions or media.
    const admin = createAdminClient()
    let scope: { level: string; trainer: string } | null = null
    if (ref.kind === 'presentation') {
      const { data } = await admin.from('lms_presentation_asset').select('folder:lms_media_folder!inner(level)').eq('asset_id', ref.id).maybeSingle()
      if (data) scope = { level: data.folder.level, trainer: 'videos' }
    } else {
      const table = { vocabulary_card: 'learning_vocabulary_cards', exercise: 'learning_exercises', reading_text: 'learning_reading_texts',
        video: 'learning_videos', verb: 'sitov_verb_catalog', path_node: 'path_nodes', path_task: 'learning_exercises',
        path_special: 'path_nodes', path_special_item: 'learning_exercises' } as const
      const { data } = await admin.from(table[ref.kind]).select('unit_id').eq('id', ref.id).maybeSingle()
      if (data) {
        const metadata = z.object({ unit_id: z.uuid() }).parse(data)
        const unit = await admin.from('learning_units').select('level,trainer').eq('id', metadata.unit_id).maybeSingle()
        if (unit.data) scope = { level: unit.data.level, trainer: unit.data.trainer }
      }
    }
    if (!scope) return false
    const result = await supabase.rpc('get_sitov_access_catalog', { p_level: scope.level, p_trainer: scope.trainer })
    if (result.error) return false
    const catalog = z.object({ units: z.array(z.object({ items: z.array(z.object({ kind: z.enum(SITOV_CONTENT_KINDS), id: z.string() })) })) }).parse(result.data)
    return catalog.units.some(unit => unit.items.some(item => item.kind === ref.kind && item.id === ref.id))
  } catch { return false }
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
    console.error("Unerwarteter Fehler bei der Niveau-Zugriffsprüfung:")
    return false
  }
}

export async function currentUserHasTrainerAccess(level: string, trainer: Trainer): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return !!user && hasTrainerAccess(await loadLevelAccessProfile(supabase, user.id), level, trainer)
  } catch (error) {
    console.error("Trainer access check failed:")
    return false
  }
}
