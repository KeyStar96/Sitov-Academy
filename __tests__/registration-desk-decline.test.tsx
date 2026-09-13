import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import RegistrationDesk from '@/components/admin/RegistrationDesk'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { confirmRegistration, declineRegistration, saveManualInvoiceStatus } from '@/app/actions/admin-registrations'
import type { RegistrationOverview, StaffRegistration } from '@/lib/types/admin-registrations'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/admin-registrations', () => ({
  confirmRegistration: jest.fn(), declineRegistration: jest.fn(), saveManualInvoiceStatus: jest.fn(),
}))
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh, push: jest.fn() }) }))

const booking: StaffRegistration = {
  id: '00000000-0000-4000-8000-000000000101', source: 'registration',
  personId: '00000000-0000-4000-8000-000000000201', profileId: null,
  createdAt: '2026-09-13T12:00:00Z', startDate: '2026-10-01', targetMonth: '2026-10-01',
  status: 'pending', contact: {
    name: 'Anna Beispiel', email: 'anna@example.invalid', phone: null,
    street: null, zip: null, city: null, birthDate: null,
  },
  courses: [
    { id: 'course-1', title: 'Deutsch Level 1', amount: 80, unitPrice: 10, unitMinutes: 45, units: 8, requestedUnits: null },
    { id: 'course-2', title: 'Sprechtraining Montag', amount: 40, unitPrice: 10, unitMinutes: 45, units: 8, requestedUnits: null },
  ],
  totalPrice: 120, consents: null,
}
const untouched: StaffRegistration = {
  ...booking, id: '00000000-0000-4000-8000-000000000102',
  contact: { ...booking.contact, name: 'Andere Anfrage', email: 'other@example.invalid' },
}

function renderDesk(isTrial: boolean) {
  const initial: RegistrationOverview = {
    registrations: [untouched, { ...booking, isTrial }], invoices: [], targetMonth: '2026-10-01',
  }
  render(<AdminI18nProvider translations={de.admin}>
    <RegistrationDesk initial={initial} lang="de" mode="registrations" />
  </AdminI18nProvider>)
}
function registrationCard(name = booking.contact.name) {
  const card = screen.getByRole('heading', { name }).closest('article')
  if (!card) throw new Error('Registration card missing')
  return within(card)
}
function openDecline() {
  fireEvent.click(registrationCard().getByRole('button', { name: 'Anmeldung ablehnen' }))
  return within(screen.getByRole('dialog'))
}

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', '') },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open') },
  })
  jest.mocked(declineRegistration).mockResolvedValue({ success: true, data: { status: 'cancelled' } })
})
afterEach(cleanup)

it.each([false, true])('identifies the pending request and never declines when cancelled (trial=%s)', isTrial => {
  renderDesk(isTrial)
  const dialog = openDecline()
  expect(dialog.getByRole('heading', { name: isTrial ? 'Probestunden-Anfrage ablehnen?' : 'Kursanmeldung ablehnen?' })).toBeVisible()
  expect(dialog.getByText(booking.contact.name)).toBeVisible()
  expect(dialog.getByText(booking.contact.email)).toBeVisible()
  for (const course of booking.courses) expect(dialog.getByText(course.title)).toBeVisible()
  expect(dialog.getByRole('button', { name: 'Ablehnen und Absage senden' })).toBeEnabled()
  expect(declineRegistration).not.toHaveBeenCalled()

  fireEvent.click(dialog.getByRole('button', { name: 'Anfrage behalten' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(registrationCard().getByText('Annahme offen')).toBeVisible()
  expect(declineRegistration).not.toHaveBeenCalled()
  expect(confirmRegistration).not.toHaveBeenCalled()
  expect(saveManualInvoiceStatus).not.toHaveBeenCalled()
  expect(mockRefresh).not.toHaveBeenCalled()
})

it.each([false, true])('declines only the explicitly confirmed booking and shows its new status (trial=%s)', async isTrial => {
  renderDesk(isTrial)
  const dialog = openDecline()
  await act(async () => { fireEvent.click(dialog.getByRole('button', { name: 'Ablehnen und Absage senden' })) })

  expect(declineRegistration).toHaveBeenCalledTimes(1)
  expect(declineRegistration).toHaveBeenCalledWith({ source: 'registration', id: booking.id })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Anfrage abgelehnt. Die Absage wurde für den E-Mail-Versand vorgemerkt.')
  expect(screen.queryByRole('heading', { name: booking.contact.name })).not.toBeInTheDocument()
  expect(registrationCard(untouched.contact.name).getByText('Annahme offen')).toBeVisible()
  expect(mockRefresh).toHaveBeenCalledTimes(1)

  fireEvent.click(screen.getByRole('button', { name: 'Pausiert / storniert' }))
  expect(registrationCard().getByText('Pausiert / storniert')).toBeVisible()
  expect(registrationCard().queryByRole('button', { name: 'Anmeldung ablehnen' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: untouched.contact.name })).not.toBeInTheDocument()
  expect(confirmRegistration).not.toHaveBeenCalled()
  expect(saveManualInvoiceStatus).not.toHaveBeenCalled()
})
