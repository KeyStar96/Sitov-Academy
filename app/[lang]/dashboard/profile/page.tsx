import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { CalendarDays, Languages } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getDictionary } from '@/lib/dictionary'
import { createProfileTranslator, translateNativeLanguage } from '@/lib/profile-i18n'
import { LOCALES, toUiLocale, UI_LOCALE_ENDONYMS } from '@/lib/locale-routing'
import UiLanguageForm from '@/components/dashboard/UiLanguageForm'
import ProfileDetailsForm from '@/components/dashboard/ProfileDetailsForm'
import { resolveVerifiedPerson } from '@/lib/profile-person'
import { loadVerifiedCourseHistory } from '@/lib/profile-course-history'
import ProfileCourseHistory from '@/components/dashboard/ProfileCourseHistory'
import ProfileAppearanceSettings from '@/components/dashboard/ProfileAppearanceSettings'
import ProfileProgressReset from '@/components/dashboard/ProfileProgressReset'
import ProfileSettings from '@/components/dashboard/ProfileSettings'
import { studentTranslator } from '@/lib/student-ui-i18n'

export default async function ProfilePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: requestedLang } = await params
  const lang = toUiLocale(requestedLang)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect(`/${lang}/login`)
  try { await resolveVerifiedPerson(user) }
  catch { console.error('[profile] Verified person association could not be loaded') }
  const [dict, profileResult] = await Promise.all([
    getDictionary(lang), supabase.from('profiles').select('*,person:people(*)').eq('id', user.id).single(),
  ])
  if (profileResult.error || !profileResult.data) throw new Error('profile_load_failed')
  const profile = profileResult.data
  const t = createProfileTranslator(dict.profile)
  const s = studentTranslator(lang)
  let courseHistory: Awaited<ReturnType<typeof loadVerifiedCourseHistory>> = null
  try { courseHistory = await loadVerifiedCourseHistory(user) }
  catch { console.error('[profile] Existing course history could not be loaded') }
  const uiLanguage = toUiLocale(profile.ui_language ?? lang)

  return (
    <ProfileSettings lang={lang}
      notice={<p>{t('teacher_progress_notice')} <Link href={`/${lang}/privacy`} className="inline-flex min-h-12 items-center rounded-lg px-2 font-semibold text-[var(--accent-text)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{t('teacher_progress_privacy')}</Link></p>}
      danger={<ProfileProgressReset translations={dict.progress_reset} userId={user.id} />}
      sections={[
        { id: 'details', title: s('settings_details'), hint: s('settings_details_hint'), content: (
          <ProfileDetailsForm lang={lang} translations={dict.profile} pendingEmail={user.new_email || null} birthDate={courseHistory?.birthDate}
            initial={{ display_name: profile.person?.display_name ?? '', email: profile.person?.email ?? user.email ?? '', phone: profile.person?.phone ?? null, street: profile.person?.street ?? null, postal_code: profile.person?.postal_code ?? null, city: profile.person?.city ?? null }} />
        ) },
        { id: 'language', title: s('settings_language'), hint: UI_LOCALE_ENDONYMS[uiLanguage], content: (
          <section id="language-settings" className="scroll-mt-28 min-w-0 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Languages size={22} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-lg font-bold text-[var(--foreground)]">{t('ui_language')}</h2>
                <p className="mt-1 text-base leading-snug text-[var(--muted)]">{t('ui_language_description')}</p>
                <p className="mt-2 text-base text-[var(--muted)]">{t('native_language')}: {translateNativeLanguage(t, profile.native_language)}</p>
              </div>
            </div>
            <div className="mt-4">
              <UiLanguageForm
                current={uiLanguage}
                options={LOCALES.map(locale => ({ value: locale, label: t(`ui_locale_${locale}`) }))}
                ariaLabel={t('ui_language')}
                saveLabel={t('ui_language_save')}
              />
            </div>
          </section>
        ) },
        { id: 'appearance', title: s('settings_appearance'), hint: s('settings_appearance_hint'), content: <ProfileAppearanceSettings /> },
        { id: 'courses', title: s('settings_courses'), hint: s('settings_courses_hint'), content: (
          <div className="space-y-5">
            <Link href={`/${lang}/dashboard/calendar#booking`} className="st-cta st-press !mt-0">
              <span className="st-cta__text"><span className="st-cta__label">{s('settings_plan')}</span></span>
              <span className="st-cta__arrow" aria-hidden="true"><CalendarDays size={22} /></span>
            </Link>
            <ProfileCourseHistory history={courseHistory} lang={lang} />
          </div>
        ) },
      ]} />
  )
}
