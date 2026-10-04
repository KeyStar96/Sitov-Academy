import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SitovStaffMfa from '@/components/auth/SitovStaffMfa'
import { sitovStaffMfaCopy } from '@/lib/sitov-staff-mfa-copy'

const mockList = jest.fn()
const mockAssurance = jest.fn()
const mockEnroll = jest.fn()
const mockUnenroll = jest.fn()
const mockVerify = jest.fn()
const mockActivate = jest.fn()
const mockClient = { auth: { mfa: {
  listFactors: mockList, getAuthenticatorAssuranceLevel: mockAssurance,
  enroll: mockEnroll, unenroll: mockUnenroll, challengeAndVerify: mockVerify,
} }, rpc: mockActivate }
jest.mock('@/utils/supabase/client', () => ({ createClient: () => mockClient }))

const copy = sitovStaffMfaCopy('de')
beforeEach(() => {
  jest.clearAllMocks()
  mockList.mockResolvedValue({ data: { all: [], totp: [] }, error: null })
  mockAssurance.mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null })
  mockEnroll.mockResolvedValue({ data: { id: 'new-factor', totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg"/>', secret: 'ABCDEF' } }, error: null })
  mockUnenroll.mockResolvedValue({ error: null })
  mockVerify.mockResolvedValue({ data: {}, error: null })
  mockActivate.mockResolvedValue({ data: true, error: null })
})

it('enrolls only after an explicit action and enables mandatory access only after verified TOTP', async () => {
  const user = userEvent.setup()
  render(<SitovStaffMfa lang="de" copy={copy} required={false} />)
  await screen.findByRole('button', { name: copy.setup })
  expect(mockEnroll).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: copy.setup }))
  expect(await screen.findByRole('img', { name: copy.qrAlt })).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
  expect(screen.getByText('ABCDEF')).toBeVisible()
  await user.type(screen.getByLabelText(copy.code), '123456')
  await user.click(screen.getByRole('button', { name: copy.verify }))
  expect(mockVerify).toHaveBeenCalledWith({ factorId: 'new-factor', code: '123456' })
  expect(mockActivate).toHaveBeenCalledWith('sitov_enable_staff_mfa')
  expect(await screen.findByText(copy.protected)).toBeVisible()
  expect(screen.queryByText('ABCDEF')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: copy.continue })).toHaveAttribute('href', '/de/admin')
})

it('does not claim success when the database activation fails after successful Auth verification', async () => {
  const user = userEvent.setup()
  const factor = { id: 'existing', status: 'verified', factor_type: 'totp', friendly_name: 'School app' }
  mockList.mockResolvedValue({ data: { all: [factor], totp: [factor] }, error: null })
  mockActivate.mockResolvedValue({ data: null, error: { message: 'offline' } })
  render(<SitovStaffMfa lang="de" copy={copy} required />)
  const input = await screen.findByLabelText(copy.code)
  await user.type(input, '123456'); await user.click(screen.getByRole('button', { name: copy.verify }))
  expect(await screen.findByRole('alert')).toHaveTextContent(copy.failed)
  expect(screen.queryByRole('link', { name: copy.continue })).not.toBeInTheDocument()
  expect(mockEnroll).not.toHaveBeenCalled()
})

it('never removes verified factors when cleaning an unfinished setup and supports cancellation', async () => {
  const user = userEvent.setup()
  const unfinished = { id: 'pending', status: 'unverified', factor_type: 'totp', friendly_name: 'Sitov Academy' }
  const other = { id: 'other', status: 'unverified', factor_type: 'totp', friendly_name: 'Another app' }
  mockList.mockResolvedValue({ data: { all: [unfinished, other], totp: [] }, error: null })
  render(<SitovStaffMfa lang="de" copy={copy} required />)
  await user.click(await screen.findByRole('button', { name: copy.setup }))
  expect(mockUnenroll).toHaveBeenCalledTimes(1)
  expect(mockUnenroll).toHaveBeenCalledWith({ factorId: 'pending' })
  await user.click(await screen.findByRole('button', { name: copy.cancel }))
  await waitFor(() => expect(screen.queryByText('ABCDEF')).not.toBeInTheDocument())
  expect(mockUnenroll).toHaveBeenLastCalledWith({ factorId: 'new-factor' })
  expect(mockActivate).not.toHaveBeenCalled()
})

it.each(['de', 'en', 'ru', 'uk', 'tr'])('renders the selected interface language: %s', async lang => {
  const localized = sitovStaffMfaCopy(lang)
  render(<SitovStaffMfa lang={lang} copy={localized} required />)
  expect(await screen.findByRole('button', { name: localized.setup })).toBeVisible()
  expect(screen.getByText(localized.mandatory)).toBeVisible()
})
