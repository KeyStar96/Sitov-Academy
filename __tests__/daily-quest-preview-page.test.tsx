import { render, screen } from '@testing-library/react'
import DailyQuestPreviewPage from '@/app/[lang]/admin/daily-quest/page'
import { loadDailyQuestPreview, loadSitovDailyQuestCatalog } from '@/lib/daily-quest-server'
import { dailyQuestFixture } from './fixtures/daily-quest'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'

jest.mock('@/lib/daily-quest-server', () => ({ loadDailyQuestPreview: jest.fn(), loadSitovDailyQuestCatalog: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(path) } }))
jest.mock('@/components/daily-quest/DailyQuestPreview', () => ({ __esModule: true, default: ({ preview, locale }: { preview: { quest: { title: string } }; locale: string }) => <section><h1>{preview.quest.title}</h1><p>{getDailyQuestCopy(locale).previewNotice}</p></section> }))

beforeEach(() => { jest.clearAllMocks(); jest.mocked(loadSitovDailyQuestCatalog).mockResolvedValue({ error: 'request_failed' }) })
const params = Promise.resolve({ lang: 'de' })

it('renders a genuine staff template, its preview notice and all CEFR choices', async () => {
  jest.mocked(loadDailyQuestPreview).mockResolvedValue({ data: { success: true, quest: dailyQuestFixture, answerKey: { steps: { build: { accepted: [['i', 'want', 'bread']] }, dialogue: { optionId: 'yes' } } } } })
  render(await DailyQuestPreviewPage({ params, searchParams: Promise.resolve({ level: 'B2' }) }))
  expect(loadDailyQuestPreview).toHaveBeenCalledWith('B2')
  expect(screen.getByRole('heading', { name: 'Beim Bäcker' })).toBeInTheDocument()
  expect(screen.getByText(getDailyQuestCopy('de').previewNotice)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'B2' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'C2' })).toHaveAttribute('href', '/de/admin/daily-quest?level=C2')
})

it('redirects a student without rendering authoring keys', async () => {
  jest.mocked(loadDailyQuestPreview).mockResolvedValue({ error: 'not_authorized' })
  await expect(DailyQuestPreviewPage({ params })).rejects.toThrow('/de/dashboard')
})

it('redirects an anonymous visitor to login while preserving the requested preview', async () => {
  jest.mocked(loadDailyQuestPreview).mockResolvedValue({ error: 'not_authenticated' })
  await expect(DailyQuestPreviewPage({ params, searchParams: Promise.resolve({ level: 'C1' }) })).rejects.toThrow('/de/login?next=%2Fde%2Fadmin%2Fdaily-quest%3Flevel%3DC1')
})

it.each(['A1.1', 'not-a-level', ['A1', 'C2']])('uses a safe A1 fallback for invalid level %s', async level => {
  jest.mocked(loadDailyQuestPreview).mockResolvedValue({ error: 'no_template' })
  render(await DailyQuestPreviewPage({ params, searchParams: Promise.resolve({ level }) }))
  expect(loadDailyQuestPreview).toHaveBeenCalledWith('A1')
  expect(screen.getByRole('link', { name: getDailyQuestCopy('de').dashboard })).toHaveAttribute('href', '/de/admin')
})

it('lets staff choose an individual journey while retaining the selected CEFR family', async () => {
  const templateKey = 'sitov-a1-train-ticket'
  jest.mocked(loadDailyQuestPreview).mockResolvedValue({ data: { success: true, quest: { ...dailyQuestFixture, templateKey }, answerKey: { steps: {} } } })
  jest.mocked(loadSitovDailyQuestCatalog).mockResolvedValue({ data: { success: true, templates: [
    { templateKey: dailyQuestFixture.templateKey, level: 'A1', day: 0, title: 'Beim Bäcker', subtitle: 'Frühstück' },
    { templateKey, level: 'A1', day: 3, title: 'Eine Fahrkarte kaufen', subtitle: 'Am Bahnhof' },
  ] } })
  render(await DailyQuestPreviewPage({ params, searchParams: Promise.resolve({ level: 'A1', template: templateKey }) }))
  expect(loadDailyQuestPreview).toHaveBeenCalledWith('A1', templateKey)
  expect(screen.getByRole('combobox', { name: 'Aufgabe auswählen' })).toHaveValue(templateKey)
  expect(screen.getByRole('option', { name: '3. Eine Fahrkarte kaufen' })).toBeInTheDocument()
  expect(screen.getByText('2 verfügbare Aufgaben')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: getDailyQuestCopy('de').previewEntry }).closest('form')).toHaveAttribute('method', 'get')
})

it('preserves a specific template when redirecting to login', async () => {
  jest.mocked(loadDailyQuestPreview).mockResolvedValue({ error: 'not_authenticated' })
  await expect(DailyQuestPreviewPage({ params, searchParams: Promise.resolve({ level: 'B1', template: 'sitov-b1-office-meeting' }) }))
    .rejects.toThrow('/de/login?next=%2Fde%2Fadmin%2Fdaily-quest%3Flevel%3DB1%26template%3Dsitov-b1-office-meeting')
})
