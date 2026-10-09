import 'server-only'
import type { requestSession } from '@/lib/request-session'
import type { PathMap } from '@/lib/learning-path-contract'
import { loadSitovLearningRecommendationSources } from './sitov-learning-recommendation-sources-server'
import { SITOV_TOPIC_MAPPING } from './sitov-topic-mapping'
/** Join actual stored source IDs to current available UUIDs; never infer source from order/title. */
export async function resolveSitovPathRecommendationTopics(session: Awaited<ReturnType<typeof requestSession>>, map?: PathMap): Promise<string[]> {
 if (!session.user || !map) return []
 const nodes = map.paths.filter(path => path.available).flatMap(path => path.nodes.filter(node => node.available && node.kind !== 'special').map(node => ({ id:node.id,unitId:path.id,pathSource:path.source_id })))
 if (!nodes.length || new Set(nodes.map(node => node.id)).size !== nodes.length) return []
 try {
  const sources = await loadSitovLearningRecommendationSources(session.supabase, map)
  return SITOV_TOPIC_MAPPING.filter(topic => topic.level === map.level && topic.anchors.some(anchor => sources.some(row => {
   const node = nodes.find(node => node.id === row.nodeId && node.unitId === row.unitId)
   return node?.pathSource === anchor.pathSourceId && row.nodeSourceId === anchor.nodeSourceId
  }))).map(topic => topic.topicId)
 } catch { return [] }
}
