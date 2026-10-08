jest.mock('@/app/actions/learning-checkpoints', () => ({
  loadLearningCheckpoint: jest.fn().mockResolvedValue({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: null }),
  saveLearningCheckpoint: jest.fn(async (_kind, _level, state, revision) => ({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: { state, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } })),
  clearLearningCheckpoint: jest.fn(async (_kind, _level, revision) => ({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: { state: {}, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } })),
}))
import { randomUUID } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import VocabularyFocus from '@/components/vocabulary/VocabularyFocus'
import VocabularyTabs from '@/components/vocabulary/VocabularyTabs'
import { getVocabularyFocus, submitVocabularyFocusAnswer } from '@/app/actions/vocabulary-focus'
import { requeue, vocabularyFocusSchema, type FocusAnswerResult, type VocabularyFocus as FocusData } from '@/lib/vocabulary-focus'
import { vocabularyFocusCopy } from '@/lib/vocabulary-focus-i18n'
import { saveLearningCheckpoint, loadLearningCheckpoint } from '@/app/actions/learning-checkpoints'
import type { VocabularyFocusCheckpoint } from '@/lib/vocabulary-focus-checkpoint'

jest.unmock('lucide-react')
jest.mock('@/app/actions/vocabulary-focus', () => ({ getVocabularyFocus: jest.fn(), submitVocabularyFocusAnswer: jest.fn() }))
const refresh = jest.fn()
let mockPathname = '/ru/dashboard/level/A1.1/vocabulary/focus'
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }), usePathname: () => mockPathname }))

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const tisch = id(1), haus = id(2), schnell = id(3)
const payload = {
  success: true, level: 'A1.1',
  summary: { active: 3, due: 3, mastered: 1, articleWords: 1, nextDueAt: null },
  words: [
    { cardId: tisch, word: 'Tisch', article: 'der', level: 'A1.1', translation: 'стол', status: 'active', stage: 0, dueAt: '2026-09-30T08:00:00+00:00', due: true, wrongCount: 2, articleErrors: 2, masteredAt: null, reasons: ['article'] },
    { cardId: haus, word: 'Haus', article: 'das', level: 'A1.1', translation: 'дом', status: 'active', stage: 1, dueAt: '2026-09-30T08:00:00+00:00', due: true, wrongCount: 4, articleErrors: 0, masteredAt: null, reasons: ['hard'] },
    { cardId: id(4), word: 'Katze', article: 'die', level: 'A1.1', translation: 'кошка', status: 'mastered', stage: 4, dueAt: null, due: false, wrongCount: 3, articleErrors: 0, masteredAt: '2026-09-29T08:00:00+00:00', reasons: ['hard'] },
  ],
  items: [
    { cardId: tisch, format: 'article', stage: 0, level: 'A1.1', prompt: 'стол', noun: true, reasons: ['article'], word: 'Tisch', options: ['der', 'die', 'das'] },
    { cardId: haus, format: 'build', stage: 1, level: 'A1.1', prompt: 'дом', noun: true, reasons: ['hard'], letters: ['u', 'H', 's', 'a'], article: 'das' },
    { cardId: schnell, format: 'type', stage: 2, level: 'A1.1', prompt: 'быстро', noun: false, reasons: ['hard'], firstLetter: 's', length: 7 },
  ],
}
const data = vocabularyFocusSchema.parse(payload) as FocusData
const reply = (patch: Partial<FocusAnswerResult>): FocusAnswerResult => ({
  correct: true, format: 'article', stage: 1, status: 'active', dueAt: '2026-10-01T22:00:00+00:00',
  solution: { display: 'der Tisch', word: 'Tisch', article: 'der' }, feedback: null, ...patch,
})
beforeAll(() => {
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID })
})
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getVocabularyFocus).mockResolvedValue({ success: true, data })
  jest.mocked(saveLearningCheckpoint).mockImplementation(async (_kind, _level, state, revision) => ({ ok: true, learnerId: id(1), checkpoint: { state, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } }))
  jest.mocked(loadLearningCheckpoint).mockResolvedValue({ ok: true, learnerId: id(1), checkpoint: null })
})

it('lists problem words with reasons, steps and due state and offers the due round', () => {
  render(<VocabularyFocus initial={data} lang="ru" level="A1.1" />)
  expect(screen.getByRole('heading', { level: 1, name: 'Проблемные слова' })).toBeInTheDocument()
  const list = screen.getByRole('list', { name: 'Ваши проблемные слова' })
  const rows = within(list).getAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(rows[0]).toHaveTextContent('der Tisch'); expect(rows[0]).toHaveTextContent('Артикль'); expect(rows[0]).toHaveTextContent('Сегодня')
  expect(within(rows[1]).getByRole('img', { name: 'Ступень 1 из 4' })).toBeInTheDocument()
  expect(screen.getByText('Освоено: 1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Начать тренировку (3)' })).toBeInTheDocument()
})

it('trains an article, brings a wrong word back once and reuses the request id on retry', async () => {
  const requests: string[] = []
  jest.mocked(submitVocabularyFocusAnswer)
    .mockImplementationOnce(async input => { requests.push((input as { requestId: string }).requestId); return { success: false, error: 'failed' } })
    .mockImplementationOnce(async input => { requests.push((input as { requestId: string }).requestId); return { success: true, data: reply({ correct: false, stage: 0, dueAt: '2026-09-30T09:00:00+00:00' }) } })
  render(<VocabularyFocus initial={data} lang="ru" level="A1.1" />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Начать тренировку (3)' })))
  expect(screen.getByText('Задание 1 из 3')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Какой артикль?' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'die' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Не получилось')
  fireEvent.click(screen.getByRole('button', { name: 'Отправить снова' }))
  expect(await screen.findByText('Не совсем.')).toBeInTheDocument()
  expect(requests[0]).toBe(requests[1])
  expect(submitVocabularyFocusAnswer).toHaveBeenLastCalledWith({ requestId: requests[0], cardId: tisch, format: 'article', answer: 'die', lang: 'ru', expectedLearnerId: id(1), learningSourceLanguage: 'ru' })
  expect(screen.getByText('der Tisch')).toBeInTheDocument()
  expect(screen.getByText('Это слово ещё раз появится в этом раунде.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'der' })).toHaveAttribute('data-state', 'correct')
  expect(screen.getByRole('button', { name: 'die' })).toHaveAttribute('data-state', 'wrong')
  // Die Runde ist jetzt eine Aufgabe länger.
  expect(screen.getByText('Задание 1 из 4')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Дальше' })).toHaveFocus()
})

it('builds a word from letters and writes a word; the server decides and the summary counts', async () => {
  jest.mocked(submitVocabularyFocusAnswer)
    .mockResolvedValueOnce({ success: true, data: reply({ correct: true, stage: 1 }) })
    .mockResolvedValueOnce({ success: true, data: reply({ correct: true, format: 'build', stage: 2, solution: { display: 'das Haus', word: 'Haus', article: 'das' } }) })
    .mockResolvedValueOnce({ success: true, data: reply({ correct: true, format: 'type', stage: 4, status: 'mastered', dueAt: null, solution: { display: 'schnell', word: 'schnell', article: null } }) })
  render(<VocabularyFocus initial={data} lang="ru" level="A1.1" />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Начать тренировку (3)' })))
  fireEvent.click(screen.getByRole('button', { name: 'der' }))
  await screen.findByRole('button', { name: 'Дальше' })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Дальше' })))
  expect(screen.getByRole('heading', { name: 'Соберите слово' })).toBeInTheDocument()
  const check = screen.getByRole('button', { name: 'Проверить' })
  expect(check).toBeDisabled()
  for (const letter of ['H', 'a', 'u', 's']) fireEvent.click(screen.getByRole('button', { name: `Добавить букву ${letter}` }))
  fireEvent.click(screen.getByRole('button', { name: 'Убрать букву s' }))
  fireEvent.click(screen.getByRole('button', { name: 'Добавить букву s' }))
  fireEvent.click(check)
  await waitFor(() => expect(submitVocabularyFocusAnswer).toHaveBeenLastCalledWith(expect.objectContaining({ cardId: haus, format: 'build', answer: 'Haus' })))
  expect(await screen.findByText(/Ступень 2 из 4/)).toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Дальше' })))
  const input = screen.getByRole('textbox', { name: 'Ваш ответ' })
  expect(input).toHaveAccessibleDescription('Начинается с «s» · букв: 7')
  fireEvent.change(input, { target: { value: ' schnell ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Проверить' }))
  expect(await screen.findByText('Освоено! Слово больше не нужно тренировать.')).toBeInTheDocument()
  expect(submitVocabularyFocusAnswer).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'type', answer: 'schnell' }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Итоги' })))
  expect(screen.getByRole('heading', { name: 'Раунд завершён' })).toBeInTheDocument()
  expect(screen.getByText('Верно: 3 из 3')).toBeInTheDocument()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'К обзору' })) })
  expect(getVocabularyFocus).toHaveBeenCalledWith('A1.1', 'ru')
  expect(refresh).toHaveBeenCalled()
})

it('skips a word that another tab already finished', async () => {
  jest.mocked(submitVocabularyFocusAnswer).mockResolvedValueOnce({ success: false, error: 'not_due' })
  render(<VocabularyFocus initial={data} lang="ru" level="A1.1" />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Начать тренировку (3)' })))
  fireEvent.click(screen.getByRole('button', { name: 'der' }))
  expect(await screen.findByText('Это слово на сегодня уже выполнено.')).toBeInTheDocument()
  expect(screen.getByText('Задание 2 из 3')).toBeInTheDocument()
})

it('shows an honest empty state and a load error with retry', async () => {
  const empty = vocabularyFocusSchema.parse({ ...payload, summary: { active: 0, due: 0, mastered: 0, articleWords: 0, nextDueAt: null }, words: [], items: [] }) as FocusData
  const { unmount } = render(<VocabularyFocus initial={empty} lang="en" level="A1.1" />)
  expect(screen.getByRole('heading', { name: 'No problem words' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Start training/ })).not.toBeInTheDocument()
  unmount()
  render(<VocabularyFocus initial={null} lang="en" level="A1.1" />)
  expect(screen.getByRole('alert')).toHaveTextContent('Problem words could not be loaded.')
  fireEvent.click(screen.getByRole('button', { name: 'Send again' }))
  expect(await screen.findByRole('button', { name: 'Start training (3)' })).toBeInTheDocument()
})

it('adds the problem-word view as the third vocabulary tab', () => {
  render(<VocabularyTabs lang="ru" level="A1.1" />)
  const nav = screen.getByRole('navigation')
  expect(nav).toHaveAttribute('data-count', '3')
  expect(within(nav).getByRole('link', { name: 'Проблемные слова' })).toHaveAttribute('aria-current', 'page')
  expect(within(nav).getByRole('link', { name: 'Проблемные слова' })).toHaveAttribute('href', '/ru/dashboard/level/A1.1/vocabulary/focus')
  mockPathname = '/ru/dashboard/level/A1.1/vocabulary'
})

it('continues a focus round with its scheduled retry on a second device', async () => {
  jest.mocked(submitVocabularyFocusAnswer).mockResolvedValueOnce({ success: true, data: reply({ correct: false, stage: 0 }) })
  const firstDevice = render(<VocabularyFocus initial={data} lang="ru" level="A1.1" learnerId={id(1)} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Начать тренировку (3)' })))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'die' })))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Дальше' })))
  const call = jest.mocked(saveLearningCheckpoint).mock.calls.at(-1)!
  const state = call[2] as VocabularyFocusCheckpoint
  expect(state.index).toBe(1)
  expect(state.queue.at(-1)?.item.cardId).toBe(tisch)
  firstDevice.unmount()
  localStorage.clear(); sessionStorage.clear()
  render(<VocabularyFocus initial={data} lang="ru" level="A1.1" learnerId={id(1)}
    checkpoint={{ state, revision: call[3] + 1, updatedAt: '2026-10-03T09:00:00Z' }} />)
  expect(screen.getByRole('heading', { name: 'Соберите слово' })).toBeVisible()
  expect(screen.getByText('Задание 2 из 4')).toBeVisible()
  expect(submitVocabularyFocusAnswer).toHaveBeenCalledTimes(1)
})

it('replays a pending focus receipt after losing the response during a device change', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof submitVocabularyFocusAnswer>>) => void
  const lostResponse = new Promise<Awaited<ReturnType<typeof submitVocabularyFocusAnswer>>>(done => { resolve = done })
  jest.mocked(submitVocabularyFocusAnswer).mockReturnValueOnce(lostResponse).mockResolvedValueOnce({ success: true, data: reply({ correct: true }) })
  const firstDevice = render(<VocabularyFocus initial={data} lang="ru" level="A1.1" learnerId={id(1)} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Начать тренировку (3)' })))
  fireEvent.click(screen.getByRole('button', { name: 'der' }))
  await waitFor(() => expect(submitVocabularyFocusAnswer).toHaveBeenCalledTimes(1))
  const original = jest.mocked(submitVocabularyFocusAnswer).mock.calls[0][0]
  const call = jest.mocked(saveLearningCheckpoint).mock.calls.at(-1)!
  firstDevice.unmount()
  render(<VocabularyFocus initial={data} lang="ru" level="A1.1" learnerId={id(1)}
    checkpoint={{ state: call[2], revision: call[3] + 1, updatedAt: '2026-10-03T09:00:00Z' }} />)
  expect(await screen.findByText('Верно!')).toBeVisible()
  expect(jest.mocked(submitVocabularyFocusAnswer).mock.calls[1][0]).toEqual(original)
  // The original, abandoned request can finish later without navigating this device.
  await act(async () => resolve({ success: true, data: reply({ correct: true }) }))
})

it('blocks grading when a focus checkpoint cannot be saved', async () => {
  const firstDevice = render(<VocabularyFocus initial={data} lang="ru" level="A1.1" learnerId={id(1)} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Начать тренировку (3)' })))
  jest.mocked(saveLearningCheckpoint).mockResolvedValueOnce({ ok: false, error: 'unavailable' })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'der' })))
  expect(submitVocabularyFocusAnswer).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('Не получилось')
  firstDevice.unmount()
})

it('blocks an old focus device when another device saved a newer checkpoint', async () => {
  render(<VocabularyFocus initial={data} lang="ru" level="A1.1" learnerId={id(1)} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Начать тренировку (3)' })))
  jest.mocked(saveLearningCheckpoint).mockResolvedValueOnce({ ok: false, error: 'conflict', checkpoint: { state: {}, revision: 20, updatedAt: '2026-10-03T09:30:00Z' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'der' })))
  expect(submitVocabularyFocusAnswer).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('Обучение продолжилось на другом устройстве')
  expect(screen.getByRole('button', { name: 'Загрузить сохранение' })).toBeVisible()
})

it('validates the item contract, requeues after two other tasks and keeps five complete localizations', () => {
  expect(vocabularyFocusSchema.safeParse({ ...payload, items: [{ ...payload.items[0], options: ['der', 'die'] }] }).success).toBe(false)
  expect(vocabularyFocusSchema.safeParse({ ...payload, items: [{ ...payload.items[1], format: 'build', letters: ['a'] }] }).success).toBe(false)
  expect(requeue(['a', 'b', 'c', 'd', 'e'], 0, 'x')).toEqual(['a', 'b', 'c', 'x', 'd', 'e'])
  expect(requeue(['a', 'b'], 1, 'x')).toEqual(['a', 'b', 'x'])
  for (const lang of ['de', 'en', 'ru', 'uk', 'tr']) {
    const t = vocabularyFocusCopy(lang)
    for (const key of ['title', 'rule', 'format_article', 'format_choice', 'format_build', 'format_type', 'done_score', 'hint_type'] as const)
      expect(t(key, { count: 1, correct: 1, total: 2, letter: 'a' }).trim().length).toBeGreaterThan(0)
  }
})
