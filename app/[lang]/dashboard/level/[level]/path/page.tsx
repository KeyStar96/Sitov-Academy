import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getLearningPath } from '@/app/actions/learning-path'
import LearningPathClient from '@/components/learning-path/LearningPathClient'
import { loadLearningNewItems } from '@/lib/learning-new-server'

export default async function LearningPathPage({ params }: { params: Promise<{ lang: string; level: string }> }) {
  const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const decodedLevel = decodeURIComponent(level)
  const [path, news] = await Promise.all([getLearningPath(decodedLevel, lang), loadLearningNewItems(decodedLevel)])
  return <LearningPathClient initialPath={path.data} initialError={path.error}
    lang={lang} level={decodedLevel} newItems={news.items} />
}
