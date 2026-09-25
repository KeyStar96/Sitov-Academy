import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requestSession } from '@/lib/request-session'
import { getDictionary } from '@/lib/dictionary'
import type { DashboardTranslations } from '@/lib/dashboard-i18n'
import { hasLevelAccess } from '@/lib/access/levels'
import { loadLevelAccessProfile } from '@/lib/access/server'
import LevelLocked from '@/components/dashboard/LevelLocked'
import ModeDock from '@/components/dashboard/ModeDock'
import ModeTransition from '@/components/dashboard/ModeTransition'
import { loadModeDock, modeLock } from '@/lib/learning-status-server'
import { LEARNING_MODES } from '@/lib/mode-targets'

export const dynamic = 'force-dynamic'

/**
 * Route-Guard für alle Inhalte eines Sprachniveaus
 * (`/dashboard/level/<level>/…`): Videos, Vokabeln, Übungen, Aussprache.
 *
 * Zugriff nur, wenn das Niveau für die konkrete User-ID freigeschaltet ist
 * (`profiles.allowed_levels`) oder die Rolle Vollzugriff hat (admin/teacher).
 * Andernfalls wird statt der Inhalte eine freundliche „gesperrt"-Anzeige
 * gerendert – die Kindrouten werden gar nicht erst geladen.
 *
 * Über allen Inhalten eines freigeschalteten Niveaus steht das Modus-Dock
 * (Phase 2, D6): Vokabeln · Lernpfad · Aussprache · Mediathek.
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

  // Sperren stehen sofort fest; die Zähler kommen nach, ohne die Seite aufzuhalten.
  const plain = LEARNING_MODES.map(mode => ({ mode, lock: modeLock(profile, decodedLevel, lang, mode) }))
  return <>
    <Suspense fallback={<ModeDock lang={lang} level={decodedLevel} entries={plain} />}>
      <CountedModeDock lang={lang} level={decodedLevel} userId={user.id} profile={profile} />
    </Suspense>
    <ModeTransition>{children}</ModeTransition>
  </>
}

async function CountedModeDock({ lang, level, userId, profile }: {
  lang: string
  level: string
  userId: string
  profile: Awaited<ReturnType<typeof loadLevelAccessProfile>>
}) {
  const entries = await loadModeDock({ userId, profile, level, lang })
  return <ModeDock lang={lang} level={level} entries={entries} />
}
