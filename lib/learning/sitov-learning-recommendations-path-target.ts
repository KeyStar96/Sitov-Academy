import { pathIdSchema, type PathMap } from '@/lib/learning-path-contract'

/** Resolve only the current authenticated map; never fall back to the first node. */
export function resolveSitovPathRecommendationTarget(raw: string | string[] | undefined, level: string, map?: PathMap) {
  if (raw === undefined) return null
  if (!pathIdSchema.safeParse(raw).success) return { error: 'unavailable' as const }
  if (!map) return { error: 'retryable' as const }
  if (map.level !== level) return { error: 'unavailable' as const }
  const matches = map.paths.flatMap(path => path.nodes.filter(node => node.id === raw).map(node => ({ node, title: path.title, pathId: path.id, available: path.available })))
  if (matches.length !== 1 || !matches[0].available || !matches[0].node.available) return { error: 'unavailable' as const }
  return { target: matches[0] }
}
