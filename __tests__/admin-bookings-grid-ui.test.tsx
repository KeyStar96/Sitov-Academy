import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import NextMonthBookings from '@/components/admin/NextMonthBookings'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import type { NextMonthOverview } from '@/lib/types/admin-staff'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

jest.unmock('lucide-react')

const student = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const course = '00000000-0000-4000-8000-0000000000aa'
const overview: NextMonthOverview = {
  targetMonth: '2026-10-01',
  enrolledCount: 2,
  paused: [],
  groups: [{
    courseId: course, title: 'B1.2 Intensiv', type: 'presence',
    students: [
      { student: { id: student, person: { display_name: 'Anna', email: 'anna@example.invalid', phone: '+49 111', street: 'Weg 1', postal_code: '30159', city: 'Hannover' } },
        courseSelections: [{ courseId: course, requestedUnits: undefined }], source: 'booking', status: 'pending', note: { id: course, student_id: student, teacher_id: student, note_text: 'Alte Notiz', created_at: '2026-01-01', updated_at: '2026-01-01' } },
      { student: { id: other, person: { display_name: 'Boris', email: 'boris@example.invalid', phone: null, street: null, postal_code: null, city: null } },
        courseSelections: [{ courseId: course, requestedUnits: undefined }], source: 'booking', status: 'confirmed', note: null },
    ],
  }],
}
const renderGrid = (dict: typeof de = de, lang = 'de') => render(
  <AdminI18nProvider translations={dict.admin}>
    <NextMonthBookings overview={overview} lang={lang} courseTitles={{ [course]: 'B1.2 Intensiv' }} />
  </AdminI18nProvider>,
)

it.each([['de', de], ['en', en], ['ru', ru], ['uk', uk], ['tr', tr]] as const)('renders the booking grid in %s without any blackboard note editor', (lang, dict) => {
  renderGrid(dict as typeof de, lang)
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getAllByText('B1.2 Intensiv').length).toBeGreaterThan(0)
  // Das „Schwarze Brett“ ist vollständig aus der Oberfläche entfernt (Phase 11.2):
  // kein Notizfeld, keine gespeicherten Notiztexte.
  expect(screen.queryByRole('textbox', { name: /Anna/ })).not.toBeInTheDocument()
  expect(document.querySelector('textarea')).toBeNull()
  expect(screen.queryByText('Alte Notiz')).not.toBeInTheDocument()
  expect(screen.queryByText(/Schwarzes Brett|Staff board|Blackboard/i)).not.toBeInTheDocument()
})

it('shows contact details and filters by status', () => {
  renderGrid()
  const table = screen.getByRole('table')
  expect(within(table).getByText('+49 111')).toBeInTheDocument()
  expect(within(table).getByText('Boris')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(de.admin.col_status), { target: { value: 'pending' } })
  expect(within(screen.getByRole('table')).queryByText('Boris')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('1')
})
