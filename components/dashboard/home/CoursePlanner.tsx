'use client'

import { useState } from 'react'
import ProfileCourseCalendar from '@/components/dashboard/ProfileCourseCalendar'
import ProfileMonthlyCourses from '@/components/dashboard/ProfileMonthlyCourses'
import type { ProfileCourseCalendarState } from '@/lib/profile-course-calendar'
import type { ProfileMonthlyState } from '@/lib/types/monthly-bookings'
import type { ProfileTranslations } from '@/lib/profile-i18n'

/**
 * Bündelt Stundenplan (Kalender) und Folgemonat-Buchung als zwei getrennte
 * Bento-Kacheln und teilt die Buchungs-Revision: sobald eine Buchung
 * gespeichert ist, aktualisiert der Kalender seine Termine.
 *
 * Rendert ein Fragment aus zwei Wrappern – beide werden direkte Kinder des
 * Bento-Grids und damit eigenständige Kacheln.
 */
export default function CoursePlanner({ calendar, monthly, lang, translations, courseTitles }: {
  calendar: ProfileCourseCalendarState | null
  monthly: ProfileMonthlyState
  lang: string
  translations: ProfileTranslations
  courseTitles: Record<string, string>
}) {
  const [revision, setRevision] = useState(`${monthly.booking?.id ?? ''}:${monthly.booking?.revision ?? ''}`)
  return (
    <>
      <div className="min-w-0 lg:col-span-7">
        <ProfileCourseCalendar initial={calendar} lang={lang} bookingRevision={revision} />
      </div>
      <div className="min-w-0 lg:col-span-5">
        <ProfileMonthlyCourses initial={monthly} lang={lang} translations={translations} courseTitles={courseTitles} onRevisionChange={setRevision} />
      </div>
    </>
  )
}
