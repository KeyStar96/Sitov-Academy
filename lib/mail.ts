import 'server-only'
import { readSupabasePublicConfig } from '@/lib/supabase-env'

export type TransactionalMailKind = 'registration_received' | 'registration_confirmed' | 'booking_cancelled' | 'cancellation_requested' | 'trial_confirmed' | 'trial_cancelled' | 'new_enrollment' | 'feedback_available'
export interface TransactionalMailPayload {
  name?: string
  courses?: Array<{ title: string; price?: number; units?: number; unitPrice?: number; unitMinutes?: number }>
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
export interface MailSendResult { success: boolean; messageId?: string; error?: string }
interface QueueInput extends QueueTransactionalEmailInput {}

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
    if (!response.ok) { console.error("[mail-outbox] enqueue_failed"); return {success:false,error:'mail_queue_failed'} }
    const result: unknown = await response.json()
    return typeof result === 'string' ? {success:true,messageId:result} : {success:false,error:'mail_queue_failed'}
  } catch { console.error('[mail-outbox] enqueue_failed'); return {success:false,error:'mail_queue_failed'} }
}
export async function queueTransactionalEmail(input: QueueTransactionalEmailInput): Promise<MailSendResult> { return enqueue(input) }
