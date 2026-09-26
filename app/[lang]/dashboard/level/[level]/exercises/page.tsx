import { redirect } from 'next/navigation'
import { modeHref } from '@/lib/mode-targets'

/** Keep existing bookmarks working after the learning-path rollout. */
export default async function ExercisesPage({ params }: { params: Promise<{ lang: string; level: string }> }) {
  const { lang, level } = await params
  redirect(modeHref(lang, decodeURIComponent(level), 'path'))
}
