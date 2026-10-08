import 'server-only'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireSitovStaffMfa, SitovStaffMfaRequiredError } from '@/lib/sitov-staff-mfa'
import { ACCESS_LEVELS } from './levels'
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const amount = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const currency = z.string().regex(/^[A-Z]{3}$/).refine(value => Intl.supportedValuesOf('currency').includes(value))
const product = z.object({ level: z.enum(ACCESS_LEVELS), amount_minor: amount.nullable(), currency: currency.nullable(), revision }).strict()
  .refine(value => (value.amount_minor === null) === (value.currency === null))
export const sitovBillingSettingsSchema = z.object({ enabled: z.boolean(), provider: z.enum(['none','stripe']), revision,
  configuration_ready: z.literal(false), missing: z.array(z.literal('provider_adapter')).length(1),
  products: z.array(product).length(ACCESS_LEVELS.length),
}).strict().refine(value => new Set(value.products.map(p => p.level)).size === ACCESS_LEVELS.length)
export type SitovBillingSettings = z.infer<typeof sitovBillingSettingsSchema>
export type SitovBillingResult<T> = { ok: true; data: T } | { ok: false; error: 'forbidden' | 'invalid_input' | 'revision_conflict' | 'provider_not_configured' | 'unavailable' }
async function clientForStaff() {
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null
  const profile = await client.from('profiles').select('role,sitov_mfa_required').eq('id', user.id).single()
  if (profile.error || !profile.data || !['teacher','admin'].includes(profile.data.role ?? '')) return null
  await requireSitovStaffMfa(client, profile.data)
  return client
}
function failed(value: unknown): SitovBillingResult<never> {
  const parsed = z.object({ error: z.enum(['forbidden','invalid_input','revision_conflict','provider_not_configured']) }).safeParse(value)
  return { ok: false, error: parsed.success ? parsed.data.error : 'unavailable' }
}
const caught = (error: unknown): SitovBillingResult<never> => ({ ok: false, error: error instanceof SitovStaffMfaRequiredError ? 'forbidden' : 'unavailable' })
export async function readSitovBillingSettings(): Promise<SitovBillingResult<SitovBillingSettings>> {
  try {
    const client = await clientForStaff()
    if (!client) return { ok: false, error: 'forbidden' }
    const result = await client.rpc('get_sitov_billing_settings')
    if (result.error) return { ok: false, error: 'unavailable' }
    const parsed = sitovBillingSettingsSchema.safeParse(result.data)
    return parsed.success ? { ok: true, data: parsed.data } : failed(result.data)
  } catch (error) { return caught(error) }
}
export async function writeSitovBillingPrice(input: unknown): Promise<SitovBillingResult<{ revision: number }>> {
  const parsed = z.object({ level: z.enum(ACCESS_LEVELS), amountMinor: amount, currency, revision }).strict().safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }
  try {
    const client = await clientForStaff()
    if (!client) return { ok: false, error: 'forbidden' }
    const value = parsed.data
    const result = await client.rpc('set_sitov_product_price', { p_level: value.level, p_amount_minor: value.amountMinor, p_currency: value.currency, p_expected_revision: value.revision })
    if (result.error) return { ok: false, error: 'unavailable' }
    const saved = z.object({ success: z.literal(true), revision }).strict().safeParse(result.data)
    if (!saved.success || saved.data.revision !== value.revision + 1) return failed(result.data)
    return { ok: true, data: { revision: saved.data.revision } }
  } catch (error) { return caught(error) }
}
export async function disableSitovBilling(input: unknown): Promise<SitovBillingResult<{ revision: number; enabled: false }>> {
  const parsed = z.object({ revision }).strict().safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }
  try {
    const client = await clientForStaff()
    if (!client) return { ok: false, error: 'forbidden' }
    // No enable parameter exists in this action; provider activation is a separate task.
    const result = await client.rpc('set_sitov_billing_enabled', { p_enabled: false, p_expected_revision: parsed.data.revision })
    if (result.error) return { ok: false, error: 'unavailable' }
    const saved = z.object({ success: z.literal(true), revision, enabled: z.literal(false) }).strict().safeParse(result.data)
    if (!saved.success || saved.data.revision !== parsed.data.revision + 1) return failed(result.data)
    return { ok: true, data: { revision: saved.data.revision, enabled: false } }
  } catch (error) { return caught(error) }
}
