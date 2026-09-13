import 'server-only'
import { createHash } from 'node:crypto'
import { readSupabasePublicConfig } from '@/lib/supabase-env'

export type TransactionalMailKind = 'registration_received' | 'registration_confirmed' | 'booking_cancelled' | 'cancellation_requested' | 'trial_confirmed' | 'trial_cancelled' | 'new_enrollment' | 'feedback_available'
export interface TransactionalMailPayload {
  name?: string
  courses?: Array<{ title: string; price?: number }>
  total?: number
  startDate?: string
  endDate?: string
  message?: string
  path?: string
}
export interface QueueTransactionalEmailInput {
  dedupeKey: string
  kind: TransactionalMailKind
  to: string
  locale?: string
  payload: TransactionalMailPayload
}
export interface MailOptions { to: string; subject: string; html: string; text?: string; from?: string; dedupeKey?: string }
export interface MailSendResult { success: boolean; messageId?: string; error?: string }
interface QueueInput { dedupeKey: string; kind: TransactionalMailKind | 'raw'; to: string; locale?: string; payload: TransactionalMailPayload | { subject: string; html: string; text: string } }

/** Success means durably queued. Only the native worker performs SMTP delivery. */
async function enqueue(input: QueueInput): Promise<MailSendResult> {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) return { success:false,error:'mail_not_configured' }
    const url = process.env.SUPABASE_INTERNAL_URL || readSupabasePublicConfig().url
    const response = await fetch(`${url}/rest/v1/rpc/queue_transactional_email`, {
      method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},
      body:JSON.stringify({p_dedupe_key:input.dedupeKey,p_kind:input.kind,p_recipient:input.to,p_locale:input.locale ?? 'de',p_payload:input.payload}),
      cache:'no-store',signal:AbortSignal.timeout(10000),
    })
    if (!response.ok) { console.error('[mail-outbox] enqueue_failed',{status:response.status}); return {success:false,error:'mail_queue_failed'} }
    const result: unknown = await response.json()
    return typeof result === 'string' ? {success:true,messageId:result} : {success:false,error:'mail_queue_failed'}
  } catch { console.error('[mail-outbox] enqueue_failed'); return {success:false,error:'mail_queue_failed'} }
}
export async function queueTransactionalEmail(input: QueueTransactionalEmailInput): Promise<MailSendResult> { return enqueue(input) }

/** Compatibility for server callers; new events should use a named template and event ID. */
export async function sendEmail(options: MailOptions): Promise<MailSendResult> {
  const text = options.text ?? options.html.replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
  const dedupeKey = options.dedupeKey ?? `legacy:${createHash('sha256').update(`${options.to}\n${options.subject}\n${options.html}`).digest('hex')}`
  return enqueue({dedupeKey,kind:'raw',to:options.to,payload:{subject:options.subject,html:options.html,text}})
}
