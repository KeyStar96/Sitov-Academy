import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getExercises } from '@/app/actions/exercises'
import ExerciseClient from '@/components/exercises/ExerciseClient'
import { getDictionary } from '@/lib/dictionary'
import type { ExerciseTranslations } from '@/lib/exercise-i18n'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { getLearningPath } from '@/app/actions/learning-path'
import LearningPathClient from '@/components/learning-path/LearningPathClient'

export default async function ExercisesPage({ params }: { params: Promise<{ lang: string; level: string }> }) {
  const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const decodedLevel = decodeURIComponent(level)
  const path = await getLearningPath(decodedLevel, lang)
  if (path.data?.paths.length) return <LearningPathClient initialPath={path.data} lang={lang} level={decodedLevel} />
  // Preserve the old trainer until an actual path is imported. Only a missing
  // backend function is a compatibility fallback; other failures remain visible.
  if (path.error && path.error !== 'backend_unavailable') {
    return <LearningPathClient initialError={path.error} lang={lang} level={decodedLevel} />
  }
  const dict = await getDictionary(lang)
  const exercises = await getExercises(decodedLevel, lang)
  const vocabulary = createVocabularyTranslator((dict.vocabulary ?? {}) as VocabularyTranslations)
  const learningLabels = { exit_learning: vocabulary('exit_learning'), theme_light: vocabulary('theme_light'), theme_dark: vocabulary('theme_dark'), overall_progress_label: vocabulary('overall_progress_label') }
  return <ExerciseClient exercises={exercises} translations={(dict.exercises ?? {}) as ExerciseTranslations} lang={lang} level={decodedLevel} learningLabels={learningLabels} />
}
