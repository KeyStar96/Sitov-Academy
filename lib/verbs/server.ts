import 'server-only'

import { z } from 'zod'
import { randomInt } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { hasTrainerAccess } from '@/lib/access/levels'
import { readAllRows } from '@/lib/supabase-read'
import { getSitovVerbById, getSitovVerbCatalog, getSitovVerbTenses } from './catalog'
import { buildSitovVerbExercise, prioritizeSitovVerbTasks } from './engine'
import { SITOV_VERB_LEVELS, type SitovVerbLocale } from './types'
import type { SitovVerbPublicExercise, SitovVerbResult, SitovVerbReviewResult, SitovVerbTrainerState } from './contracts'

const sitovLevel = z.enum(SITOV_VERB_LEVELS)
const sitovTense = z.enum(['present', 'perfect', 'past'])
const sitovNextInput = z.object({ level: sitovLevel, tenses: z.array(sitovTense).min(1).max(3).optional(), excludeVerbId: z.string().max(160).optional() }).strict()
const sitovBoxInput = z.object({ level: sitovLevel, verbIds: z.array(z.string().min(1).max(160)).min(1).max(1000), selected: z.boolean() }).strict()
const sitovAnswerInput = z.object({ exerciseId: z.uuid(), answer: z.array(z.string().max(240)).min(1).max(3) }).strict()
const sitovProgressSchema = z.object({ verbId: z.string(), tense: sitovTense, box: z.number().int().min(1).max(7), attempts: z.number().int().nonnegative(), correct: z.number().int().nonnegative(), lapses: z.number().int().nonnegative(), nextReviewAt: z.string().nullable(), lastAnsweredAt: z.string().nullable() }).transform(row => ({ ...row, nextReviewAt: row.nextReviewAt ?? null, lastAnsweredAt: row.lastAnsweredAt ?? null }))
const sitovReviewSchema = z.object({ correct: z.boolean(), solution: z.string(), progress: sitovProgressSchema })
class SitovVerbError extends Error {}

async function sitovRequest<T>(work: (client: Awaited<ReturnType<typeof createClient>>, userId: string) => Promise<T>): Promise<SitovVerbResult<T>> {
  try {
    const client = await createClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) throw new SitovVerbError('not_authenticated')
    return { data: await work(client, user.id) }
  } catch (error) {
    if (error instanceof SitovVerbError) return { error: error.message }
    console.error('[sitov-verbs] Request unavailable')
    return { error: 'request_failed' }
  }
}
function sitovRpcData(data: unknown, error: unknown) {
  if (error || data == null || typeof data !== 'object' || Array.isArray(data)) throw new SitovVerbError('request_failed')
  if ('error' in data) throw new SitovVerbError(['not_authenticated', 'not_authorized', 'not_found', 'invalid_input', 'expired', 'conflict'].includes(String(data.error)) ? String(data.error) : 'request_failed')
  return data
}

async function sitovLoad(client: Awaited<ReturnType<typeof createClient>>, learnerId: string, level: unknown): Promise<SitovVerbTrainerState> {
  const parsed = sitovLevel.safeParse(level)
  if (!parsed.success) throw new SitovVerbError('invalid_input')
  const profile = await loadLevelAccessProfile(client, learnerId)
  if (!hasTrainerAccess(profile, parsed.data, 'verbs')) throw new SitovVerbError('not_authorized')
  const [catalog, box, progress] = await Promise.all([
    readAllRows((from, to) => client.from('sitov_verb_catalog').select('id,unit_id,level').order('id').range(from, to)),
    readAllRows((from, to) => client.from('sitov_verb_box').select('verb_id,selected').eq('auth_user_id', learnerId).order('verb_id').range(from, to)),
    readAllRows((from, to) => client.from('sitov_verb_progress').select('verb_id,tense,box,attempts,correct,lapses,next_review_at,last_answered_at').eq('auth_user_id', learnerId).order('verb_id').order('tense').range(from, to)),
  ])
  const metadata = new Map(catalog.map(row => [row.id, row]))
  const verbs = getSitovVerbCatalog(parsed.data).flatMap(verb => {
    const meta = metadata.get(verb.id)
    return meta ? [{ ...verb, unitId: meta.unit_id }] : []
  })
  const visible = new Set(verbs.map(verb => verb.id))
  return {
    learnerId, level: parsed.data,
    authorizedLevels: SITOV_VERB_LEVELS.filter(item => SITOV_VERB_LEVELS.indexOf(item) <= SITOV_VERB_LEVELS.indexOf(parsed.data) && hasTrainerAccess(profile, item, 'verbs')),
    tenses: getSitovVerbTenses(parsed.data), verbs,
    selectedIds: box.filter(row => row.selected).map(row => row.verb_id),
    progress: progress.filter(row => visible.has(row.verb_id)).map(row => sitovProgressSchema.parse({ verbId: row.verb_id, tense: row.tense, box: row.box, attempts: row.attempts, correct: row.correct, lapses: row.lapses, nextReviewAt: row.next_review_at, lastAnsweredAt: row.last_answered_at })),
  }
}
export function loadSitovVerbTrainer(level: unknown, lang?: string): Promise<SitovVerbResult<SitovVerbTrainerState>> {
  if (lang != null && typeof lang !== 'string') return Promise.resolve({ error: 'invalid_input' })
  return sitovRequest((client, learnerId) => sitovLoad(client, learnerId, level))
}
export function setSitovVerbBox(input: z.infer<typeof sitovBoxInput>): Promise<SitovVerbResult<{ selectedIds: string[] }>> {
  return sitovRequest(async client => {
    const parsed = sitovBoxInput.safeParse(input)
    if (!parsed.success) throw new SitovVerbError('invalid_input')
    const { data, error } = await client.rpc('sitov_set_verb_box', { p_level: parsed.data.level, p_verb_ids: [...new Set(parsed.data.verbIds)], p_selected: parsed.data.selected })
    return z.object({ selectedIds: z.array(z.string()) }).parse(sitovRpcData(data, error))
  })
}
export function nextSitovVerbExercise(input: z.infer<typeof sitovNextInput>, lang: string = 'de'): Promise<SitovVerbResult<SitovVerbPublicExercise | null>> {
  return sitovRequest(async (client, learnerId) => {
    const parsed = sitovNextInput.safeParse(input)
    if (!parsed.success) throw new SitovVerbError('invalid_input')
    const state = await sitovLoad(client, learnerId, parsed.data.level)
    if (parsed.data.tenses?.some(tense => !state.tenses.includes(tense))) throw new SitovVerbError('not_authorized')
    const selected = state.verbs.filter(verb => state.selectedIds.includes(verb.id))
    let tasks = prioritizeSitovVerbTasks(selected, state.progress, state.level, parsed.data.tenses)
    if (tasks.length > 1 && parsed.data.excludeVerbId) {
      const others = tasks.filter(task => task.verbId !== parsed.data.excludeVerbId)
      if (others.length) tasks = others
    }
    const task = tasks[0]
    if (!task) return null
    const verb = getSitovVerbById(task.verbId)
    if (!verb) throw new SitovVerbError('request_failed')
    const exercise = buildSitovVerbExercise(verb, task.tense, { seed: randomInt(0, 2147483647) })
    const admin = createAdminClient()
    const { data, error } = await admin.from('sitov_verb_challenges').insert({ auth_user_id: learnerId, verb_id: verb.id, context_level: state.level, tense: task.tense, expected: exercise.answers, solution: exercise.solution }).select('id').single()
    if (error || !data) throw new SitovVerbError('request_failed')
    const locale: SitovVerbLocale = ['de', 'en', 'ru', 'uk', 'tr'].includes(lang) ? lang as SitovVerbLocale : 'en'
    return { exerciseId: data.id, verbId: verb.id, infinitive: verb.infinitive, translation: verb.translations[locale], tense: exercise.tense, kind: exercise.kind, prompt: exercise.prompt, parts: exercise.parts, person: exercise.person }
  })
}
export function submitSitovVerbAnswer(input: z.infer<typeof sitovAnswerInput>): Promise<SitovVerbResult<SitovVerbReviewResult>> {
  return sitovRequest(async client => {
    const parsed = sitovAnswerInput.safeParse(input)
    if (!parsed.success) throw new SitovVerbError('invalid_input')
    const { data, error } = await client.rpc('sitov_submit_verb_answer', { p_challenge_id: parsed.data.exerciseId, p_answer: parsed.data.answer })
    const result = sitovReviewSchema.parse(sitovRpcData(data, error))
    return { correct: result.correct, solution: result.solution, progress: result.progress }
  })
}
export function sitovVerbStats(state: SitovVerbTrainerState, now = Date.now()) {
  const active = state.verbs.filter(verb => state.selectedIds.includes(verb.id))
  const tasks = prioritizeSitovVerbTasks(active, state.progress, state.level, undefined, now)
  return { total: state.verbs.length, selected: active.length, due: tasks.filter(task => task.due).length, mastered: state.progress.filter(progress => state.selectedIds.includes(progress.verbId) && progress.box >= 6).length }
}
