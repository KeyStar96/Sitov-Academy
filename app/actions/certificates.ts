'use server'

import { revalidatePath } from 'next/cache'
import { withBackendSession, revalidateBackendPages } from '@/lib/actions/backend'
import type { BackendActionResult } from '@/lib/types/backend'
import { uuidSchema } from '@/lib/types/backend'
import {
  loadCertificateAdminData, loadCertificateImportRows, loadStudentCertificateData,
  runCertificateStaffCommand, stageCertificateImport, loadStaffCertificateEligibility,
} from '@/lib/certificates/server'
import {
  certificateStaffCommandSchema, type CertificateAdminData, type CertificateCommandResult,
  type CertificateImportRow, type StudentCertificateData, type CertificateEligibilityPeriod,
} from '@/lib/certificates/types'

export async function getCertificateAdminData(): Promise<BackendActionResult<CertificateAdminData>> {
  return withBackendSession(context => loadCertificateAdminData(context), 'staff')
}
export async function getCertificateImportRows(batchId: string): Promise<BackendActionResult<CertificateImportRow[]>> {
  return withBackendSession(context => loadCertificateImportRows(context, uuidSchema.parse(batchId)), 'staff')
}
export async function previewCertificateImport(formData: FormData): Promise<BackendActionResult<CertificateCommandResult>> {
  return withBackendSession(async context => {
    const result = await stageCertificateImport(context, formData)
    revalidateBackendPages()
    return result
  }, 'staff')
}
export async function executeCertificateCommand(input: unknown): Promise<BackendActionResult<CertificateCommandResult>> {
  return withBackendSession(async context => {
    const command = certificateStaffCommandSchema.parse(input)
    const result = await runCertificateStaffCommand(context, command)
    revalidateBackendPages()
    revalidatePath('/[lang]/dashboard/profile', 'page')
    return result
  }, 'staff')
}
export async function getStudentCertificateData(): Promise<BackendActionResult<StudentCertificateData>> {
  return withBackendSession(context => loadStudentCertificateData(context))
}

export async function getStaffCertificateEligibility(personId: string): Promise<BackendActionResult<CertificateEligibilityPeriod[]>> {
  return withBackendSession(context => loadStaffCertificateEligibility(context, uuidSchema.parse(personId)), 'staff')
}
