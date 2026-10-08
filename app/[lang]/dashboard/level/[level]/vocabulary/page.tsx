import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getVocabularySession, getVocabularyOverview } from '@/app/actions/vocabulary'
import { getDictionary } from '@/lib/dictionary'
import { type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import VocabTrainerPageClient from '@/components/vocabulary/VocabTrainerPageClient'

export default async function VocabularyOverviewPage({
  params,
}: {
  params: Promise<{ lang: string; level: string }>
}) {
  const { lang, level } = await params
  const decodedLevel = decodeURIComponent(level)
  const dict = await getDictionary(lang)
  const translations = (dict.vocabulary ?? {}) as VocabularyTranslations

  const [overview, session] = await Promise.all([
    getVocabularyOverview(decodedLevel),
    getVocabularySession(decodedLevel, lang),
  ])

  if (session.learningSourceRequired) return <TrainerLanguageRequired lang={lang} />

  return (
    <VocabTrainerPageClient
      key={`${session.learnerId}:${session.learningSourceLanguage ?? 'missing'}`}
      learnerId={session.learnerId}
      learningSourceLanguage={session.learningSourceLanguage}
      initialCards={session.cards}
      initialDeferredCount={session.deferredCount}
      initialPreviousCardId={session.previousCardId}
      boxSummary={overview.box}
      carryover={overview.carryover}
      translations={translations}
      softErrorTranslations={dict.exercises?.soft_error}
      lang={lang}
      level={decodedLevel}
    />
  )
}
