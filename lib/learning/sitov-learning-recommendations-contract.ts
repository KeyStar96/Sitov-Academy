import { z } from 'zod'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { SITOV_TOPIC_MAPPING } from './sitov-topic-mapping'

const knownTopic = z.string().refine(id => SITOV_TOPIC_MAPPING.some(t => t.topicId === id))
const knownCompetency = z.string().refine(id => SITOV_TOPIC_MAPPING.some(t => t.competencyId === id))
const unique = (ids: string[]) => new Set(ids).size === ids.length
export const sitovLearningRecommendationInputSchema = z.object({
  topicIds: z.array(knownTopic).min(1).max(10).refine(unique),
  failedCompetencyIds: z.array(knownCompetency).max(40).refine(unique).optional(),
  locale: z.enum(['de', 'en', 'ru', 'uk', 'tr']), limit: z.number().int().min(1).max(3).default(3),
}).strict()
export const sitovRecommendationProgressSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('vocabulary'), directions: z.array(z.object({ direction: z.enum(['de_to_native', 'native_to_de']), box: z.number().int().min(1).max(7) }).strict()).max(2), checkpoint: z.boolean() }).strict(),
  z.object({ source: z.literal('verbs'), box: z.number().int().min(1).max(7).nullable(), attempts: z.number().int().nonnegative().nullable(), correct: z.number().int().nonnegative().nullable() }).strict(),
  z.object({ source: z.literal('learning_path'), status: z.enum(['not_started', 'in_progress', 'completed']) }).strict(),
  z.object({ source: z.literal('pronunciation'), status: z.enum(['available', 'in_progress', 'passed', 'failed']) }).strict(),
])
export const sitovLearningRecommendationSchema = z.object({
  kind: z.enum(['vocabulary', 'verbs', 'learning_path', 'pronunciation']), level: z.enum(ACCESS_LEVELS),
  targetId: z.string().max(160), topicId: knownTopic, competencyId: knownCompetency,
  action: z.enum(['practice', 'continue', 'review', 'pretest']), progress: sitovRecommendationProgressSchema,
  href: z.string().max(600),
}).strict().superRefine((item, ctx) => {
  const topic = SITOV_TOPIC_MAPPING.find(t => t.topicId === item.topicId)
  if (topic?.competencyId !== item.competencyId || item.progress.source !== item.kind || !item.href.startsWith('/')) ctx.addIssue({ code: 'custom', message: 'inconsistent_recommendation' })
  let url: URL
  try { url = new URL(item.href, 'https://sitov.invalid') } catch { ctx.addIssue({ code: 'custom', message: 'invalid_exact_href' }); return }
  const locale = url.pathname.split('/')[1]
  const prefix = `/${locale}/dashboard/level/${encodeURIComponent(item.level)}`
  const routes = { vocabulary: '/vocabulary/train', verbs: '/verbs', learning_path: '/path', pronunciation: '/pronunciation' }
  const expected = new URLSearchParams()
  if (item.kind === 'vocabulary') {
    const lesson = url.searchParams.get('lesson')
    if (!z.uuid().safeParse(lesson).success) ctx.addIssue({ code: 'custom', message: 'invalid_lesson' })
    expected.set('lesson', lesson ?? '')
  }
  expected.set('sitov_target', item.targetId)
  if (item.kind === 'verbs') expected.set('tense', 'present')
  if (!['de', 'en', 'ru', 'uk', 'tr'].includes(locale) || url.origin !== 'https://sitov.invalid' || url.hash || item.href !== `${prefix}${routes[item.kind]}?${expected.toString()}`) ctx.addIssue({ code: 'custom', message: 'invalid_exact_href' })
  if (item.kind === 'verbs' ? !/^sitov-verb-[a-z0-9-]+$/.test(item.targetId) : !z.uuid().safeParse(item.targetId).success) ctx.addIssue({ code: 'custom', message: 'invalid_target' })
})
export const sitovLearningRecommendationsResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.object({ mappingVersion: z.literal(1), items: z.array(sitovLearningRecommendationSchema).max(3) }).strict() }).strict(),
  z.object({ ok: z.literal(false), error: z.enum(['authentication_required', 'invalid_input', 'retryable_failure']), retryable: z.boolean() }).strict(),
])
export type SitovLearningRecommendation = z.infer<typeof sitovLearningRecommendationSchema>
export type SitovLearningRecommendationsResult = z.infer<typeof sitovLearningRecommendationsResultSchema>
