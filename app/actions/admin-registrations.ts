'use server'
import { withBackendSession, checkDatabaseError, checkRpcError, revalidateBackendPages } from '@/lib/actions/backend'
import { loadRegistrationOverview } from '@/lib/admin-registration-data'
import { staffConfirmationSchema, invoiceStatusInputSchema, type RegistrationOverview } from '@/lib/types/admin-registrations'
import { targetMonthSchema } from '@/lib/types/monthly-bookings'
import type { BackendActionResult } from '@/lib/types/backend'
import { profileMonthWindow } from '@/lib/profile-month'

export async function getRegistrationOverview(month?: string): Promise<BackendActionResult<RegistrationOverview>> {
  return withBackendSession(()=>loadRegistrationOverview(targetMonthSchema.parse(month ?? profileMonthWindow().next)), 'staff')
}
export async function confirmRegistration(input: unknown): Promise<BackendActionResult<{status:'confirmed'}>> {
  return withBackendSession(async({supabase})=>{
    const data = staffConfirmationSchema.parse(input)
    const result = await supabase.rpc('confirm_business_booking',{p_id:data.id})
    checkDatabaseError(result.error)
    checkRpcError(result.data)
    revalidateBackendPages()
    return {status:'confirmed' as const}
  },'staff')
}
export async function declineRegistration(input: unknown): Promise<BackendActionResult<{status:'cancelled'}>> {
  return withBackendSession(async({supabase})=>{
    const data = staffConfirmationSchema.parse(input)
    const result = await supabase.rpc('decline_business_booking',{p_id:data.id})
    checkDatabaseError(result.error)
    checkRpcError(result.data)
    revalidateBackendPages()
    return {status:'cancelled' as const}
  },'staff')
}
export async function saveManualInvoiceStatus(input: unknown): Promise<BackendActionResult<{saved:true}>> {
  return withBackendSession(async({supabase})=>{
    const data = invoiceStatusInputSchema.parse(input)
    const result = await supabase.rpc('mark_business_invoice',{p_booking:data.id,p_month:data.month,p_created:data.created,p_reference:data.reference})
    checkDatabaseError(result.error)
    checkRpcError(result.data)
    revalidateBackendPages()
    return {saved:true as const}
  },'staff')
}
