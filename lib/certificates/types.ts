import { z } from 'zod'
import { plainTextSchema, uuidSchema } from '@/lib/types/backend'
import type { Json, Tables } from '@/supabase/database.types'

export const certificateImportKindSchema = z.enum(['customers', 'invoices', 'products'])
export type CertificateImportKind = z.infer<typeof certificateImportKindSchema>
export const certificateDateSchema = z.iso.date()
export const certificateMonthSchema = certificateDateSchema.refine(value => value.endsWith('-01'))
const optionalText = (max: number) => z.string().trim().max(max).optional()
const scheduleEntrySchema = z.object({
  weekday: z.number().int().min(1).max(7),
  start_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  end_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
}).strict().refine(value => value.end_time > value.start_time, { message: 'Class end must be after its start.' })
const periodInputSchema = z.object({
  id: uuidSchema.optional(), person_id: uuidSchema, course_id: uuidSchema,
  start: certificateDateSchema, end: certificateDateSchema,
  title: plainTextSchema(180), description: optionalText(6000),
  schedule: z.array(scheduleEntrySchema).max(21).optional(),
  revision: z.number().int().positive().optional(),
}).strict().refine(value => value.start <= value.end && value.start.slice(0, 7) === value.end.slice(0, 7), {
  message: 'Participation must stay within one calendar month.',
})

export const certificateStaffCommandSchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal('apply_import'), payload: z.object({ batch_id: uuidSchema }).strict() }).strict(),
  z.object({ command: z.literal('resolve_customer'), payload: z.object({
    id: uuidSchema, person_id: uuidSchema.optional(), display_name: plainTextSchema(160).optional(),
    email: z.email().max(254).transform(value => value.toLowerCase().trim()).optional(),
    phone: optionalText(80), street: optionalText(250), postal_code: optionalText(30), city: optionalText(160),
  }).strict().refine(value => Boolean(value.person_id) !== Boolean(value.display_name && value.email), {
    message: 'Choose an existing person or supply a new name and email.',
  }) }).strict(),
  z.object({ command: z.literal('map_product'), payload: z.object({
    id: uuidSchema, course_ids: z.array(uuidSchema).min(1).max(50).refine(ids => new Set(ids).size === ids.length),
    title: plainTextSchema(180).optional(), description: optionalText(6000),
  }).strict() }).strict(),
  z.object({ command: z.literal('resolve_invoice'), payload: z.object({
    id: uuidSchema, service_month: certificateMonthSchema,
    validity: z.enum(['valid', 'cancelled', 'replaced', 'review']),
  }).strict() }).strict(),
  z.object({ command: z.literal('relate_invoice'), payload: z.object({
    original: uuidSchema, related: uuidSchema, type: z.enum(['cancels', 'replaces']),
  }).strict().refine(value => value.original !== value.related) }).strict(),
  z.object({ command: z.literal('allocate'), payload: z.object({
    id: uuidSchema.optional(), invoice_id: uuidSchema, course_id: uuidSchema,
    start: certificateDateSchema, end: certificateDateSchema, status: z.enum(['confirmed', 'excluded']).optional(),
  }).strict().refine(value => value.start <= value.end && value.start.slice(0, 7) === value.end.slice(0, 7)) }).strict(),
  z.object({ command: z.literal('confirm_participation'), payload: z.object({
    periods: z.array(periodInputSchema).min(1).max(250),
  }).strict() }).strict(),
  z.object({ command: z.literal('revoke_participation'), payload: z.object({
    id: uuidSchema, revision: z.number().int().positive(), reason: plainTextSchema(1000),
  }).strict() }).strict(),
  z.object({ command: z.literal('revoke_issue'), payload: z.object({
    id: uuidSchema, reason: plainTextSchema(1000),
  }).strict() }).strict(),
])
export type CertificateStaffCommand = z.infer<typeof certificateStaffCommandSchema>

export const certificateImportOptionsSchema = z.object({
  kind: certificateImportKindSchema,
  exportedAt: z.iso.datetime({ offset: true }).refine(value => Date.parse(value) <= Date.now() + 5 * 60_000),
  completeSnapshot: z.boolean(), exportYear: z.number().int().min(2000).max(2200).nullable(),
  includesArchived: z.boolean(),
}).strict().refine(value => !value.completeSnapshot || (
  value.kind === 'invoices' && value.exportYear !== null && value.includesArchived
), { message: 'A complete invoice export must include archived documents and a year.' })

const eligibilityAllocationSchema = z.object({
  id: uuidSchema, invoice_id: uuidSchema, start_date: certificateDateSchema, end_date: certificateDateSchema,
  source_revision: z.number().int().positive(), invoice_revision: z.number().int().positive(),
  payment_status: z.string(), validity: z.string(), invoice_number: z.string(),
})
export const certificateEligibilitySchema = z.array(z.object({
  id: uuidSchema, person_id: uuidSchema, course_id: uuidSchema,
  start_date: certificateDateSchema, end_date: certificateDateSchema, status: z.string(),
  title_snapshot: z.string(), description_snapshot: z.string(), schedule_snapshot: z.json(),
  revision: z.number().int().positive(), source_revision: z.number().int().positive(),
  eligible: z.boolean(), reason: z.string().nullable(), allocations: z.array(eligibilityAllocationSchema),
}))
export type CertificateEligibilityPeriod = z.infer<typeof certificateEligibilitySchema>[number]
export type CertificateCommandResult = {
  id?: string
  batch_id?: string
  status?: string
  summary?: Json
  confirmed_count?: number
}
export type CertificateIssueSummary = Pick<Tables<'certificate_issues'>,
  'id' | 'certificate_number' | 'status' | 'requested_month' | 'issued_at' | 'revoked_at' | 'revoked_reason' | 'created_at'>
export type CertificateImportRow = Pick<Tables<'import_rows'>,
  'id' | 'batch_id' | 'row_number' | 'external_key' | 'normalized_data' | 'disposition' | 'issues' | 'resolution'>

export interface CertificateAdminData {
  batches: Pick<Tables<'import_batches'>, 'id' | 'kind' | 'status' | 'filename' | 'exported_at' | 'scope' | 'is_complete_snapshot' | 'export_year' | 'summary' | 'created_at' | 'applied_at'>[]
  customers: Pick<Tables<'external_customers'>, 'id' | 'customer_number' | 'person_id' | 'display_name' | 'email' | 'phone' | 'street' | 'postal_code' | 'city' | 'review_status' | 'review_reason'>[]
  products: Pick<Tables<'external_products'>, 'id' | 'article_number' | 'name' | 'description' | 'unit' | 'unit_price' | 'review_status' | 'review_reason'>[]
  productCourses: Pick<Tables<'external_product_courses'>, 'product_id' | 'course_id' | 'certificate_title' | 'certificate_description' | 'schedule_snapshot' | 'version'>[]
  invoices: Pick<Tables<'invoices'>, 'id' | 'invoice_number' | 'external_customer_id' | 'customer_number' | 'document_type' | 'source_status' | 'payment_status' | 'validity' | 'invoice_date' | 'service_month' | 'gross_amount' | 'paid_amount' | 'discount_amount' | 'article_numbers' | 'review_reason' | 'source_revision' | 'source_exported_at'>[]
  invoiceRelations: Pick<Tables<'invoice_relations'>, 'id' | 'original_invoice_id' | 'related_invoice_id' | 'relation_type' | 'confirmed'>[]
  allocations: Pick<Tables<'invoice_allocations'>, 'id' | 'invoice_id' | 'person_id' | 'course_id' | 'start_date' | 'end_date' | 'status' | 'source_revision'>[]
  periods: Pick<Tables<'participation_periods'>, 'id' | 'person_id' | 'course_id' | 'start_date' | 'end_date' | 'status' | 'confirmed_at' | 'title_snapshot' | 'description_snapshot' | 'schedule_snapshot' | 'revision' | 'source_revision'>[]
  issues: (CertificateIssueSummary & Pick<Tables<'certificate_issues'>, 'person_id'>)[]
  people: Pick<Tables<'people'>, 'id' | 'display_name' | 'email' | 'street' | 'postal_code' | 'city'>[]
  courses: Pick<Tables<'courses'>, 'id' | 'title' | 'description' | 'slug' | 'start_date' | 'end_date' | 'archived_at' | 'type'>[]
  bookings: Pick<Tables<'bookings'>, 'id' | 'person_id' | 'target_month' | 'start_date' | 'status' | 'kind'>[]
  bookingItems: Pick<Tables<'booking_items'>, 'id' | 'booking_id' | 'course_id' | 'title_snapshot'>[]
  schedules: Pick<Tables<'course_schedules'>, 'course_id' | 'weekday' | 'start_time' | 'end_time'>[]
}

export interface StudentCertificateData {
  person: Pick<Tables<'people'>, 'display_name' | 'street' | 'postal_code' | 'city'> | null
  identityUnresolved: boolean
  periods: CertificateEligibilityPeriod[]
  issues: CertificateIssueSummary[]
  paymentUpdatedAt: string | null
}
