import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/lib/dictionary'
import { createProfileTranslator } from '@/lib/profile-i18n'
import { loadProfileMonthlyState } from '@/lib/profile-dashboard-server'
import { loadProfileCourseCalendar } from '@/lib/profile-course-calendar-server'
import { studentTranslator } from '@/lib/student-ui-i18n'
import CoursePlanner from '@/components/dashboard/home/CoursePlanner'
import ProfileCourseCalendar from '@/components/dashboard/ProfileCourseCalendar'

/**
 * Kalender: oben die Termine als Kalenderblätter, darunter die Planung des
 * nächsten Monats als geführter Ablauf. Beide laden unabhängig — ein Fehler
 * der Buchung lässt den Stundenplan stehen und umgekehrt.
 */
export default async function CalendarPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)
  const dict = await getDictionary(lang)
  const profileT = createProfileTranslator(dict.profile)
  const s = studentTranslator(lang)
  const [monthly, calendar] = await Promise.all([
    loadProfileMonthlyState(supabase, user).catch(() => { console.error('[calendar] Course plan could not be loaded'); return null }),
    loadProfileCourseCalendar(supabase, user).catch(() => { console.error('[calendar] Course calendar could not be loaded'); return null }),
  ])
  const courseTitles = Object.fromEntries((monthly?.courses ?? []).map(course => [
    course.id, course.translations.find(item => item.locale === lang)?.title || course.title || profileT('course_fallback'),
  ]))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="st-path-hero__title">{s('calendar_title')}</h1>
        <p className="mt-1 text-lg text-[var(--muted)]">{s('calendar_intro')}</p>
      </header>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {monthly
          ? <CoursePlanner calendar={calendar} monthly={monthly} lang={lang} translations={dict.profile} courseTitles={courseTitles} />
          : <>
              <div className="min-w-0 lg:col-span-7"><ProfileCourseCalendar initial={calendar} lang={lang} bookingRevision="" /></div>
              <section id="booking" className="min-w-0 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-800 dark:bg-amber-950 lg:col-span-5">
                <h2 className="text-xl font-bold text-[var(--foreground)]">{profileT('next_month_title')}</h2>
                <p role="alert" className="mt-3 text-amber-900 dark:text-amber-200">{profileT('booking_load_failed')}</p>
                <a href={`/${lang}/dashboard/calendar`} className="mt-4 inline-flex min-h-12 min-w-12 items-center rounded-xl border border-amber-500 px-4 py-2 font-bold text-amber-950 dark:text-amber-100">{profileT('reload')}</a>
              </section>
            </>}
      </div>
    </div>
  )
}
