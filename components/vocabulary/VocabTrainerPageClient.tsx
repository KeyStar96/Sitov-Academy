'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CircleCheckBig, Settings2 } from 'lucide-react'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { DueVocabularyCard, VocabularyBoxSummary, VocabularyCarryoverSummary } from '@/lib/types/vocabulary'
import type { SoftErrorReason } from '@/lib/answer-grading'
import VocabularyTrainingStart from './VocabularyTrainingStart'
import LeitnerBoxOverview from './LeitnerBoxOverview'
import { useVocabularyRoundSize } from '@/lib/sitov-trainer-preferences'
import { sitovTrainerUiCopy } from '@/lib/sitov-trainer-ui-i18n'
import { sitovTrainerHeroCopy } from '@/lib/sitov-trainer-hero-i18n'
import { lessonsHref } from '@/lib/mode-targets'
import SitovTrainerHero from '@/components/motion/SitovTrainerHero'
import { SitovVocabularyDeck } from './SitovVocabularyGraphics'
import './lernkasten.css'
import styles from './SitovVocabularyMotion.module.css'

interface Props {
  learnerId: string | null
  initialCards: DueVocabularyCard[]
  /** Verteilung über die sechs Phasen — serverseitig gezählt, siehe getVocabularyBoxSummary. */
  boxSummary: VocabularyBoxSummary
  translations?: VocabularyTranslations
  softErrorTranslations?: Partial<Record<SoftErrorReason, string>>
  lang: string
  level: string
  initialDeferredCount?: number
  initialPreviousCardId?: string | null
  carryover?: VocabularyCarryoverSummary | null
}

/**
 * Der Einstieg startet die sichere Lernsession; die getrennte Lernbox zeigt
 * den Lernstand. Lektionen, eigene Wörter und selten geänderte Einstellungen
 * behalten ihre bisherigen Ziele und gespeicherten Werte.
 */
export default function VocabTrainerPageClient({ learnerId, initialCards, boxSummary, translations = {}, softErrorTranslations, lang, level, initialDeferredCount = 0, initialPreviousCardId = null, carryover }: Props) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const overview = `/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary`
  const s = studentTranslator(lang)
  const copy = sitovTrainerUiCopy(lang)
  const heroCopy = sitovTrainerHeroCopy(lang)
  const [session, setSession] = useState<DueVocabularyCard[] | null>(null)
  const [previousCardId, setPreviousCardId] = useState<string | null>(initialPreviousCardId)
  useEffect(() => { setPreviousCardId(initialPreviousCardId) }, [initialPreviousCardId])
  const [chosenSize] = useVocabularyRoundSize()
  const due = initialCards.length
  const lessons = lessonsHref(lang, level)
  // Leer ist die Box, solange unter „Lektionen" noch keine Lektion eingeschaltet ist.
  const empty = due === 0 && boxSummary.inPhases + boxSummary.learned === 0

  if (session) return <VocabularyTrainingStart key={learnerId} level={level} learnerId={learnerId} cards={session} translations={translations} softErrorTranslations={softErrorTranslations} uiLanguage={lang} previousCardId={previousCardId} initialDeferredCount={initialDeferredCount} overviewHref={overview} roundSize={chosenSize}
    onBackToLernkasten={lastId => { setPreviousCardId(lastId); setSession(null); startRefresh(() => router.refresh()) }} />

  return <div className="mx-auto w-full max-w-5xl space-y-6 text-[var(--foreground)]">
    <SitovTrainerHero mode="vocabulary" eyebrow={heroCopy.vocabularyEyebrow} level={level} title={heroCopy.vocabularyTitle}
      className={styles.sitovHero} testId="sitov-vocabulary-hero"
      graphic={<div className={styles.sitovHeroGraphic}><SitovVocabularyDeck /></div>}
      description={due > 0
        ? <span className={styles.sitovHeroCount}><b>{due}</b> {t('due_now')}</span>
        : empty ? heroCopy.vocabularyEmpty
          : <span className={styles.sitovHeroRest} role="status"><CircleCheckBig size={18} aria-hidden="true" />{t('all_done')}</span>}
      action={due > 0
        ? { label: copy.practice, onClick: () => setSession(initialCards), disabled: refreshing, busy: refreshing }
        : { label: s('areas_to_lessons'), href: lessons }} />

    <LeitnerBoxOverview summary={boxSummary} level={level} uiLanguage={lang} translations={translations} carryover={carryover} />

    <div className="flex justify-end">
      <Link href={`/${lang}/dashboard/profile#trainers`} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
        <Settings2 size={17} aria-hidden="true" />{copy.settings}
      </Link>
    </div>
  </div>
}
