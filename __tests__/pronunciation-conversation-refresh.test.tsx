import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import PronunciationConversation from '@/components/audio/PronunciationConversation'
import { getPronunciationConversations, markPronunciationSeen } from '@/app/actions/pronunciation-conversations'
import type { PronunciationConversation as Conversation } from '@/lib/pronunciation-conversations'
import { PRONUNCIATION_FALLBACKS as labels } from '@/lib/pronunciation-i18n'

jest.unmock('lucide-react')
jest.mock('@/app/actions/pronunciation-conversations', () => ({ getPronunciationConversations: jest.fn(), markPronunciationSeen: jest.fn() }))
jest.mock('@/components/audio/PronunciationMessageInput', () => ({ __esModule: true, default: () => <div>Composer</div> }))
jest.mock('@/components/audio/WaveformPlayer', () => ({ __esModule: true, default: ({ src }: { src: string }) => <div data-testid="waveform-source" data-source={src}>Waveform</div> }))

const initial: Conversation = {
  id: '00000000-0000-4000-8000-000000000001', title: 'Mein Alltag', studentName: 'Test Student', studentEmail: null,
  level: 'A1.1', readingText: null, status: 'reviewed', createdAt: '2026-09-13T12:00:00Z', hasUnseen: false,
  messages: [{ id: 'message-1', senderRole: 'teacher', text: 'Ein guter Anfang.', audioUrl: null, unseen: false, createdAt: '2026-09-13T12:00:00Z' }],
}
const fresh: Conversation = {
  ...initial, messages: [...initial.messages, {
    id: 'message-2', senderRole: 'teacher', text: 'Auch die neue Rückmeldung bleibt sichtbar.',
    audioUrl: null, unseen: false, createdAt: '2026-09-13T12:01:00Z',
  }],
}
function deferred<Result>() {
  let resolve!: (value: Result) => void
  const promise = new Promise<Result>(done => { resolve = done })
  return { promise, resolve }
}
function view(data: Conversation) { return <PronunciationConversation conversation={data} lang="de" translations={{}} /> }
function visible(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value })
  document.dispatchEvent(new Event('visibilitychange'))
}
async function openConversation() {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mein Alltag/ })))
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open') } })
  jest.mocked(getPronunciationConversations).mockResolvedValue([initial])
  jest.mocked(markPronunciationSeen).mockResolvedValue({ success: true })
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it('retains newly refreshed message IDs when an older parent snapshot arrives afterward', async () => {
  const { rerender } = render(view(initial))
  await openConversation()
  jest.mocked(getPronunciationConversations).mockResolvedValue([fresh])
  await act(async () => fireEvent.click(screen.getByRole('button', { name: labels.refresh_messages })))
  expect(within(screen.getByRole('log')).getByText(fresh.messages[1].text)).toBeVisible()

  // A parent inbox request started before the explicit refresh can finish later.
  await act(async () => rerender(view({ ...initial, messages: initial.messages.map(message => ({ ...message })) })))
  const log = within(screen.getByRole('log'))
  expect(log.getByText(fresh.messages[1].text)).toBeVisible()
  expect(log.getAllByText(initial.messages[0].text)).toHaveLength(1)
})

it('refreshes on open and while visible, serializes requests and stops polling after unmount', async () => {
  const { unmount } = render(view(initial))
  expect(getPronunciationConversations).not.toHaveBeenCalled()
  await openConversation()
  expect(getPronunciationConversations).toHaveBeenCalledTimes(1)
  expect(getPronunciationConversations).toHaveBeenCalledWith(undefined, initial.id)

  const pending = deferred<Conversation[]>()
  jest.mocked(getPronunciationConversations).mockReturnValueOnce(pending.promise)
  await act(async () => jest.advanceTimersByTime(12_000))
  expect(getPronunciationConversations).toHaveBeenCalledTimes(2)
  await act(async () => {
    jest.advanceTimersByTime(24_000)
    visible('visible')
  })
  expect(getPronunciationConversations).toHaveBeenCalledTimes(2)
  await act(async () => {
    visible('hidden')
    jest.advanceTimersByTime(24_000)
  })
  expect(getPronunciationConversations).toHaveBeenCalledTimes(2)

  unmount()
  await act(async () => {
    pending.resolve([{ ...fresh, hasUnseen: true, messages: fresh.messages.map(message => ({ ...message, unseen: true })) }])
    visible('visible')
    jest.advanceTimersByTime(60_000)
  })
  expect(getPronunciationConversations).toHaveBeenCalledTimes(2)
  expect(markPronunciationSeen).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('keeps the waveform source stable during signed-URL refreshes and renews it near expiry', async () => {
  const now = new Date('2026-09-13T12:00:00Z').getTime()
  jest.setSystemTime(now)
  const signedUrl = (seconds: number) => `https://academy.test/audio/recording.wav?token=header.${btoa(JSON.stringify({ exp: now / 1000 + seconds }))}.signature`
  const firstUrl = signedUrl(3600), renewedUrl = signedUrl(7200)
  const existing = { ...initial, messages: [{ ...initial.messages[0], audioUrl: firstUrl }] }
  const updated = { ...initial, messages: [{ ...initial.messages[0], audioUrl: renewedUrl }] }
  jest.mocked(getPronunciationConversations).mockResolvedValue([updated])
  render(view(existing))
  await openConversation()
  expect(screen.getByTestId('waveform-source')).toHaveAttribute('data-source', firstUrl)
  await act(async () => jest.advanceTimersByTime(12000))
  expect(screen.getByTestId('waveform-source')).toHaveAttribute('data-source', firstUrl)

  jest.setSystemTime(now + 3550 * 1000)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: labels.refresh_messages })))
  expect(screen.getByTestId('waveform-source')).toHaveAttribute('data-source', renewedUrl)
})
