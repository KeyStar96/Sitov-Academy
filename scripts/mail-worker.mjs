#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'
import { createLocalSmtpTransport, senderAddress } from '../lib/mail/smtp.mjs'
import { mailSiteOrigin } from '../lib/mail/templates.mjs'
import { runMailBatch } from '../lib/mail/worker.mjs'

// Run with node --env-file=/etc/sitov-academy/app.env scripts/mail-worker.mjs.
// All configuration is server-side; secrets must never enter a public bundle.
async function main() {
  const url = process.env.SUPABASE_INTERNAL_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('mail_database_not_configured')
  mailSiteOrigin(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '')
  senderAddress()
  const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const transport = createLocalSmtpTransport()
  const workerId = randomUUID()
  let stopping = false
  const controller = new AbortController()
  const stop = () => { stopping=true; controller.abort() }
  process.once('SIGINT',stop); process.once('SIGTERM',stop)
  console.info('[mail-worker] started',{workerId})
  try {
    while (!stopping) {
      await runMailBatch({client,transport,workerId})
      if (process.argv.includes('--once')) break
      try { await delay(5000,undefined,{signal:controller.signal}) } catch { /* Graceful shutdown. */ }
    }
  } finally { transport.close(); console.info('[mail-worker] stopped') }
}
main().catch(error => { console.error('[mail-worker] startup_failed',error instanceof Error ? error.message : 'unknown'); process.exitCode=1 })
