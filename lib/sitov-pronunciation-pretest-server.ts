import 'server-only'
import { z } from 'zod'
import { requestSession } from '@/lib/request-session'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import {
  sitovPronunciationPretestActionResultSchema as responseSchema,
  sitovPronunciationPretestCatalogSchema as catalogSchema,
  sitovPronunciationPretestAttemptWithTasksSchema as openSchema,
  sitovPronunciationPretestAttemptResponseSchema as attemptSchema,
  sitovPronunciationPretestAttemptSchema as summarySchema,
  sitovPronunciationPretestCompletedAttemptSchema as completedSchema,
  sitovPronunciationPretestUploadTicketSchema as ticketSchema,
  sitovPronunciationPretestStartInputSchema as startSchema,
  sitovPronunciationPretestAnswersInputSchema as answersSchema,
  type SitovPronunciationPretestActionResult,
} from './sitov-pronunciation-pretest-contract'

import { sitovPretestAuthorSaveInputSchema, sitovPretestAuthorSavedSchema, sitovPretestStaffDefinitionSchema } from './sitov-pronunciation-pretest-author-contract'

type Client = Awaited<ReturnType<typeof requestSession>>['supabase']
const fail = (error: 'invalid_input' | 'authentication_required' | 'retryable_failure' | 'attempt_conflict') => ({ ok: false as const, error, retryable: error === 'retryable_failure' })
async function run<T extends z.ZodType>(schema: T, query: (client: Client) => PromiseLike<{ data: unknown; error: unknown }>): Promise<SitovPronunciationPretestActionResult<z.infer<T>>> {
  try {
    const { supabase, user } = await requestSession()
    if (!user) return fail('authentication_required')
    const result = await query(supabase)
    if (result.error) return fail('retryable_failure')
    const parsed = responseSchema(schema).safeParse(result.data)
    if (!parsed.success) return fail('retryable_failure')
    // Zod validated the exact envelope; this bridges its generic mapped output type.
    return parsed.data as SitovPronunciationPretestActionResult<z.infer<T>>
  } catch { return fail('retryable_failure') }
}
export async function loadSitovPronunciationPretests(level: string) {
  if (!z.enum(ACCESS_LEVELS).safeParse(level).success) return fail('invalid_input')
  return run(catalogSchema, client => client.rpc('sitov_get_pronunciation_pretests', { p_level: level }))
}
export async function startSitovPronunciationPretestServer(input: unknown) {
  const parsed = startSchema.safeParse(input)
  if (!parsed.success) return fail('invalid_input')
  const result = await run(attemptSchema, client => client.rpc('sitov_start_pronunciation_pretest', { p_text_id: parsed.data.textId, p_request_id: parsed.data.requestId }))
  // A stale tab may start after another tab passed. Ask it to refresh the catalog;
  // never construct a fake open form from a completed attempt.
  if (result.ok === false) return result
  const open = openSchema.safeParse(result.data)
  if (!open.success) return fail('attempt_conflict')
  return { ok: true as const, data: open.data }
}
export async function loadSitovPronunciationPretestAttempt(attemptId: string) {
  if (!z.uuid().safeParse(attemptId).success) return fail('invalid_input')
  return run(attemptSchema, client => client.rpc('sitov_get_pronunciation_pretest_attempt', { p_attempt_id: attemptId }))
}
export async function saveSitovPronunciationPretestAnswersServer(input: unknown) {
  const parsed = answersSchema.safeParse(input)
  if (!parsed.success) return fail('invalid_input')
  const value = parsed.data
  return run(summarySchema, client => client.rpc('sitov_save_pronunciation_pretest_answers', { p_attempt_id: value.attemptId, p_revision: value.revision, p_answers: value.answers, p_request_id: value.requestId }))
}
export async function submitSitovPronunciationPretestServer(input: unknown) {
  const parsed = answersSchema.safeParse(input)
  if (!parsed.success) return fail('invalid_input')
  const value = parsed.data
  return run(completedSchema, client => client.rpc('sitov_submit_pronunciation_pretest', { p_attempt_id: value.attemptId, p_revision: value.revision, p_answers: value.answers, p_request_id: value.requestId }))
}
const uploadInput = z.object({ textId: z.uuid(), requestId: z.uuid(), extension: z.enum(['webm', 'mp4', 'ogg', 'wav', 'mp3']) }).strict()
export async function createSitovPronunciationUploadTicketServer(input: unknown) {
  const parsed = uploadInput.safeParse(input)
  if (!parsed.success) return fail('invalid_input')
  const value = parsed.data
  return run(ticketSchema, client => client.rpc('sitov_create_pronunciation_upload_ticket', { p_text_id: value.textId, p_request_id: value.requestId, p_extension: value.extension }))
}
const replyInput = z.object({ submissionId: z.uuid(), requestId: z.uuid(), extension: z.enum(['webm', 'mp4', 'ogg', 'wav', 'mp3']) }).strict()
const replyTicket = ticketSchema.omit({ textVersion: true }).extend({ submissionId: z.uuid(), purpose: z.literal('reply') }).strict()
export async function createSitovPronunciationReplyUploadTicketServer(input: unknown) {
  const parsed = replyInput.safeParse(input)
  if (!parsed.success) return fail('invalid_input')
  const value = parsed.data
  return run(replyTicket, client => client.rpc('sitov_create_pronunciation_reply_upload_ticket', { p_submission_id: value.submissionId, p_request_id: value.requestId, p_extension: value.extension }))
}

const staffInput = z.object({ textId: z.uuid(), studentId: z.uuid().nullable().optional() }).strict()
const staffDefinition = sitovPretestStaffDefinitionSchema
const staffData = z.object({ definitions: z.array(staffDefinition), attempts: z.array(attemptSchema) }).strict()
export async function loadSitovPronunciationPretestStaff(input: unknown) {
  const parsed = staffInput.safeParse(input)
  if (!parsed.success) return fail('invalid_input')
  return run(staffData, client => client.rpc('sitov_get_pronunciation_pretest_staff', { p_text_id: parsed.data.textId, p_student_id: parsed.data.studentId ?? null }))
}

/** Cookie-scoped authenticated RPC only; SQL independently enforces staff/MFA. */
export async function saveSitovPronunciationPretestDraftServer(input: unknown) {
  const parsed=sitovPretestAuthorSaveInputSchema.safeParse(input)
  if(!parsed.success)return fail('invalid_input')
  const v=parsed.data
  // Narrow temporary signature until M adds this exact RPC to shared generated types.
  type DraftRpc=(name:'sitov_save_pronunciation_pretest_draft',args:{p_text_id:string;p_text_version:string;p_base_definition_id:string|null;p_definition:typeof v.definition;p_request_id:string})=>PromiseLike<{data:unknown;error:unknown}>
  const result=await run(sitovPretestAuthorSavedSchema,client=>(client.rpc as unknown as DraftRpc)('sitov_save_pronunciation_pretest_draft',{p_text_id:v.textId,p_text_version:v.textVersion,p_base_definition_id:v.baseDefinitionId,p_definition:v.definition,p_request_id:v.requestId}))
  if(result.ok&&(result.data.text_id!==v.textId||result.data.text_version!==v.textVersion||JSON.stringify(result.data.definition)!==JSON.stringify(v.definition)))return fail('retryable_failure')
  return result
}
