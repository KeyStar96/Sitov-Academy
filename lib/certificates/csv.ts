import { parse } from 'csv-parse/sync'
import type { Json } from '@/supabase/database.types'

export type ImportKind = 'customers' | 'invoices' | 'products'
export type ParsedImportRow = {
  row_number: number
  external_key: string | null
  raw_data: Record<string, string>
  normalized_data: { [key: string]: Json }
  disposition: 'new' | 'updated' | 'unchanged' | 'conflict' | 'ignored' | 'error'
  issues: string[]
}
export type ImportSummary = { total: number; ready: number; conflicts: number; errors: number; ignored: number; paid: number }
export class CsvImportError extends Error {}
export const MAX_CSV_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 10000
const headers: Record<ImportKind, string[]> = {
  customers: ['Name', 'Kontaktart', 'Kunden-/Lieferantennr.', 'E-Mail'],
  invoices: ['Rechnungsnr.', 'Betreff', 'Kundennummer', 'Datum', 'Status', 'Typ', 'Brutto', 'Bezahlt', 'Skonto', 'Waren & Dienstleistungen'],
  products: ['Name', 'Artikelnummer', 'Beschreibung', 'Typ', 'Brutto-Preis', 'Einheitbezeichnung Einzel'],
}
const retained: Record<ImportKind, string[]> = {
  customers: [...headers.customers, 'Straße (Post)', 'PLZ (Post)', 'Stadt (Post)', 'Telefon'],
  invoices: [...headers.invoices, 'Fälligkeitsdatum', 'letztes Bezahldatum'],
  products: [...headers.products],
}
function required(value: string | undefined, label: string, max = 200): string {
  const text = value?.trim() ?? ''
  if (!text || text.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) {
    throw new CsvImportError(`${label}: fehlender oder ungültiger Wert.`)
  }
  return text
}
export function parseGermanMoney(input: string): string {
  const text = input.trim()
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) throw new CsvImportError('Ungültiger Geldbetrag.')
  const [whole, fraction = ''] = text.replaceAll('.', '').split(',')
  const cents = Number(whole) * 100 + (text.startsWith('-') ? -1 : 1) * Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 999999999999) throw new CsvImportError('Geldbetrag außerhalb des zulässigen Bereichs.')
  return `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`
}
export function parseCsvDate(input: string | undefined, optional = false): string | null {
  const text = input?.trim() ?? ''
  if (!text && optional) return null
  const german = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text)
  const iso = german ? `${german[3]}-${german[2]}-${german[1]}` : text
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new CsvImportError('Ungültiges Datum.')
  const date = new Date(`${iso}T12:00:00Z`)
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== iso || iso < '2000-01-01' || iso > '2200-12-31') {
    throw new CsvImportError('Ungültiges Kalenderdatum.')
  }
  return iso
}
const monthNames = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember']
export function serviceMonthFromSubject(subject: string): string | null {
  const values = new Set<string>()
  const text = subject.toLocaleLowerCase('de').replaceAll('maerz', 'märz')
  // “September und Oktober 2026” supplies the year only once; never turn it
  // into a single October invoice merely because that is the final match.
  if (monthNames.filter(month => new RegExp(`\\b${month}\\b`).test(text)).length > 1) return null
  for (const match of text.matchAll(/\b(20\d{2}|21\d{2})-(0[1-9]|1[0-2])\b/g)) values.add(`${match[1]}-${match[2]}-01`)
  monthNames.forEach((month, index) => {
    for (const match of text.matchAll(new RegExp(`\\b${month}\\s+(20\\d{2}|21\\d{2})\\b`, 'g'))) {
      values.add(`${match[1]}-${String(index + 1).padStart(2, '0')}-01`)
    }
  })
  // Multiple distinct months are ambiguous, even when one is the due date.
  return values.size === 1 ? [...values][0] : null
}
function invoiceData(raw: Record<string, string>, issues: string[]): ParsedImportRow['normalized_data'] {
  const sourceStatus = required(raw.Status, 'Status')
  const status = sourceStatus.toLocaleLowerCase('de')
  const kind = required(raw.Typ, 'Typ').toLocaleLowerCase('de')
  const documentType = new Map([['rechnung', 'invoice'], ['stornorechnung', 'cancellation'], ['gutschrift', 'credit_note']]).get(kind) ?? 'unknown'
  const payment = new Map([['bezahlt', 'paid'], ['überbezahlt', 'overpaid'], ['unbezahlt', 'unpaid'], ['gemahnt', 'reminded'], ['teilbezahlt', 'partial'], ['teilweise bezahlt', 'partial']]).get(status) ?? 'unknown'
  const cancelled = status === 'storniert'
  const gross = parseGermanMoney(raw.Brutto)
  const paid = parseGermanMoney(raw.Bezahlt)
  const discount = parseGermanMoney(raw.Skonto)
  const cents = (value: string) => Number(value.replace('.', ''))
  if (cents(discount) < 0) throw new CsvImportError('Skonto darf nicht negativ sein.')
  const subject = required(raw.Betreff, 'Betreff', 1000)
  const month = serviceMonthFromSubject(subject)
  const articles = [...new Set((raw['Waren & Dienstleistungen'] ?? '').split(',').map(value => value.trim()).filter(Boolean))]
  if (articles.some(value => value.length > 100)) throw new CsvImportError('Artikelnummer ist zu lang.')
  let reason: string | null = null
  if (!cancelled && documentType === 'invoice') {
    if (payment === 'unknown') reason = 'unknown_status'
    else if (cents(gross) <= 0 || cents(paid) < 0 || cents(discount) > cents(gross)) reason = 'amount_mismatch'
    else if ((payment === 'paid' && cents(paid) + cents(discount) !== cents(gross)) ||
      (payment === 'overpaid' && cents(paid) + cents(discount) <= cents(gross)) ||
      (payment === 'partial' && !(cents(paid) > 0 && cents(paid) + cents(discount) < cents(gross))) ||
      (['unpaid', 'reminded'].includes(payment) && cents(paid) + cents(discount) >= cents(gross))) reason = 'amount_mismatch'
    else if (!month) reason = 'missing_month'
    else if (!articles.length) reason = 'missing_products'
  } else if (documentType !== 'invoice') reason = documentType === 'unknown' ? 'unknown_document_type' : 'document_relation_required'
  if (reason) issues.push(reason)
  return {
    invoice_number: required(raw['Rechnungsnr.'], 'Rechnungsnummer', 100),
    customer_number: required(raw.Kundennummer, 'Kundennummer', 100),
    document_type: documentType, source_status: sourceStatus, payment_status: payment,
    validity: cancelled ? 'cancelled' : reason && !['missing_month', 'missing_products'].includes(reason) ? 'review' : 'valid',
    invoice_date: parseCsvDate(raw.Datum), due_date: parseCsvDate(raw.Fälligkeitsdatum, true), paid_at: parseCsvDate(raw['letztes Bezahldatum'], true),
    service_month: month, gross_amount: gross, paid_amount: paid, discount_amount: discount,
    article_numbers: articles, subject, review_reason: reason,
  }
}
/** Parse the actual Papierkram dialect. Values are data, never executable cells. */
export function parsePaperkramCsv(kind: ImportKind, input: Buffer | string): { rows: ParsedImportRow[]; summary: ImportSummary } {
  if (!Object.hasOwn(headers, kind)) throw new CsvImportError('Unbekannte Importart.')
  if (Buffer.byteLength(input) > MAX_CSV_BYTES) throw new CsvImportError('Die CSV darf höchstens 5 MB groß sein.')
  let text: string
  try { text = typeof input === 'string' ? input : new TextDecoder('utf-8', { fatal: true }).decode(input) }
  catch { throw new CsvImportError('Bitte die Datei als UTF-8-CSV exportieren.') }
  let records: Record<string, string>[]
  try {
    records = parse(text, {
      bom: true, delimiter: ';', skip_empty_lines: true, max_record_size: 32768,
      columns: (values: string[]) => {
        const names = values.map(value => value.trim())
        if (new Set(names).size !== names.length) throw new CsvImportError('Doppelte Spaltenüberschriften.')
        const missing = headers[kind].filter(name => !names.includes(name))
        if (missing.length) throw new CsvImportError(`Fehlende Spalten: ${missing.join(', ')}.`)
        return names
      },
    }) as Record<string, string>[]
  } catch (error) {
    if (error instanceof CsvImportError) throw error
    throw new CsvImportError('Die CSV-Struktur ist ungültig. Bitte den unveränderten Papierkram-Export verwenden.')
  }
  if (!records.length || records.length > MAX_ROWS) throw new CsvImportError('Die CSV muss zwischen 1 und 10.000 Datensätzen enthalten.')
  const keys = new Map<string, ParsedImportRow[]>()
  const emails = new Map<string, ParsedImportRow[]>()
  const rows = records.map((record, index): ParsedImportRow => {
    const raw = Object.fromEntries(retained[kind].map(key => [key, (record[key] ?? '').trim()]))
    const row: ParsedImportRow = { row_number: index + 2, external_key: null, raw_data: raw, normalized_data: {}, disposition: 'new', issues: [] }
    try {
      if (kind === 'customers') {
        if (raw.Kontaktart !== 'Kunde') return { ...row, raw_data: { Kontaktart: raw.Kontaktart }, disposition: 'ignored' }
        const email = raw['E-Mail'].toLowerCase()
        const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
        if (!validEmail) row.issues.push(email ? 'invalid_email' : 'missing_email')
        row.normalized_data = {
          customer_number: required(raw['Kunden-/Lieferantennr.'], 'Kundennummer', 100),
          display_name: required(raw.Name, 'Name', 160), email: validEmail ? email : null,
          phone: raw.Telefon || null, street: raw['Straße (Post)'] || null,
          postal_code: raw['PLZ (Post)'] || null, city: raw['Stadt (Post)'] || null,
        }
        row.external_key = String(row.normalized_data.customer_number)
        if (validEmail) emails.set(email, [...(emails.get(email) ?? []), row])
      } else if (kind === 'products') {
        if (raw.Typ !== 'Dienstleistung') return { ...row, disposition: 'ignored' }
        row.normalized_data = {
          article_number: required(raw.Artikelnummer, 'Artikelnummer', 100), name: required(raw.Name, 'Name'),
          description: raw.Beschreibung, unit: raw['Einheitbezeichnung Einzel'] || null,
          unit_price: parseGermanMoney(raw['Brutto-Preis']),
        }
        if (Number(row.normalized_data.unit_price) < 0) throw new CsvImportError('Produktpreis darf nicht negativ sein.')
        row.external_key = String(row.normalized_data.article_number)
      } else {
        row.normalized_data = invoiceData(raw, row.issues)
        row.external_key = String(row.normalized_data.invoice_number)
      }
      if (row.issues.length) row.disposition = 'conflict'
      if (row.external_key) keys.set(row.external_key, [...(keys.get(row.external_key) ?? []), row])
    } catch (error) {
      row.disposition = 'error'
      row.issues.push(error instanceof CsvImportError ? error.message : 'Ungültiger Datensatz.')
    }
    return row
  })
  for (const group of keys.values()) if (group.length > 1) {
    group.forEach(row => { row.disposition = 'error'; row.issues.push('duplicate_key') })
  }
  for (const group of emails.values()) if (group.length > 1) {
    group.forEach(row => { if (row.disposition !== 'error') row.disposition = 'conflict'; row.issues.push('duplicate_email') })
  }
  return { rows, summary: summarizeImport(rows) }
}
export function summarizeImport(rows: ParsedImportRow[]): ImportSummary {
  return {
    total: rows.length, ready: rows.filter(row => ['new', 'updated', 'unchanged'].includes(row.disposition)).length,
    conflicts: rows.filter(row => row.disposition === 'conflict').length, errors: rows.filter(row => row.disposition === 'error').length,
    ignored: rows.filter(row => row.disposition === 'ignored').length,
    paid: rows.filter(row => ['paid', 'overpaid'].includes(String(row.normalized_data.payment_status)) && row.normalized_data.validity === 'valid').length,
  }
}
