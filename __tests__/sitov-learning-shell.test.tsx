import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SitovLearningShell from '@/components/layout/SitovLearningShell'
import { AppearanceProvider } from '@/components/layout/AppearanceProvider'
import { createDashboardTranslator } from '@/lib/dashboard-i18n'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import de from '@/dictionaries/de.json'

let mockPathname = '/de/dashboard'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname, useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }))
jest.mock('@/app/actions/auth', () => ({ logout: jest.fn() }))
jest.mock('next/image', () => ({ __esModule: true, default: ({ priority: sitovPriority, ...sitovProps }: { priority?: boolean; src: string; alt: string }) => {
  void sitovPriority
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...sitovProps} alt={sitovProps.alt} /> } }))
jest.unmock('lucide-react')

const sitovSupport = { whatsapp: 'WhatsApp', phone: '+49 1', phoneLabel: 'Anrufen', telegram: 'Telegram', email: 'a@b.test', emailLabel: 'E-Mail' }
const sitovT = createDashboardTranslator(de.dashboard)
const sitovS = studentTranslator('de')
function sitovView(sitovPreviewPathname?: string) {
  return <AppearanceProvider copy={de.accessibility}><SitovLearningShell lang="de" translations={de.dashboard}
    displayName="Dennis" levels={['A1.1', 'A1.2']} lastActiveLevel="A1.2" supportLabels={sitovSupport}
    sitovPreviewPathname={sitovPreviewPathname}><p>Deine Lerninhalte</p></SitovLearningShell></AppearanceProvider>
}

it.each(['', '/calendar', '/profile', '/daily-quest', '/level/A1.1', '/level/A1.1/vocabulary/train',
  '/level/A1.1/vocabulary/assess', '/level/A1.1/path', '/level/A1.1/pronunciation', '/level/A1.1/videos', '/level/A1.1/verbs'])
  ('stellt dieselben Profil-, Darstellungs- und Navigationsanker auf %s bereit', sitovRoute => {
    mockPathname = `/de/dashboard${sitovRoute}`
    render(sitovView())
    const sitovHeader = screen.getByRole('banner')
    expect(within(sitovHeader).getByRole('link', { name: 'Sitov Academy' })).toHaveAttribute('href', '/de/dashboard')
    expect(within(sitovHeader).getByRole('link', { name: sitovT('open_profile_aria') })).toHaveAttribute('href', '/de/dashboard/profile')
    expect(within(sitovHeader).getByRole('button', { name: de.accessibility.title })).toBeInTheDocument()
    expect(within(sitovHeader).getByRole('button', { name: sitovS('nav_logout') })).toBeInTheDocument()
    const sitovNavigation = within(sitovHeader).getByRole('navigation', { name: sitovS('nav_label') })
    expect(within(sitovNavigation).getByRole('link', { name: getDailyQuestCopy('de').navJourney })).toHaveAttribute('href', '/de/dashboard/daily-quest')
    expect(within(sitovNavigation).getByRole('link', { name: sitovS('nav_calendar') })).toHaveAttribute('href', '/de/dashboard/calendar')
    expect(screen.getByText('Deine Lerninhalte')).toBeInTheDocument()
  })

it('zeigt in einer lokalen Vorschau genau dieselben Anker und eine übersetzte Deutschreise-Brotkrume', () => {
  mockPathname = '/de/sitov-preview/daily-quest'
  render(sitovView('/de/dashboard/daily-quest'))
  const sitovNavigation = screen.getByRole('navigation', { name: sitovS('nav_label') })
  expect(within(sitovNavigation).getByRole('link', { name: 'Deutschreise' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('heading', { name: 'Deutschreise', level: 1 })).toHaveAttribute('aria-current', 'page')
})

it('öffnet die Darstellung und die Hilfe aus jedem Modul ohne den Lerninhalt zu verlassen', async () => {
  mockPathname = '/de/dashboard/level/A1.1/verbs'
  render(sitovView())
  const sitovUser = userEvent.setup()
  await sitovUser.click(screen.getByRole('button', { name: de.accessibility.title }))
  expect(screen.getByRole('dialog', { name: de.accessibility.title })).toBeInTheDocument()
  await sitovUser.click(screen.getByRole('button', { name: de.accessibility.close }))
  await sitovUser.click(screen.getByRole('button', { name: sitovS('nav_help') }))
  const sitovHelp = screen.getByRole('dialog', { name: sitovS('help_title') })
  expect(within(sitovHelp).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/491714758620')
  expect(screen.getByText('Deine Lerninhalte')).toBeInTheDocument()
})
