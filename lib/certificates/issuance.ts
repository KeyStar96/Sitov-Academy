import 'server-only'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resolveVerifiedPerson } from '@/lib/profile-person'
import { certificateEligibilitySchema, certificateMonthSchema } from './types'
import type { Json } from '@/supabase/database.types'

export class CertificateHttpError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code) }
}
export const certificateRequestSchema = z.object({ month: certificateMonthSchema.nullable() }).strict()
const issueSchema = z.object({
  id: z.uuid(), person_id: z.uuid(), certificate_number: z.string().min(1).max(100),
  status: z.enum(['generating', 'issued', 'failed', 'revoked']),
  storage_bucket: z.literal('certificates'), storage_path: z.string(),
  pdf_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  snapshot: z.object({
    person: z.object({ display_name: z.string().min(1), street: z.string().nullable(), postal_code: z.string().nullable(), city: z.string().nullable() }),
    periods: certificateEligibilitySchema.min(1).max(600), date: z.iso.date(),
  }),
})
type Issue = z.infer<typeof issueSchema>
type Actor = { userId: string; personId: string }
const MAX_PDF_BYTES = 10 * 1024 * 1024

export async function certificateActor(): Promise<Actor> {
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || !user.email_confirmed_at || user.is_anonymous) throw new CertificateHttpError('not_authenticated', 401)
  const identity = await resolveVerifiedPerson(user)
  if (!identity.id || identity.unresolved) throw new CertificateHttpError('identity_unresolved', 409)
  return { userId: user.id, personId: identity.id }
}

async function issueCommand(actor: Actor, command: string, payload: Json): Promise<Issue> {
  const result = await createAdminClient().rpc('certificate_issue_command', { p_actor: actor.userId, p_command: command, p_payload: payload })
  if (result.error) {
    if (result.error.code === '42501' || result.error.code === 'P0002') throw new CertificateHttpError('not_available', 404)
    if (['40001', 'PT409', '23505'].includes(result.error.code)) throw new CertificateHttpError('source_changed', 409)
    if (result.error.code === '22023') throw new CertificateHttpError('invalid_input', 400)
    throw new CertificateHttpError('request_failed', 503)
  }
  const failure = z.object({ error: z.string() }).safeParse(result.data)
  if (failure.success) {
    if (failure.data.error === 'invalid_input') throw new CertificateHttpError('invalid_input', 400)
    throw new CertificateHttpError(failure.data.error === 'conflict' ? 'source_changed' : 'request_failed', failure.data.error === 'conflict' ? 409 : 503)
  }
  const parsed = issueSchema.safeParse(result.data)
  if (parsed.success === false) throw new CertificateHttpError('request_failed', 503)
  const issue = parsed.data
  if (issue.person_id !== actor.personId || issue.storage_path !== `${actor.personId}/${issue.id}.pdf` ||
    issue.snapshot.periods.some(period => period.person_id !== actor.personId)) throw new CertificateHttpError('not_available', 404)
  return issue
}

/** Rendering happens outside the DB transaction; finalization revalidates every source. */
export async function issueCertificate(actor: Actor, month: string | null): Promise<string> {
  const issue = await issueCommand(actor, 'reserve', { month })
  if (issue.status === 'issued') return issue.id
  if (issue.status !== 'generating') throw new CertificateHttpError('source_changed', 409)
  try {
    const { renderCertificatePdf } = await import('./pdf')
    const pdf = await renderCertificatePdf({ certificate_number: issue.certificate_number,
      snapshot: { ...issue.snapshot, person: { display_name: issue.snapshot.person.display_name,
        street: issue.snapshot.person.street ?? null, postal_code: issue.snapshot.person.postal_code ?? null,
        city: issue.snapshot.person.city ?? null } } })
    if (pdf.length === 0 || pdf.length > MAX_PDF_BYTES || pdf.subarray(0, 5).toString() !== '%PDF-') throw new CertificateHttpError('render_failed', 503)
    const digest = createHash('sha256').update(pdf).digest('hex')
    const result = await createAdminClient().storage.from('certificates').upload(issue.storage_path, pdf, {
      contentType: 'application/pdf', cacheControl: '0', upsert: false,
      metadata: { issue_id: issue.id, sha256: digest },
    })
    if (result.error) throw new CertificateHttpError('storage_failed', 503)
    const final = await issueCommand(actor, 'finalize', { id: issue.id, pdf_sha256: digest })
    if (final.status !== 'issued') throw new CertificateHttpError('source_changed', 409)
    return final.id
  } catch (error: unknown) {
    try {
      // A timed-out finalize may already have succeeded. Delete only after the
      // database confirms failure; issued/revoked historical PDFs stay intact.
      const failed = await issueCommand(actor, 'fail', { id: issue.id })
      if (failed.status === 'failed') {
        const cleanup = await createAdminClient().storage.from('certificates').remove([issue.storage_path])
        if (cleanup.error) console.warn('[certificates] Failed PDF cleanup needs retry')
      }
    } catch { /* Leave the private object for recovery if its final state is unknown. */ }
    throw error
  }
}

export async function downloadCertificate(actor: Actor, id: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; filename: string }> {
  const issue = await issueCommand(actor, 'download', { id })
  if (issue.status !== 'issued' || !issue.pdf_sha256) throw new CertificateHttpError('not_available', 404)
  const result = await createAdminClient().storage.from('certificates').download(issue.storage_path)
  if (result.error || !result.data || result.data.size > MAX_PDF_BYTES) throw new CertificateHttpError('storage_failed', 503)
  const bytes = new Uint8Array(await result.data.arrayBuffer())
  if (createHash('sha256').update(bytes).digest('hex') !== issue.pdf_sha256) throw new CertificateHttpError('storage_failed', 503)
  // A reconciliation can finish during the Storage fetch. Recheck immediately
  // before returning bytes instead of issuing a bypassable signed Storage URL.
  const current = await issueCommand(actor, 'download', { id })
  if (current.status !== 'issued' || current.pdf_sha256 !== issue.pdf_sha256) throw new CertificateHttpError('source_changed', 409)
  return { bytes, filename: `Teilnahmebescheinigung-${issue.certificate_number.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf` }
}

export const certificateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' }
export function certificateErrorResponse(error: unknown): Response {
  if (error instanceof CertificateHttpError) return Response.json({ error: error.code }, { status: error.status, headers: certificateHeaders })
  if (error instanceof z.ZodError) return Response.json({ error: 'invalid_input' }, { status: 400, headers: certificateHeaders })
  console.error('[certificates] Request failed')
  return Response.json({ error: 'request_failed' }, { status: 503, headers: certificateHeaders })
}

export function requireCertificateOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  const expected = new Set([new URL(request.url).origin])
  for (const value of [process.env.SITE_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    if (value) expected.add(new URL(value).origin)
  }
  if (!origin || !expected.has(origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new CertificateHttpError('not_authorized', 403)
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new CertificateHttpError('invalid_input', 400)
}

export async function readCertificateRequest(request: Request): Promise<z.infer<typeof certificateRequestSchema>> {
  const reader = request.body?.getReader()
  if (!reader) throw new CertificateHttpError('invalid_input', 400)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 1024) { await reader.cancel(); throw new CertificateHttpError('invalid_input', 413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  let json: unknown
  try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new CertificateHttpError('invalid_input', 400) }
  return certificateRequestSchema.parse(json)
}
