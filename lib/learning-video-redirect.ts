import { createClient } from '@/utils/supabase/server'
import { currentUserHasTrainerAccess } from '@/lib/access/server'
import { learningResourceUrl } from '@/lib/video-links'

export async function learningVideoDestination(lang: string, level: string, id: string) {
  const library = `/${lang}/dashboard/level/${encodeURIComponent(level)}/videos`
  try {
    if (await currentUserHasTrainerAccess(level, 'videos')) {
      const supabase = await createClient()
      const { data, error } = await supabase.from('learning_videos').select('source_url,unit:learning_units!inner(level,is_active)').eq('id', id).eq('unit.level', level).eq('unit.is_active', true).maybeSingle()
      if (error) throw error
      return learningResourceUrl(data?.source_url) ?? library
    }
  } catch { console.error('Video link unavailable:') }
  return library
}
