import { createClient } from '@/utils/supabase/server'
import { Languages } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getDictionary } from '@/lib/dictionary'
import { createProfileTranslator, translateNativeLanguage } from '@/lib/profile-i18n'
import { LOCALES, toUiLocale } from '@/lib/locale-routing'
import { loadProfileMonthlyState } from '@/lib/profile-dashboard-server'
import UiLanguageForm from '@/components/dashboard/UiLanguageForm'
import ProfileDetailsForm from '@/components/dashboard/ProfileDetailsForm'
import ProfileMonthlyCourses from '@/components/dashboard/ProfileMonthlyCourses'

export default async function ProfilePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: requestedLang } = await params
  const lang = toUiLocale(requestedLang)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect(`/${lang}/login`)
  const [dict, profileResult] = await Promise.all([
    getDictionary(lang), supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])
  if (profileResult.error || !profileResult.data) throw new Error('profile_load_failed')
  const profile = profileResult.data
  const t = createProfileTranslator(dict.profile)
  // A booking failure must not make the personal details form disappear.
  let monthly: Awaited<ReturnType<typeof loadProfileMonthlyState>> | null = null
  try { monthly = await loadProfileMonthlyState(supabase, user) }
  catch { console.error('[profile] Course plan could not be loaded') }
  const courseData: Record<string, { title?: string }> = dict.CourseData
  const titles = Object.fromEntries((monthly?.courses ?? []).map(course => [
    course.id, courseData[course.translationKey]?.title || course.title || t('course_fallback'),
  ]))

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6 [overflow-wrap:break-word] sm:space-y-8">
      <div className="max-w-2xl">
        <h1 className="break-words text-3xl font-extrabold text-[var(--foreground)] sm:text-4xl">{t('title')}</h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{t('intro')}</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <ProfileDetailsForm lang={lang} translations={dict.profile} pendingEmail={user.new_email || null}
            initial={{ name: profile.name ?? '', email: profile.email, phone: profile.phone, street: profile.street, zip_code: profile.zip_code, city: profile.city }} />
          <section className="min-w-0 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Languages size={22} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-lg font-bold text-[var(--foreground)]">{t('ui_language')}</h2>
                <p className="mt-1 text-sm leading-snug text-[var(--muted)]">{t('ui_language_description')}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{t('native_language')}: {translateNativeLanguage(t, profile.native_language)}</p>
              </div>
            </div>
            <div className="mt-4">
              <UiLanguageForm
                current={toUiLocale(profile.ui_language ?? lang)}
                options={LOCALES.map(locale => ({ value: locale, label: t(`ui_locale_${locale}`) }))}
                ariaLabel={t('ui_language')}
                saveLabel={t('ui_language_save')}
              />
            </div>
          </section>
        </div>
        {monthly ? <ProfileMonthlyCourses key={`${user.id}:${monthly.targetMonth}`} initial={monthly} lang={lang} translations={dict.profile} courseTitles={titles} />
          : <section className="min-w-0 rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950">
            <h2 className="text-xl font-bold text-[var(--foreground)]">{t('next_month_title')}</h2>
            <p role="alert" className="mt-3 text-amber-900 dark:text-amber-200">{t('booking_load_failed')}</p>
            <a href={`/${lang}/dashboard/profile`} className="mt-4 inline-flex min-h-12 min-w-12 items-center rounded-xl border border-amber-500 px-4 py-2 font-bold text-amber-950 dark:text-amber-100">{t('reload')}</a>
          </section>}
      </div>
    </div>
  )
}
