import { randomUUID } from 'node:crypto'
import { renderTransactionalEmail, mailSiteOrigin } from './templates.mjs'
import { senderAddress, deliveryError } from './smtp.mjs'

export function isMailJob(value) {
  return value && typeof value === 'object' && typeof value.id === 'string' && typeof value.lease_token === 'string'
    && typeof value.recipient === 'string' && typeof value.kind === 'string' && typeof value.locale === 'string'
    && value.payload && typeof value.payload === 'object' && !Array.isArray(value.payload)
}

/** Injected DB and SMTP boundaries make the complete delivery loop testable without external mail. */
export async function runMailBatch({ client, transport, env=process.env, workerId=randomUUID(), logger=console }) {
  const siteUrl = mailSiteOrigin(env.SITE_URL || env.NEXT_PUBLIC_SITE_URL || '')
  const from = senderAddress(env)
  let result
  try { result = await client.rpc('claim_mail_jobs', { p_worker_id:workerId, p_limit:5 }) }
  catch { logger.error('[mail-worker] claim_failed'); return 0 }
  if (result.error || !Array.isArray(result.data)) { logger.error('[mail-worker] claim_failed'); return 0 }
  await Promise.all(result.data.map(async job => {
    if (!isMailJob(job)) { logger.error('[mail-worker] invalid_claim'); return }
    let mail
    try {
      if (job.kind === 'raw') {
        if (typeof job.payload.subject !== 'string' || typeof job.payload.html !== 'string' || typeof job.payload.text !== 'string') throw new Error('invalid_raw_mail')
        mail = { subject:job.payload.subject, html:job.payload.html, text:job.payload.text }
      } else mail = renderTransactionalEmail(job.kind,job.locale,job.payload,siteUrl)
    } catch {
      try {
        const failed = await client.rpc('fail_mail_job',{ p_id:job.id,p_lease_token:job.lease_token,p_error:'invalid_mail_payload',p_permanent:true })
        if (failed.error || failed.data !== true) logger.error('[mail-worker] failure_write_failed', { id:job.id })
      }
      catch { logger.error('[mail-worker] failure_write_failed', { id:job.id }) }
      return
    }
    const messageId = `<${job.id}@${from.address.split('@')[1]}>`
    try {
      const sent = await transport.sendMail({ ...mail, from, to:job.recipient, replyTo:from.address, messageId,
        disableFileAccess:true, disableUrlAccess:true })
      if (sent.rejected?.length || !sent.accepted?.length) throw Object.assign(new Error('smtp_rejected'),{ code:'ERECIPIENT',responseCode:550 })
    } catch (error) {
      const failure = deliveryError(error)
      try {
        const failed = await client.rpc('fail_mail_job',{p_id:job.id,p_lease_token:job.lease_token,p_error:failure.code,p_permanent:failure.permanent})
        if (failed.error || failed.data !== true) logger.error('[mail-worker] failure_write_failed',{id:job.id})
      } catch { logger.error('[mail-worker] failure_write_failed',{id:job.id}) }
      logger.error('[mail-worker] delivery_failed',{id:job.id,code:failure.code})
      return
    }
    // SMTP acceptance is not atomic with Postgres acknowledgement. Preserve the lease on
    // acknowledgement failure: an operator can inspect it before an eventual retry.
    try {
      const ack = await client.rpc('complete_mail_job',{p_id:job.id,p_lease_token:job.lease_token,p_message_id:messageId})
      if (ack.error || ack.data !== true) logger.error('[mail-worker] smtp_accepted_ack_failed',{id:job.id})
      else logger.info('[mail-worker] delivered',{id:job.id})
    } catch { logger.error('[mail-worker] smtp_accepted_ack_failed',{id:job.id}) }
  }))
  return result.data.length
}
