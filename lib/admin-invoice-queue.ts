import type {StaffRegistration,StaffInvoice} from './types/admin-registrations'
/** Canonical bookings and invoice cases both enforce one person per calendar month. */
export function invoiceQueue(registrations:readonly StaffRegistration[],invoices:readonly StaffInvoice[],month:string):StaffRegistration[] {
 return registrations.filter(row=>!row.isTrial && row.targetMonth===month && (row.status==='confirmed'||invoices.some(invoice=>invoice.sourceId===row.id&&invoice.month===month&&invoice.status==='created')))
}
