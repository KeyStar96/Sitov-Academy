import { render, screen } from '@testing-library/react'
import DailyQuestPreview, { createDailyQuestPreviewActions } from '@/components/daily-quest/DailyQuestPreview'
import DailyQuestEngine from '@/components/daily-quest/DailyQuestEngine'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import { dailyQuestFixture } from './fixtures/daily-quest'
import type { DailyQuestPreview as PreviewData } from '@/lib/daily-quest-contract'

// The real engine has its own interaction/audio tests; this boundary asserts
// that the teacher receives local callbacks instead of student server actions.
jest.mock('@/components/daily-quest/DailyQuestEngine', () => ({ __esModule: true, default: jest.fn(() => null) }))

const preview: PreviewData = { success: true, quest: dailyQuestFixture, answerKey: { steps: {
  build: { accepted: [['i', 'want', 'bread'], ['i', 'bread', 'want']] }, dialogue: { optionId: 'yes' },
} } }
beforeEach(() => { jest.clearAllMocks() })
const discover = (actions: ReturnType<typeof createDailyQuestPreviewActions>) => actions.submit({ assignmentId: dailyQuestFixture.id, stepId: 'discover', answer: { wordIds: ['coffee', 'bread'] } })

it('injects local preview actions, a zero streak and the admin return destination', () => {
  render(<DailyQuestPreview preview={preview} locale="de" />)
  expect(jest.mocked(DailyQuestEngine).mock.calls[0][0]).toEqual(expect.objectContaining({
    preview: true, dashboardHref: '/de/admin', initialQuest: dailyQuestFixture,
    initialStreak: { current: 0, longest: 0, lastCompletedDate: null },
    actions: { submit: expect.any(Function), complete: expect.any(Function) },
  }))
})

it('checks words as a complete unique set and sentences against accepted orders', async () => {
  const actions = createDailyQuestPreviewActions(preview)
  expect((await actions.submit({ assignmentId: dailyQuestFixture.id, stepId: 'discover', answer: { wordIds: ['bread', 'bread'] } })).data?.correct).toBe(false)
  expect((await discover(actions)).data?.correct).toBe(true)
  expect((await actions.submit({ assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['want', 'i', 'bread'] } })).data?.correct).toBe(false)
  expect((await actions.submit({ assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i', 'bread', 'want'] } })).data?.correct).toBe(true)
})

it('requires ordered stations and server-authored dialogue keys before local completion', async () => {
  const actions = createDailyQuestPreviewActions(preview)
  expect(await actions.complete(dailyQuestFixture.id)).toEqual({ error: 'steps_incomplete' })
  expect(await actions.submit({ assignmentId: dailyQuestFixture.id, stepId: 'dialogue', answer: { optionId: 'yes' } })).toEqual({ error: 'step_out_of_order' })
  await discover(actions)
  await actions.submit({ assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i', 'want', 'bread'] } })
  expect((await actions.submit({ assignmentId: dailyQuestFixture.id, stepId: 'dialogue', answer: { optionId: 'morning' } })).data?.correct).toBe(false)
  expect((await actions.submit({ assignmentId: dailyQuestFixture.id, stepId: 'dialogue', answer: { optionId: 'yes' } })).data?.correct).toBe(true)
  const finished = await actions.complete(dailyQuestFixture.id)
  expect(finished.data?.quest.status).toBe('completed')
  expect(finished.data?.streak).toEqual({ current: 0, longest: 0, lastCompletedDate: null })
  expect(dailyQuestFixture.status).toBe('active')
  expect(dailyQuestFixture.completedStepIds).toEqual([])
})

it('rejects assignment impersonation and incomplete answer shapes', async () => {
  const actions = createDailyQuestPreviewActions(preview)
  expect(await actions.submit({ assignmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stepId: 'discover', answer: { wordIds: ['bread', 'coffee'] } })).toEqual({ error: 'invalid_input' })
  expect(await actions.submit({ assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i'] } })).toEqual({ error: 'invalid_input' })
})

it('keeps preview grading progress when a server refresh returns identical data', async () => {
  const view = render(<DailyQuestPreview preview={preview} locale="de" />)
  const actions = jest.mocked(DailyQuestEngine).mock.calls[0][0].actions!
  await discover(actions)
  view.rerender(<DailyQuestPreview preview={JSON.parse(JSON.stringify(preview))} locale="de" />)
  const refreshed = jest.mocked(DailyQuestEngine).mock.calls.at(-1)![0].actions!
  expect(refreshed).toBe(actions)
  expect((await refreshed.submit({ assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i', 'want', 'bread'] } })).data?.correct).toBe(true)
})

it('starts a new local grader when the same template receives different content', async () => {
  const view = render(<DailyQuestPreview preview={preview} locale="de" />)
  const actions = jest.mocked(DailyQuestEngine).mock.calls[0][0].actions!
  await discover(actions)
  view.rerender(<DailyQuestPreview preview={{ ...preview, quest: { ...preview.quest, title: 'Aktualisierte Vorschau' } }} locale="de" />)
  const refreshed = jest.mocked(DailyQuestEngine).mock.calls.at(-1)![0].actions!
  expect(refreshed).not.toBe(actions)
  expect(await refreshed.submit({ assignmentId: dailyQuestFixture.id, stepId: 'build', answer: { pieceIds: ['i', 'want', 'bread'] } })).toEqual({ error: 'step_out_of_order' })
})

it.each(['de', 'en', 'ru', 'uk', 'tr'])('has an explicit staff preview notice in %s', locale => {
  render(<p>{getDailyQuestCopy(locale).previewNotice}</p>)
  expect(screen.getByText(getDailyQuestCopy(locale).previewNotice)).toBeInTheDocument()
})
