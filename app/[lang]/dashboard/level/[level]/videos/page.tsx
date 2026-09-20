import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/lib/dictionary'
import { videoQuery, mapVideo } from '@/lib/learning-catalog'
import VideoLibrary from '@/components/dashboard/VideoLibrary'
import type { VideoRecord } from '@/lib/video-links'

export default async function VideosOverviewPage({ params }: { params: Promise<{ lang: string; level: string }> }) {
  const { lang, level } = await params
  const decodedLevel = decodeURIComponent(level)
  const dict = await getDictionary(lang)
  let videos: VideoRecord[] = []
  let failed = false
  try {
    {
      const supabase = await createClient()
      const { data, error } = await videoQuery(supabase).eq('unit.level', decodedLevel).order('created_at')
      if (error) throw error
      videos = (data ?? []).map(mapVideo)
    }
  } catch (error) {
    failed = true
    console.error("Video library unavailable:")
  }
  return <VideoLibrary videos={videos} lang={lang} level={decodedLevel} translations={dict.videos ?? {}} failed={failed} />
}
