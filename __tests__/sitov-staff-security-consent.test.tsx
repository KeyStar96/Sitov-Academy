import fs from 'fs'
import path from 'path'
import { fireEvent, render, screen } from '@testing-library/react'
import SitovStaffSecurityPage from '@/app/[lang]/staff-security/page'
import ConsentManager from '@/components/analytics/ConsentManager'
import { getDictionary } from '@/lib/dictionary'
import { consentStatus, saveConsent } from '@/lib/analytics/consent'
import { revokeMetaPixel } from '@/lib/analytics/meta-pixel'

let mockPathname = '/de/staff-security'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname, redirect: jest.fn() }))
jest.mock('@/app/actions/auth', () => ({ logout: jest.fn() }))
jest.mock('@/lib/dictionary', () => ({ getDictionary: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'staff-user' } }, error: null }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'teacher', sitov_mfa_required: true } }) }) }) }),
}) }))
jest.mock('@/components/auth/AuthShell', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock('@/components/auth/SitovStaffMfa', () => ({ __esModule: true, default: () => <div data-testid="sitov-mfa-flow" /> }))

beforeEach(() => {
  revokeMetaPixel()
  window.localStorage.clear()
  delete window.fbq
  jest.spyOn(window, 'Image')
})
afterEach(() => {
  revokeMetaPixel()
  jest.restoreAllMocks()
})

const cases = ['de', 'en', 'ru', 'uk', 'tr'].flatMap(lang => [undefined, false, true].map(marketing => ({ lang, marketing })))
it.each(cases)('MFA in $lang with previous marketing=$marketing: localized withdrawal stays reachable without tracking', async ({ lang, marketing }) => {
  mockPathname = `/${lang}/staff-security`
  window.history.replaceState(null, '', mockPathname)
  if (marketing !== undefined) saveConsent(marketing)
  const dictionary = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dictionaries', `${lang}.json`), 'utf-8'))
  jest.mocked(getDictionary).mockResolvedValue(dictionary)
  const legacySdk = jest.fn()
  window.fbq = legacySdk
  const page = await SitovStaffSecurityPage({ params: Promise.resolve({ lang }) })
  render(<>{page}<ConsentManager lang={lang} copy={dictionary.consent} /></>)

  expect(screen.getByTestId('sitov-mfa-flow')).toBeVisible()
  expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument()
  expect(window.Image).not.toHaveBeenCalled()
  expect(document.querySelector('script[src*="connect.facebook.net"]')).toBeNull()
  expect(legacySdk).toHaveBeenCalledWith('consent', 'revoke')

  const settings = screen.getByRole('button', { name: dictionary.consent.settings_button })
  settings.focus()
  fireEvent.click(settings)
  expect(screen.getByTestId('consent-banner')).toHaveAttribute('data-prompt', 'manual')
  expect(screen.getByRole('switch', { name: dictionary.consent.marketing_label })).toHaveProperty('checked', marketing === true)
  fireEvent.click(screen.getByRole('button', { name: dictionary.consent.reject_all }))
  expect(consentStatus()).toBe('denied')
  expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument()
  expect(settings).toHaveFocus()
  expect(window.Image).not.toHaveBeenCalled()
})
