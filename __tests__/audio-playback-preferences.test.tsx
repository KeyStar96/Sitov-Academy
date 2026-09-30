import { act, fireEvent, render, screen } from '@testing-library/react'
import { PLAYBACK_RATE_STORAGE_KEY, usePlaybackRate } from '@/lib/audio/usePlaybackRate'

function Player({ level, name }: { level: string; name: string }) {
  const [rate, setRate] = usePlaybackRate(level)
  return <select aria-label={name} value={rate} onChange={event => setRate(Number(event.target.value))}>
    {[0.75, 0.85, 1, 1.25].map(value => <option value={value} key={value}>{value}</option>)}
  </select>
}

beforeEach(() => { localStorage.clear() })
afterEach(() => { jest.restoreAllMocks() })

it('keeps automatic defaults until a user explicitly chooses a speed', () => {
  const { rerender } = render(<Player name="trainer" level="A1.1" />)
  expect(screen.getByRole('combobox')).toHaveValue('0.85')
  expect(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)).toBeNull()
  rerender(<Player name="trainer" level="B1" />)
  expect(screen.getByRole('combobox')).toHaveValue('1')
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '0.75' } })
  rerender(<Player name="trainer" level="A2" />)
  expect(screen.getByRole('combobox')).toHaveValue('0.75')
})

it('synchronizes vocabulary and pronunciation players in the same tab', () => {
  render(<><Player name="vocabulary" level="A1" /><Player name="pronunciation" level="B1" /></>)
  fireEvent.change(screen.getByRole('combobox', { name: 'vocabulary' }), { target: { value: '1.25' } })
  expect(screen.getByRole('combobox', { name: 'pronunciation' })).toHaveValue('1.25')
  fireEvent.change(screen.getByRole('combobox', { name: 'pronunciation' }), { target: { value: '1' } })
  expect(screen.getByRole('combobox', { name: 'vocabulary' })).toHaveValue('1')
})

it('receives changes made in another browser tab', () => {
  render(<Player name="trainer" level="A1" />)
  act(() => {
    localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, '1.25')
    window.dispatchEvent(new StorageEvent('storage', { key: PLAYBACK_RATE_STORAGE_KEY }))
  })
  expect(screen.getByRole('combobox')).toHaveValue('1.25')
})

it.each(['wrong', '0', '-1', '2', 'Infinity', '{}'])('ignores corrupted stored speed %s', stored => {
  localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, stored)
  render(<Player name="trainer" level="A2" />)
  expect(screen.getByRole('combobox')).toHaveValue('0.85')
})

it('retains the speed across remounts when browser storage is blocked', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
  const first = render(<Player name="trainer" level="A1" />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '0.75' } })
  first.unmount()
  render(<Player name="trainer" level="B1" />)
  expect(screen.getByRole('combobox')).toHaveValue('0.75')
})

it('applies a new speed when writes fail but reads still return the previous speed', () => {
  localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, '1')
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
  const first = render(<Player name="trainer" level="A1" />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '0.75' } })
  expect(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)).toBe('1')
  expect(screen.getByRole('combobox')).toHaveValue('0.75')
  first.unmount()
  render(<Player name="trainer" level="B1" />)
  expect(screen.getByRole('combobox')).toHaveValue('0.75')
})
