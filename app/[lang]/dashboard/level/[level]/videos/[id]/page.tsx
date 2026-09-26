import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { redirect } from 'next/navigation'
import { learningVideoDestination } from '@/lib/learning-video-redirect'

/** Keep old bookmarks working without loading an embedded third-party player. */
export default async function VideoPage({ params }: { params: Promise<{ lang: string; level: string; id: string }> }) {
  const { lang, level, id } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  redirect(await learningVideoDestination(lang, decodeURIComponent(level), id))
}
