import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ProfileProgressReset from '@/components/dashboard/ProfileProgressReset'
import { resetUserProgress } from '@/app/actions/resetUserProgress'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))
jest.mock('@/app/actions/resetUserProgress', () => ({ resetUserProgress: jest.fn() }))
jest.unmock('lucide-react')

const t = de.progress_reset
const userId = '00000000-0000-4000-8000-000000000001'
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open') } })
})
afterAll(() => {
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})
beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  jest.mocked(resetUserProgress).mockResolvedValue({ success: true })
})
function openDialog() {
  const trigger = screen.getByRole('button', { name: t.button })
  fireEvent.click(trigger)
  return { trigger, dialog: screen.getByRole('dialog', { name: t.dialog_title }) }
}

it('requires a separate explicit confirmation and focuses the safe cancel action first', () => {
  render(<ProfileProgressReset translations={t} userId={userId} />)
  const { dialog, trigger } = openDialog()
  expect(dialog).toHaveAccessibleDescription(t.dialog_description)
  expect(within(dialog).getByText(t.scope)).toBeVisible()
  expect(within(dialog).getByRole('button', { name: t.cancel })).toHaveFocus()
  expect(resetUserProgress).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: t.cancel }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(resetUserProgress).not.toHaveBeenCalled()
})

it('traps Tab and Shift+Tab and restores focus when Escape cancels', () => {
  render(<ProfileProgressReset translations={t} userId={userId} />)
  const { dialog, trigger } = openDialog()
  const cancel = within(dialog).getByRole('button', { name: t.cancel })
  const confirm = within(dialog).getByRole('button', { name: t.confirm })
  fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true })
  expect(confirm).toHaveFocus()
  fireEvent.keyDown(confirm, { key: 'Tab' })
  expect(cancel).toHaveFocus()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('locks the dialog during the real request and never sends a caller-selected user ID', async () => {
  let finish: ((value: { success: true }) => void) | undefined
  jest.mocked(resetUserProgress).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<ProfileProgressReset translations={t} userId={userId} />)
  const { dialog } = openDialog()
  const confirm = within(dialog).getByRole('button', { name: t.confirm })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  expect(resetUserProgress).toHaveBeenCalledTimes(1)
  expect(resetUserProgress).toHaveBeenCalledWith({ confirmation: 'RESET_LEARNING_DATA' })
  expect(confirm).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: t.cancel })).toBeDisabled()
  expect(within(dialog).getByRole('status')).toHaveTextContent(t.pending)
  fireEvent.keyDown(dialog, { key: 'Escape' })
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(dialog).toBeInTheDocument()
  await act(async () => { finish?.({ success: true }) })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(t.success)
  expect(mockRefresh).toHaveBeenCalledTimes(1)
})

it('clears learning selections only after confirmed success and preserves auth, theme and authored content', async () => {
  localStorage.setItem('sitov_lernkasten:A1.1', '["Lektion 1"]')
  localStorage.setItem('sitov_lernkasten:B1.2', '["Lektion 2"]')
  localStorage.setItem('sitov_custom_vocab:A1.1:Lektion 1', '["das Haus"]')
  localStorage.setItem('theme', 'dark')
  localStorage.setItem('sb-project-auth-token', 'keep-session')
  sessionStorage.setItem('sitov_vocab_autostart', 'A1.1')
  sessionStorage.setItem('sitov-intro-seen', '1')
  render(<ProfileProgressReset translations={t} userId={userId} />)
  openDialog()
  expect(localStorage.getItem('sitov_lernkasten:A1.1')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: t.confirm }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(t.success))
  expect(localStorage.getItem('sitov_lernkasten:A1.1')).toBeNull()
  expect(localStorage.getItem('sitov_lernkasten:B1.2')).toBeNull()
  expect(sessionStorage.getItem('sitov_vocab_autostart')).toBeNull()
  expect(localStorage.getItem('sitov_custom_vocab:A1.1:Lektion 1')).toBe('["das Haus"]')
  expect(localStorage.getItem('theme')).toBe('dark')
  expect(localStorage.getItem('sb-project-auth-token')).toBe('keep-session')
  expect(sessionStorage.getItem('sitov-intro-seen')).toBe('1')
})

it.each([
  ['reset_failed', 'error'], ['invalid_input', 'error'],
  ['not_authenticated', 'not_authenticated'], ['reset_in_progress', 'reset_in_progress'],
] as const)('keeps retry available and browser state intact for %s', async (reason, key) => {
  jest.mocked(resetUserProgress).mockResolvedValue({ success: false, reason })
  localStorage.setItem('sitov_lernkasten:A1.1', '["Lektion 1"]')
  render(<ProfileProgressReset translations={t} userId={userId} />)
  openDialog()
  fireEvent.click(screen.getByRole('button', { name: t.confirm }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(t[key]))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: t.confirm })).toBeEnabled()
  expect(screen.getByRole('button', { name: t.cancel })).toBeEnabled()
  expect(localStorage.getItem('sitov_lernkasten:A1.1')).not.toBeNull()
  expect(mockRefresh).not.toHaveBeenCalled()
})

it('reports a safe error for rejected requests and allows a successful retry', async () => {
  jest.mocked(resetUserProgress).mockRejectedValueOnce(new Error('Internal database detail')).mockResolvedValueOnce({ success: true })
  render(<ProfileProgressReset translations={t} userId={userId} />)
  openDialog()
  fireEvent.click(screen.getByRole('button', { name: t.confirm }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(t.error))
  expect(screen.queryByText('Internal database detail')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: t.confirm }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(t.success))
})

it('does not misreport a successful server reset when a browser refresh fails', async () => {
  mockRefresh.mockImplementationOnce(() => { throw new Error('Refresh unavailable') })
  render(<ProfileProgressReset translations={t} userId={userId} />)
  openDialog()
  fireEvent.click(screen.getByRole('button', { name: t.confirm }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(t.success))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('provides the same complete reset namespace in all supported languages', () => {
  for (const dictionary of [de, en, ru, uk, tr]) {
    expect(Object.keys(dictionary.progress_reset).sort()).toEqual(Object.keys(t).sort())
    for (const value of Object.values(dictionary.progress_reset)) expect(value.trim().length).toBeGreaterThan(0)
  }
})
