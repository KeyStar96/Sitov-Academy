import { z } from 'zod'
import { ACCESS_LEVELS } from './access/levels'

/** Public transport validation only. A parsed score/proof is never authorization:
 * commercial rights and the persisted current-version pass are checked on the server.
 * Private answer keys, source evidence and target bodies belong in server-only modules. */
export const SITOV_PRONUNCIATION_PRETEST_POLICY = Object.freeze({
  id: 'sitov-pronunciation-language-prerequisites-v1',
  minimumCoreQuestions: 3, minimumPoolQuestions: 6,
  totalNumerator: 3, totalDenominator: 4, coreNumerator: 2, coreDenominator: 3,
})
const count = z.number().int().min(0).max(1000)
const positiveCount = count.min(1)
const revision = z.number().int().nonnegative().max(2147483647)
const identifier = z.string().regex(/^sitov[.:-][a-zA-Z0-9._:-]{1,90}$/)
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/)
const timestamp = z.iso.datetime({ offset: true })
const unique = <T>(items: readonly T[]) => new Set(items).size === items.length
const sameVersion = (a: { textId?: string; textVersion?: string; testVersion?: string | null }, b: { textId?: string; textVersion?: string; testVersion?: string | null }) =>
  a.textId === b.textId && a.textVersion === b.textVersion && a.testVersion === b.testVersion
const requiredCorrect = (total: number, scope: 'core' | 'total') =>
  Math.floor((total * (scope === 'core' ? 2 : 3) + (scope === 'core' ? 3 : 4) - 1) / (scope === 'core' ? 3 : 4))

/** Exact integer thresholds, for displaying/validating the fixed server policy.
 * This deliberately does not grade answers or compute an unlock decision. */
export function sitovPronunciationPretestRequiredCorrect(total: number, scope: 'core' | 'total'): number {
  if (!Number.isSafeInteger(total) || total < 1 || total > 1000 || !['core', 'total'].includes(scope)) throw new RangeError('invalid_question_count')
  return requiredCorrect(total, scope)
}

export const sitovPronunciationPretestErrorSchema = z.enum([
  'authentication_required', 'not_found', 'test_required', 'authoring_not_ready',
  'version_conflict', 'attempt_conflict', 'invalid_input', 'invalid_answer',
  'incomplete_attempt', 'request_conflict', 'rate_limited', 'retryable_failure',
])
export type SitovPronunciationPretestError = z.infer<typeof sitovPronunciationPretestErrorSchema>
export const sitovPronunciationPretestFailureSchema = z.object({
  ok: z.literal(false), error: sitovPronunciationPretestErrorSchema, retryable: z.boolean(),
}).strict()
export function sitovPronunciationPretestActionResultSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion('ok', [z.object({ ok: z.literal(true), data }).strict(), sitovPronunciationPretestFailureSchema])
}
export type SitovPronunciationPretestActionResult<T> =
  | { ok: true; data: T } | { ok: false; error: SitovPronunciationPretestError; retryable: boolean }

export const sitovPronunciationPretestTaskSchema = z.object({
  id: identifier, competencyId: identifier, kind: z.literal('single_choice'),
  promptDe: z.string().trim().min(1).max(500), fragmentDe: z.string().trim().min(1).max(300).nullable(),
  options: z.array(z.object({ id: identifier, textDe: z.string().trim().min(1).max(300) }).strict()).min(3).max(5),
}).strict().refine(task => unique(task.options.map(option => option.id)) && unique(task.options.map(option => option.textDe.normalize('NFC'))), 'duplicate_option')
export type SitovPronunciationPretestTask = z.infer<typeof sitovPronunciationPretestTaskSchema>

export const sitovPronunciationPretestAnswersSchema = z.record(identifier, identifier)
export const sitovPronunciationPretestAttemptSchema = z.object({
  id: z.uuid(), textId: z.uuid(), textVersion: fingerprint, testVersion: fingerprint,
  status: z.enum(['in_progress', 'passed', 'failed', 'outdated']), revision,
  startedAt: timestamp, updatedAt: timestamp,
  questionIds: z.array(identifier).min(3).max(120), answers: sitovPronunciationPretestAnswersSchema,
  answeredCount: count, totalCount: positiveCount.max(120),
}).strict().superRefine((attempt, ctx) => {
  if (!unique(attempt.questionIds) || attempt.totalCount !== attempt.questionIds.length) ctx.addIssue({ code: 'custom', message: 'invalid_question_set' })
  const answers = Object.keys(attempt.answers)
  if (answers.length !== attempt.answeredCount || answers.some(id => !attempt.questionIds.includes(id))) ctx.addIssue({ code: 'custom', message: 'invalid_answers' })
  if (Date.parse(attempt.updatedAt) < Date.parse(attempt.startedAt)) ctx.addIssue({ code: 'custom', message: 'invalid_attempt_time' })
  if (['passed', 'failed'].includes(attempt.status) && attempt.answeredCount !== attempt.totalCount) ctx.addIssue({ code: 'custom', message: 'incomplete_terminal_attempt' })
})
export type SitovPronunciationPretestAttempt = z.infer<typeof sitovPronunciationPretestAttemptSchema>

export const sitovPronunciationPretestProofSchema = z.object({
  id: z.uuid(), textId: z.uuid(), textVersion: fingerprint, testVersion: fingerprint,
  passedAttemptId: z.uuid(), passedAt: timestamp,
  // Version transfer is disabled until a validated compatibility implementation exists.
  compatibilityId: z.null(),
}).strict()
export type SitovPronunciationPretestProof = z.infer<typeof sitovPronunciationPretestProofSchema>

export const sitovPronunciationPretestUploadTicketSchema = z.object({
  ticketId: z.uuid(), textVersion: fingerprint, expiresAt: timestamp,
  path: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:webm|mp4|ogg|wav|mp3)$/),
}).strict()
export type SitovPronunciationPretestUploadTicket = z.infer<typeof sitovPronunciationPretestUploadTicketSchema>

export const sitovPronunciationPretestLearningLinkSchema = z.object({
  kind: z.enum(['vocabulary', 'verbs', 'learning_path']), level: z.enum(ACCESS_LEVELS),
  targetId: z.string().min(1).max(128),
  href: z.string().max(500).regex(/^\/(?:de|en|ru|uk|tr)\/dashboard\/level\/[A-C][12](?:\.|%2[eE])[12]\/(?:vocabulary|verbs|path)(?:[/?#][^\s\\]*)?$/)
    .refine(href => !/\.\.|%2e%2e|%5c|%0[ad]/i.test(href), 'invalid_learning_link'),
}).strict().refine(link => {
  try {
    const path = decodeURIComponent(link.href.split(/[?#]/)[0]).split('/')
    return path[4] === link.level && path[5] === (link.kind === 'learning_path' ? 'path' : link.kind)
  } catch { return false }
}, 'learning_link_scope_mismatch')
export type SitovPronunciationPretestLearningLink = z.infer<typeof sitovPronunciationPretestLearningLinkSchema>

const competencyResult = z.object({ id: identifier, correct: count, total: positiveCount.min(3), required: positiveCount, met: z.boolean() }).strict()
export const sitovPronunciationPretestResultSchema = z.object({
  attemptId: z.uuid(), textId: z.uuid(), textVersion: fingerprint, testVersion: fingerprint,
  passed: z.boolean(), correct: count, total: positiveCount,
  competencies: z.array(competencyResult).min(1).max(40), failedCompetencyIds: z.array(identifier).max(40),
  learningLinks: z.array(sitovPronunciationPretestLearningLinkSchema).max(40), proof: sitovPronunciationPretestProofSchema.nullable(),
}).strict().superRefine((result, ctx) => {
  const failures = result.competencies.filter(row => !row.met).map(row => row.id)
  const validRows = result.competencies.every(row => row.correct <= row.total && row.required === requiredCorrect(row.total, 'core') && row.met === (row.correct >= row.required))
  const expectedPassed = failures.length === 0 && result.correct >= requiredCorrect(result.total, 'total')
  if (!validRows || !unique(result.competencies.map(row => row.id)) || !unique(result.failedCompetencyIds)
    || failures.length !== result.failedCompetencyIds.length || failures.some(id => !result.failedCompetencyIds.includes(id))
    || result.total !== result.competencies.reduce((sum, row) => sum + row.total, 0)
    || result.correct !== result.competencies.reduce((sum, row) => sum + row.correct, 0) || result.passed !== expectedPassed) ctx.addIssue({ code: 'custom', message: 'inconsistent_server_result' })
  if (result.passed !== Boolean(result.proof) || (result.proof && (!sameVersion(result, result.proof) || result.proof.passedAttemptId !== result.attemptId))) ctx.addIssue({ code: 'custom', message: 'invalid_result_proof' })
})
export type SitovPronunciationPretestResult = z.infer<typeof sitovPronunciationPretestResultSchema>

export const sitovPronunciationPretestAttemptWithTasksSchema = z.object({
  attempt: sitovPronunciationPretestAttemptSchema, tasks: z.array(sitovPronunciationPretestTaskSchema).min(3).max(120),
}).strict().superRefine((value, ctx) => {
  const { attempt, tasks } = value
  if (attempt.status !== 'in_progress' || tasks.length !== attempt.totalCount || !unique(tasks.map(task => task.id)) || tasks.some((task, index) => task.id !== attempt.questionIds[index])) ctx.addIssue({ code: 'custom', message: 'invalid_attempt_tasks' })
  for (const task of tasks) if (attempt.answers[task.id] && !task.options.some(option => option.id === attempt.answers[task.id])) ctx.addIssue({ code: 'custom', message: 'invalid_answer_option' })
  const cores = new Set(tasks.map(task => task.competencyId))
  if ([...cores].some(id => tasks.filter(task => task.competencyId === id).length < 3)) ctx.addIssue({ code: 'custom', message: 'incomplete_core_coverage' })
})
export type SitovPronunciationPretestAttemptWithTasks = z.infer<typeof sitovPronunciationPretestAttemptWithTasksSchema>

export const sitovPronunciationPretestCompletedAttemptSchema = z.object({
  attempt: sitovPronunciationPretestAttemptSchema, result: sitovPronunciationPretestResultSchema.nullable(),
}).strict().superRefine((value, ctx) => {
  const { attempt, result } = value
  if (attempt.status === 'in_progress' || (!result && attempt.status !== 'outdated') || (result && (!sameVersion(attempt, result) || result.attemptId !== attempt.id || result.total !== attempt.totalCount || (attempt.status !== 'outdated' && result.passed !== (attempt.status === 'passed'))))) ctx.addIssue({ code: 'custom', message: 'invalid_completed_attempt' })
})
export type SitovPronunciationPretestCompletedAttempt = z.infer<typeof sitovPronunciationPretestCompletedAttemptSchema>
export const sitovPronunciationPretestAttemptResponseSchema = z.union([sitovPronunciationPretestAttemptWithTasksSchema, sitovPronunciationPretestCompletedAttemptSchema])

export const sitovPronunciationPretestCatalogEntrySchema = z.object({
  textId: z.uuid(), unitId: z.uuid(), level: z.enum(ACCESS_LEVELS), title: z.string().trim().min(1).max(120),
  focus: z.string().max(200).nullable(), kind: z.enum(['regular', 'bonus']), textVersion: fingerprint, testVersion: fingerprint.nullable(),
  status: z.enum(['locked', 'available', 'in_progress', 'passed', 'failed']),
  lockedReason: z.enum(['authoring_not_ready', 'version_changed']).nullable(), attempt: sitovPronunciationPretestAttemptSchema.nullable(),
  proof: sitovPronunciationPretestProofSchema.nullable(), target: z.enum(['pretest', 'resume_pretest', 'pronunciation']).nullable(),
}).strict().superRefine((entry, ctx) => {
  const expectedTarget = { locked: null, available: 'pretest', in_progress: 'resume_pretest', passed: 'pronunciation', failed: 'pretest' }[entry.status]
  if (entry.target !== expectedTarget || (entry.status === 'locked') !== Boolean(entry.lockedReason) || (entry.status !== 'locked' && !entry.testVersion)) ctx.addIssue({ code: 'custom', message: 'invalid_catalog_state' })
  if ((entry.status === 'passed') !== Boolean(entry.proof) || (entry.proof && !sameVersion(entry, entry.proof))) ctx.addIssue({ code: 'custom', message: 'invalid_catalog_proof' })
  if (entry.attempt && (entry.attempt.textId !== entry.textId || (entry.status !== 'locked' && !sameVersion(entry, entry.attempt)))) ctx.addIssue({ code: 'custom', message: 'foreign_catalog_attempt' })
  if (['in_progress', 'passed', 'failed'].includes(entry.status) && (!entry.attempt || entry.attempt.status !== entry.status)) ctx.addIssue({ code: 'custom', message: 'missing_catalog_attempt' })
  if (entry.status === 'available' && entry.attempt) ctx.addIssue({ code: 'custom', message: 'unexpected_catalog_attempt' })
  if (entry.proof && entry.attempt && entry.proof.passedAttemptId !== entry.attempt.id) ctx.addIssue({ code: 'custom', message: 'foreign_catalog_proof' })
})
export type SitovPronunciationPretestCatalogEntry = z.infer<typeof sitovPronunciationPretestCatalogEntrySchema>
export const sitovPronunciationPretestCatalogSchema = z.array(sitovPronunciationPretestCatalogEntrySchema).max(1000)
  .refine(entries => unique(entries.map(entry => entry.textId)), 'duplicate_catalog_text')

/** Authoring coverage projection, without solutions or source quotations.
 * This checks pool structure, not correctness/didactic quality/publication/audio. */
export const sitovPronunciationPretestPoolSchema = z.object({
  policyId: z.literal(SITOV_PRONUNCIATION_PRETEST_POLICY.id),
  competencies: z.array(z.object({ id: identifier, itemsPerAttempt: count.min(3).max(40) }).strict()).min(1).max(40),
  tasks: z.array(sitovPronunciationPretestTaskSchema).min(6).max(1000),
}).strict().superRefine((pool, ctx) => {
  if (!unique(pool.tasks.map(task => task.id)) || !unique(pool.competencies.map(core => core.id))) ctx.addIssue({ code: 'custom', message: 'duplicate_pool_id' })
  if (pool.tasks.some(task => !pool.competencies.some(core => core.id === task.competencyId))) ctx.addIssue({ code: 'custom', message: 'unknown_pool_competency' })
  for (const core of pool.competencies) if (pool.tasks.filter(task => task.competencyId === core.id).length < 2 * core.itemsPerAttempt) ctx.addIssue({ code: 'custom', message: 'insufficient_retry_pool' })
  if (pool.competencies.reduce((sum, core) => sum + core.itemsPerAttempt, 0) > 120) ctx.addIssue({ code: 'custom', message: 'oversized_attempt' })
})
export type SitovPronunciationPretestPool = z.infer<typeof sitovPronunciationPretestPoolSchema>

export const sitovPronunciationPretestStartInputSchema = z.object({ textId: z.uuid(), requestId: z.uuid() }).strict()
export const sitovPronunciationPretestAnswersInputSchema = z.object({
  attemptId: z.uuid(), revision, answers: sitovPronunciationPretestAnswersSchema, requestId: z.uuid(),
}).strict()
export type SitovPronunciationPretestStartInput = z.infer<typeof sitovPronunciationPretestStartInputSchema>
export type SitovPronunciationPretestAnswersInput = z.infer<typeof sitovPronunciationPretestAnswersInputSchema>
