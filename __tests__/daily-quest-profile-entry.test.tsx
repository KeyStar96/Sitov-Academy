import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ProfileDailyQuestSettings from '@/components/dashboard/ProfileDailyQuestSettings'
import DailyQuestEntry from '@/components/dashboard/DailyQuestEntry'
import { setDailyQuestEnabled } from '@/app/actions/daily-quests'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import { dailyQuestFixture, dailyQuestStreakFixture } from './fixtures/daily-quest'
import type { DailyQuestResult, DailyQuestStatus } from '@/lib/daily-quest-contract'

jest.mock('@/app/actions/daily-quests', () => ({ setDailyQuestEnabled: jest.fn() }))
jest.mock('lucide-react', () => jest.requireActual('lucide-react'))

const status: DailyQuestStatus = { success: true, enabled: true, streak: dailyQuestStreakFixture, today: { assignmentId: dailyQuestFixture.id, status: 'active' } }
beforeEach(() => { jest.clearAllMocks() })

it('saves opt-out and renders the DB response without editing streaks', async () => {
  jest.mocked(setDailyQuestEnabled).mockResolvedValue({ data: { ...status, enabled: false } })
  render(<ProfileDailyQuestSettings lang="de" initial={status} />)
  const toggle = screen.getByRole('switch')
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(toggle)
  await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
  expect(setDailyQuestEnabled).toHaveBeenCalledWith(false)
  expect(screen.getByRole('status')).toHaveTextContent(getDailyQuestCopy('de').settingsSaved)
  expect(screen.getByText(/Längste Serie: 5/)).toBeInTheDocument()
})

it('keeps the confirmed preference on a failed save and announces the error', async () => {
  jest.mocked(setDailyQuestEnabled).mockResolvedValue({ error: 'request_failed' })
  render(<ProfileDailyQuestSettings lang="en" initial={status} />)
  fireEvent.click(screen.getByRole('switch'))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(getDailyQuestCopy('en').settingsError))
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
})

it('blocks duplicate writes while a preference is pending', async () => {
  let resolve: (value: DailyQuestResult<DailyQuestStatus>) => void
  jest.mocked(setDailyQuestEnabled).mockImplementation(() => new Promise(done => { resolve = done }))
  render(<ProfileDailyQuestSettings lang="de" initial={status} />)
  const toggle = screen.getByRole('switch')
  fireEvent.click(toggle); fireEvent.click(toggle)
  expect(setDailyQuestEnabled).toHaveBeenCalledTimes(1)
  expect(toggle).toBeDisabled()
  await act(async () => { resolve({ data: { ...status, enabled: false } }) })
  expect(toggle).not.toBeDisabled()
})

it('does not guess an enabled preference when loading failed', () => {
  render(<ProfileDailyQuestSettings lang="de" initial={null} />)
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  expect(screen.getByText(getDailyQuestCopy('de').settingsUnavailable)).toBeInTheDocument()
})

it.each(['de', 'en', 'ru', 'uk', 'tr'])('has complete UI copy and a localized dashboard entry for %s', locale => {
  const copy = getDailyQuestCopy(locale)
  expect(Object.values(copy).every(value => typeof value === 'string' && value.trim().length > 0)).toBe(true)
  expect(Object.keys(copy)).toEqual(Object.keys(getDailyQuestCopy('de')))
  render(<DailyQuestEntry lang={locale} status={status} />)
  expect(screen.getByRole('link', { name: copy.entryStart })).toHaveAttribute('href', `/${locale}/dashboard/daily-quest`)
})

it('links paused users to the exact opt-in setting', () => {
  render(<DailyQuestEntry lang="de" status={{ ...status, enabled: false }} />)
  expect(screen.getByRole('link', { name: getDailyQuestCopy('de').openSettings })).toHaveAttribute('href', '/de/dashboard/profile#daily-quest')
})

it('shows the completion recorded by the database on the dashboard', () => {
  render(<DailyQuestEntry lang="de" status={{ ...status, today: { assignmentId: dailyQuestFixture.id, status: 'completed' } }} />)
  expect(screen.getByRole('link', { name: getDailyQuestCopy('de').entryDone })).toBeInTheDocument()
  expect(screen.getByText('2 Tage in Folge')).toBeInTheDocument()
})
