import 'server-only'
import { z } from 'zod'
import type { requestSession } from '@/lib/request-session'
import { hasTrainerAccess, isAccessLevel, type LevelAccessProfile } from '@/lib/access/levels'
import { hasSitovCommercialItemAccess } from '@/lib/access/sitov-commercial'
import type { SitovVerbTrainerState } from '@/lib/verbs/contracts'
import type { SitovLearningTargetError } from './sitov-learning-target-i18n'

export type SitovVocabularyTarget = { cardId: string; lesson: string }
export type SitovTargetResult<T> = { target: T; error?: never } | { target?: never; error: SitovLearningTargetError }
/** Authenticated RLS read of the exact canonical parent; opening never writes. */
export async function resolveSitovVocabularyTarget(raw: string | string[] | undefined, level: string,
  session: Awaited<ReturnType<typeof requestSession>>, profile: LevelAccessProfile | null): Promise<SitovTargetResult<SitovVocabularyTarget> | null> {
  if (raw === undefined) return null
  if (!z.string().uuid().safeParse(raw).success || !isAccessLevel(level) || !session.user || !profile || !hasTrainerAccess(profile, level, 'vocabulary')) return { error: 'unavailable' }
  try {
    const { data, error } = await session.supabase.from('learning_vocabulary_cards')
      .select('id,unit:learning_units!inner(id,level,label,is_active,owner_auth_user_id)')
      .eq('id', raw as string).eq('unit.level', level).eq('unit.is_active', true).maybeSingle()
    if (error) return { error: 'retryable' }
    if (!data || data.id !== raw || data.unit.level !== level || !data.unit.is_active || !data.unit.label) return { error: 'unavailable' }
    const allowed = hasSitovCommercialItemAccess({ ...profile, user_id: session.user.id,
      vip_enabled: profile.vip_enabled ?? false, purchased_levels: (profile.purchased_levels ?? []).filter(isAccessLevel),
      trial: profile.trial ?? { version: 1, rules: [] }, revision: 0 }, {
      kind: 'vocabulary_card', id: data.id, unit_id: data.unit.id, level, trainer: 'vocabulary', published: true,
      owner_user_id: data.unit.owner_auth_user_id,
    })
    return allowed ? { target: { cardId: data.id, lesson: data.unit.label } } : { error: 'unavailable' }
  } catch { return { error: 'retryable' } }
}
/** Every returned verb is authorized by the action; never consult a static pool. */
export function resolveSitovVerbTarget(raw: string | string[] | undefined, tense: string | string[] | undefined,
  state: SitovVerbTrainerState): SitovTargetResult<string> | null {
  if (raw === undefined) return null
  if (typeof raw !== 'string' || !raw || raw.length > 160 || tense !== 'present' || !state.tenses.includes('present')) return { error: 'unavailable' }
  const verb = state.verbs.find(item => item.id === raw)
  return verb ? { target: verb.id } : { error: 'unavailable' }
}
