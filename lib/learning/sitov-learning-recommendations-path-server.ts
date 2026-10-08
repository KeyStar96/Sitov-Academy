import 'server-only'
import { z } from 'zod'
import type { requestSession } from '@/lib/request-session'
import type { PathMap } from '@/lib/learning-path-contract'
import { SITOV_TOPIC_MAPPING } from './sitov-topic-mapping'
/** Join actual stored source IDs to current available UUIDs; never infer source from order/title. */
export async function resolveSitovPathRecommendationTopics(session: Awaited<ReturnType<typeof requestSession>>, map?: PathMap): Promise<string[]> {
 if (!session.user || !map) return []
 const nodes = map.paths.filter(path => path.available).flatMap(path => path.nodes.filter(node => node.available && node.kind !== 'special').map(node => ({ id:node.id,unitId:path.id,pathSource:path.source_id })))
 if (!nodes.length || new Set(nodes.map(node => node.id)).size !== nodes.length) return []
 try {
  const result = await session.supabase.from('path_nodes').select('id,source_id,unit_id').in('id',nodes.map(node => node.id)).eq('is_active',true)
  const parsed = z.array(z.object({ id:z.uuid(),source_id:z.string(),unit_id:z.uuid() })).safeParse(result.data)
  if (result.error || !parsed.success || new Set(parsed.data.map(row => row.id)).size !== parsed.data.length) return []
  return SITOV_TOPIC_MAPPING.filter(topic => topic.level === map.level && topic.anchors.some(anchor => parsed.data.some(row => {
   const node = nodes.find(node => node.id === row.id && node.unitId === row.unit_id)
   return node?.pathSource === anchor.pathSourceId && row.source_id === anchor.nodeSourceId
  }))).map(topic => topic.topicId)
 } catch { return [] }
}
