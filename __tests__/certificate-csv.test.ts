/** @jest-environment node */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  CsvImportError, MAX_CSV_BYTES, parseCsvDate, parseGermanMoney, parsePaperkramCsv, serviceMonthFromSubject,
  type ImportKind,
} from '@/lib/certificates/csv'

const invoice = {
  'Rechnungsnr.': 'R-TEST-1', Betreff: 'Deutschkurs September 2026', Kundennummer: 'K-TEST-1',
  Datum: '31.08.2026', Status: 'Bezahlt', Typ: 'Rechnung', Brutto: '58,00', Bezahlt: '50,00', Skonto: '8,00',
  'Waren & Dienstleistungen': 'TEST-B1', Fälligkeitsdatum: '01.09.2026', 'letztes Bezahldatum': '2026-09-18',
}
const customer = { Name: 'Testperson', Kontaktart: 'Kunde', 'Kunden-/Lieferantennr.': 'K-TEST-1', 'E-Mail': 'student@example.test' }
const product = { Name: 'Testkurs', Artikelnummer: 'TEST-B1', Beschreibung: 'Sprachkurs', Typ: 'Dienstleistung', 'Brutto-Preis': '10,00', 'Einheitbezeichnung Einzel': 'Stunde' }

function csv(rows: Record<string, string>[]): string {
  const headers = Object.keys(rows[0])
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  return [headers.map(quote).join(';'), ...rows.map(row => headers.map(header => quote(row[header] ?? '')).join(';'))].join('\r\n')
}
const parseInvoice = (changes: Partial<typeof invoice> = {}) => parsePaperkramCsv('invoices', csv([{ ...invoice, ...changes }])).rows[0]

describe('provided Papierkram exports', () => {
  it('finds customers requiring clarification without exposing supplier data', () => {
    const { rows, summary } = parsePaperkramCsv('customers', readFileSync(path.join(process.cwd(), 'docs/Papierkram/Adressbuch/eintraege.csv')))
    expect(summary).toMatchObject({ total: 245, ready: 159, conflicts: 37, errors: 0, ignored: 49 })
    expect(rows.filter(row => row.issues.includes('missing_email'))).toHaveLength(35)
    expect(rows.filter(row => row.issues.includes('duplicate_email'))).toHaveLength(2)
    for (const row of rows.filter(row => row.disposition === 'ignored')) {
      expect(Object.keys(row.raw_data)).toEqual(['Kontaktart'])
      expect(row.normalized_data).toEqual({})
    }
  })

  it('uses the actual service month and recognizes overpayments and paid invoices with discounts', () => {
    const { rows, summary } = parsePaperkramCsv('invoices', readFileSync(path.join(process.cwd(), 'docs/Papierkram/Rechnungen/rechnungen-3.csv')))
    expect(summary).toMatchObject({ total: 54, ready: 54, conflicts: 0, errors: 0, paid: 45 })
    expect(rows.every(row => row.normalized_data.service_month === '2026-09-01')).toBe(true)
    expect(rows.filter(row => row.normalized_data.payment_status === 'overpaid')).toHaveLength(2)
    expect(rows.filter(row => row.normalized_data.payment_status === 'paid' && Number(row.normalized_data.discount_amount) > 0)).toHaveLength(2)
  })

  it('imports all seven service products without guessing course quantities', () => {
    const { rows, summary } = parsePaperkramCsv('products', readFileSync(path.join(process.cwd(), 'docs/Papierkram/Dienstleistungen/produkte.csv')))
    expect(summary).toMatchObject({ total: 7, ready: 7, errors: 0 })
    expect(new Set(rows.map(row => row.external_key)).size).toBe(7)
    expect(rows.every(row => !Object.hasOwn(row.normalized_data, 'quantity'))).toBe(true)
  })
})

describe('CSV validation and minimized source data', () => {
  it('supports UTF-8 BOM, quoted semicolons, escaped quotes and multiline descriptions', () => {
    const description = 'Wortschatz; Grammatik\nÜbung mit "Zitat" und Кириллица'
    const { rows } = parsePaperkramCsv('products', Buffer.from(`\uFEFF${csv([{ ...product, Beschreibung: description }])}`))
    expect(rows[0].normalized_data.description).toBe(description)
    expect(rows[0].disposition).toBe('new')
  })

  it('rejects missing or duplicate headers and inconsistent or unclosed rows', () => {
    expect(() => parsePaperkramCsv('customers', 'Name;Kontaktart;E-Mail\nTest;Kunde;a@example.test')).toThrow(/Fehlende Spalten/)
    expect(() => parsePaperkramCsv('customers', 'Name;Kontaktart;Kunden-/Lieferantennr.;E-Mail;E-Mail\nTest;Kunde;K1;a@example.test;a@example.test')).toThrow(/Doppelte Spalten/)
    expect(() => parsePaperkramCsv('customers', 'Name;Kontaktart;Kunden-/Lieferantennr.;E-Mail\nTest;Kunde;K1')).toThrow(CsvImportError)
    expect(() => parsePaperkramCsv('customers', 'Name;Kontaktart;Kunden-/Lieferantennr.;E-Mail\n"Test;Kunde;K1;a@example.test')).toThrow(CsvImportError)
  })

  it('rejects invalid UTF-8, oversized files, empty files and unsupported import kinds', () => {
    expect(() => parsePaperkramCsv('customers', Buffer.from([0xc3, 0x28]))).toThrow(/UTF-8/)
    expect(() => parsePaperkramCsv('customers', Buffer.alloc(MAX_CSV_BYTES + 1))).toThrow(/5 MB/)
    expect(() => parsePaperkramCsv('customers', '')).toThrow(CsvImportError)
    expect(() => parsePaperkramCsv('constructor' as ImportKind, '')).toThrow(/Unbekannte Importart/)
  })

  it('blocks duplicated external keys rather than allowing row order to choose the winner', () => {
    const rows = parsePaperkramCsv('invoices', csv([invoice, { ...invoice, Status: 'Unbezahlt', Bezahlt: '0,00', Skonto: '0,00' }])).rows
    expect(rows.every(row => row.disposition === 'error' && row.issues.includes('duplicate_key'))).toBe(true)
  })

  it('keeps distinct customer numbers and flags shared normalized email addresses', () => {
    const rows = parsePaperkramCsv('customers', csv([
      { ...customer, 'E-Mail': '  Student@Example.Test  ' },
      { ...customer, 'Kunden-/Lieferantennr.': 'K-TEST-2' },
    ])).rows
    expect(rows.map(row => row.external_key)).toEqual(['K-TEST-1', 'K-TEST-2'])
    expect(rows.every(row => row.normalized_data.email === 'student@example.test' && row.issues.includes('duplicate_email'))).toBe(true)
  })

  it('preserves email plus tags and flags missing or malformed emails for clarification', () => {
    const rows = parsePaperkramCsv('customers', csv([
      { ...customer, 'E-Mail': 'Student+German@Example.Test' },
      { ...customer, 'Kunden-/Lieferantennr.': 'K-TEST-2', 'E-Mail': '' },
      { ...customer, 'Kunden-/Lieferantennr.': 'K-TEST-3', 'E-Mail': 'not-an-email' },
    ])).rows
    expect(rows[0].normalized_data.email).toBe('student+german@example.test')
    expect(rows[1]).toMatchObject({ disposition: 'conflict', normalized_data: { email: null }, issues: ['missing_email'] })
    expect(rows[2]).toMatchObject({ disposition: 'conflict', normalized_data: { email: null }, issues: ['invalid_email'] })
  })

  it('drops unrelated source columns and never treats notes as correction relations', () => {
    const sensitive = 'SHOULD-NOT-BE-RETAINED'
    for (const [kind, row] of [['customers', customer], ['invoices', invoice], ['products', product]] as const) {
      const parsed = parsePaperkramCsv(kind, csv([{ ...row, IBAN: sensitive, Notizen: sensitive, 'Rechnung basiert auf': sensitive }]))
      expect(JSON.stringify(parsed)).not.toContain(sensitive)
    }
  })
})

describe('invoice normalization', () => {
  it('allows a late payment with full discount settlement without shifting attendance dates', () => {
    expect(parseInvoice().normalized_data).toMatchObject({
      validity: 'valid', payment_status: 'paid', gross_amount: '58.00', paid_amount: '50.00', discount_amount: '8.00',
      invoice_date: '2026-08-31', paid_at: '2026-09-18', service_month: '2026-09-01',
    })
  })

  it('keeps cancellation validity separate from payment status and requires explicit cancellation relations', () => {
    expect(parseInvoice({ Status: 'Storniert' }).normalized_data.validity).toBe('cancelled')
    expect(parseInvoice({ Typ: 'Stornorechnung', Brutto: '-58,00', Bezahlt: '-58,00', Skonto: '0,00' }))
      .toMatchObject({ disposition: 'conflict', normalized_data: { document_type: 'cancellation', validity: 'review', review_reason: 'document_relation_required' } })
  })

  it.each(['Offen zur Prüfung', 'constructor', '__proto__', 'toString'])('fails closed for unknown status %s', status => {
    expect(parseInvoice({ Status: status })).toMatchObject({
      disposition: 'conflict', normalized_data: { payment_status: 'unknown', validity: 'review', review_reason: 'unknown_status' },
    })
  })

  it.each(['Andere Rechnung', 'constructor', '__proto__'])('fails closed for unknown document type %s', type => {
    expect(parseInvoice({ Typ: type })).toMatchObject({
      disposition: 'conflict', normalized_data: { document_type: 'unknown', validity: 'review', review_reason: 'unknown_document_type' },
    })
  })

  it.each([
    { Status: 'Bezahlt', Bezahlt: '49,99' },
    { Status: 'Überbezahlt', Bezahlt: '50,00' },
    { Status: 'Unbezahlt', Bezahlt: '50,00' },
    { Status: 'Teilbezahlt', Bezahlt: '50,00' },
    { Status: 'Bezahlt', Skonto: '59,00' },
  ])('does not approve contradictory payment amounts: %j', changes => {
    expect(parseInvoice(changes).normalized_data).toMatchObject({ validity: 'review', review_reason: 'amount_mismatch' })
  })

  it('accepts actual overpayment and partial payment while preserving distinct payment states', () => {
    expect(parseInvoice({ Status: 'Überbezahlt', Bezahlt: '60,00', Skonto: '0,00' }).normalized_data).toMatchObject({ validity: 'valid', payment_status: 'overpaid' })
    expect(parseInvoice({ Status: 'Teilbezahlt', Bezahlt: '20,00', Skonto: '0,00' }).normalized_data).toMatchObject({ validity: 'valid', payment_status: 'partial' })
  })

  it('requires clarification for a missing service month or product without guessing from invoice date', () => {
    expect(parseInvoice({ Betreff: 'Sprachkurs' })).toMatchObject({ disposition: 'conflict', normalized_data: { service_month: null, review_reason: 'missing_month' } })
    expect(parseInvoice({ 'Waren & Dienstleistungen': '' })).toMatchObject({ disposition: 'conflict', normalized_data: { article_numbers: [], review_reason: 'missing_products' } })
  })
})

describe('dates, money and service months', () => {
  it.each([['0', '0.00'], ['1.234,50', '1234.50'], ['-0,01', '-0.01'], ['58,5', '58.50'], ['9999999999,99', '9999999999.99']])('parses exact money %s', (input, expected) => {
    expect(parseGermanMoney(input)).toBe(expected)
  })
  it.each(['12.34,55', '1,234', '10000000000,00', '1e3', 'NaN', '58 €', ''])('rejects invalid money %s', input => {
    expect(() => parseGermanMoney(input)).toThrow(CsvImportError)
  })
  it('validates calendar dates and permits empty optional dates', () => {
    expect(parseCsvDate('29.02.2024')).toBe('2024-02-29')
    expect(parseCsvDate('2026-09-18')).toBe('2026-09-18')
    expect(parseCsvDate('', true)).toBeNull()
    for (const invalid of ['29.02.2026', '31.04.2026', '2026-13-01', '1999-12-31', '']) expect(() => parseCsvDate(invalid)).toThrow(CsvImportError)
  })
  it.each([
    ['Deutschkurs September 2026', '2026-09-01'], ['Leistungsmonat 2026-10', '2026-10-01'],
    ['MÄRZ 2026', '2026-03-01'], ['Maerz 2026', '2026-03-01'],
    ['September und Oktober 2026', null], ['September/Oktober 2026', null],
    ['September 2026 bis Oktober 2026', null], ['2026-09 / 2026-10', null], ['Sprachkurs ohne Monatsangabe', null],
  ])('resolves only unambiguous service subjects: %s', (subject, expected) => {
    expect(serviceMonthFromSubject(subject)).toBe(expected)
  })
})
