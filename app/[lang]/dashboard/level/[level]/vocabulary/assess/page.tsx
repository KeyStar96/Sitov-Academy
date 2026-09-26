import Link from 'next/link'
import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getVocabularyAssessment } from '@/app/actions/vocabulary'
import { getDictionary } from '@/lib/dictionary'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import LessonAssessmentClient from './LessonAssessmentClient'
import VocabularyStartGate from '@/components/vocabulary/VocabularyStartGate'

export default async function VocabularyAssessPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; level: string }>
  searchParams: Promise<{ lesson?: string }>
}) {
  const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const { lesson } = await searchParams
  const decodedLevel = decodeURIComponent(level)
  const decodedLesson = lesson ?? ''
  const dict = await getDictionary(lang)
  const translations = (dict.vocabulary ?? {}) as VocabularyTranslations
  const t = createVocabularyTranslator(translations)
  const overviewHref = `/${lang}/dashboard/level/${encodeURIComponent(decodedLevel)}/vocabulary`

  const assessment = decodedLesson ? await getVocabularyAssessment(decodedLesson, decodedLevel, lang) : { learnerId: null, cards: [] }
  const cardsToAssess = assessment.cards

  return (
    <div className="mx-auto w-full max-w-4xl text-[var(--foreground)]">

      {cardsToAssess.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] py-12 text-center">
          <p className="text-xl font-bold text-[var(--foreground)]">{t('assess_empty_title')}</p>
          <p className="mx-auto mt-2 max-w-md text-lg text-[var(--muted)]">{t('assess_empty_text')}</p>
          <Link
            href={overviewHref}
            className="mt-8 inline-flex min-h-16 items-center justify-center rounded-2xl bg-[var(--accent-strong)] px-8 py-4 text-xl font-bold text-[var(--accent-foreground)] shadow-md transition-colors hover:bg-[var(--accent-strong-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
          >
            {t('back_to_overview')}
          </Link>
        </div>
      ) : (
        <VocabularyStartGate level={decodedLevel} lang={lang} learnerId={assessment.learnerId}>
        <LessonAssessmentClient
          key={assessment.learnerId}
          learnerId={assessment.learnerId}
          cards={cardsToAssess}
          lessonName={decodedLesson}
          lang={lang}
          level={decodedLevel}
          translations={translations}
        />
        </VocabularyStartGate>
      )}
    </div>
  )
}
