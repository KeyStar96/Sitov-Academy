import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import VocabularyFocus from '@/components/vocabulary/VocabularyFocus'
import { getVocabularyFocus } from '@/app/actions/vocabulary-focus'
import { loadLearningCheckpoint } from '@/app/actions/learning-checkpoints'

/**
 * Problemwörter eines Niveaus (Phase 11.3): Schwachstellen aus dem
 * Vokabeltrainer, getrennt gespeichert und mit eigenen kleinen Aufgaben
 * wiederholt. Wie der Vokabeltrainer nur mit einer anderen Oberflächensprache
 * als Deutsch – die Aufgaben brauchen die Übersetzung.
 */
export default async function VocabularyFocusPage({ params }: { params: Promise<{ lang: string; level: string }> }) {
  const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const decodedLevel = decodeURIComponent(level)
  const [result, saved] = await Promise.all([getVocabularyFocus(decodedLevel, lang), loadLearningCheckpoint('vocabulary_focus', decodedLevel)])
  return <VocabularyFocus initial={result.success && saved.ok ? result.data : null} learnerId={saved.ok ? saved.learnerId : null}
    checkpoint={saved.ok ? saved.checkpoint : null} lang={lang} level={decodedLevel} />
}
