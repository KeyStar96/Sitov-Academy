import 'server-only'
import { z } from 'zod'
import type { createClient } from '@/utils/supabase/server'
import type { PathMap } from '@/lib/learning-path-contract'

const sourceSchema = z.object({
  nodeId: z.uuid(), unitId: z.uuid(), pathSourceId: z.string().min(1), nodeSourceId: z.string().min(1),
  kind: z.enum(['practice', 'review', 'test', 'special']), anchorNodeId: z.uuid().nullable(),
  anchorSourceId: z.string().min(1).nullable(), goals: z.array(z.string()), anchorGoals: z.array(z.string()),
}).strict()
const responseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.object({ level: z.string(), sources: z.array(sourceSchema).max(200) }).strict() }).strict(),
  z.object({ ok: z.literal(false), error: z.enum(['authentication_required', 'invalid_input', 'not_found', 'retryable_failure']), retryable: z.boolean() }).strict(),
])
export type SitovRecommendationSource = z.infer<typeof sourceSchema>

/** Only request actual available map IDs. SQL108 owns current authorization and stored source binding. */
export async function loadSitovLearningRecommendationSources(client: Pick<Awaited<ReturnType<typeof createClient>>, 'rpc'>, map: PathMap): Promise<SitovRecommendationSource[]> {
  const nodes = map.paths.filter(path => path.available).flatMap(path => path.nodes.filter(node => node.available).map(node => ({ node, path })))
  if (!nodes.length) return []
  if (new Set(nodes.map(({ node }) => node.id)).size !== nodes.length || new Set(map.paths.map(path => path.id)).size !== map.paths.length || new Set(map.paths.map(path => path.source_id)).size !== map.paths.length) throw new Error('ambiguous_path_map')
  const sources: SitovRecommendationSource[] = []
  for (let offset = 0; offset < nodes.length; offset += 200) {
    const ids = nodes.slice(offset, offset + 200).map(({ node }) => node.id)
    const result = await client.rpc('sitov_get_learning_recommendation_sources', { p_level: map.level, p_node_ids: ids })
    if (result.error) throw new Error('source_transport_failure')
    const response = responseSchema.parse(result.data)
    if (response.ok === false) {
      if (response.retryable || response.error === 'retryable_failure') throw new Error('source_read_failure')
      return []
    }
    if (response.data.level !== map.level) throw new Error('foreign_source_level')
    for (const row of response.data.sources) {
      const match = nodes.find(({ node }) => node.id === row.nodeId)
      if (!ids.includes(row.nodeId) || !match || match.path.id !== row.unitId || match.path.source_id !== row.pathSourceId || match.node.kind !== row.kind) throw new Error('foreign_source_binding')
      if (row.kind === 'special') {
        const anchor = nodes.find(({ node }) => node.id === row.anchorNodeId)
        if (!anchor || anchor.path.id !== row.unitId || anchor.node.kind === 'special' || !row.anchorSourceId) throw new Error('foreign_special_anchor')
      } else if (row.anchorNodeId !== null || row.anchorSourceId !== null || row.anchorGoals.length) throw new Error('unexpected_anchor')
      sources.push(row)
    }
  }
  if (new Set(sources.map(row => row.nodeId)).size !== sources.length || new Set(sources.map(row => `${row.unitId}/${row.nodeSourceId}`)).size !== sources.length) throw new Error('ambiguous_source_binding')
  return sources
}
