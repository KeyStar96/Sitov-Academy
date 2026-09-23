import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/lib/dictionary'
import { videoQuery, mapVideo } from '@/lib/learning-catalog'
import { getMediaFolders } from '@/app/actions/media'
import VideoLibrary from '@/components/dashboard/VideoLibrary'
import type { VideoRecord } from '@/lib/video-links'
import { buildMediaLibrary } from '@/lib/media-library'
import type { MediaFolder } from '@/lib/media'
import { studentTranslator } from '@/lib/student-ui-i18n'

/**
 * Die Mediathek eines Niveaus: Unterrichtsordner (Videos und Unterlagen),
 * hochgeladene Videos ohne Ordner und Lernvideos aus dem Internet — früher
 * zwei getrennte Seiten. Die Ordner kommen aus derselben Quelle wie im
 * Lehrer-Bereich, die Leserechte bleiben in RLS.
 */
export default async function VideosOverviewPage({ params }: { params: Promise<{ lang: string; level: string }> }) {
  const { lang, level } = await params
  const decodedLevel = decodeURIComponent(level)
  const dict = await getDictionary(lang)
  const s = studentTranslator(lang)
  let videos: VideoRecord[] = []
  let failed = false
  try {
    const supabase = await createClient()
    const { data, error } = await videoQuery(supabase).eq('unit.level', decodedLevel).order('created_at')
    if (error) throw error
    videos = (data ?? []).map(mapVideo)
  } catch (error) {
    failed = true
    console.error("Video library unavailable:")
  }
  let folders: MediaFolder[] = []
  try {
    const result = await getMediaFolders(decodedLevel)
    if (result.success) folders = result.data
    else console.error('Media folders unavailable')
  } catch { console.error('Media folders unavailable') }
  const { groups, links } = buildMediaLibrary({ videos, folders, looseTitle: s('media_more_videos') })
  return <VideoLibrary groups={groups} links={links} lang={lang} level={decodedLevel} translations={dict.videos ?? {}} failed={failed} />
}
