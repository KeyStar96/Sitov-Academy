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
