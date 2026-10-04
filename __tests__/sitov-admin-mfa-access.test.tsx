import { render, screen } from '@testing-library/react'
import AdminLayout from '@/app/[lang]/admin/layout'
import { withBackendSession } from '@/lib/actions/backend'
import { sitovStaffMfaCopy } from '@/lib/sitov-staff-mfa-copy'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
let mockRole = 'teacher'
let mockRequired = true
const mockRpc = jest.fn()
const mockCounts = jest.fn()
const mockClient = {
  auth: { getUser: async () => ({ data: { user: { id: 'staff-user', email: 'staff@sitov.test' } }, error: null }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: {
    role: mockRole, sitov_mfa_required: mockRequired, ui_language: 'de', person: { display_name: 'Staff' },
  }, error: null }) }) }) }),
  rpc: mockRpc,
}
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: (target: string) => { throw new Error(`redirect:${target}`) } }))
jest.mock('@/utils/supabase/server', () => ({ createClient: async () => mockClient }))
jest.mock('@/app/actions/auth', () => ({ logout: jest.fn() }))
jest.mock('@/app/actions/admin', () => ({ getAdminNavCounts: () => mockCounts() }))
jest.mock('@/lib/dictionary', () => ({ getDictionary: async () => de }))
jest.mock('@/components/layout/BrandLogo', () => ({ __esModule: true, default: () => <span>Sitov Academy</span> }))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/layout/HeaderLanguageSwitcher', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/admin/AdminI18nProvider', () => ({ AdminI18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('@/components/admin/TeacherLayout', () => ({ __esModule: true, default: ({ controls, children }: { controls: React.ReactNode; children: React.ReactNode }) => <div>{controls}{children}</div> }))

beforeEach(() => {
  jest.clearAllMocks()
  mockRole = 'teacher'
  mockRequired = true
  mockRpc.mockResolvedValue({ data: { required: true, satisfied: false }, error: null })
  mockCounts.mockResolvedValue({})
})

it('renders the teacher workspace without MFA navigation or checks, including a stale legacy mandatory flag', async () => {
  render(await AdminLayout({ params: Promise.resolve({ lang: 'de' }), children: <p>Teacher workspace</p> }))
  expect(screen.getByText('Teacher workspace')).toBeVisible()
  expect(screen.queryByRole('link', { name: sitovStaffMfaCopy('de').title })).not.toBeInTheDocument()
  expect(mockRpc).not.toHaveBeenCalled()
  expect(mockCounts).toHaveBeenCalledTimes(1)
})

it('keeps the administrator guard before loading private navigation data', async () => {
  mockRole = 'admin'
  await expect(AdminLayout({ params: Promise.resolve({ lang: 'de' }), children: <p>Private workspace</p> })).rejects.toThrow('redirect:/de/staff-security')
  expect(mockRpc).toHaveBeenCalledWith('sitov_staff_mfa_status')
  expect(mockCounts).not.toHaveBeenCalled()
})

it('shows MFA management for an administrator who satisfied the database guard', async () => {
  mockRole = 'admin'
  mockRpc.mockResolvedValue({ data: { required: true, satisfied: true }, error: null })
  render(await AdminLayout({ params: Promise.resolve({ lang: 'de' }), children: <p>Admin workspace</p> }))
  expect(screen.getByRole('link', { name: sitovStaffMfaCopy('de').title })).toHaveAttribute('href', '/de/staff-security')
  expect(mockCounts).toHaveBeenCalledTimes(1)
})

it('allows password-only teacher staff work while enforcing the administrator session and role boundary', async () => {
  const work = jest.fn(async ({ role }: { role: string | null }) => role)
  expect(await withBackendSession(work, 'staff')).toEqual({ success: true, data: 'teacher' })
  expect(mockRpc).not.toHaveBeenCalled()
  expect(work).toHaveBeenCalledTimes(1)
  work.mockClear()
  expect(await withBackendSession(work, 'admin')).toEqual({ success: false, error: 'not_authorized' })
  expect(work).not.toHaveBeenCalled()
  mockRole = 'admin'
  expect(await withBackendSession(work, 'staff')).toEqual({ success: false, error: 'not_authorized' })
  expect(work).not.toHaveBeenCalled()
  mockRpc.mockResolvedValue({ data: { required: true, satisfied: true }, error: null })
  expect(await withBackendSession(work, 'staff')).toEqual({ success: true, data: 'admin' })
  expect(work).toHaveBeenCalledTimes(1)
})
