import { requestSession } from '@/lib/request-session'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { hasConfiguredTrainerAccess } from '@/lib/access/levels'
import { getDictionary } from '@/lib/dictionary'
import LevelLocked from '@/components/dashboard/LevelLocked'

/** Media remains available in German, with the same teacher grant on every URL. */
export default async function SitovMediaAccessLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ lang: string; level: string }>
}) {
  const { lang, level } = await params
  const decodedLevel = decodeURIComponent(level)
  const { supabase, user } = await requestSession()
  const profile = user ? await loadLevelAccessProfile(supabase, user.id) : null
  if (hasConfiguredTrainerAccess(profile, decodedLevel, 'videos')) return children
  const dict = await getDictionary(lang)
  return <LevelLocked lang={lang} level={decodedLevel} translations={dict.dashboard} trainer />
}
