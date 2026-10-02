import { render, screen } from '@testing-library/react'
import DailyQuestPreviewPage from '@/app/[lang]/admin/daily-quest/page'
import { loadDailyQuestPreview } from '@/lib/daily-quest-server'
import { dailyQuestFixture } from './fixtures/daily-quest'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'

jest.mock('@/lib/daily-quest-server', () => ({ loadDailyQuestPreview: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(path) } }))
jest.mock('@/components/daily-quest/DailyQuestPreview', () => ({ __esModule: true, default: ({ preview, locale }: { preview: { quest: { title: string } }; locale: string }) => <section><h1>{preview.quest.title}</h1><p>{getDailyQuestCopy(locale).previewNotice}</p></section> }))

beforeEach(() => { jest.clearAllMocks() })
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
