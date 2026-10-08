import { requestSession } from '@/lib/request-session'
import { pathMapSchema, pathLevelSchema, pathLocaleSchema, type PathResult, type PathMap } from '@/lib/learning-path-contract'
import { resolveSitovPathRecommendationTopics } from '@/lib/learning/sitov-learning-recommendations-path-server'
import LearningPathClient from '@/components/learning-path/LearningPathClient'
import { loadLearningNewItems } from '@/lib/learning-new-server'

export default async function LearningPathPage({ params, searchParams }: { params: Promise<{ lang: string; level: string }>; searchParams?: Promise<{ sitov_target?: string | string[] }> }) {
  const { lang, level } = await params
  const decodedLevel = decodeURIComponent(level)
  const query = await searchParams
  const session = await requestSession()
  let path: PathResult<PathMap> = { error: 'authentication_required' }
  if (session.user && pathLevelSchema.safeParse(decodedLevel).success && pathLocaleSchema.safeParse(lang).success) {
    try {
      const result = await session.supabase.rpc('get_learning_path', { p_level: decodedLevel, p_locale: lang })
      const parsed = pathMapSchema.safeParse(result.data)
      path = !result.error && parsed.success && parsed.data.level === decodedLevel ? { data: parsed.data } : { error: 'request_failed' }
    } catch { path = { error: 'request_failed' } }
  }
  const [news, topics] = await Promise.all([loadLearningNewItems(decodedLevel), resolveSitovPathRecommendationTopics(session, path.data)])
  return <LearningPathClient initialPath={path.data} initialError={path.error}
    lang={lang} level={decodedLevel} newItems={news.items} sitovTarget={query?.sitov_target} recommendationTopicIds={topics} recommendationAccountKey={session.user?.id} />
}
