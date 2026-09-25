import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import LoginPage from '@/app/[lang]/login/page'
import RegisterPage from '@/app/[lang]/register/page'
import TodayPlan from '@/components/dashboard/home/TodayPlan'
import StudentNavigation from '@/components/dashboard/StudentNavigation'
import { getDictionary } from '@/lib/dictionary'
import { studentTranslator } from '@/lib/student-ui-i18n'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/auth', () => ({ login: jest.fn(), signup: jest.fn(), resendConfirmation: jest.fn() }))
jest.mock('@/components/auth/AuthShell', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
jest.mock('@/components/auth/AuthForm', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/dictionary', () => ({ getDictionary: jest.fn() }))

const dictionaries = { de, en, ru, uk, tr }
const labels = { whatsapp: 'WhatsApp', phone: '+49 1', phoneLabel: 'Anrufen', telegram: 'Telegram', email: 'a@b.test', emailLabel: 'E-Mail' }

it.each(Object.entries(dictionaries))('shows the registration and email-confirmation messages in %s', async (lang, dictionary) => {
  jest.mocked(getDictionary).mockResolvedValue(dictionary)
  for (const status of ['signup_email_sent', 'confirm_success'] as const) {
    const props = { params: Promise.resolve({ lang }), searchParams: Promise.resolve({ status }) }
    const { unmount } = render(await LoginPage(props))
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent(dictionary.auth.signup_thanks)
    expect(notice).toHaveTextContent(studentTranslator(lang)('pending_access_review'))
    expect(notice).toHaveTextContent(dictionary.auth[`status_${status}`])
    expect(within(notice).getByText(dictionary.auth.signup_thanks)).toHaveClass('font-bold')
    unmount()
  }
})

it('also renders the registration notice on its register status page', async () => {
  jest.mocked(getDictionary).mockResolvedValue(de)
  render(await RegisterPage({ params: Promise.resolve({ lang: 'de' }), searchParams: Promise.resolve({ status: 'signup_email_sent' }) }))
  expect(screen.getByRole('status')).toHaveTextContent(de.auth.signup_thanks)
  expect(screen.getByRole('status')).toHaveTextContent(studentTranslator('de')('pending_access_review'))
})

it.each(Object.keys(dictionaries))('shows the pending-access card with help and calendar in %s', lang => {
  const t = studentTranslator(lang)
  const { rerender } = render(<TodayPlan lang={lang} name="Anna" items={[]} fallbackHref={null} week={null} noLevel />)
  const card = screen.getByRole('region', { name: t('pending_access_title') })
  expect(card).toHaveTextContent(t('pending_access_thanks'))
  expect(card).toHaveTextContent(t('pending_access_review'))
  expect(card).toHaveTextContent(t('pending_access_email'))
  expect(card.querySelector('svg')?.closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'true')
  expect(within(card).getByRole('link', { name: t('nav_help') })).toHaveAttribute('href', `/${lang}/dashboard#dashboard-support-title`)
  expect(within(card).getByRole('link', { name: t('nav_calendar') })).toHaveAttribute('href', `/${lang}/dashboard/calendar`)
  rerender(<TodayPlan lang={lang} name="Anna" items={[]} fallbackHref={`/${lang}/dashboard/level/A1.1`} week={null} noLevel={false} />)
  expect(screen.queryByRole('region', { name: t('pending_access_title') })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: new RegExp(t('today_start')) })).toHaveAttribute('href', `/${lang}/dashboard/level/A1.1`)
})

it('keeps calendar and help navigation usable without a released level', () => {
  const t = studentTranslator('de')
  render(<StudentNavigation lang="de" firstLevel={null} levels={[]} supportLabels={labels} />)
  expect(screen.getByRole('link', { name: t('nav_calendar') })).toHaveAttribute('href', '/de/dashboard/calendar')
  fireEvent.click(screen.getByRole('button', { name: t('nav_help') }))
  expect(screen.getByRole('dialog', { name: t('help_title') })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'E-Mail' })).toHaveAttribute('href', 'mailto:a@b.test')
})
