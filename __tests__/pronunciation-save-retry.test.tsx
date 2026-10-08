import { act, fireEvent, render, screen } from '@testing-library/react'
import AudioRecorder from '@/components/audio/AudioRecorder'
import { createPronunciationSubmission } from '@/app/actions/pronunciation-conversations'
import { uploadPrivatePronunciationRecording } from '@/lib/audio/upload'
import { useAudioRecorder } from '@/lib/audio/useAudioRecorder'
import { PRONUNCIATION_FALLBACKS as labels } from '@/lib/pronunciation-i18n'

jest.unmock('lucide-react')
jest.mock('@/app/actions/pronunciation-conversations', () => ({ createPronunciationSubmission: jest.fn() }))
jest.mock('@/lib/audio/upload', () => ({ uploadPrivatePronunciationRecording: jest.fn() }))
jest.mock('@/lib/audio/useAudioRecorder', () => ({ useAudioRecorder: jest.fn() }))
jest.mock('@/components/audio/WaveformPlayer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/audio/LiveWaveform', () => ({ __esModule: true, default: () => null }))
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))
const path = 'storage://pronunciation_audio/owner/saved.wav'

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useAudioRecorder).mockReturnValue({
    status: 'ready', levels: [], elapsedSeconds: 10, audioUrl: 'blob:recording',
    audioBlob: new Blob(['audio'], { type: 'audio/wav' }), isRecording: false,
    hasRecording: true, analyserRef: { current: null }, start: jest.fn(), stop: jest.fn(), reset: jest.fn(),
  })
  jest.mocked(uploadPrivatePronunciationRecording).mockResolvedValue({ success: true, audioPath: path })
  mockRefresh.mockReset()
})

it('keeps the recording ready after a failed save and retries the same uploaded checkpoint', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.mocked(createPronunciationSubmission)
    .mockResolvedValueOnce({ success: false, reason: 'save_failed' })
    .mockResolvedValueOnce({ success: true, id: 'saved' })
  render(<AudioRecorder promptId="text" />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: labels.submit_for_review })))
  expect(screen.getByRole('button', { name: labels.submit_for_review })).toBeEnabled()
  expect(screen.queryByText(labels.submitted)).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: labels.submit_for_review })))
  expect(uploadPrivatePronunciationRecording).toHaveBeenCalledTimes(2)
  const calls = jest.mocked(uploadPrivatePronunciationRecording).mock.calls
  expect(calls[1][0]).toBe(calls[0][0])
  expect(calls[0][1]).toEqual({ purpose: 'target', textId: 'text', textVersion: undefined })
  expect(calls[1][1]).toEqual(calls[0][1])
  expect(createPronunciationSubmission).toHaveBeenNthCalledWith(1, { promptId: 'text', audioPath: path })
  expect(createPronunciationSubmission).toHaveBeenNthCalledWith(2, { promptId: 'text', audioPath: path })
  expect(screen.getByText(labels.submitted)).toBeVisible()
  log.mockRestore()
})

it('keeps saved recording success if refreshing the studio fails', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.mocked(createPronunciationSubmission).mockResolvedValue({ success: true, id: 'saved' })
  mockRefresh.mockImplementation(() => { throw new Error('offline') })
  render(<AudioRecorder promptId="text" />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: labels.submit_for_review })))
  expect(screen.getByText(labels.submitted)).toBeVisible()
  expect(screen.queryByText(labels.upload_failed)).not.toBeInTheDocument()
  log.mockRestore()
})
