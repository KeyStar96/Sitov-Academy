import 'server-only'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { currentUserHasContentAccess } from '@/lib/access/server'
import { sitovCheckpointSchema } from '@/lib/learning-checkpoints'
import { pathMapSchema } from '@/lib/learning-path-contract'
import { sitovPronunciationPretestCatalogSchema } from '@/lib/sitov-pronunciation-pretest-contract'
import { SITOV_TOPIC_MAPPING, type SitovPathSourceTarget, type SitovTopicTarget } from './sitov-topic-mapping'
import { sitovLearningRecommendationInputSchema, sitovLearningRecommendationsResultSchema, type SitovLearningRecommendation, type SitovLearningRecommendationsResult } from './sitov-learning-recommendations-contract'

const accessCatalog = z.object({ version: z.literal(1), level: z.string(), trainer: z.string(), units: z.array(z.object({ id: z.uuid(), items: z.array(z.object({ kind: z.string(), id: z.string(), published: z.boolean() })) })) })
const pathMetadata = z.array(z.object({ id: z.uuid() })).max(2)
const unitMetadata = z.array(z.object({ id: z.uuid(), level: z.string(), trainer: z.literal('exercises'), is_path: z.literal(true), is_active: z.literal(true) })).max(2)
const directionsSchema = z.array(z.object({ id: z.uuid(), direction: z.enum(['de_to_native', 'native_to_de']), box_number: z.number().int().min(1).max(7) })).max(2)
const verbProgressSchema = z.array(z.object({ box: z.number().int().min(1).max(7), attempts: z.number().int().nonnegative(), correct: z.number().int().nonnegative() })).max(1)
function checked<T>(result: { data: T; error: unknown }): T { if (result.error || result.data == null) throw new Error('recommendation_read_failed'); return result.data }

/** Authenticated, read-only DAL. Never accepts caller account, rights, evidence or URLs. */
export async function resolveSitovLearningRecommendations(input: unknown): Promise<SitovLearningRecommendationsResult> {
  const parsed = sitovLearningRecommendationInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input', retryable: false }
  try {
    const client = await createClient()
    const auth = await client.auth.getUser()
    if (auth.error || !auth.data.user) return { ok: false, error: 'authentication_required', retryable: false }
    const actor = auth.data.user.id
    const { locale, limit, failedCompetencyIds } = parsed.data
    const catalogs = new Map<string, z.infer<typeof accessCatalog>>()
    const paths = new Map<string, z.infer<typeof pathMapSchema>>()
    const pretests = new Map<string, z.infer<typeof sitovPronunciationPretestCatalogSchema>>()
    const checkpoints = new Map<string, string[]>()
    const items: SitovLearningRecommendation[] = []
    const seen = new Set<string>()
    const topics = SITOV_TOPIC_MAPPING.filter(t => parsed.data.topicIds.includes(t.topicId) && (!failedCompetencyIds?.length || failedCompetencyIds.includes(t.competencyId)))
    for (const topic of topics) {
      const candidates: (SitovPathSourceTarget | SitovTopicTarget)[] = [...topic.anchors, ...topic.targets]
      for (const target of candidates) {
        const kind = target.kind === 'path_node_source' ? 'path_node' : target.kind
        const trainer = { path_node: 'exercises', vocabulary_card: 'vocabulary', verb: 'verbs', reading_text: 'pronunciation' }[kind]
        const cacheKey = `${target.level}/${trainer}`
        if (!catalogs.has(cacheKey)) {
          const result = await client.rpc('get_sitov_access_catalog', { p_level: target.level, p_trainer: trainer })
          const catalog = accessCatalog.parse(checked(result))
          if (catalog.level !== target.level || catalog.trainer !== trainer) throw new Error('foreign_catalog')
          catalogs.set(cacheKey, catalog)
        }
        const catalog = catalogs.get(cacheKey)!
        let id: string; let unitId: string | undefined
        if (target.kind === 'path_node_source') {
          const units = unitMetadata.parse(checked(await client.from('learning_units').select('id,level,trainer,is_path,is_active').eq('level', target.level).eq('trainer', 'exercises').eq('is_path', true).eq('is_active', true).eq('path_source_id', target.pathSourceId).limit(2)))
          if (units.length !== 1 || units[0].level !== target.level) continue
          const nodes = pathMetadata.parse(checked(await client.from('path_nodes').select('id').eq('unit_id', units[0].id).eq('source_id', target.nodeSourceId).eq('is_active', true).limit(2)))
          if (nodes.length !== 1) continue
          id = nodes[0].id; unitId = units[0].id
        } else { id = target.id; if (target.kind === 'vocabulary_card') unitId = target.unitId }
        const matches = catalog.units.flatMap(unit => unit.items.filter(item => item.kind === kind && item.id === id && item.published).map(() => unit.id))
        if (matches.length !== 1 || (unitId && matches[0] !== unitId) || seen.has(`${kind}/${id}`)) continue
        unitId = matches[0]
        if (!await currentUserHasContentAccess({ kind, id })) continue
        const base = { level: target.level, targetId: id, topicId: topic.topicId, competencyId: topic.competencyId }
        const prefix = `/${locale}/dashboard/level/${encodeURIComponent(target.level)}`
        let item: SitovLearningRecommendation
        if (target.kind === 'path_node_source') {
          if (!paths.has(target.level)) paths.set(target.level, pathMapSchema.parse(checked(await client.rpc('get_learning_path', { p_level: target.level, p_locale: locale }))))
          const pathMap = paths.get(target.level)!
          if (pathMap.level !== target.level) throw new Error('foreign_path')
          const matches = pathMap.paths.filter(path => path.id === unitId && path.available).flatMap(path => path.nodes).filter(node => node.id === id)
          const node = matches.length === 1 ? matches[0] : undefined
          if (!node?.available || node.kind === 'special') continue
          const status = node.status ?? 'not_started'
          item = { ...base, kind: 'learning_path', action: status === 'completed' ? 'review' : status === 'in_progress' ? 'continue' : 'practice', progress: { source: 'learning_path', status }, href: `${prefix}/path?sitov_target=${encodeURIComponent(id)}` }
        } else if (target.kind === 'vocabulary_card') {
          const rows = directionsSchema.parse(checked(await client.from('vocabulary_direction_progress').select('id,direction,box_number').eq('auth_user_id', actor).eq('card_id', id)))
          if (new Set(rows.map(r => r.direction)).size !== rows.length) throw new Error('duplicate_progress')
          if (!checkpoints.has(target.level)) {
            const result = z.object({ checkpoint: sitovCheckpointSchema.nullable() }).parse(checked(await client.rpc('sitov_learning_checkpoint', { p_action: 'get', p_kind: 'vocabulary', p_level: target.level, p_state: null, p_expected_revision: null })))
            const plan = result.checkpoint?.state.plan
            if (plan !== undefined && !z.array(z.uuid()).safeParse(plan).success) throw new Error('invalid_checkpoint')
            checkpoints.set(target.level, (plan as string[] | undefined) ?? [])
          }
          // Checkpoint plans contain direction-progress UUIDs, not vocabulary-card UUIDs.
          const checkpoint = rows.some(row => checkpoints.get(target.level)!.includes(row.id))
          item = { ...base, kind: 'vocabulary', action: checkpoint ? 'continue' : rows.length === 2 && rows.every(r => r.box_number === 7) ? 'review' : 'practice', progress: { source: 'vocabulary', directions: rows.map(r => ({ direction: r.direction, box: r.box_number })), checkpoint }, href: `${prefix}/vocabulary/lessons?sitov_target=${encodeURIComponent(id)}` }
        } else if (target.kind === 'verb') {
          const rows = verbProgressSchema.parse(checked(await client.from('sitov_verb_progress').select('box,attempts,correct').eq('auth_user_id', actor).eq('verb_id', id).eq('tense', 'present')))
          const row = rows[0]
          if (row && row.correct > row.attempts) throw new Error('invalid_progress')
          item = { ...base, kind: 'verbs', action: row?.box === 7 ? 'review' : row?.attempts ? 'continue' : 'practice', progress: { source: 'verbs', box: row?.box ?? null, attempts: row?.attempts ?? null, correct: row?.correct ?? null }, href: `${prefix}/verbs?sitov_target=${encodeURIComponent(id)}&tense=present` }
        } else {
          if (!pretests.has(target.level)) {
            const result = z.object({ ok: z.literal(true), data: sitovPronunciationPretestCatalogSchema }).parse(checked(await client.rpc('sitov_get_pronunciation_pretests', { p_level: target.level })))
            pretests.set(target.level, result.data)
          }
          const entry = pretests.get(target.level)!.find(entry => entry.textId === id)
          if (!entry || entry.status === 'locked' || entry.unitId !== unitId || entry.level !== target.level) continue
          item = { ...base, kind: 'pronunciation', action: entry.status === 'passed' ? 'review' : entry.status === 'in_progress' ? 'continue' : 'pretest', progress: { source: 'pronunciation', status: entry.status }, href: `${prefix}/pronunciation?sitov_target=${encodeURIComponent(id)}` }
        }
        seen.add(`${kind}/${id}`); items.push(item)
      }
    }
    // Existing unfinished evidence drives order, never authorization or pedagogical passage.
    const priority = { continue: 0, practice: 1, pretest: 1, review: 2 }
    items.sort((a, b) => priority[a.action] - priority[b.action])
    return sitovLearningRecommendationsResultSchema.parse({ ok: true, data: { mappingVersion: 1, items: items.slice(0, limit) } })
  } catch { return { ok: false, error: 'retryable_failure', retryable: true } }
}
