import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import PronunciationConversation from '@/components/audio/PronunciationConversation'
import PronunciationInbox from '@/components/audio/PronunciationInbox'
import { getPronunciationConversations, markPronunciationSeen, setPronunciationMessageHidden, setPronunciationSubmissionHidden } from '@/app/actions/pronunciation-conversations'
import type { PronunciationConversation as Conversation, PronunciationHideResult } from '@/lib/pronunciation-conversations'
import translations from '@/lib/pronunciation-translations.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/pronunciation-conversations', () => ({
  getPronunciationConversations: jest.fn(), markPronunciationSeen: jest.fn(), sendPronunciationMessage: jest.fn(),
  setPronunciationMessageHidden: jest.fn(), setPronunciationSubmissionHidden: jest.fn(),
}))
jest.mock('@/components/audio/PronunciationMessageInput', () => ({ __esModule: true, default: () => <div>Antwortfeld</div> }))
jest.mock('@/components/audio/WaveformPlayer', () => ({ __esModule: true, default: (props: { src: string; fastToggle?: boolean }) => <div data-testid="player" data-fast={String(Boolean(props.fastToggle))}>{props.src}</div> }))
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))

const t = translations.de
const id = '00000000-0000-4000-8000-000000000001'
const followUp = '00000000-0000-4000-8000-000000000011'
const reply = '00000000-0000-4000-8000-000000000012'
const conversation: Conversation = {
  id, title: 'Mein Alltag', studentName: 'Anna Beispiel', studentEmail: 'anna@example.test', level: 'A1.1', readingText: null,
  status: 'pending', createdAt: '2026-09-10T12:00:00Z', hasUnseen: false,
  messages: [
    { id: `recording-${id}`, senderRole: 'student', text: '', audioUrl: 'https://files.test/recording.webm', unseen: false, createdAt: '2026-09-10T12:00:00Z' },
    { id: reply, senderRole: 'teacher', text: 'Sehr gut gelesen.', audioUrl: 'https://files.test/reply.webm', unseen: false, createdAt: '2026-09-11T12:00:00Z' },
    { id: followUp, senderRole: 'student', text: 'Noch ein Versuch.', audioUrl: 'https://files.test/follow-up.webm', unseen: false, createdAt: '2026-09-12T12:00:00Z' },
  ],
}
/** What the server returns to staff once the follow-up is out of their view. */
const withoutFollowUp: Conversation = { ...conversation, status: 'reviewed', messages: conversation.messages.slice(0, 2) }
const other: Conversation = { ...conversation, id: '00000000-0000-4000-8000-000000000002', studentName: 'Boris Muster', status: 'reviewed',
  messages: [{ id: 'recording-00000000-0000-4000-8000-000000000002', senderRole: 'student', text: '', audioUrl: 'https://files.test/other.webm', unseen: false, createdAt: '2026-09-09T12:00:00Z' }] }

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(markPronunciationSeen).mockResolvedValue({ success: true })
  jest.mocked(getPronunciationConversations).mockResolvedValue([conversation])
  jest.mocked(setPronunciationMessageHidden).mockResolvedValue({ success: true })
  jest.mocked(setPronunciationSubmissionHidden).mockResolvedValue({ success: true })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open') } })
})
const openConversation = async (name = /^Anna Beispiel/) => { await act(async () => fireEvent.click(screen.getAllByRole('button', { name })[0])) }
const thread = () => screen.getByRole('dialog', { name: 'Anna Beispiel' })
const confirmation = (title: string) => screen.getByRole('dialog', { name: title })
function deferred<Result>() {
  let resolve!: (result: Result) => void
  const promise = new Promise<Result>(done => { resolve = done })
  return { promise, resolve }
}

it('shows learners neither remove controls nor the teacher speed switch', async () => {
  render(<PronunciationConversation conversation={conversation} lang="de" translations={t} />)
  expect(screen.queryByRole('button', { name: /Lehreransicht/ })).not.toBeInTheDocument()
  await openConversation(/Mein Alltag/)
  expect(screen.queryByRole('button', { name: /Lehreransicht/ })).not.toBeInTheDocument()
  expect(screen.getAllByTestId('player').every(player => player.dataset.fast === 'false')).toBe(true)
})

it('gives teachers 2× playback on every recording and remove controls only on learner messages', async () => {
  render(<PronunciationConversation conversation={conversation} staff lang="de" translations={t} />)
  await openConversation()
  expect(screen.getAllByTestId('player')).toHaveLength(3)
  expect(screen.getAllByTestId('player').every(player => player.dataset.fast === 'true')).toBe(true)
  // Header + first recording take the whole conversation out of view; the follow-up only itself; the teacher's reply nothing.
  expect(within(thread()).getAllByRole('button', { name: t.remove_submission })).toHaveLength(2)
  expect(within(thread()).getAllByRole('button', { name: t.remove_message })).toHaveLength(1)
  for (const button of within(thread()).getAllByRole('button', { name: /Lehreransicht/ })) expect(button).toHaveClass('h-12', 'w-12')
})

it('asks first, says that the learner keeps everything, starts on the safe action and does nothing on cancel', async () => {
  render(<PronunciationConversation conversation={conversation} staff lang="de" translations={t} />)
  await openConversation()
  const trigger = within(thread()).getByRole('button', { name: t.remove_message })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = confirmation(t.remove_message_title)
  expect(dialog).toHaveAccessibleDescription(t.remove_message_text)
  expect(t.remove_message_text).toMatch(/sieht und hört sie weiterhin/)
  expect(within(dialog).getByText(/Anna Beispiel · Mein Alltag/)).toBeVisible()
  const buttons = within(dialog).getAllByRole('button')
  expect(buttons.map(button => button.textContent)).toEqual([t.remove_cancel, t.remove_confirm])
  expect(buttons[0]).toHaveFocus()
  fireEvent.click(buttons[0])
  expect(screen.queryByRole('dialog', { name: t.remove_message_title })).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(setPronunciationMessageHidden).not.toHaveBeenCalled()
  expect(screen.getByText('Noch ein Versuch.')).toBeVisible()
})

it('removes one learner message from the staff view, confirms it and never lets an older snapshot bring it back', async () => {
  const pending = deferred<PronunciationHideResult>()
  jest.mocked(setPronunciationMessageHidden).mockReturnValueOnce(pending.promise)
  const view = render(<PronunciationConversation conversation={conversation} staff lang="de" translations={t} />)
  await openConversation()
  fireEvent.click(within(thread()).getByRole('button', { name: t.remove_message }))
  const dialog = confirmation(t.remove_message_title)
  fireEvent.click(within(dialog).getByRole('button', { name: t.remove_confirm }))
  // While saving nothing can be dismissed or triggered twice.
  expect(within(dialog).getByRole('status')).toHaveTextContent(t.removing)
  for (const button of within(dialog).getAllByRole('button')) expect(button).toBeDisabled()
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(dialog).toBeInTheDocument()
  expect(within(thread()).getByRole('button', { name: 'Gespräch schließen' })).toBeDisabled()
  jest.mocked(getPronunciationConversations).mockResolvedValue([withoutFollowUp])
  await act(async () => pending.resolve({ success: true }))
  expect(setPronunciationMessageHidden).toHaveBeenCalledTimes(1)
  expect(setPronunciationMessageHidden).toHaveBeenCalledWith(followUp, true)
  expect(setPronunciationSubmissionHidden).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog', { name: t.remove_message_title })).not.toBeInTheDocument()
  expect(screen.queryByText('Noch ein Versuch.')).not.toBeInTheDocument()
  expect(screen.getByText('Sehr gut gelesen.')).toBeVisible()
  const notice = within(thread()).getByRole('status')
  expect(notice).toHaveTextContent(t.message_removed)
  expect(notice).toHaveFocus()
  expect(within(notice).getByRole('button', { name: t.undo })).toHaveClass('min-h-12')
  expect(within(thread()).queryByRole('button', { name: t.remove_message })).not.toBeInTheDocument()
  // The list page re-renders with data read before the change.
  view.rerender(<PronunciationConversation conversation={{ ...conversation }} staff lang="de" translations={t} />)
  expect(screen.queryByText('Noch ein Versuch.')).not.toBeInTheDocument()
})

it('undo brings the message back into the staff view', async () => {
  render(<PronunciationConversation conversation={conversation} staff lang="de" translations={t} />)
  await openConversation()
  jest.mocked(getPronunciationConversations).mockResolvedValue([withoutFollowUp])
  fireEvent.click(within(thread()).getByRole('button', { name: t.remove_message }))
  await act(async () => fireEvent.click(within(confirmation(t.remove_message_title)).getByRole('button', { name: t.remove_confirm })))
  expect(screen.queryByText('Noch ein Versuch.')).not.toBeInTheDocument()
  // First attempt fails: the offer stays.
  jest.mocked(setPronunciationMessageHidden).mockResolvedValueOnce({ success: false, reason: 'save_failed' })
  await act(async () => fireEvent.click(within(thread()).getByRole('button', { name: t.undo })))
  expect(within(thread()).getByText(t.undo_failed)).toBeVisible()
  expect(screen.queryByText('Noch ein Versuch.')).not.toBeInTheDocument()
  jest.mocked(getPronunciationConversations).mockResolvedValue([conversation])
  await act(async () => fireEvent.click(within(thread()).getByRole('button', { name: t.undo })))
  expect(setPronunciationMessageHidden).toHaveBeenLastCalledWith(followUp, false)
  await waitFor(() => expect(screen.getByText('Noch ein Versuch.')).toBeVisible())
  expect(within(thread()).getByText(t.message_restored)).toBeVisible()
  expect(within(thread()).queryByRole('button', { name: t.undo })).not.toBeInTheDocument()
  expect(within(thread()).getByRole('button', { name: t.remove_message })).toBeVisible()
})

it('keeps the message and explains the problem when saving fails', async () => {
  jest.mocked(setPronunciationMessageHidden).mockResolvedValueOnce({ success: false, reason: 'save_failed' }).mockResolvedValueOnce({ success: false, reason: 'not_authorized' })
  render(<PronunciationConversation conversation={conversation} staff lang="de" translations={t} />)
  await openConversation()
  fireEvent.click(within(thread()).getByRole('button', { name: t.remove_message }))
  const dialog = confirmation(t.remove_message_title)
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: t.remove_confirm })))
  expect(within(dialog).getByRole('alert')).toHaveTextContent(t.remove_failed)
  expect(screen.getByText('Noch ein Versuch.')).toBeVisible()
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: t.remove_confirm })))
  expect(within(dialog).getByRole('alert')).toHaveTextContent(t.remove_not_allowed)
  expect(setPronunciationMessageHidden).toHaveBeenCalledTimes(2)
})

it('takes the whole conversation out of view when its first recording is removed', async () => {
  const onRemoved = jest.fn()
  render(<PronunciationConversation conversation={conversation} staff lang="de" translations={t} onRemoved={onRemoved} />)
  await openConversation()
  fireEvent.click(within(thread()).getAllByRole('button', { name: t.remove_submission })[1])
  const dialog = confirmation(t.remove_submission_title)
  expect(dialog).toHaveAccessibleDescription(t.remove_submission_text)
  expect(t.remove_submission_text).toMatch(/behält alles/)
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: t.remove_confirm })))
  expect(setPronunciationSubmissionHidden).toHaveBeenCalledWith(id, true)
  expect(setPronunciationMessageHidden).not.toHaveBeenCalled()
  expect(onRemoved).toHaveBeenCalledWith(expect.objectContaining({ id }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('explicit reads drop a message a colleague removed; the status follows the server', async () => {
  render(<PronunciationConversation conversation={conversation} staff lang="de" translations={t} />)
  jest.mocked(getPronunciationConversations).mockResolvedValue([withoutFollowUp])
  await openConversation()
  await waitFor(() => expect(screen.queryByText('Noch ein Versuch.')).not.toBeInTheDocument())
  expect(screen.getByText('Sehr gut gelesen.')).toBeVisible()
})

it('lets teachers clear the correction queue: the row disappears, counts follow, and undo brings it back', async () => {
  render(<PronunciationInbox conversations={[conversation, other]} lang="de" translations={t} staff initialFilter="all" />)
  expect(screen.getByRole('button', { name: /Alle/ })).toHaveTextContent('2')
  const rowRemove = screen.getByRole('button', { name: t.remove_submission_of.replace('{name}', 'Anna Beispiel') })
  expect(rowRemove).toHaveClass('h-12', 'w-12')
  fireEvent.click(rowRemove)
  // Asking never opens the conversation behind it.
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(markPronunciationSeen).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(within(confirmation(t.remove_submission_title)).getByRole('button', { name: t.remove_confirm })))
  expect(setPronunciationSubmissionHidden).toHaveBeenCalledWith(id, true)
  expect(screen.queryByRole('button', { name: /^Anna Beispiel/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Boris Muster/ })).toBeVisible()
  expect(screen.getByRole('button', { name: /Alle/ })).toHaveTextContent('1')
  const notice = screen.getByRole('status')
  expect(notice).toHaveTextContent(t.submission_removed)
  expect(notice).toHaveFocus()
  expect(mockRefresh).toHaveBeenCalledTimes(1)

  await act(async () => fireEvent.click(within(notice).getByRole('button', { name: t.undo })))
  expect(setPronunciationSubmissionHidden).toHaveBeenLastCalledWith(id, false)
  expect(screen.getByRole('button', { name: /^Anna Beispiel/ })).toBeVisible()
  expect(screen.getByRole('button', { name: /Alle/ })).toHaveTextContent('2')
  expect(screen.getByRole('status')).toHaveTextContent(t.submission_restored)
  expect(screen.queryByRole('button', { name: t.undo })).not.toBeInTheDocument()
  expect(mockRefresh).toHaveBeenCalledTimes(2)
})

it('keeps an open conversation in the queue when its status leaves the current filter', async () => {
  const view = render(<PronunciationInbox conversations={[conversation]} lang="de" translations={t} staff initialFilter="pending" />)
  await openConversation()
  view.rerender(<PronunciationInbox conversations={[withoutFollowUp]} lang="de" translations={t} staff initialFilter="pending" />)
  expect(thread()).toBeVisible()
  fireEvent.click(within(thread()).getByRole('button', { name: 'Gespräch schließen' }))
  expect(screen.queryByRole('button', { name: /^Anna Beispiel/ })).not.toBeInTheDocument()
})

it('offers no remove controls in the learner history', () => {
  render(<PronunciationInbox conversations={[conversation]} lang="de" translations={t} />)
  expect(screen.queryByRole('button', { name: /Lehreransicht/ })).not.toBeInTheDocument()
})

it('names every moderation text in all five languages and never promises a real deletion', () => {
  const keys = ['fast_playback', 'remove_message', 'remove_submission', 'remove_submission_of', 'remove_message_title', 'remove_message_text', 'remove_submission_title', 'remove_submission_text',
    'remove_cancel', 'remove_confirm', 'removing', 'remove_failed', 'remove_not_allowed', 'message_removed', 'submission_removed', 'undo', 'undo_failed', 'message_restored', 'submission_restored'] as const
  for (const lang of ['de', 'en', 'ru', 'uk', 'tr'] as const) {
    for (const key of keys) expect(translations[lang][key].trim().length).toBeGreaterThan(3)
    expect(translations[lang].remove_submission_of).toContain('{name}')
    expect(Object.keys(translations[lang]).filter(key => key.startsWith('delete_'))).toEqual([])
    if (lang !== 'de') for (const key of keys.filter(key => key !== 'fast_playback')) expect(translations[lang][key]).not.toBe(translations.de[key])
  }
  expect(t.remove_message_text).not.toMatch(/endgültig|rückgängig/)
  expect(t.remove_submission_text).not.toMatch(/endgültig|rückgängig/)
})
