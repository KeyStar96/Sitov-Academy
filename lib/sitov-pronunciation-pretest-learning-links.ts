import 'server-only'
import { z } from 'zod'
import { requestSession } from '@/lib/request-session'
import { SITOV_TOPIC_MAPPING } from '@/lib/learning/sitov-topic-mapping'
import { resolveSitovLearningRecommendations } from '@/lib/learning/sitov-learning-recommendations-server'
import { sitovLearningRecommendationsResultSchema } from '@/lib/learning/sitov-learning-recommendations-contract'
import { sitovPronunciationPretestActionResultSchema, sitovPronunciationPretestLearningLinkSchema, type SitovPronunciationPretestCompletedAttempt } from './sitov-pronunciation-pretest-contract'
const unique = (ids: string[]) => new Set(ids).size === ids.length
const companion = z.object({
  attemptId: z.uuid(), textId: z.uuid(), textVersion: z.string().regex(/^[a-f0-9]{64}$/), testVersion: z.string().regex(/^[a-f0-9]{64}$/),
  failedCompetencyIds: z.array(z.string().min(1).max(160)).max(40).refine(unique),
  topicIds: z.array(z.string().min(1).max(160)).max(400).refine(unique),
}).strict()
/** Optional current-rights suggestions only; never changes the persisted grade. */
export async function enrichSitovPronunciationPretestLearningLinks(value: SitovPronunciationPretestCompletedAttempt): Promise<SitovPronunciationPretestCompletedAttempt> {
  if (value.attempt.status !== 'failed' || !value.result || value.result.passed) return value
  const result = value.result
  const fallback = { ...value, result: { ...result, learningLinks: [] } }
  try {
    const { supabase, user } = await requestSession()
    if (!user) return fallback
    const reply = await supabase.rpc('sitov_get_pronunciation_pretest_learning_topics', { p_attempt_id: value.attempt.id })
    const parsed = sitovPronunciationPretestActionResultSchema(companion).safeParse(reply.data)
    if (reply.error || !parsed.success || !parsed.data.ok) return fallback
    const topics = parsed.data.data
    if (topics.attemptId !== result.attemptId || topics.textId !== result.textId || topics.textVersion !== result.textVersion || topics.testVersion !== result.testVersion
      || JSON.stringify(topics.failedCompetencyIds) !== JSON.stringify(result.failedCompetencyIds)) return fallback
    const topicIds = topics.topicIds.filter(id => SITOV_TOPIC_MAPPING.some(topic => topic.topicId === id)).slice(0, 10)
    if (!topicIds.length) return fallback
    // Text-specific core IDs are not the resolver's global competency IDs.
    const recommendations = sitovLearningRecommendationsResultSchema.safeParse(await resolveSitovLearningRecommendations({ topicIds, locale: 'de', limit: 3 }))
    if (!recommendations.success || !recommendations.data.ok) return fallback
    const learningLinks = recommendations.data.data.items.filter(item => item.kind !== 'pronunciation' && topicIds.includes(item.topicId))
      .map(item => sitovPronunciationPretestLearningLinkSchema.parse({ kind: item.kind, level: item.level, targetId: item.targetId, href: item.href }))
    return { ...value, result: { ...result, learningLinks } }
  } catch { return fallback }
}
