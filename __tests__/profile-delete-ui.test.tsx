import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import ProfileDelete from '@/components/dashboard/ProfileDelete'
import StudentProfileDelete from '@/components/admin/StudentProfileDelete'
import { deleteOwnProfile } from '@/app/actions/profile'
import { deleteStudentProfile } from '@/app/actions/admin'
import { studentsAdminCopy } from '@/lib/students-admin-i18n'
import { AUTH_FALLBACKS } from '@/lib/auth-i18n'
import { parseAuthStatus, toneForAuthStatus } from '@/lib/types/auth'
import type { ProfileDeletionResult } from '@/lib/types/profile-deletion'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

const mockReplace = jest.fn()
const mockRethrow = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace, refresh: jest.fn() }), unstable_rethrow: (error: unknown) => mockRethrow(error) }))
jest.mock('@/app/actions/profile', () => ({ deleteOwnProfile: jest.fn() }))
jest.mock('@/app/actions/admin', () => ({ deleteStudentProfile: jest.fn() }))
jest.unmock('lucide-react')

const t = de.profile_delete
const s = studentsAdminCopy('de')
const studentId = '00000000-0000-4000-8000-000000000001'
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open') } })
})
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(deleteOwnProfile).mockResolvedValue({ success: false, reason: 'delete_failed' })
  jest.mocked(deleteStudentProfile).mockResolvedValue({ success: true })
})
/** Stands in for the Next.js redirect boundary, which receives the rethrown redirect in the app. */
class Boundary extends React.Component<{ children: React.ReactNode; onError: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { this.props.onError(error) }
  render() { return this.state.failed ? <p>Weiterleitung</p> : this.props.children }
}
function deferred<Result>() {
  let resolve!: (result: Result) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<Result>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

describe('learner deletes the own profile', () => {
  function openDialog() {
    const trigger = screen.getByRole('button', { name: t.button })
    fireEvent.click(trigger)
    return { trigger, dialog: screen.getByRole('dialog', { name: t.dialog_title }) }
  }

  it('explains what is deleted and what the academy keeps, and starts on the safe action', () => {
    render(<ProfileDelete translations={t} lang="de" />)
    expect(screen.getByRole('heading', { name: t.title })).toBeVisible()
    const { dialog } = openDialog()
    expect(dialog).toHaveAccessibleDescription(t.dialog_description)
    expect(within(dialog).getByText(t.scope)).toBeVisible()
    expect(t.scope).toMatch(/Rechnungen/)
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map(button => button.textContent)).toEqual([t.cancel, t.confirm])
    expect(buttons[0]).toHaveFocus()
    for (const button of buttons) expect(button).toHaveClass('min-h-12')
  })

  it('cannot be confirmed before the acknowledgement is ticked; cancel and Escape delete nothing', () => {
    render(<ProfileDelete translations={t} lang="de" />)
    const { dialog, trigger } = openDialog()
    const confirm = within(dialog).getByRole('button', { name: t.confirm })
    expect(confirm).toBeDisabled()
    fireEvent.click(confirm)
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    // The acknowledgement does not survive a closed dialog.
    const reopened = openDialog().dialog
    expect(within(reopened).getByRole('checkbox', { name: t.acknowledge })).not.toBeChecked()
    fireEvent.click(within(reopened).getByRole('button', { name: t.cancel }))
    expect(deleteOwnProfile).not.toHaveBeenCalled()
  })

  it('sends only language and confirmation word, stays locked while deleting and leaves the redirect to Next.js', async () => {
    const pending = deferred<ProfileDeletionResult>()
    jest.mocked(deleteOwnProfile).mockReturnValue(pending.promise)
    const redirect = new Error('NEXT_REDIRECT')
    mockRethrow.mockImplementation(error => { if (error === redirect) throw error })
    const handedOver = jest.fn()
    render(<Boundary onError={handedOver}><ProfileDelete translations={t} lang="uk" /></Boundary>)
    const { dialog } = openDialog()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: t.acknowledge }))
    const confirm = within(dialog).getByRole('button', { name: t.confirm })
    expect(confirm).toBeEnabled()
    await act(async () => { fireEvent.click(confirm); fireEvent.click(confirm) })
    expect(deleteOwnProfile).toHaveBeenCalledTimes(1)
    expect(deleteOwnProfile).toHaveBeenCalledWith('uk', { confirmation: 'DELETE_LEARNING_PROFILE' })
    expect(within(dialog).getByRole('status')).toHaveTextContent(t.pending)
    for (const control of [...within(dialog).getAllByRole('button'), within(dialog).getByRole('checkbox')]) expect(control).toBeDisabled()
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(dialog).toBeInTheDocument()
    // A redirect is not a failure: no error text, the router takes over.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => { pending.reject(redirect); await pending.promise.catch(() => {}) })
    consoleError.mockRestore()
    expect(mockRethrow).toHaveBeenCalledWith(redirect)
    expect(handedOver).toHaveBeenCalledWith(redirect)
    expect(screen.queryByText(t.error)).not.toBeInTheDocument()
  })

  it.each([
    ['delete_failed', t.error], ['not_authenticated', t.not_authenticated], ['conflict', t.conflict], ['not_authorized', t.conflict],
  ] as const)('explains %s and allows another attempt', async (reason, message) => {
    jest.mocked(deleteOwnProfile).mockResolvedValue({ success: false, reason })
    render(<ProfileDelete translations={t} lang="de" />)
    const { dialog } = openDialog()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: t.acknowledge }))
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: t.confirm })))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(message)
    expect(within(dialog).getByRole('button', { name: t.confirm })).toBeEnabled()
  })

  it('shows a network failure as an error instead of leaving the dialog busy', async () => {
    jest.mocked(deleteOwnProfile).mockRejectedValue(new Error('offline'))
    render(<ProfileDelete translations={t} lang="de" />)
    const { dialog } = openDialog()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: t.acknowledge }))
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: t.confirm })))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(t.error)
  })

  it.each([['de', de], ['en', en], ['ru', ru], ['uk', uk], ['tr', tr]] as const)('is fully translated in %s, including the login confirmation', (lang, dict) => {
    for (const [key, value] of Object.entries(dict.profile_delete)) {
      expect(value.trim().length).toBeGreaterThan(3)
      if (lang !== 'de') expect(value).not.toBe(de.profile_delete[key as keyof typeof de.profile_delete])
    }
    expect(dict.auth.status_profile_deleted.trim().length).toBeGreaterThan(10)
    expect(parseAuthStatus('profile_deleted')).toBe('profile_deleted')
    expect(toneForAuthStatus('profile_deleted')).toBe('success')
    expect(AUTH_FALLBACKS.status_profile_deleted).toBe(de.auth.status_profile_deleted)
  })
})

describe('teacher deletes a learner profile', () => {
  const renderCard = () => render(<StudentProfileDelete studentId={studentId} name="Anna Beispiel" lang="de" />)
  function openDialog() {
    const trigger = screen.getByRole('button', { name: s.deleteProfileButton })
    fireEvent.click(trigger)
    return { trigger, dialog: screen.getByRole('dialog', { name: 'Profil von Anna Beispiel löschen?' }) }
  }

  it('names the learner and states what stays in administration', () => {
    renderCard()
    expect(screen.getByRole('heading', { name: s.deleteProfileTitle })).toBeVisible()
    expect(screen.getByText(s.deleteProfileIntro)).toBeVisible()
    const { dialog } = openDialog()
    expect(dialog).toHaveAccessibleDescription(s.deleteProfileDialogText)
    expect(within(dialog).getByText(s.deleteProfileKept)).toBeVisible()
    expect(s.deleteProfileKept).toMatch(/Rechnungen/)
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map(button => button.textContent)).toEqual([s.deleteProfileCancel, s.deleteProfileButton])
    expect(buttons[0]).toHaveFocus()
    expect(buttons[1]).toBeDisabled()
    fireEvent.click(buttons[0])
    expect(deleteStudentProfile).not.toHaveBeenCalled()
  })

  it('deletes after the acknowledgement and returns to the list without a name in the address', async () => {
    renderCard()
    const { dialog } = openDialog()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: s.deleteProfileAcknowledge }))
    const confirm = within(dialog).getByRole('button', { name: s.deleteProfileButton })
    await act(async () => { fireEvent.click(confirm); fireEvent.click(confirm) })
    expect(deleteStudentProfile).toHaveBeenCalledTimes(1)
    expect(deleteStudentProfile).toHaveBeenCalledWith({ studentId, confirmation: 'DELETE_STUDENT_PROFILE' })
    expect(mockReplace).toHaveBeenCalledWith('/de/admin/students?deleted=1')
    // Still busy until the list replaces the page: no second delete, no flash of the old form.
    expect(within(dialog).getByRole('status')).toHaveTextContent(s.deleteProfilePending)
  })

  it('goes back to the list when a colleague already deleted the profile', async () => {
    jest.mocked(deleteStudentProfile).mockResolvedValue({ success: false, reason: 'not_found' })
    renderCard()
    const { dialog } = openDialog()
    fireEvent.click(within(dialog).getByRole('checkbox'))
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: s.deleteProfileButton })))
    expect(mockReplace).toHaveBeenCalledWith('/de/admin/students?deleted=1')
  })

  it.each([
    ['conflict', s.deleteProfileConflict], ['not_authorized', s.deleteProfileNotAllowed], ['delete_failed', s.deleteProfileFailed],
  ] as const)('stays on the page and explains %s', async (reason, message) => {
    jest.mocked(deleteStudentProfile).mockResolvedValue({ success: false, reason })
    renderCard()
    const { dialog } = openDialog()
    fireEvent.click(within(dialog).getByRole('checkbox'))
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: s.deleteProfileButton })))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(message)
    expect(mockReplace).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: s.deleteProfileButton })).toBeEnabled()
  })

  it.each(['en', 'ru', 'uk', 'tr'])('has its own wording in %s', lang => {
    const copy = studentsAdminCopy(lang)
    for (const key of Object.keys(s).filter(key => key.startsWith('deleteProfile') || key === 'profileDeleted') as Array<keyof typeof s>) {
      expect(copy[key].trim().length).toBeGreaterThan(3)
      expect(copy[key]).not.toBe(s[key])
    }
    expect(copy.deleteProfileDialogTitle).toContain('{name}')
  })
})
