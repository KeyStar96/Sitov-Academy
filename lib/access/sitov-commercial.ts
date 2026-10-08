import { z } from 'zod'
import { ACCESS_LEVELS, TRAINERS, sitovLevelHasTrainer, type AccessLevel, type Trainer, type LevelAccessProfile } from './levels'

export const SITOV_CONTENT_KINDS = ['vocabulary_card', 'exercise', 'reading_text', 'video', 'verb', 'path_node', 'path_task', 'presentation'] as const
export type SitovContentKind = typeof SITOV_CONTENT_KINDS[number]
export interface SitovContentRef { kind: SitovContentKind; id: string }
const refSchema = z.object({ kind: z.enum(SITOV_CONTENT_KINDS), id: z.string().min(1).max(160) }).strict()
const unitItemsSchema = z.object({ unit_id: z.uuid(), refs: z.array(refSchema).max(1000).nullable() }).strict()
const ruleSchema = z.object({
  level: z.enum(ACCESS_LEVELS), trainer: z.enum(TRAINERS),
  unit_ids: z.array(z.uuid()).max(1000).nullable(),
  items: z.array(unitItemsSchema).max(1000).nullable(),
}).strict()
export const sitovTrialManifestSchema = z.object({ version: z.literal(1), rules: z.array(ruleSchema).max(50) }).strict()
  .superRefine((manifest, ctx) => {
    const scopes = new Set<string>()
    for (const [index, rule] of manifest.rules.entries()) {
      const key = `${rule.level}:${rule.trainer}`
      if (scopes.has(key) || !sitovLevelHasTrainer(rule.level, rule.trainer)) {
        ctx.addIssue({ code: 'custom', path: ['rules', index], message: 'invalid_scope' })
      }
      scopes.add(key)
      if (rule.unit_ids && new Set(rule.unit_ids).size !== rule.unit_ids.length) {
        ctx.addIssue({ code: 'custom', path: ['rules', index, 'unit_ids'], message: 'duplicate_unit' })
      }
      const units = new Set<string>()
      for (const unit of rule.items ?? []) {
        const refs = unit.refs?.map(ref => `${ref.kind}:${ref.id}`) ?? []
        if (units.has(unit.unit_id) || (rule.unit_ids !== null && !rule.unit_ids.includes(unit.unit_id))
          || new Set(refs).size !== refs.length) {
          ctx.addIssue({ code: 'custom', path: ['rules', index, 'items'], message: 'invalid_items' })
        }
        units.add(unit.unit_id)
      }
    }
  })
export type SitovTrialManifest = z.infer<typeof sitovTrialManifestSchema>
export interface SitovAccessContext extends LevelAccessProfile {
  user_id: string
  vip_enabled: boolean
  trial: SitovTrialManifest
  purchased_levels: readonly AccessLevel[]
  revision: number
}
/** Canonical DB metadata, never a caller-supplied authorization assertion. */
export interface SitovCanonicalItem extends SitovContentRef {
  level: AccessLevel
  trainer: Trainer
  unit_id: string | null
  published: boolean
  owner_user_id?: string | null
  legacy_level_media?: boolean
}

/** Pure UI projection. Server/RLS must independently use item_allowed on each request. */
export function hasSitovCommercialItemAccess(context: SitovAccessContext | null, item: SitovCanonicalItem): boolean {
  if (!context) return false
  if (item.owner_user_id && item.owner_user_id !== context.user_id) return false
  if (context.role === 'teacher' || context.role === 'admin') return true
  if (context.role !== 'student' || (!item.published && item.owner_user_id !== context.user_id)
    || !sitovLevelHasTrainer(item.level, item.trainer)) return false
  if (context.vip_enabled || context.purchased_levels.includes(item.level)) return true
  const legacyLevel = context.allowed_levels?.includes(item.level) ?? false
  const legacyRule = context.trainer_grants?.find(rule => rule.level === item.level && rule.trainer === item.trainer)
  if (legacyLevel && (item.legacy_level_media || (legacyRule?.enabled !== false
    && (item.owner_user_id === context.user_id || legacyRule?.unit_ids == null
      || (item.unit_id !== null && legacyRule.unit_ids.includes(item.unit_id)))))) return true
  // Trial never opens personal words, whole folders, or unmapped catalog objects.
  if (item.owner_user_id || item.unit_id === null) return false
  const rule = context.trial.rules.find(rule => rule.level === item.level && rule.trainer === item.trainer)
  if (!rule || (rule.unit_ids !== null && !rule.unit_ids.includes(item.unit_id))) return false
  if (rule.items === null) return true
  const refs = rule.items.find(unit => unit.unit_id === item.unit_id)?.refs
  return refs === null || !!refs?.some(ref => ref.kind === item.kind && ref.id === item.id)
}
