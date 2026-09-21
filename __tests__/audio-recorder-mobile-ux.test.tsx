import { render, screen, within } from '@testing-library/react'
import AudioRecorder from '@/components/audio/AudioRecorder'
import { useAudioRecorder, type UseAudioRecorderResult } from '@/lib/audio/useAudioRecorder'
import { PRONUNCIATION_FALLBACKS as labels } from '@/lib/pronunciation-i18n'

jest.unmock('lucide-react')
jest.mock('@/app/actions/pronunciation-conversations', () => ({ createPronunciationSubmission: jest.fn() }))
jest.mock('@/lib/audio/upload', () => ({ uploadPrivatePronunciationRecording: jest.fn() }))
jest.mock('@/lib/audio/useAudioRecorder', () => ({ useAudioRecorder: jest.fn() }))
jest.mock('@/components/audio/WaveformPlayer', () => ({ __esModule: true, default: ({ label }: { label?: string }) => <div>{label}</div> }))
jest.mock('@/components/audio/LiveWaveform', () => ({ __esModule: true, default: () => <div>Waveform</div> }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

let recorder: UseAudioRecorderResult
beforeEach(() => {
  jest.clearAllMocks()
  recorder = { status: 'idle', levels: [], elapsedSeconds: 0, audioUrl: null, audioBlob: null, isRecording: false, hasRecording: false, analyserRef: { current: null }, start: jest.fn(), stop: jest.fn(), reset: jest.fn() }
  jest.mocked(useAudioRecorder).mockImplementation(() => recorder)
})

const dock = () => screen.queryByTestId('pronunciation-recording-bar')
const renderRecorder = () => render(<AudioRecorder promptId="prompt-1" mobileFloating />)

it('bietet im Ruhezustand nur den schwebenden Aufnahme-Knopf und keine Karte im Textfluss', () => {
  const { container } = renderRecorder()
  const floating = dock()!
  expect(floating).toHaveClass('fixed')
  expect(within(floating).getByRole('button', { name: labels.start_recording })).toBeInTheDocument()
  // Die Karte bleibt auf dem Handy ausgeblendet und kostet dort keinen Platz.
  expect(container.querySelector('.rounded-3xl')).toHaveClass('hidden', 'lg:block')
})

it('zeigt waehrend der Aufnahme nur Stopp-Knopf und Live-Wellenform in der schwebenden Leiste', () => {
  recorder = { ...recorder, status: 'recording', isRecording: true }
  const { container } = renderRecorder()
  const floating = dock()!
  expect(within(floating).getByRole('button', { name: labels.stop_recording })).toBeInTheDocument()
  expect(within(floating).getByText('Waveform')).toBeInTheDocument()
  expect(within(floating).queryByRole('button', { name: labels.submit_for_review })).not.toBeInTheDocument()
  expect(container.querySelector('.rounded-3xl')).toHaveClass('hidden', 'lg:block')
})

it('loest die schwebende Ebene nach der Aufnahme auf und stellt die Auswertung in den Textfluss', () => {
  recorder = { ...recorder, status: 'ready', hasRecording: true, audioUrl: 'blob:recording', audioBlob: new Blob(['x']) }
  const { container } = renderRecorder()
  expect(dock()).not.toBeInTheDocument()
  expect(container.querySelector('.rounded-3xl')).not.toHaveClass('hidden')
  expect(screen.getByText(labels.your_recording)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: labels.submit_for_review })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: labels.delete_recording_aria })).toBeInTheDocument()
})

it('meldet eine verweigerte Mikrofon-Freigabe direkt in der schwebenden Ebene', () => {
  recorder = { ...recorder, status: 'denied' }
  renderRecorder()
  const floating = dock()!
  expect(within(floating).getByRole('status')).toHaveTextContent(labels.mic_denied)
  expect(within(floating).getByRole('button', { name: labels.start_recording })).toBeInTheDocument()
})
