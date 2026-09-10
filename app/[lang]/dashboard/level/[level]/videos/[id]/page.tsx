import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { currentUserHasTrainerAccess } from '@/lib/access/server'
import { youtubeWatchUrl } from '@/lib/video-links'

/** Keep old bookmarks working without loading an embedded third-party player. */
export default async function VideoPage({ params }: { params: Promise<{ lang: string; level: string; id: string }> }) {
  const { lang, level, id } = await params
  const decodedLevel = decodeURIComponent(level)
  let destination = `/${lang}/dashboard/level/${encodeURIComponent(decodedLevel)}/videos`
  try {
    if (await currentUserHasTrainerAccess(decodedLevel, 'videos')) {
      const supabase = await createClient()
      const { data, error } = await supabase.from('videos').select('external_url, video_url').eq('id', id).eq('level', decodedLevel).maybeSingle()
      if (error) throw error
      destination = youtubeWatchUrl(data?.external_url ?? data?.video_url) ?? destination
    }
  } catch (error) { console.error('Video link unavailable:', error instanceof Error ? error.name : 'database_error') }
  redirect(destination)
}
