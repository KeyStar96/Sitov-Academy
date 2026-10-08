import { act, fireEvent, render, screen } from '@testing-library/react'
import ProfileSettings from '@/components/dashboard/ProfileSettings'
import ProfileTrainerSettings from '@/components/dashboard/ProfileTrainerSettings'
import { loadRoundSize, loadStudyMode } from '@/lib/vocabulary-lernkasten'
import { useVocabularyRoundSize, useVocabularyStudyMode } from '@/lib/sitov-trainer-preferences'
import { PLAYBACK_RATE_STORAGE_KEY, usePlaybackRate } from '@/lib/audio/usePlaybackRate'
import { SITOV_TRAINER_SETTINGS_COPY, getSitovTrainerSettingsCopy } from '@/lib/sitov-trainer-settings-i18n'
import { LOCALES } from '@/lib/locale-routing'
import { renderToString } from 'react-dom/server.node'

jest.unmock('lucide-react')

function SitovPreferenceConsumer() {
  const [size] = useVocabularyRoundSize()
  const [mode] = useVocabularyStudyMode()
  const [beginnerSpeed] = usePlaybackRate('A1.1')
  const [advancedSpeed] = usePlaybackRate('B1')
  return <output data-testid="sitov-shared-preferences">{size}|{mode}|{beginnerSpeed}|{advancedSpeed}</output>
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})
afterEach(() => { jest.restoreAllMocks() })

it('inherits the existing vocabulary and audio preferences without creating replacement keys', () => {
  localStorage.setItem('sitov_vocab_round_size', '30')
  localStorage.setItem('sitov_vocab_study_mode', 'typed')
  localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, '0.75')
  render(<ProfileTrainerSettings lang="de" />)
  expect(screen.getByRole('radio', { name: '30' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Ausschreiben' })).toBeChecked()
  expect(screen.getByRole('combobox', { name: 'Tempo' })).toHaveValue('0.75')
  expect(localStorage.length).toBe(3)
})

it('applies profile changes to shared trainer readers and retains the same keys across visits', () => {
  const first = render(<><ProfileTrainerSettings lang="de" /><SitovPreferenceConsumer /></>)
  expect(screen.getByTestId('sitov-shared-preferences')).toHaveTextContent('20|flashcard|0.85|1')
  fireEvent.click(screen.getByRole('radio', { name: '50' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Ausschreiben' }))
  expect(loadRoundSize()).toBe(50)
  expect(loadStudyMode()).toBe('typed')
  expect(screen.getByTestId('sitov-shared-preferences')).toHaveTextContent('50|typed|0.85|1')
  expect(localStorage.getItem('sitov_vocab_round_size')).toBe('50')
  expect(localStorage.getItem('sitov_vocab_study_mode')).toBe('typed')
  first.unmount()
  render(<ProfileTrainerSettings lang="de" />)
  expect(screen.getByRole('radio', { name: '50' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Ausschreiben' })).toBeChecked()
})

it('synchronizes changes from another browser tab', () => {
  render(<><ProfileTrainerSettings lang="de" /><SitovPreferenceConsumer /></>)
  act(() => {
    localStorage.setItem('sitov_vocab_study_mode', 'typed')
    window.dispatchEvent(new StorageEvent('storage', { key: 'sitov_vocab_study_mode' }))
    localStorage.setItem('sitov_vocab_round_size', 'all')
    window.dispatchEvent(new StorageEvent('storage', { key: 'sitov_vocab_round_size' }))
  })
  expect(screen.getByRole('radio', { name: 'Alle' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Ausschreiben' })).toBeChecked()
  expect(screen.getByTestId('sitov-shared-preferences')).toHaveTextContent('all|typed|0.85|1')
})

it('sets every audio player to a chosen speed and restores each level default through Automatic', () => {
  render(<><ProfileTrainerSettings lang="en" /><SitovPreferenceConsumer /></>)
  fireEvent.change(screen.getByRole('combobox', { name: 'Speed' }), { target: { value: '1.25' } })
  expect(screen.getByTestId('sitov-shared-preferences')).toHaveTextContent('20|flashcard|1.25|1.25')
  expect(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)).toBe('1.25')
  fireEvent.change(screen.getByRole('combobox', { name: 'Speed' }), { target: { value: 'auto' } })
  expect(screen.getByTestId('sitov-shared-preferences')).toHaveTextContent('20|flashcard|0.85|1')
  expect(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)).toBeNull()
})

it.each(LOCALES)('offers all preference controls with complete copy in %s', locale => {
  const copy = getSitovTrainerSettingsCopy(locale)
  expect(Object.keys(copy).sort()).toEqual(Object.keys(SITOV_TRAINER_SETTINGS_COPY.de).sort())
  expect(Object.values(copy).every(value => value.length > 0)).toBe(true)
  render(<ProfileTrainerSettings lang={locale} />)
  expect(screen.getByRole('heading', { name: copy.title })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: copy.roundSize })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: copy.studyMode })).toBeInTheDocument()
  expect(screen.getByText(copy.device)).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: copy.flashcard })).toBeChecked()
  expect(screen.getByRole('combobox', { name: copy.speed })).toHaveValue('auto')
})

it('opens the trainer settings directly from the profile anchor', () => {
  window.history.replaceState(null, '', '/de/dashboard/profile#trainers')
  const copy = getSitovTrainerSettingsCopy('de')
  render(<ProfileSettings lang="de" sections={[
    { id: 'trainers', title: copy.title, hint: copy.hint, content: <ProfileTrainerSettings lang="de" /> },
  ]} danger={null} />)
  expect(screen.getByRole('combobox', { name: copy.speed })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Alle Einstellungen' })).toBeInTheDocument()
})

it('applies vocabulary choices when quota rejects writes but old preferences remain readable', () => {
  localStorage.setItem('sitov_vocab_round_size', '20')
  localStorage.setItem('sitov_vocab_study_mode', 'flashcard')
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
  render(<><ProfileTrainerSettings lang="de" /><SitovPreferenceConsumer /></>)
  fireEvent.click(screen.getByRole('radio', { name: '30' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Ausschreiben' }))
  expect(localStorage.getItem('sitov_vocab_round_size')).toBe('20')
  expect(localStorage.getItem('sitov_vocab_study_mode')).toBe('flashcard')
  expect(screen.getByTestId('sitov-shared-preferences')).toHaveTextContent('30|typed|0.85|1')
  expect(screen.getByText('Übernommen').closest('[role="status"]')).toBeInTheDocument()
})

it('keeps the server render stable before device preferences hydrate', () => {
  localStorage.setItem('sitov_vocab_round_size', '50')
  localStorage.setItem('sitov_vocab_study_mode', 'typed')
  localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, '1.25')
  const html = renderToString(<ProfileTrainerSettings lang="en" />)
  const document = new DOMParser().parseFromString(html, 'text/html')
  expect(document.querySelector('input[value="20"]')?.hasAttribute('checked')).toBe(true)
  expect(document.querySelector('input[value="flashcard"]')?.hasAttribute('checked')).toBe(true)
  expect(document.querySelector('option[value="auto"]')?.hasAttribute('selected')).toBe(true)
  expect(document.querySelector('input[value="50"]')?.hasAttribute('checked')).toBe(false)
})
