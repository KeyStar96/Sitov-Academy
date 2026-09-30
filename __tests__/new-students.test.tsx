import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import NewStudents from '@/components/admin/NewStudents'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { updateStudentAllowedLevels } from '@/app/actions/admin'
import type { NewStudent } from '@/lib/admin-new-students'
import { newStudentsCopy } from '@/lib/new-students-i18n'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }), usePathname: () => '/de/admin/new-students' }))
jest.mock('@/app/actions/admin', () => ({ updateStudentAllowedLevels: jest.fn() }))
jest.unmock('lucide-react')

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const student = (n: number, overrides: Partial<NewStudent> = {}): NewStudent => ({
  id: id(n), name: `Schüler ${n}`, email: `s${n}@example.invalid`, phone: null, city: null, nativeLanguage: 'uk',
  registeredAt: `2026-09-${String(10 + n).padStart(2, '0')}T10:00:00Z`, bookings: [], ...overrides,
})
const c = newStudentsCopy('de')
const renderList = (rows: NewStudent[], lang = 'de', dict: typeof de = de) =>
  render(<AdminI18nProvider translations={dict.admin}><NewStudents students={rows} lang={lang} /></AdminI18nProvider>)

beforeEach(() => { jest.clearAllMocks(); jest.mocked(updateStudentAllowedLevels).mockResolvedValue({ success: true, allowedLevels: ['A1.1', 'A2.1'] }) })

test('lists newest registrations first and shows course registrations only as information', () => {
  renderList([student(1), student(3, { bookings: [{ title: 'Deutsch A1.1 (Online)', kind: 'trial', status: 'confirmed', targetMonth: '2026-10-01' }] })])
  const cards = screen.getAllByRole('article')
  expect(cards.map(card => within(card).getByRole('heading').textContent)).toEqual(['Schüler 3', 'Schüler 1'])
  expect(within(cards[0]).getByText('Deutsch A1.1 (Online)')).toBeInTheDocument()
  // Ein Kurs wählt kein Niveau vor.
  expect(within(cards[0]).queryAllByRole('button', { pressed: true })).toHaveLength(0)
  expect(within(cards[0]).getByRole('button', { name: c.submit })).toBeDisabled()
})

test('assigns the selected levels in canonical order and keeps a confirmation after refresh', async () => {
  const { rerender } = renderList([student(1)])
  const card = screen.getByRole('article')
  fireEvent.click(within(card).getByRole('button', { name: 'A2.1' }))
  fireEvent.click(within(card).getByRole('button', { name: 'A1.1' }))
  expect(within(card).getByRole('button', { name: 'A2.1' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(within(card).getByRole('button', { name: c.submit }))
  await waitFor(() => expect(updateStudentAllowedLevels).toHaveBeenCalledWith(id(1), ['A1.1', 'A2.1']))
  expect(await screen.findByText(c.success.replace('{levels}', 'A1.1 · A2.1'))).toBeInTheDocument()
  expect(refresh).toHaveBeenCalled()
  // Nach dem Neuladen fehlt der Schüler in der Serverliste – die Bestätigung bleibt.
  rerender(<AdminI18nProvider translations={de.admin}><NewStudents students={[]} lang="de" /></AdminI18nProvider>)
  expect(screen.getByRole('link', { name: c.adjust })).toHaveAttribute('href', `/de/admin/students/${id(1)}`)
})

test('reports a failed activation without claiming success and allows a retry', async () => {
  jest.mocked(updateStudentAllowedLevels).mockResolvedValueOnce({ success: false, error: 'db' })
  renderList([student(1)])
  fireEvent.click(screen.getByRole('button', { name: 'B1.1' }))
  fireEvent.click(screen.getByRole('button', { name: c.submit }))
  expect(await screen.findByRole('alert')).toHaveTextContent(c.failed)
  expect(refresh).not.toHaveBeenCalled()
  jest.mocked(updateStudentAllowedLevels).mockResolvedValueOnce({ success: true, allowedLevels: ['B1.1'] })
  fireEvent.click(screen.getByRole('button', { name: c.retry }))
  expect(await screen.findByText(c.success.replace('{levels}', 'B1.1'))).toBeInTheDocument()
})

test('shows an empty state when every student has a level', () => {
  renderList([])
  expect(screen.getByText(c.emptyTitle)).toBeInTheDocument()
})

test.each([['en', en], ['ru', ru], ['uk', uk], ['tr', tr]] as const)('renders localized copy in %s', (lang, dict) => {
  renderList([student(1)], lang, dict as typeof de)
  expect(screen.getByRole('heading', { level: 1, name: dict.admin.nav_new_students })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: newStudentsCopy(lang).submit })).toBeInTheDocument()
})

test('offers a search for longer lists', () => {
  renderList([1, 2, 3, 4, 5, 6, 7].map(n => student(n)))
  fireEvent.change(screen.getByRole('searchbox', { name: c.search }), { target: { value: 'Schüler 4' } })
  expect(screen.getAllByRole('article')).toHaveLength(1)
})
