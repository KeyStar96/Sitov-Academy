import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ProfileCourseCalendar from '@/components/dashboard/ProfileCourseCalendar'
import { getProfileCourseCalendar } from '@/app/actions/profile-calendar'
import type { ProfileCourseCalendarState } from '@/lib/profile-course-calendar'
import { PROFILE_CALENDAR_MESSAGES } from '@/lib/profile-calendar-i18n'

jest.mock('@/app/actions/profile-calendar', () => ({ getProfileCourseCalendar: jest.fn() }))
jest.unmock('lucide-react')

const calendar: ProfileCourseCalendarState = {
  currentMonth: '2026-09-01', nextMonth: '2026-10-01', unresolved: false, unscheduled: [],
  events: [
    { id: 'first', courseId: 'a1', title: 'Deutsch A1', translations: [{ locale: 'en', title: 'German A1' }], date: '2026-09-22', startTime: '18:00', endTime: '19:30', cancelled: true, reasons: ['Feiertag'], pending: false, trial: false },
    { id: 'second', courseId: 'a2', title: 'Deutsch A2', translations: [], date: '2026-09-29', startTime: '18:00', endTime: '19:30', cancelled: false, reasons: [], pending: false, trial: false },
    { id: 'third', courseId: 'a2', title: 'Deutsch A2', translations: [], date: '2026-10-06', startTime: '18:00', endTime: '19:30', cancelled: false, reasons: [], pending: true, trial: false },
  ],
}
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getProfileCourseCalendar).mockResolvedValue({ success: true, data: calendar }) })

it('switches between this month and next, filters by accessible day buttons, and retains cancellation reasons', () => {
  render(<ProfileCourseCalendar initial={calendar} lang="de" bookingRevision="1" />)
  expect(screen.getByText('Fällt aus: Feiertag')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /22\. September · Termine: 1/ }))
  expect(screen.getByText('Deutsch A1')).toBeInTheDocument()
  expect(screen.queryByText('Deutsch A2')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Alle Termine des Monats' }))
  expect(screen.getByText('Deutsch A2')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Oktober 2026' }))
  expect(screen.getByRole('button', { name: 'Oktober 2026' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText('Deutsch A1')).not.toBeInTheDocument()
  expect(screen.getByText('Bestätigung ausstehend')).toBeInTheDocument()
})

it('refreshes only after a persisted booking revision changes and presents refresh errors with retry', async () => {
  const view = render(<ProfileCourseCalendar initial={calendar} lang="de" bookingRevision="1" />)
  expect(getProfileCourseCalendar).not.toHaveBeenCalled()
  jest.mocked(getProfileCourseCalendar).mockResolvedValueOnce({ success: false, error: 'request_failed' })
  view.rerender(<ProfileCourseCalendar initial={calendar} lang="de" bookingRevision="2" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Der Kurskalender konnte nicht geladen werden.')
  fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(getProfileCourseCalendar).toHaveBeenCalledTimes(2)
})

it.each(Object.entries(PROFILE_CALENDAR_MESSAGES))('localizes the complete calendar interface in %s', (lang, messages) => {
  expect(Object.keys(messages).sort()).toEqual(Object.keys(PROFILE_CALENDAR_MESSAGES.de).sort())
  expect(Object.values(messages).every(value => value.length > 0)).toBe(true)
  render(<ProfileCourseCalendar initial={calendar} lang={lang} bookingRevision="1" />)
  expect(screen.getByRole('heading', { name: messages.title })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: messages.months })).toBeInTheDocument()
  expect(screen.getByText(messages.timezone)).toBeInTheDocument()
})
