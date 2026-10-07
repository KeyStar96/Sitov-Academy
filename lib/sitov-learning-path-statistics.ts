import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/database.types'
import { pathMapSchema } from '@/lib/learning-path-contract'

/** Current curriculum only; optional special nodes do not gate path completion. */
export async function readSitovLearningPathStatistics(supabase: SupabaseClient<Database>, level: string, locale: string) {
  // Raw path_nodes are intentionally staff-only. The learner RPC applies the
  // access contract and excludes inactive nodes and reset progress records.
  const { data, error } = await supabase.rpc('get_learning_path', { p_level: level, p_locale: locale })
  if (error) throw new Error(`learning_path_statistics_unavailable: ${error.code}`)
  if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in data) {
    if (data.error === 'path_locked') return null
    throw new Error(`learning_path_statistics_unavailable: ${String(data.error)}`)
  }
  const parsed = pathMapSchema.safeParse(data)
  if (!parsed.success || parsed.data.level !== level) throw new Error('learning_path_statistics_unavailable: invalid_response')
  const paths = [...parsed.data.paths].sort((left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id))
  const nodes = paths.flatMap(path => path.nodes.filter(node => node.kind !== 'special'))
  const firstOpen = paths.findIndex(path => !path.completed)
  return {
    total: nodes.length,
    // Passing a topic test proves mastery without requiring every practice
    // round. In unfinished topics, only completed core nodes contribute.
    solved: paths.reduce((sum, path) => sum + path.nodes.filter(node => node.kind !== 'special'
      && (path.completed || node.status === 'completed')).length, 0),
    topics: paths.length,
    openTopics: paths.filter(path => !path.completed).length,
    currentTopic: firstOpen < 0 ? null : firstOpen + 1,
  }
}
