import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getExercises } from '@/app/actions/exercises'
import ExerciseClient from '@/components/exercises/ExerciseClient'
import { getDictionary } from '@/lib/dictionary'
import type { ExerciseTranslations } from '@/lib/exercise-i18n'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'

export default async function ExercisesPage({ params }: { params: Promise<{ lang: string; level: string }> }) {
  const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const decodedLevel = decodeURIComponent(level)
  const dict = await getDictionary(lang)
  const exercises = await getExercises(decodedLevel, lang)
  const vocabulary = createVocabularyTranslator((dict.vocabulary ?? {}) as VocabularyTranslations)
  const learningLabels = { exit_learning: vocabulary('exit_learning'), theme_light: vocabulary('theme_light'), theme_dark: vocabulary('theme_dark'), overall_progress_label: vocabulary('overall_progress_label') }
  return <ExerciseClient exercises={exercises} translations={(dict.exercises ?? {}) as ExerciseTranslations} lang={lang} level={decodedLevel} learningLabels={learningLabels} />
}
