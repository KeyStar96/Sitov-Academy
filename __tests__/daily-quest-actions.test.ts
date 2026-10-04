/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/daily-quest-server', () => ({
  loadDailyQuest: jest.fn(), loadDailyQuestStatus: jest.fn(), updateDailyQuestEnabled: jest.fn(),
  submitDailyQuestAnswer: jest.fn(), finishDailyQuest: jest.fn(), dismissDailyQuest: jest.fn(),
}))
import { revalidatePath } from 'next/cache'
import { submitDailyQuestAnswer, finishDailyQuest, dismissDailyQuest, updateDailyQuestEnabled } from '@/lib/daily-quest-server'
import { submitDailyQuestStep, completeDailyQuest, skipDailyQuest, setDailyQuestEnabled } from '@/app/actions/daily-quests'
import { dailyQuestFixture, dailyQuestStreakFixture } from './fixtures/daily-quest'

const success = { data: { success: true as const, quest: dailyQuestFixture, streak: dailyQuestStreakFixture } }
beforeEach(() => { jest.clearAllMocks() })

it.each([
  { assignmentId: 'not-a-uuid', stepId: 'build', answer: { pieceIds: ['i', 'want'] } },
  { assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i'] } },
  { assignmentId: dailyQuestFixture.id, stepId: '../build', answer: { pieceIds: ['i', 'want'] } },
  { assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i', 'want'], score: 100 } },
  { assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i', 'want'] }, userId: 'someone-else' },
])('rejects malformed and privileged submission fields', async input => {
  expect(await submitDailyQuestStep(input)).toEqual({ error: 'invalid_input' })
  expect(submitDailyQuestAnswer).not.toHaveBeenCalled()
})

it('passes a valid answer to the student-only DAL without invalidating the current engine', async () => {
  const input = { assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i', 'want'] } }
  jest.mocked(submitDailyQuestAnswer).mockResolvedValue({ data: { ...success.data, correct: false, feedback: 'Noch einmal.' } })
  expect((await submitDailyQuestStep(input)).data?.correct).toBe(false)
  expect(submitDailyQuestAnswer).toHaveBeenCalledWith(input, 'de')
  expect(revalidatePath).not.toHaveBeenCalled()
})

it.each([completeDailyQuest, skipDailyQuest])('requires an assignment UUID for a state mutation', async action => {
  expect(await action('invalid')).toEqual({ error: 'invalid_input' })
  expect(finishDailyQuest).not.toHaveBeenCalled()
  expect(dismissDailyQuest).not.toHaveBeenCalled()
})

it('invalidates the dashboard after confirmed completion but not after an incomplete result', async () => {
  jest.mocked(finishDailyQuest).mockResolvedValueOnce({ error: 'steps_incomplete' }).mockResolvedValueOnce(success)
  expect(await completeDailyQuest(dailyQuestFixture.id)).toEqual({ error: 'steps_incomplete' })
  expect(revalidatePath).not.toHaveBeenCalled()
  await completeDailyQuest(dailyQuestFixture.id)
  expect(revalidatePath).toHaveBeenCalledWith('/[lang]/dashboard', 'page')
})

it('accepts boolean preferences only and relies on the returned DB status', async () => {
  for (const value of ['false', 0, null, { enabled: false, streak: 99 }]) {
    expect(await setDailyQuestEnabled(value)).toEqual({ error: 'invalid_input' })
  }
  expect(updateDailyQuestEnabled).not.toHaveBeenCalled()
  jest.mocked(updateDailyQuestEnabled).mockResolvedValue({ data: { success: true, enabled: false, streak: dailyQuestStreakFixture, today: null } })
  expect((await setDailyQuestEnabled(false)).data?.enabled).toBe(false)
  expect(updateDailyQuestEnabled).toHaveBeenCalledWith(false)
  expect(revalidatePath).toHaveBeenCalledWith('/[lang]/dashboard/profile', 'page')
})


it.each(['en', 'ru', 'uk', 'tr'])('passes the selected UI language %s through grading and completion', async sitovLocale => {
  const input = { assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i', 'want'] } }
  await submitDailyQuestStep(input, sitovLocale)
  expect(submitDailyQuestAnswer).toHaveBeenCalledWith(input, sitovLocale)
  jest.mocked(finishDailyQuest).mockResolvedValue(success)
  await completeDailyQuest(dailyQuestFixture.id, sitovLocale)
  expect(finishDailyQuest).toHaveBeenCalledWith(dailyQuestFixture.id, sitovLocale)
})

it.each(['xx', {}, null])('rejects invalid UI languages before a grading mutation (%s)', async sitovLocale => {
  const input = { assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i', 'want'] } }
  expect(await submitDailyQuestStep(input, sitovLocale)).toEqual({ error: 'invalid_input' })
  expect(await completeDailyQuest(dailyQuestFixture.id, sitovLocale)).toEqual({ error: 'invalid_input' })
  expect(submitDailyQuestAnswer).not.toHaveBeenCalled()
  expect(finishDailyQuest).not.toHaveBeenCalled()
})
