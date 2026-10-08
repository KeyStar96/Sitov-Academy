'use server'
import { revalidatePath } from 'next/cache'
import { readSitovStaffAccess, readSitovStaffCatalog, writeSitovStaffAccess } from '@/lib/access/sitov-commercial-staff'

export async function getSitovStaffCommercialAccess(studentId: unknown) { return readSitovStaffAccess(studentId) }
export async function getSitovStaffCommercialCatalog(input: unknown) { return readSitovStaffCatalog(input) }
export async function saveSitovStaffCommercialAccess(input: unknown) {
  const result = await writeSitovStaffAccess(input)
  if (result.ok) {
    try { revalidatePath('/[lang]/dashboard', 'layout') } catch { /* Saved DB rights remain authoritative. */ }
  }
  return result
}

export async function getSitovStaffBillingSettings() {
  const { readSitovBillingSettings } = await import('@/lib/access/sitov-billing-staff')
  return readSitovBillingSettings()
}
export async function saveSitovStaffBillingPrice(input: unknown) {
  const { writeSitovBillingPrice } = await import('@/lib/access/sitov-billing-staff')
  const result = await writeSitovBillingPrice(input)
  if (result.ok) { try { revalidatePath('/[lang]/admin/settings/billing', 'page') } catch { /* Saved value remains authoritative. */ } }
  return result
}
export async function turnOffSitovStaffBilling(input: unknown) {
  const { disableSitovBilling } = await import('@/lib/access/sitov-billing-staff')
  const result = await disableSitovBilling(input)
  if (result.ok) { try { revalidatePath('/[lang]/admin/settings/billing', 'page') } catch { /* Saved state remains authoritative. */ } }
  return result
}
