import { act, fireEvent, render, screen, within } from '@testing-library/react'
import PronunciationConversation from '@/components/audio/PronunciationConversation'
import PronunciationMessageInput from '@/components/audio/PronunciationMessageInput'
import { getPronunciationConversations, markPronunciationSeen, sendPronunciationMessage } from '@/app/actions/pronunciation-conversations'
import { uploadPrivatePronunciationRecording, type AudioUploadResult } from '@/lib/audio/upload'
import { useAudioRecorder, type UseAudioRecorderResult } from '@/lib/audio/useAudioRecorder'
import type { PronunciationConversation as Conversation } from '@/lib/pronunciation-conversations'
import { createPronunciationTranslator, PRONUNCIATION_FALLBACKS as labels } from '@/lib/pronunciation-i18n'

jest.unmock('lucide-react')
jest.mock('@/app/actions/pronunciation-conversations', () => ({ getPronunciationConversations: jest.fn(), markPronunciationSeen: jest.fn(), sendPronunciationMessage: jest.fn() }))
jest.mock('@/lib/audio/upload', () => ({ uploadPrivatePronunciationRecording: jest.fn() }))
jest.mock('@/lib/audio/useAudioRecorder', () => ({ useAudioRecorder: jest.fn() }))
jest.mock('@/components/audio/WaveformPlayer', () => ({ __esModule: true, default: ({ label }: { label?: string }) => <div>{label}</div> }))
jest.mock('@/components/audio/LiveWaveform', () => ({ __esModule: true, default: () => <div>Waveform</div> }))
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))
const t = createPronunciationTranslator({})
const conversation: Conversation = {
  id: '00000000-0000-4000-8000-000000000001', title: 'Mein Alltag', studentName: 'Test Student', studentEmail: 'test@example.test',
  level: 'A1.1', readingText: 'Ich lerne Deutsch.', status: 'pending', createdAt: '2026-09-10T12:00:00Z', hasUnseen: true,
  messages: [{ id: 'message-1', senderRole: 'teacher', text: 'Ein guter Anfang.', audioUrl: null, unseen: true, createdAt: '2026-09-10T12:00:00Z' }],
}
let recorder: UseAudioRecorderResult
beforeEach(() => {
  jest.clearAllMocks()
  recorder = { status: 'idle', levels: [], elapsedSeconds: 0, audioUrl: null, audioBlob: null, isRecording: false, hasRecording: false, analyserRef: { current: null }, start: jest.fn(), stop: jest.fn(), reset: jest.fn() }
  jest.mocked(useAudioRecorder).mockImplementation(() => recorder)
  jest.mocked(markPronunciationSeen).mockResolvedValue({ success: true })
  jest.mocked(getPronunciationConversations).mockResolvedValue([conversation])
  jest.mocked(sendPronunciationMessage).mockResolvedValue({ success: true, id: 'new-message' })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open') } })
})
function renderConversation(data = conversation) { return render(<PronunciationConversation conversation={data} lang="de" translations={{}} />) }
async function openConversation() { await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mein Alltag/ }))) }
function deferred<Result>() {
  let resolve!: (result: Result) => void
  const promise = new Promise<Result>(done => { resolve = done })
  return { promise, resolve }
}

it('keeps unread conversations closed and only marks the explicitly opened one read', async () => {
  render(<><PronunciationConversation conversation={conversation} lang="de" translations={{}} /><PronunciationConversation conversation={{ ...conversation, id: 'other', title: 'Im Park' }} lang="de" translations={{}} /></>)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(markPronunciationSeen).not.toHaveBeenCalled()
  await openConversation()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(markPronunciationSeen).toHaveBeenCalledWith(conversation.id)
  expect(markPronunciationSeen).toHaveBeenCalledTimes(1)
})

it('preserves the draft on close, restores focus, and unlocks body scrolling', async () => {
  renderConversation()
  const trigger = screen.getByRole('button', { name: /Mein Alltag/ })
  trigger.focus()
  await openConversation()
  expect(document.body.style.overflow).toBe('hidden')
  const input = screen.getByRole('textbox', { name: labels.reply_label })
  fireEvent.change(input, { target: { value: 'Eine Frage zum Text.' } })
  fireEvent.click(screen.getByRole('button', { name: labels.close_conversation }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.body.style.overflow).toBe('')
  expect(trigger).toHaveFocus()
  await openConversation()
  expect(screen.getByRole('textbox', { name: labels.reply_label })).toHaveValue('Eine Frage zum Text.')
})

it('locks dismissal while recording or sending, and keeps a failed recording ready to retry', async () => {
  recorder = { ...recorder, status: 'ready', hasRecording: true, audioUrl: 'blob:recording', audioBlob: new Blob(['voice'], { type: 'audio/wav' }) }
  const upload = deferred<AudioUploadResult>()
  jest.mocked(uploadPrivatePronunciationRecording).mockReturnValueOnce(upload.promise)
  renderConversation()
  await openConversation()
  fireEvent.click(screen.getByRole('button', { name: labels.send_message }))
  expect(screen.getByRole('button', { name: labels.close_conversation })).toBeDisabled()
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(screen.getByRole('dialog')).toBeVisible()
  await act(async () => upload.resolve({ success: false, reason: 'upload_failed' }))
  expect(screen.getByRole('button', { name: labels.close_conversation })).toBeEnabled()
  expect(screen.getByText(labels.your_recording)).toBeVisible()
  expect(recorder.reset).not.toHaveBeenCalled()
})

it('scrolls the actual message container after a reply and keeps refresh available', async () => {
  renderConversation()
  await openConversation()
  const log = screen.getByRole('log')
  expect(log).toHaveClass('overflow-y-auto')
  Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 1000 })
  Object.defineProperty(log, 'clientHeight', { configurable: true, value: 200 })
  jest.mocked(getPronunciationConversations).mockResolvedValue([{ ...conversation, messages: [...conversation.messages, { ...conversation.messages[0], id: 'reply', text: 'Danke!' }] }])
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Danke!' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: labels.send_message })))
  expect(log.scrollTop).toBe(1000)
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: labels.refresh_messages })).toBeEnabled()
})

it('does not move a reader away from older messages when new messages arrive', async () => {
  const { rerender } = renderConversation()
  await openConversation()
  const log = screen.getByRole('log')
  Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 1000 })
  Object.defineProperty(log, 'clientHeight', { configurable: true, value: 200 })
  log.scrollTop = 100
  fireEvent.scroll(log)
  await act(async () => rerender(<PronunciationConversation conversation={{ ...conversation, messages: [...conversation.messages, { ...conversation.messages[0], id: 'reply' }] }} lang="de" translations={{}} />))
  expect(log.scrollTop).toBe(100)
})

it('keeps a successful send successful even if the subsequent refresh rejects', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  render(<PronunciationMessageInput conversationId={conversation.id} t={t} onMessageSent={async () => { throw new Error('offline') }} />)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Danke!' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: labels.send_message })))
  expect(screen.getByText(labels.message_sent)).toBeVisible()
  expect(screen.queryByText(labels.message_failed)).not.toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveValue('')
  expect(sendPronunciationMessage).toHaveBeenCalledTimes(1)
  errorLog.mockRestore()
})

it('does not send text while microphone permission is still being requested', () => {
  recorder.status = 'requesting'
  render(<PronunciationMessageInput conversationId={conversation.id} t={t} onMessageSent={async () => undefined} />)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hier ist meine Aufnahme.' } })
  expect(screen.getByRole('button', { name: labels.send_message })).toBeDisabled()
  expect(sendPronunciationMessage).not.toHaveBeenCalled()
})
