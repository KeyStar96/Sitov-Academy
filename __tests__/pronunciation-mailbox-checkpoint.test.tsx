import { act, fireEvent, render, screen } from '@testing-library/react'
import Mailbox from '@/components/audio/Mailbox'
import { markPronunciationSeen } from '@/app/actions/pronunciation-conversations'
import { PRONUNCIATION_FALLBACKS as labels } from '@/lib/pronunciation-i18n'
import type { PronunciationConversation } from '@/lib/pronunciation-conversations'

jest.unmock('lucide-react')
jest.mock('@/app/actions/pronunciation-conversations', () => ({ markPronunciationSeen: jest.fn() }))
jest.mock('@/components/audio/PronunciationConversation', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/audio/TeacherAvatar', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/audio/WaveformPlayer', () => ({ __esModule: true, default: () => null }))
const conversation: PronunciationConversation = {
  id: 'feedback-1', level: 'A1.1', title: 'Mein Alltag', readingText: 'Ich lerne.', status: 'reviewed',
  studentName: null, studentEmail: null, createdAt: '2026-10-03T08:00:00Z', hasUnseen: true,
  messages: [{ id: 'message-1', senderRole: 'teacher', text: 'Gut gelesen!', audioUrl: null, unseen: true, createdAt: '2026-10-03T08:00:00Z' }],
}

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers() })
afterEach(() => { jest.useRealTimers() })

it('keeps feedback unread when the account receipt fails and archives it only after retry commits', async () => {
  jest.mocked(markPronunciationSeen)
    .mockResolvedValueOnce({ success: false, reason: 'save_failed' })
    .mockResolvedValueOnce({ success: true })
  render(<Mailbox conversations={[conversation]} lang="de" translations={{}} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Gehört' })))
  await act(async () => jest.advanceTimersByTime(2000))
  expect(screen.getByText('Gut gelesen!')).toBeVisible()
  expect(screen.getByRole('alert')).toHaveTextContent(labels.receipt_failed)
  expect(screen.getByRole('button', { name: 'Gehört' })).toBeEnabled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: labels.audio_retry })))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await act(async () => jest.advanceTimersByTime(2000))
  expect(screen.queryByText('Gut gelesen!')).not.toBeInTheDocument()
  expect(markPronunciationSeen).toHaveBeenCalledTimes(2)
})
