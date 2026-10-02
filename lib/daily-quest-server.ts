import 'server-only'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import {
  dailyQuestLoadSchema, dailyQuestLoginSchema, dailyQuestMutationSchema,
  dailyQuestStatusSchema, dailyQuestStepResultSchema,
  dailyQuestPreviewSchema, dailyQuestLevelSchema,
  type DailyQuestResult, type DailyQuestStepAnswer, type DailyQuestPreview,
} from '@/lib/daily-quest-contract'

type QuestClient = Awaited<ReturnType<typeof createClient>>
const errorCodes = new Set([
  'not_authenticated', 'not_authorized', 'invalid_input', 'not_found', 'conflict',
  'disabled', 'expired', 'steps_incomplete', 'step_out_of_order', 'not_active',
  'no_template', 'request_failed',
])

class QuestRequestError extends Error {
  constructor(readonly code: string) { super(code) }
}

/** Even a successful PostgREST response may carry a failed JSONB operation. */
async function readRpc<T>(
  request: PromiseLike<{ data: unknown; error: unknown }>, schema: z.ZodType<T>,
): Promise<T> {
  const { data, error } = await request
  if (error) throw new QuestRequestError('request_failed')
  if (data && typeof data === 'object' && !Array.isArray(data) && 'success' in data && data.success === false) {
    const code = 'error' in data && typeof data.error === 'string' && errorCodes.has(data.error)
      ? data.error : 'request_failed'
    throw new QuestRequestError(code)
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new QuestRequestError('request_failed')
  return parsed.data
}

async function requireStudent(supabase: QuestClient, userId: string) {
  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (error || profile?.role !== 'student') throw new QuestRequestError('not_authorized')
}

/** Cookie-bound user JWT only. SQL repeats ownership, role and answer checks. */
async function withStudent<T>(work: (supabase: QuestClient) => Promise<T>): Promise<DailyQuestResult<T>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new QuestRequestError('not_authenticated')
    await requireStudent(supabase, user.id)
    return { data: await work(supabase) }
  } catch (error) {
    if (error instanceof QuestRequestError) return { error: error.code }
    console.error('[daily-quest] Request unavailable')
    return { error: 'request_failed' }
  }
}

export function loadDailyQuest() {
  return withStudent(client => readRpc(client.rpc('get_daily_quest'), dailyQuestLoadSchema))
}

export function loadDailyQuestStatus() {
  return withStudent(client => readRpc(client.rpc('get_daily_quest_status'), dailyQuestStatusSchema))
}

/** Read-only staff RPC: answer keys never pass through a student load. */
export async function loadDailyQuestPreview(level: unknown = 'A1'): Promise<DailyQuestResult<DailyQuestPreview>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new QuestRequestError('not_authenticated')
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profileError || (profile?.role !== 'teacher' && profile?.role !== 'admin')) throw new QuestRequestError('not_authorized')
    const parsed = dailyQuestLevelSchema.safeParse(level)
    if (!parsed.success) throw new QuestRequestError('invalid_input')
    return { data: await readRpc(supabase.rpc('get_daily_quest_preview', { p_level: parsed.data }), dailyQuestPreviewSchema) }
  } catch (error) {
    if (error instanceof QuestRequestError) return { error: error.code }
    console.error('[daily-quest] Preview unavailable')
    return { error: 'request_failed' }
  }
}

export function updateDailyQuestEnabled(enabled: boolean) {
  return withStudent(client => readRpc(client.rpc('set_daily_quest_enabled', { p_enabled: enabled }), dailyQuestStatusSchema))
}

export function submitDailyQuestAnswer(input: { assignmentId: string; stepId: string; answer: DailyQuestStepAnswer }) {
  return withStudent(client => readRpc(client.rpc('submit_daily_quest_step', {
    p_assignment_id: input.assignmentId, p_step_id: input.stepId, p_answer: input.answer,
  }), dailyQuestStepResultSchema))
}

export function finishDailyQuest(assignmentId: string) {
  return withStudent(client => readRpc(client.rpc('complete_daily_quest', { p_assignment_id: assignmentId }), dailyQuestMutationSchema))
}

export function dismissDailyQuest(assignmentId: string) {
  return withStudent(client => readRpc(client.rpc('skip_daily_quest', { p_assignment_id: assignmentId }), dailyQuestMutationSchema))
}

/**
 * Called only after a successful authentication, never from layout/Proxy.
 * Explicit learning destinations bypass the daily switch. A broken quest must
 * never turn a successful login into an authentication failure.
 */
export async function resolveDailyQuestLoginTarget({ supabase, userId, lang, nextPath }: {
  supabase: QuestClient; userId: string; lang: string; nextPath: string
}): Promise<string> {
  if (nextPath !== `/${lang}/dashboard`) return nextPath
  try {
    await requireStudent(supabase, userId)
    const claim = await readRpc(supabase.rpc('claim_daily_quest_login'), dailyQuestLoginSchema)
    return claim.enabled && claim.shouldRedirect && claim.assignmentId
      ? `/${lang}/dashboard/daily-quest` : nextPath
  } catch {
    return nextPath
  }
}
