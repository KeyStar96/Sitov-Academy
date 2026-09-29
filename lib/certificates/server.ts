import 'server-only'

import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { z } from 'zod'
import { BackendError, checkDatabaseError, checkRpcError, type BackendContext } from '@/lib/actions/backend'
import { resolveVerifiedPerson } from '@/lib/profile-person'
import { createAdminClient } from '@/utils/supabase/admin'
import type { Json } from '@/supabase/database.types'
import { CsvImportError, MAX_CSV_BYTES, parsePaperkramCsv, summarizeImport, type ImportKind, type ParsedImportRow } from './csv'
import {
  certificateEligibilitySchema, certificateImportOptionsSchema,
  type CertificateAdminData, type CertificateCommandResult, type CertificateImportRow,
  type CertificateStaffCommand, type StudentCertificateData,
} from './types'

const PAGE_SIZE = 500
const MAX_DATA_ROWS = 20_000
const accountKey = 'papierkram'
type PageResult<T> = { data: T[] | null; error: { code: string } | null }

/** Stop visibly at the operational cap; never silently truncate a reconciliation. */
async function allPages<T>(read: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; offset <= MAX_DATA_ROWS; offset += PAGE_SIZE) {
    const result = await read(offset, offset + PAGE_SIZE - 1)
    checkDatabaseError(result.error)
    const page = result.data ?? []
    if (rows.length + page.length > MAX_DATA_ROWS) throw new BackendError('request_failed')
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
  throw new BackendError('request_failed')
}

function requireVerified(context: BackendContext): void {
  if (!context.user.email_confirmed_at || context.user.is_anonymous) throw new BackendError('not_authenticated')
}
function requireStaff(context: BackendContext): void {
  requireVerified(context)
  if (context.role !== 'teacher' && context.role !== 'admin') throw new BackendError('not_authorized')
}

export async function loadCertificateAdminData(context: BackendContext): Promise<CertificateAdminData> {
  requireStaff(context)
  const client = context.supabase
  const [batches, customers, products, productCourses, invoices, invoiceRelations, allocations, periods, issues,
    people, courses, bookings, bookingItems, schedules] = await Promise.all([
    allPages((from, to) => client.from('import_batches').select('id,kind,status,filename,exported_at,scope,is_complete_snapshot,export_year,summary,created_at,applied_at').eq('account_key', accountKey).order('id').range(from, to)),
    allPages((from, to) => client.from('external_customers').select('id,customer_number,person_id,display_name,email,phone,street,postal_code,city,review_status,review_reason').eq('account_key', accountKey).order('id').range(from, to)),
    allPages((from, to) => client.from('external_products').select('id,article_number,name,description,unit,unit_price,review_status,review_reason').eq('account_key', accountKey).order('id').range(from, to)),
    allPages((from, to) => client.from('external_product_courses').select('product_id,course_id,certificate_title,certificate_description,schedule_snapshot,version').order('product_id').order('course_id').range(from, to)),
    allPages((from, to) => client.from('invoices').select('id,invoice_number,external_customer_id,customer_number,document_type,source_status,payment_status,validity,invoice_date,service_month,gross_amount,paid_amount,discount_amount,article_numbers,review_reason,source_revision,source_exported_at').eq('account_key', accountKey).order('id').range(from, to)),
    allPages((from, to) => client.from('invoice_relations').select('id,original_invoice_id,related_invoice_id,relation_type,confirmed').order('id').range(from, to)),
    allPages((from, to) => client.from('invoice_allocations').select('id,invoice_id,person_id,course_id,start_date,end_date,status,source_revision').order('id').range(from, to)),
    allPages((from, to) => client.from('participation_periods').select('id,person_id,course_id,start_date,end_date,status,confirmed_at,title_snapshot,description_snapshot,schedule_snapshot,revision,source_revision').order('id').range(from, to)),
    allPages((from, to) => client.from('certificate_issues').select('id,person_id,certificate_number,status,requested_month,issued_at,revoked_at,revoked_reason,created_at').order('id').range(from, to)),
    allPages((from, to) => client.from('people').select('id,display_name,email,street,postal_code,city').order('id').range(from, to)),
    allPages((from, to) => client.from('courses').select('id,title,description,slug,start_date,end_date,archived_at,type').order('id').range(from, to)),
    allPages((from, to) => client.from('bookings').select('id,person_id,target_month,start_date,status,kind').order('id').range(from, to)),
    allPages((from, to) => client.from('booking_items').select('id,booking_id,course_id,title_snapshot').order('id').range(from, to)),
    allPages((from, to) => client.from('course_schedules').select('course_id,weekday,start_time,end_time').order('course_id').order('id').range(from, to)),
  ])
  return { batches: batches.sort((a, b) => b.created_at.localeCompare(a.created_at)), customers, products, productCourses,
    invoices, invoiceRelations, allocations, periods, issues: issues.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    people, courses, bookings, bookingItems, schedules }
}

export async function loadCertificateImportRows(context: BackendContext, batchId: string): Promise<CertificateImportRow[]> {
  requireStaff(context)
  return allPages((from, to) => context.supabase.from('import_rows')
    .select('id,batch_id,row_number,external_key,normalized_data,disposition,issues,resolution')
    .eq('batch_id', batchId).order('row_number').range(from, to))
}

function canonicalJson(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key] ?? null)}`).join(',')}}`
  }
  return JSON.stringify(value)
}
const emailKey = (value: string) => value.trim().toLowerCase()
function issue(row: ParsedImportRow, reason: string): void {
  if (!row.issues.includes(reason)) row.issues.push(reason)
  row.disposition = 'conflict'
}

/** Read-only comparison. SQL repeats all decisions when applying the staged batch. */
async function preparePreview(context: BackendContext, kind: ImportKind, rows: ParsedImportRow[], exportedAt: string): Promise<ParsedImportRow[]> {
  const client = context.supabase
  const [customers, products, invoices, people] = await Promise.all([
    allPages((from, to) => client.from('external_customers').select('id,customer_number,person_id,email,review_status,source_data,source_exported_at').eq('account_key', accountKey).order('id').range(from, to)),
    kind === 'customers' ? Promise.resolve([]) : allPages((from, to) => client.from('external_products').select('id,article_number,review_status,source_data,source_exported_at').eq('account_key', accountKey).order('id').range(from, to)),
    kind !== 'invoices' ? Promise.resolve([]) : allPages((from, to) => client.from('invoices').select('id,invoice_number,customer_number,service_month,service_month_source,source_data,source_exported_at').eq('account_key', accountKey).order('id').range(from, to)),
    kind !== 'customers' ? Promise.resolve([]) : allPages((from, to) => client.from('people').select('id,email').order('id').range(from, to)),
  ])
  for (const row of rows) {
    if (row.disposition === 'ignored' || row.disposition === 'error') continue
    const old = kind === 'customers' ? customers.find(value => value.customer_number === row.external_key)
      : kind === 'products' ? products.find(value => value.article_number === row.external_key)
      : invoices.find(value => value.invoice_number === row.external_key)
    if (kind === 'customers') {
      const existing = customers.find(value => value.customer_number === row.external_key)
      if (existing?.person_id) {
        // A confirmed customer-number link survives profile email edits and shared emails.
        row.issues = row.issues.filter(value => !['missing_email', 'invalid_email', 'duplicate_email'].includes(value))
      } else if (typeof row.normalized_data.email === 'string') {
        const key = emailKey(row.normalized_data.email)
        if (people.filter(person => emailKey(person.email) === key).length > 1) issue(row, 'ambiguous_person_email')
        if (customers.some(customer => customer.customer_number !== row.external_key && customer.email && emailKey(customer.email) === key)) issue(row, 'duplicate_customer_email')
      }
    }
    if (kind === 'invoices') {
      const current = invoices.find(value => value.invoice_number === row.external_key)
      if (current?.service_month) {
        if (row.normalized_data.service_month && row.normalized_data.service_month !== current.service_month) issue(row, 'service_month_conflict')
        row.issues = row.issues.filter(value => value !== 'missing_month')
        if (row.normalized_data.review_reason === 'missing_month') row.normalized_data.review_reason = null
      }
      if (current?.customer_number && current.customer_number !== row.normalized_data.customer_number) issue(row, 'invoice_customer_changed')
      const customer = customers.find(value => value.customer_number === row.normalized_data.customer_number)
      if (!customer?.person_id || customer.review_status !== 'resolved') issue(row, 'unresolved_customer')
      const articleNumbers = row.normalized_data.article_numbers
      if (Array.isArray(articleNumbers)) for (const articleNumber of articleNumbers) {
        const product = products.find(value => value.article_number === articleNumber)
        if (!product || product.review_status !== 'resolved') issue(row, 'unresolved_product')
      }
      if (!row.normalized_data.service_month && !current?.service_month) issue(row, 'missing_month')
    }
    if (old?.source_exported_at && Date.parse(old.source_exported_at) > Date.parse(exportedAt)) issue(row, 'older_export')
    row.disposition = row.issues.length ? 'conflict' : !old ? 'new'
      : canonicalJson(old.source_data) === canonicalJson(row.normalized_data) ? 'unchanged' : 'updated'
  }
  return rows
}

const commandResultSchema = z.object({
  id: z.string().uuid().optional(), batch_id: z.string().uuid().optional(), status: z.string().optional(),
  summary: z.json().optional(), confirmed_count: z.number().int().nonnegative().optional(),
})
async function staffRpc(context: BackendContext, command: string, payload: Json): Promise<CertificateCommandResult> {
  requireStaff(context)
  const result = await createAdminClient().rpc('certificate_staff_command', {
    p_actor: context.userId, p_command: command, p_payload: payload,
  })
  if (result.error?.code === '22023') throw new BackendError('invalid_input')
  checkDatabaseError(result.error)
  checkRpcError(result.data)
  return commandResultSchema.parse(result.data)
}

export async function stageCertificateImport(context: BackendContext, formData: FormData): Promise<CertificateCommandResult> {
  requireStaff(context)
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_CSV_BYTES) throw new BackendError('invalid_input')
  const options = certificateImportOptionsSchema.parse({
    kind: formData.get('kind'), exportedAt: formData.get('exportedAt'),
    completeSnapshot: formData.get('completeSnapshot') === 'true',
    exportYear: formData.get('exportYear') ? Number(formData.get('exportYear')) : null,
    includesArchived: formData.get('includesArchived') === 'true',
  })
  const filename = basename(file.name.replaceAll('\\', '/')).replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 255)
  if (!filename.toLowerCase().endsWith('.csv')) throw new BackendError('invalid_input')
  const bytes = Buffer.from(await file.arrayBuffer())
  let parsed: ReturnType<typeof parsePaperkramCsv>
  try { parsed = parsePaperkramCsv(options.kind, bytes) }
  catch (error: unknown) {
    if (error instanceof CsvImportError) throw new BackendError('invalid_input')
    throw error
  }
  // Tie the visible comparison to the exact source state used by stage/apply.
  const baseline = await createAdminClient().rpc('certificate_import_baseline', { p_account: accountKey })
  checkDatabaseError(baseline.error)
  const expectedBaseline = z.string().regex(/^[a-f0-9]{32}$/).parse(baseline.data)
  const rows = await preparePreview(context, options.kind, parsed.rows, options.exportedAt)
  return staffRpc(context, 'stage_import', {
    account_key: accountKey, kind: options.kind, filename, expected_baseline: expectedBaseline,
    file_sha256: createHash('sha256').update(bytes).digest('hex'), exported_at: options.exportedAt,
    is_complete_snapshot: options.completeSnapshot, export_year: options.exportYear,
    scope: { export_year: options.exportYear, includes_archived: options.includesArchived },
    rows, summary: summarizeImport(rows),
  })
}

export async function runCertificateStaffCommand(context: BackendContext, input: CertificateStaffCommand): Promise<CertificateCommandResult> {
  return staffRpc(context, input.command, input.payload)
}

export async function loadStudentCertificateData(context: BackendContext): Promise<StudentCertificateData> {
  requireVerified(context)
  const identity = await resolveVerifiedPerson(context.user)
  if (!identity.id || identity.unresolved) return {
    person: null, identityUnresolved: identity.unresolved, periods: [], issues: [], paymentUpdatedAt: null,
  }
  const personId = identity.id
  // Only the verified, persistent person ID reaches the privileged eligibility RPC.
  const service = createAdminClient()
  const [profile, eligibility, issues, latestInvoice] = await Promise.all([
    context.supabase.from('people').select('display_name,street,postal_code,city').eq('id', personId).single(),
    service.rpc('certificate_eligibility', { p_person: personId }),
    allPages((from, to) => context.supabase.from('certificate_issues')
      .select('id,certificate_number,status,requested_month,issued_at,revoked_at,revoked_reason,created_at')
      .eq('person_id', personId).in('status', ['issued', 'revoked']).order('id').range(from, to)),
    service.from('invoices').select('source_exported_at,last_import_batch_id,external_customers!inner(person_id)')
      .eq('external_customers.person_id', personId).order('source_exported_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  checkDatabaseError(profile.error); checkDatabaseError(eligibility.error); checkRpcError(eligibility.data); checkDatabaseError(latestInvoice.error)
  const periods = certificateEligibilitySchema.parse(eligibility.data)
  if (periods.some(period => period.person_id !== personId)) throw new BackendError('request_failed')
  let paymentUpdatedAt = latestInvoice.data?.source_exported_at ?? null
  if (latestInvoice.data?.last_import_batch_id) {
    const batch = await service.from('import_batches').select('exported_at').eq('id', latestInvoice.data.last_import_batch_id).eq('status', 'applied').maybeSingle()
    checkDatabaseError(batch.error)
    paymentUpdatedAt = batch.data?.exported_at ?? paymentUpdatedAt
  }
  return { person: profile.data, identityUnresolved: false, periods,
    issues: issues.sort((a, b) => b.created_at.localeCompare(a.created_at)), paymentUpdatedAt }
}

export async function loadStaffCertificateEligibility(context: BackendContext, personId: string) {
  requireStaff(context)
  const result = await createAdminClient().rpc('certificate_eligibility', { p_person: personId })
  checkDatabaseError(result.error)
  checkRpcError(result.data)
  const periods = certificateEligibilitySchema.parse(result.data)
  if (periods.some(period => period.person_id !== personId)) throw new BackendError('request_failed')
  return periods
}
