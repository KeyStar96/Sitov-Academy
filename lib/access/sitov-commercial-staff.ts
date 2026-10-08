import 'server-only'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireSitovStaffMfa, SitovStaffMfaRequiredError } from '@/lib/sitov-staff-mfa'
import { ACCESS_LEVELS, TRAINERS, sitovLevelHasTrainer } from './levels'
import { SITOV_CONTENT_KINDS, sitovTrialManifestSchema } from './sitov-commercial'

export const sitovStaffAccessSchema = z.object({ vip_enabled: z.boolean(), trial: sitovTrialManifestSchema,
  purchased_levels: z.array(z.enum(ACCESS_LEVELS)), revision: z.number().int().nonnegative() }).strict()
export type SitovStaffAccess = z.infer<typeof sitovStaffAccessSchema>
const catalogSchema = z.object({ version: z.literal(1), level: z.enum(ACCESS_LEVELS), trainer: z.enum(TRAINERS),
  units: z.array(z.object({ id: z.uuid().nullable(), label: z.string().max(1000), items: z.array(z.object({
    kind: z.enum(SITOV_CONTENT_KINDS), id: z.string().min(1).max(160), label: z.string().max(1000), published: z.boolean(),
  }).strict()).max(20000) }).strict()).max(1000) }).strict()
export type SitovStaffCatalog = z.infer<typeof catalogSchema>
export type SitovStaffResult<T> = { ok: true; data: T } | { ok: false; error: 'forbidden' | 'invalid_input' | 'revision_conflict' | 'unavailable' }
const studentSchema = z.uuid()
const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

async function staffClient(studentId?: string) {
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null
  const profile = await client.from('profiles').select('role,sitov_mfa_required').eq('id', user.id).single()
  if (profile.error || !profile.data || !['teacher', 'admin'].includes(profile.data.role ?? '')) return null
  await requireSitovStaffMfa(client, profile.data)
  if (studentId) {
    const target = await client.from('profiles').select('role').eq('id', studentId).maybeSingle()
    if (target.error || target.data?.role !== 'student') return null
  }
  return client
}
function failure(value: unknown): SitovStaffResult<never> {
  const parsed = z.object({ error: z.enum(['forbidden', 'invalid_input', 'revision_conflict']) }).safeParse(value)
  return { ok: false, error: parsed.success ? parsed.data.error : 'unavailable' }
}
export async function readSitovStaffAccess(studentId: unknown): Promise<SitovStaffResult<SitovStaffAccess>> {
  if (!studentSchema.safeParse(studentId).success) return { ok: false, error: 'invalid_input' }
  try {
    const client = await staffClient(studentSchema.parse(studentId))
    if (!client) return { ok: false, error: 'forbidden' }
    const result = await client.rpc('get_sitov_access_context', { p_student: studentSchema.parse(studentId) })
    if (result.error) return { ok: false, error: 'unavailable' }
    const parsed = sitovStaffAccessSchema.safeParse(result.data)
    return parsed.success ? { ok: true, data: parsed.data } : failure(result.data)
  } catch (error) { return { ok: false, error: error instanceof SitovStaffMfaRequiredError ? 'forbidden' : 'unavailable' } }
}
export async function readSitovStaffCatalog(input: unknown): Promise<SitovStaffResult<SitovStaffCatalog>> {
  const parsed = z.object({ level: z.enum(ACCESS_LEVELS), trainer: z.enum(TRAINERS) }).strict().safeParse(input)
  if (!parsed.success || !sitovLevelHasTrainer(parsed.data.level, parsed.data.trainer)) return { ok: false, error: 'invalid_input' }
  try {
    const client = await staffClient()
    if (!client) return { ok: false, error: 'forbidden' }
    // The staff cookie RPC exposes only canonical scope metadata, including items the student lacks.
    const result = await client.rpc('get_sitov_access_catalog', { p_level: parsed.data.level, p_trainer: parsed.data.trainer })
    if (result.error) return { ok: false, error: 'unavailable' }
    const catalog = catalogSchema.safeParse(result.data)
    if (!catalog.success || catalog.data.level !== parsed.data.level || catalog.data.trainer !== parsed.data.trainer) return failure(result.data)
    // A vocabulary card's actual headword is its selection label; no answer keys,
    // translations, audio URLs or complete task bodies enter the staff DTO.
    const ids = catalog.data.units.flatMap(unit => unit.items.filter(item => item.kind === 'vocabulary_card' && item.label === unit.label).map(item => item.id))
    const labels = new Map<string, string>()
    for (let offset = 0; offset < ids.length; offset += 300) {
      const rows = await client.from('learning_vocabulary_cards').select('id,word_de').in('id', ids.slice(offset, offset + 300))
      if (rows.error || !rows.data) return { ok: false, error: 'unavailable' }
      for (const row of rows.data) labels.set(row.id, row.word_de)
    }
    return { ok: true, data: { ...catalog.data, units: catalog.data.units.map(unit => ({ ...unit,
      items: unit.items.map(item => ({ ...item, label: item.kind === 'vocabulary_card' ? labels.get(item.id) ?? item.label : item.label })),
    })) } }

  } catch (error) { return { ok: false, error: error instanceof SitovStaffMfaRequiredError ? 'forbidden' : 'unavailable' } }
}
export async function writeSitovStaffAccess(input: unknown): Promise<SitovStaffResult<{ revision: number }>> {
  const parsed = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('vip'), studentId: studentSchema, enabled: z.boolean(), revision: revisionSchema }).strict(),
    z.object({ kind: z.literal('trial'), studentId: studentSchema, manifest: sitovTrialManifestSchema, revision: revisionSchema }).strict(),
  ]).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }
  try {
    const client = await staffClient(parsed.data.studentId)
    if (!client) return { ok: false, error: 'forbidden' }
    const value = parsed.data
    const result = value.kind === 'vip'
      ? await client.rpc('set_sitov_student_vip', { p_student: value.studentId, p_enabled: value.enabled, p_expected_revision: value.revision })
      : await client.rpc('set_sitov_student_trial', { p_student: value.studentId, p_manifest: value.manifest, p_expected_revision: value.revision })
    if (result.error) return { ok: false, error: 'unavailable' }
    const saved = z.object({ success: z.literal(true), revision: revisionSchema }).strict().safeParse(result.data)
    if (!saved.success || saved.data.revision !== value.revision + 1) return failure(result.data)
    return { ok: true, data: { revision: saved.data.revision } }
  } catch (error) { return { ok: false, error: error instanceof SitovStaffMfaRequiredError ? 'forbidden' : 'unavailable' } }
}
