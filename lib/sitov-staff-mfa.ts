import 'server-only'
import type { createClient } from '@/utils/supabase/server'

export class SitovStaffMfaRequiredError extends Error {
  constructor() { super('staff_mfa_required') }
}

/** Database is authoritative for the mandatory flag, JWT AAL and factor state. */
export async function requireSitovStaffMfa(
  client: Awaited<ReturnType<typeof createClient>>,
  profile: { role?: string | null; sitov_mfa_required?: boolean } | null,
) {
  if (!profile || !['teacher', 'admin'].includes(profile.role ?? '') || profile.sitov_mfa_required !== true) return
  const result = await client.rpc('sitov_staff_mfa_status')
  const status = result.data
  if (result.error || !status || typeof status !== 'object' || Array.isArray(status) || status.satisfied !== true) {
    throw new SitovStaffMfaRequiredError()
  }
}
