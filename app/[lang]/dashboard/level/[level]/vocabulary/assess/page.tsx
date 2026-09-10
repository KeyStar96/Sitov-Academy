import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import { getLessonCards } from '@/app/actions/vocabulary'
import { getDictionary } from '@/lib/dictionary'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import LessonAssessmentClient from './LessonAssessmentClient'

export default async function VocabularyAssessPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; level: string }>
  searchParams: Promise<{ lesson?: string }>
}) {
  const { lang, level } = await params
  const { lesson } = await searchParams
  const decodedLevel = decodeURIComponent(level)
  const decodedLesson = lesson ?? ''
  const dict = await getDictionary(lang)
  const translations = (dict.vocabulary ?? {}) as VocabularyTranslations
  const t = createVocabularyTranslator(translations)
  const overviewHref = `/${lang}/dashboard/level/${encodeURIComponent(decodedLevel)}/vocabulary`

  const allCards = decodedLesson ? await getLessonCards(decodedLesson, decodedLevel) : []
  // Keep translations, examples and audio entirely outside the assessment payload.
  const cardsToAssess = allCards.filter((card) => card.phase === null)
    .map(({ id, word_de, article }) => ({ id, word_de, article }))

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl rounded-3xl bg-[var(--surface)] p-5 py-8 text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)] sm:p-8">

      <div className="mb-6 border-b border-[var(--border)] pb-6">
        <h1 className="flex items-center gap-3 break-words text-3xl font-extrabold text-[var(--foreground)] sm:text-4xl">
          <ListChecks className="h-8 w-8 shrink-0 text-[var(--accent)]" aria-hidden="true" />
          {t('assess_title')}
        </h1>
        <p className="mt-2 text-xl text-[var(--muted)]">{t('assess_subtitle')}</p>
      </div>

      {cardsToAssess.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] py-12 text-center">
          <p className="text-xl font-bold text-[var(--foreground)]">{t('assess_empty_title')}</p>
          <p className="mx-auto mt-2 max-w-md text-lg text-[var(--muted)]">{t('assess_empty_text')}</p>
          <Link
            href={overviewHref}
            className="mt-8 inline-flex min-h-16 items-center justify-center rounded-2xl bg-[var(--accent)] px-8 py-4 text-xl font-bold text-white dark:text-[#23150e] shadow-md transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
          >
            {t('back_to_overview')}
          </Link>
        </div>
      ) : (
        <LessonAssessmentClient
          cards={cardsToAssess}
          lessonName={decodedLesson}
          lang={lang}
          level={decodedLevel}
          translations={translations}
        />
      )}
    </div>
  )
}
