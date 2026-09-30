import { fireEvent, render, screen } from '@testing-library/react'
import PronunciationStudio from '@/components/audio/PronunciationStudio'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import WaveformPlayer from '@/components/audio/WaveformPlayer'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'

jest.unmock('lucide-react')
jest.mock('@/components/audio/AudioRecorder', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/audio/Mailbox', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/dashboard/useLearningNew', () => ({ useLearningNew: () => ({ mark: jest.fn(), isNew: () => false }) }))
jest.mock('@/lib/audio/neural-client', () => ({ prefetchNeuralAudio: () => () => {} }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({
  __esModule: true,
  default: jest.fn(({ onWordChange, onProgress }: { onWordChange?: (index: number | null) => void; onProgress?: (fraction: number | null) => void }) =>
    <button onClick={() => { onProgress?.(0.9); onWordChange?.(1) }}>Read with TTS</button>),
}))
jest.mock('@/components/audio/WaveformPlayer', () => ({
  __esModule: true,
  default: jest.fn(({ onProgress }: { onProgress?: (state: { playing: boolean; fraction: number; ended: boolean }) => void }) =>
    <button onClick={() => onProgress?.({ playing: true, fraction: 0.9, ended: false })}>Teacher recording</button>),
}))

const prompt: PronunciationPrompt = {
  id: 'text-1', unitId: 'a1', lesson: '1', cefrLevel: 'A1', sentenceDe: 'Die Straßenverkehrsordnung ändert sich.',
  focus: null, audioUrl: null, sortOrder: 0,
}

beforeEach(() => { jest.clearAllMocks() })

it('connects TTS word timing and the course level to studio reading', () => {
  render(<PronunciationStudio prompts={[prompt]} conversations={[]} level="A1.2" lang="de" translations={{}} />)
  expect(jest.mocked(SolutionAudioButton).mock.calls[0][0]).toMatchObject({ level: 'A1.2' })
  fireEvent.click(screen.getByRole('button', { name: 'Read with TTS' }))
  expect(screen.getByTestId('pronunciation-reading-text').querySelector('[data-state="current"]')).toHaveTextContent('Straßenverkehrsordnung')
})

it('upgrades a legacy generated reference to TTS timing while retaining teacher recordings', () => {
  const cached = { ...prompt, audioUrl: 'https://storage.test/audio_cache/legacy.mp3' }
  const { unmount } = render(<PronunciationStudio prompts={[cached]} conversations={[]} level="A2" lang="de" translations={{}} />)
  expect(screen.getByRole('button', { name: 'Read with TTS' })).toBeInTheDocument()
  expect(WaveformPlayer).not.toHaveBeenCalled()
  expect(jest.mocked(SolutionAudioButton).mock.calls[0][0]).toMatchObject({ audioUrl: cached.audioUrl, level: 'A2' })
  unmount()
  render(<PronunciationStudio prompts={[{ ...prompt, audioUrl: 'https://storage.test/teacher/recording.mp3' }]} conversations={[]} level="B1" lang="de" translations={{}} />)
  expect(screen.getByRole('button', { name: 'Teacher recording' })).toBeInTheDocument()
  expect(jest.mocked(WaveformPlayer).mock.calls[0][0]).toMatchObject({ level: 'B1' })
})

it('retains authored teacher references without a voice selector', () => {
  render(<PronunciationStudio prompts={[{ ...prompt, audioUrl: 'https://storage.test/teacher/recording.mp3' }]} conversations={[]} level="A1" lang="de" translations={{}} />)
  expect(screen.queryByRole('combobox', { name: 'Stimme' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Teacher recording' }))
  expect(screen.getByTestId('pronunciation-reading-text').querySelector('[data-state="current"]')).toHaveTextContent('sich.')
  expect(screen.getByRole('button', { name: 'Teacher recording' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Read with TTS' })).toBeNull()
})

it('uses fixed synthesis on the next text without a teacher recording', () => {
  render(<PronunciationStudio prompts={[
    { ...prompt, title: 'Teacher text', audioUrl: 'https://storage.test/teacher/recording.mp3' },
    { ...prompt, id: 'text-2', title: 'Generated text' },
  ]} conversations={[]} level="A2" lang="de" translations={{}} />)
  fireEvent.click(screen.getByRole('button', { name: /Generated text/ }))
  expect(jest.mocked(SolutionAudioButton).mock.calls.at(-1)?.[0]).toMatchObject({ audioUrl: null, level: 'A2', language: 'de' })
  expect(screen.queryByRole('combobox', { name: 'Stimme' })).toBeNull()
})
