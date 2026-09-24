import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import EnrollmentTerminal from '@/components/registration/EnrollmentTerminal'
import { submitEnrollment } from '@/app/actions/submit-enrollment'
import type { CourseConfig } from '@/lib/course-config'
import { monthStarts, upcomingCourseDays } from '@/lib/registration-start-dates'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('next/navigation', () => ({ useSearchParams: () => ({ get: () => null }) }))
jest.mock('@/app/actions/validate-email', () => ({ validateEmail: jest.fn().mockResolvedValue({ isValid: true }) }))
jest.mock('@/app/actions/submit-enrollment', () => ({ submitEnrollment: jest.fn() }))
jest.mock('@/app/actions/submit-trial', () => ({ submitTrialLesson: jest.fn() }))
jest.mock('@/app/actions/trialEligibilityHint', () => ({ trialEligibilityHint: jest.fn() }))
jest.mock('@/app/actions/auth', () => ({ signup: jest.fn() }))
jest.mock('@/lib/analytics/meta-pixel', () => ({ trackMetaEvent: jest.fn() }))

const monday: CourseConfig = {
  id: '00000000-0000-4000-8000-000000000001', slug: 'deutsch-a1', title: 'Deutsch A1', category: 'german', type: 'presence',
  level: 'A1', unitPrice: 2.5, unitMinutes: 45, sessions: [{ day: 'Mo', startTime: '10:30', endTime: '12:00' }],
}
const online: CourseConfig = {
  id: '00000000-0000-4000-8000-000000000002', slug: 'online-b1', title: 'Online B1', category: 'online', type: 'online',
  unitPrice: 3, unitMinutes: 45, sessions: [{ day: 'Mi', startTime: '18:00', endTime: '19:30' }],
}
const serverTime = new Date('2026-09-13T10:00:00Z').getTime() // a Sunday
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))

function renderFlow() {
  render(<EnrollmentTerminal dictionary={de} lang="de" courses={[monday, online]} serverTime={serverTime}
    exceptions={[{ date: '2026-09-21', reason: 'Herbstferien', courseIds: [monday.id] }]} />)
}

function fill(label: string, value: string) {
  const field = screen.getByLabelText(label)
  fireEvent.change(field, { target: { value } })
  fireEvent.blur(field)
}

beforeEach(() => jest.mocked(submitEnrollment).mockReset())

it('asks for the course first, in plain words, and says why "Weiter" cannot go on yet', () => {
  renderFlow()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welchen Kurs möchtest du besuchen?')
  expect(screen.getByText('Schritt 1 von 4')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Kurse vor Ort in Hannover' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Online-Kurse' })).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/\/\/|Warten auf Auswahl|Wählen Sie|Modul/)
  // No cost box and no floating shortcut before there is anything to show.
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  expect(screen.getByText('Wähle zuerst mindestens einen Kurs.')).toBeInTheDocument()

  next()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welchen Kurs möchtest du besuchen?')
  expect(screen.getByText('Wähle zuerst mindestens einen Kurs.').closest('p')).toHaveAttribute('data-nudge', 'true')

  const card = screen.getByRole('checkbox', { name: 'Deutsch A1' })
  expect(card).toHaveAccessibleDescription(/Montag, 10:30 bis 12:00 Uhr/)
  expect(card).toHaveAccessibleDescription(/2,50\s€ pro 45 Minuten/)
  fireEvent.click(card)
  expect(card).toBeChecked()
  expect(screen.getByText('Das ist gewählt')).toBeInTheDocument()
  expect(screen.queryByText('Wähle zuerst mindestens einen Kurs.')).not.toBeInTheDocument()

  const costs = screen.getByRole('complementary', { name: 'Deine Kosten' })
  expect(costs).toHaveTextContent('Erster Monat: September 2026')
  expect(costs).toHaveTextContent('Du zahlst zuerst nur diesen ersten Monat.')
  // 14 and 28 September (the 21st is cancelled), 2 units each at 2.50 €.
  expect(within(costs).getAllByText('10,00 €').length).toBeGreaterThanOrEqual(1)
  expect(costs).toHaveTextContent('Herbstferien – fällt aus und wird nicht berechnet')
})

it('offers only real lesson days as start dates and shows errors as sentences under the fields', async () => {
  renderFlow()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Deutsch A1' }))
  next()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Wann möchtest du anfangen?')
  expect(screen.getByRole('radio', { name: /Montag, 14\. September\s*10:30 bis 12:00 Uhr/ })).toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: /21\. September/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('radio')).toHaveLength(6)

  next()
  expect(screen.getByText('Wähle zuerst, wann du anfangen möchtest.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: /28\. September/ }))
  expect(screen.getByRole('complementary')).toHaveTextContent('Gerechnet ab Montag, 28. September.')
  next()

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Deine Angaben')
  expect(screen.getByText('Zum Beispiel: 30159')).toBeInTheDocument()
  expect(screen.getByLabelText('Telefonnummer (freiwillig)')).toBeInTheDocument()
  next()
  await waitFor(() => expect(screen.getByText('Bitte gib deinen Vornamen ein (mindestens 2 Buchstaben).')).toBeInTheDocument())
  expect(screen.getByLabelText('Vorname')).toHaveFocus()
  expect(screen.getByLabelText('Vorname')).toHaveAccessibleDescription('Bitte gib deinen Vornamen ein (mindestens 2 Buchstaben).')
  expect(screen.getByText('Bitte gib deine E-Mail-Adresse vollständig ein, zum Beispiel: name@web.de')).toBeInTheDocument()
  expect(screen.getByText('Bitte prüfe die rot markierten Felder. Wir haben dich zum ersten Feld gebracht.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Deine Angaben')
})

it('lets names in any alphabet through and sends a complete registration', async () => {
  jest.mocked(submitEnrollment).mockResolvedValue({ success: true, message: 'registration_success' })
  renderFlow()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Deutsch A1' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Online B1' }))
  next()
  fireEvent.click(screen.getByRole('radio', { name: /Montag, 14\. September/ }))
  next()
  fill('Vorname', 'Ayşe')
  fill('Nachname', 'Ağaoğlu')
  fill('E-Mail-Adresse', 'ayse@web.de')
  fill('Tag', '4')
  fill('Monat', '3')
  fill('Jahr', '1958')
  fill('Straße und Hausnummer', 'Vahrenwalder Straße 92')
  fill('Postleitzahl', '30165')
  fill('Wohnort', 'Hannover')
  next()
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bitte prüfe deine Anmeldung'))
  expect(screen.getByText('04.03.1958')).toBeInTheDocument()
  expect(screen.getByText('Start: Montag, 14. September')).toBeInTheDocument()

  // Online course → four consents; nothing is sent before all are ticked.
  expect(screen.getAllByRole('checkbox')).toHaveLength(4)
  fireEvent.click(screen.getByRole('button', { name: 'Kostenpflichtig bestellen' }))
  expect(submitEnrollment).not.toHaveBeenCalled()
  expect(screen.getByText('Bitte bestätige zuerst alle Punkte.')).toBeInTheDocument()

  fireEvent.click(screen.getAllByRole('button', { name: 'Mehr lesen' })[0])
  expect(screen.getByText(/gemäß der Datenschutzerklärung/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Alle akzeptieren' }))
  screen.getAllByRole('checkbox').forEach(box => expect(box).toBeChecked())
  // Each box stays individually visible and can be unticked again.
  fireEvent.click(screen.getByRole('checkbox', { name: /aufgezeichnet/ }))
  expect(screen.getByRole('checkbox', { name: /aufgezeichnet/ })).not.toBeChecked()
  fireEvent.click(screen.getByRole('checkbox', { name: /aufgezeichnet/ }))

  fireEvent.click(screen.getByRole('button', { name: 'Kostenpflichtig bestellen' }))
  await waitFor(() => expect(submitEnrollment).toHaveBeenCalledTimes(1))
  const [data, selections, start, consents] = jest.mocked(submitEnrollment).mock.calls[0]
  expect(data.personal).toMatchObject({ firstName: 'Ayşe', lastName: 'Ağaoğlu', birthDate: '04.03.1958', zip: '30165' })
  expect(selections).toEqual([{ courseId: monday.id }, { courseId: online.id }])
  expect(start).toBe('14.09.2026')
  expect(consents).toEqual({ privacy: true, agb: true, revocation: true, videoRecording: true })

  expect(await screen.findByRole('heading', { level: 1, name: 'Danke für deine Anmeldung!' })).toHaveFocus()
  expect(screen.getByText('So geht es weiter')).toBeInTheDocument()
  expect(screen.getByText('Du bekommst gleich eine E-Mail an ayse@web.de. Schau bitte auch im Spam-Ordner nach.')).toBeInTheDocument()
  expect(screen.getByText('Danach bekommst du die Rechnung für den ersten Monat.')).toBeInTheDocument()
})

it('explains a failed submission on the page instead of a browser alert', async () => {
  jest.mocked(submitEnrollment).mockResolvedValue({ success: false, message: 'generic_error' })
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => {})
  renderFlow()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Deutsch A1' }))
  next()
  fireEvent.click(screen.getByRole('radio', { name: /14\. September/ }))
  next()
  fill('Vorname', 'Anna'); fill('Nachname', 'Schmidt'); fill('E-Mail-Adresse', 'anna@web.de')
  fill('Tag', '24'); fill('Monat', '12'); fill('Jahr', '1950')
  fill('Straße und Hausnummer', 'Hauptstraße 5'); fill('Postleitzahl', '30159'); fill('Wohnort', 'Hannover')
  next()
  await screen.findByRole('heading', { level: 1, name: 'Bitte prüfe deine Anmeldung' })
  expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: 'Alle akzeptieren' }))
  fireEvent.click(screen.getByRole('button', { name: 'Kostenpflichtig bestellen' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Das hat leider nicht geklappt.')
  expect(alert).not.toHaveBeenCalled()
  alert.mockRestore()
})

describe('start date suggestions', () => {
  it('lists lesson days in order, skipping cancellations and days outside the course period', () => {
    const days = upcomingCourseDays([{ ...monday, endDate: '2026-10-05' }, online], [{ date: '2026-09-21', reason: 'x' }], '2026-09-14', { days: 60, limit: 10 })
    expect(days.map(day => day.iso)).toEqual(['2026-09-14', '2026-09-16', '2026-09-23', '2026-09-28', '2026-09-30', '2026-10-05', '2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28'])
    expect(days[0].sessions).toEqual([{ courseId: monday.id, startTime: '10:30', endTime: '12:00' }])
  })

  it('starts lessons by arrangement tomorrow or on the first of a following month', () => {
    expect(monthStarts('2026-12-14', 3)).toEqual(['2026-12-14', '2027-01-01', '2027-02-01'])
  })
})
