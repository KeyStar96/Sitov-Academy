import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { getDictionary } from '@/lib/dictionary'
import LevelTrainerCards from '@/components/dashboard/LevelTrainerCards'

export default async function LevelDashboard({ params }: {
  params: Promise<{ lang: string; level: string }>
}) {
  const { lang, level } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [profile, dict] = await Promise.all([
    user ? loadLevelAccessProfile(supabase, user.id) : null,
    getDictionary(lang),
  ])
  return <LevelTrainerCards lang={lang} level={level} profile={profile} translations={dict.dashboard} />
}
