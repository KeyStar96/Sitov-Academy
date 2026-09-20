import { redirect } from 'next/navigation'
import { requestSession } from '@/lib/request-session'
import { getDictionary } from '@/lib/dictionary'
import type { DashboardTranslations } from '@/lib/dashboard-i18n'
import { hasLevelAccess } from '@/lib/access/levels'
import { loadLevelAccessProfile } from '@/lib/access/server'
import LevelLocked from '@/components/dashboard/LevelLocked'

export const dynamic = 'force-dynamic'

/**
 * Route-Guard für alle Inhalte eines Sprachniveaus
 * (`/dashboard/level/<level>/…`): Videos, Vokabeln, Übungen, Aussprache.
 *
 * Zugriff nur, wenn das Niveau für die konkrete User-ID freigeschaltet ist
 * (`profiles.allowed_levels`) oder die Rolle Vollzugriff hat (admin/teacher).
 * Andernfalls wird statt der Inhalte eine freundliche „gesperrt"-Anzeige
 * gerendert – die Kindrouten werden gar nicht erst geladen.
 */
export default async function LevelAccessLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string; level: string }>
}) {
  const { lang, level } = await params
  const decodedLevel = decodeURIComponent(level)

  const { supabase, user } = await requestSession()

  if (!user) {
    redirect(`/${lang}/login`)
  }

  const [profile, dict] = await Promise.all([
    loadLevelAccessProfile(supabase, user.id),
    getDictionary(lang),
  ])

  if (!hasLevelAccess(profile, decodedLevel)) {
    const translations = (dict.dashboard ?? {}) as DashboardTranslations
    return <LevelLocked lang={lang} level={decodedLevel} translations={translations} />
  }

  return <>{children}</>
}
