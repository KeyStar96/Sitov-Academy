import { notFound } from 'next/navigation'
import ProfileSettings from '@/components/dashboard/ProfileSettings'
import ProfileTrainerSettings from '@/components/dashboard/ProfileTrainerSettings'
import { getSitovTrainerSettingsCopy } from '@/lib/sitov-trainer-settings-i18n'
import { toUiLocale } from '@/lib/locale-routing'
import '@/components/dashboard/student.css'

/** Local settings preview changes browser preferences only, never learner progress. */
export default async function SitovTrainerSettingsPreview({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang: requestedLang } = await params
  const lang = toUiLocale(requestedLang)
  const copy = getSitovTrainerSettingsCopy(lang)
  return <main className="min-h-screen bg-[var(--background)] p-4 sm:p-8">
    <ProfileSettings lang={lang} sections={[
      { id: 'trainers', title: copy.title, hint: copy.hint, content: <ProfileTrainerSettings lang={lang} /> },
    ]} danger={null} />
  </main>
}
