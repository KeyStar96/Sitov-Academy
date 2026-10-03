/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { dailyQuestFixture, dailyQuestStreakFixture } from './fixtures/daily-quest'
import {
  loadDailyQuest, loadDailyQuestStatus, resolveDailyQuestLoginTarget,
  submitDailyQuestAnswer, finishDailyQuest,
  loadDailyQuestPreview,
  loadSitovDailyQuestCatalog,
} from '@/lib/daily-quest-server'

const getUser = jest.fn()
const single = jest.fn()
const rpc = jest.fn()
const eq = jest.fn(() => ({ single }))
const select = jest.fn(() => ({ eq }))
const from = jest.fn(() => ({ select }))
const client = { auth: { getUser }, from, rpc }
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue(client as never)
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
  single.mockResolvedValue({ data: { role: 'student' }, error: null })
  rpc.mockResolvedValue({ data: { success: true, enabled: true, quest: dailyQuestFixture, streak: dailyQuestStreakFixture }, error: null })
})

it.each([null, 'teacher', 'admin'])('does not call a quest RPC for the role %s', async role => {
  single.mockResolvedValue({ data: { role }, error: null })
  expect(await loadDailyQuest()).toEqual({ error: 'not_authorized' })
  expect(rpc).not.toHaveBeenCalled()
})

it('verifies Auth before reading profile or invoking the RPC', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect(await loadDailyQuest()).toEqual({ error: 'not_authenticated' })
  expect(from).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})

it('validates and strips authoring solutions and ownership from the RPC result', async () => {
  rpc.mockResolvedValue({ data: { success: true, enabled: true, quest: {
    ...dailyQuestFixture, userId, solution: 'private', steps: dailyQuestFixture.steps.map(step => ({ ...step, answerKey: 'private' })),
  }, streak: dailyQuestStreakFixture, internal: 'private' }, error: null })
  const result = await loadDailyQuest()
  expect(result.data?.quest).toEqual(dailyQuestFixture)
  expect(result.data).not.toHaveProperty('internal')
  expect(rpc).toHaveBeenCalledWith('get_daily_quest')
})

it('rejects invalid payloads rather than exposing unchecked data to the UI', async () => {
  rpc.mockResolvedValue({ data: { success: true, enabled: true, quest: { ...dailyQuestFixture, scene: { ...dailyQuestFixture.scene, backgroundKey: '../private' } }, streak: dailyQuestStreakFixture }, error: null })
  expect(await loadDailyQuest()).toEqual({ error: 'request_failed' })
})

it.each(['steps_incomplete', 'step_out_of_order', 'expired'])('returns only the approved business code %s', async error => {
  rpc.mockResolvedValue({ data: { success: false, error, message: 'Do not forward this text' }, error: null })
  expect(await finishDailyQuest(dailyQuestFixture.id)).toEqual({ error })
})

it('hides unexpected SQL and provider error details', async () => {
  rpc.mockResolvedValue({ data: { success: false, error: 'secret-schema-error', message: 'private' }, error: null })
  expect(await loadDailyQuest()).toEqual({ error: 'request_failed' })
  rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private' } })
  expect(await loadDailyQuest()).toEqual({ error: 'request_failed' })
})

it('sends the answer but never a client-supplied user, score, date or streak', async () => {
  rpc.mockResolvedValue({ data: { success: true, correct: true, feedback: '', quest: dailyQuestFixture, streak: dailyQuestStreakFixture }, error: null })
  await submitDailyQuestAnswer({ assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i', 'want', 'bread'] } })
  expect(rpc).toHaveBeenCalledWith('submit_daily_quest_step', { p_assignment_id: dailyQuestFixture.id, p_step_id: 'build', p_answer: { pieceIds: ['i', 'want', 'bread'] } })
})

it('reads dashboard status without consuming a login claim or creating a quest', async () => {
  rpc.mockResolvedValue({ data: { success: true, enabled: true, streak: dailyQuestStreakFixture, today: null }, error: null })
  expect((await loadDailyQuestStatus()).data?.today).toBeNull()
  expect(rpc).toHaveBeenCalledWith('get_daily_quest_status')
  expect(rpc).toHaveBeenCalledTimes(1)
})

const resolve = (nextPath = '/de/dashboard') => resolveDailyQuestLoginTarget({ supabase: client as never, userId, lang: 'de', nextPath })

it('lets the database select the first login and sends later logins to the dashboard', async () => {
  const claim = { success: true, enabled: true, shouldRedirect: true, assignmentId: dailyQuestFixture.id, date: dailyQuestFixture.date }
  rpc.mockResolvedValueOnce({ data: claim, error: null }).mockResolvedValueOnce({ data: { ...claim, shouldRedirect: false }, error: null })
  expect(await resolve()).toBe('/de/dashboard/daily-quest')
  expect(await resolve()).toBe('/de/dashboard')
  expect(rpc.mock.calls).toEqual([['claim_daily_quest_login'], ['claim_daily_quest_login']])
})

it.each(['teacher', 'admin', null])('never auto redirects staff or unknown profile roles (%s)', async role => {
  single.mockResolvedValue({ data: { role }, error: null })
  expect(await resolve()).toBe('/de/dashboard')
  expect(rpc).not.toHaveBeenCalled()
})

it.each(['/de/reset-password', '/ru/dashboard/level/A1.1/path?lesson=4#task', '/de/dashboard?focus=grammar'])('preserves targeted destination %s without claiming the day', async path => {
  expect(await resolve(path)).toBe(path)
  expect(from).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})

it.each([
  { data: { success: true, enabled: false, shouldRedirect: false, assignmentId: null, date: dailyQuestFixture.date }, error: null },
  { data: { success: false, error: 'no_template', message: 'private' }, error: null },
  { data: null, error: { message: 'private' } },
  { data: { success: true }, error: null },
])('falls back to the dashboard on a disabled or failed claim', async response => {
  rpc.mockResolvedValue(response)
  expect(await resolve()).toBe('/de/dashboard')
})

const previewData = { success: true, quest: dailyQuestFixture, answerKey: { steps: {
  build: { accepted: [['i', 'want', 'bread']] }, dialogue: { optionId: 'yes' },
} } }

it('denies anonymous callers before loading staff answer keys', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect(await loadDailyQuestPreview('A1')).toEqual({ error: 'not_authenticated' })
  expect(rpc).not.toHaveBeenCalled()
})

it.each(['student', null])('denies preview answer keys to non-staff profiles (%s)', async role => {
  single.mockResolvedValue({ data: { role }, error: null })
  expect(await loadDailyQuestPreview('A1')).toEqual({ error: 'not_authorized' })
  expect(rpc).not.toHaveBeenCalled()
})

it.each(['teacher', 'admin'])('allows a verified %s to load a read-only template preview', async role => {
  single.mockResolvedValue({ data: { role }, error: null })
  rpc.mockResolvedValue({ data: { ...previewData, internalStudentData: 'private' }, error: null })
  expect(await loadDailyQuestPreview('B2')).toEqual({ data: previewData })
  expect(rpc.mock.calls).toEqual([['get_daily_quest_preview', { p_level: 'B2' }]])
})

it('validates both the preview level and private answer-key shape', async () => {
  single.mockResolvedValue({ data: { role: 'admin' }, error: null })
  expect(await loadDailyQuestPreview('A1.1')).toEqual({ error: 'invalid_input' })
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockResolvedValue({ data: { ...previewData, answerKey: { steps: { build: { accepted: ['i', 'want'] } } } }, error: null })
  expect(await loadDailyQuestPreview('A1')).toEqual({ error: 'request_failed' })
})

it('checks staff authorization before fetching the full catalogue', async () => {
  expect(await loadSitovDailyQuestCatalog('A1')).toEqual({ error: 'not_authorized' })
  expect(rpc).not.toHaveBeenCalled()
  single.mockResolvedValue({ data: { role: 'teacher' }, error: null })
  const data = { success: true as const, templates: [{ templateKey: 'sitov-a1-train-ticket', level: 'A1' as const, day: 3, title: 'Fahrkarte', subtitle: 'Ein Ticket kaufen.' }] }
  rpc.mockResolvedValue({ data, error: null })
  expect(await loadSitovDailyQuestCatalog('A1')).toEqual({ data })
  expect(rpc).toHaveBeenCalledWith('get_sitov_daily_quest_catalog', { p_level: 'A1' })
})

it('loads only a validated staff-selected template, with the level checked by SQL', async () => {
  single.mockResolvedValue({ data: { role: 'teacher' }, error: null })
  expect(await loadDailyQuestPreview('A1', ['sitov-a1-ticket'])).toEqual({ error: 'invalid_input' })
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockResolvedValue({ data: previewData, error: null })
  expect(await loadDailyQuestPreview('A1', 'sitov-a1-ticket')).toEqual({ data: previewData })
  expect(rpc).toHaveBeenCalledWith('get_sitov_daily_quest_preview', { p_level: 'A1', p_template_key: 'sitov-a1-ticket' })
})
