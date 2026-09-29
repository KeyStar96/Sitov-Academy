import { fireEvent, render, screen, within } from '@testing-library/react'
import Reconcile from '@/components/admin/certificates/Reconcile'
import { certificateAdminCopy } from '@/components/admin/certificates/i18n'
import type { CertificateAdminData } from '@/lib/certificates/types'

function fixture(): CertificateAdminData {
  const original: CertificateAdminData['invoices'][number] = {
    id: '00000000-0000-4000-8000-000000000001', invoice_number: 'R-ORIGINAL', external_customer_id: null,
    customer_number: 'K-1', document_type: 'invoice', source_status: 'Bezahlt', payment_status: 'paid', validity: 'valid',
    invoice_date: '2026-08-31', service_month: '2026-09-01', gross_amount: 100, paid_amount: 100, discount_amount: 0,
    article_numbers: ['B1'], review_reason: null, source_revision: 1, source_exported_at: '2026-09-29T12:00:00Z',
  }
  const cancellation = { ...original, id: '00000000-0000-4000-8000-000000000002', invoice_number: 'R-CANCEL', document_type: 'cancellation', gross_amount: -100 }
  const replacement = { ...original, id: '00000000-0000-4000-8000-000000000003', invoice_number: 'R-REPLACEMENT' }
  return {
    batches: [], customers: [], products: [], productCourses: [], allocations: [], periods: [], issues: [],
    people: [], courses: [], bookings: [], bookingItems: [], schedules: [],
    invoices: [original, cancellation, replacement],
    invoiceRelations: [
      { id: '00000000-0000-4000-8000-000000000004', original_invoice_id: original.id, related_invoice_id: cancellation.id, relation_type: 'cancels', confirmed: false },
      { id: '00000000-0000-4000-8000-000000000005', original_invoice_id: original.id, related_invoice_id: replacement.id, relation_type: 'replaces', confirmed: true },
    ],
  }
}

it.each(['de', 'en'])('distinguishes pending cancellation links from confirmed replacements in %s', lang => {
  const c = certificateAdminCopy(lang)
  render(<Reconcile data={fixture()} lang={lang} c={c} busy={false} run={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: c.invoices }))
  const heading = screen.getByRole('heading', { name: c.relations })
  expect(heading).toHaveTextContent(lang === 'de' ? 'Dokumentbeziehungen' : 'Document relationships')
  const section = heading.closest('section')!
  const cancellationRow = within(section).getByText(/R-CANCEL → R-ORIGINAL/)
  const replacementRow = within(section).getByText(/R-REPLACEMENT → R-ORIGINAL/)
  expect(within(cancellationRow).getByText(c.review, { exact: true })).toBeVisible()
  expect(within(cancellationRow).queryByText(c.confirmed, { exact: true })).not.toBeInTheDocument()
  expect(within(replacementRow).getByText(c.confirmed, { exact: true })).toBeVisible()
  expect(within(replacementRow).queryByText(c.review, { exact: true })).not.toBeInTheDocument()
})
