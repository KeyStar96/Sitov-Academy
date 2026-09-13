import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { currentUserHasTrainerAccess } from '@/lib/access/server'
import { learningResourceUrl } from '@/lib/video-links'

/** Keep old bookmarks working without loading an embedded third-party player. */
export default async function VideoPage({ params }: { params: Promise<{ lang: string; level: string; id: string }> }) {
  const { lang, level, id } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const decodedLevel = decodeURIComponent(level)
  let destination = `/${lang}/dashboard/level/${encodeURIComponent(decodedLevel)}/videos`
  try {
    if (await currentUserHasTrainerAccess(decodedLevel, 'videos')) {
      const supabase = await createClient()
      const { data, error } = await supabase.from('learning_videos').select('source_url,unit:learning_units!inner(level,is_active)').eq('id', id).eq('unit.level', decodedLevel).eq('unit.is_active', true).maybeSingle()
      if (error) throw error
      destination = learningResourceUrl(data?.source_url) ?? destination
    }
  } catch (error) { console.error('Video link unavailable:', error instanceof Error ? error.name : 'database_error') }
  redirect(destination)
}
