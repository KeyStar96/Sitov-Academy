'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, CircleCheckBig, ListChecks, Settings2 } from 'lucide-react'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { DueVocabularyCard, VocabularyBoxSummary, VocabularyCarryoverSummary } from '@/lib/types/vocabulary'
import type { SoftErrorReason } from '@/lib/answer-grading'
import VocabularyTrainingStart from './VocabularyTrainingStart'
import LeitnerBoxOverview from './LeitnerBoxOverview'
import { useVocabularyRoundSize } from '@/lib/sitov-trainer-preferences'
import { sitovTrainerUiCopy } from '@/lib/sitov-trainer-ui-i18n'
import { lessonsHref } from '@/lib/mode-targets'
import { EASE_OUT_SOFT, MOTION, PRESS_SCALE, useReducedMotionSafe } from '@/lib/motion'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
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
 * Die Lernbox — und nur sie.
 *
 * Die Seite beantwortet eine einzige Frage: „Was muss ich jetzt tun?" Oben
 * steht, wie viel heute wartet, darunter die Lernbox als Gegenstand und
 * direkt darunter der eine große Start-Knopf. Was in der Box liegt, wird im
 * Modus Vokabeln unter „Lektionen" entschieden: Dort werden Lektionen und „Eigene Wörter"
 * eingeschaltet, eingestuft und ergänzt.
 */
export default function VocabTrainerPageClient({ learnerId, initialCards, boxSummary, translations = {}, softErrorTranslations, lang, level, initialDeferredCount = 0, initialPreviousCardId = null, carryover }: Props) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const overview = `/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary`
  const s = studentTranslator(lang)
  const copy = sitovTrainerUiCopy(lang)
  const [session, setSession] = useState<DueVocabularyCard[] | null>(null)
  const [previousCardId, setPreviousCardId] = useState<string | null>(initialPreviousCardId)
  const reduced = useReducedMotionSafe()
  useEffect(() => { setPreviousCardId(initialPreviousCardId) }, [initialPreviousCardId])
  const [chosenSize] = useVocabularyRoundSize()
  const due = initialCards.length
  const lessons = lessonsHref(lang, level)
  // Leer ist die Box, solange unter „Lektionen" noch keine Lektion eingeschaltet ist.
  const empty = due === 0 && boxSummary.inPhases + boxSummary.learned === 0

  if (session) return <VocabularyTrainingStart key={learnerId} level={level} learnerId={learnerId} cards={session} translations={translations} softErrorTranslations={softErrorTranslations} uiLanguage={lang} previousCardId={previousCardId} initialDeferredCount={initialDeferredCount} overviewHref={overview} roundSize={chosenSize}
    onBackToLernkasten={lastId => { setPreviousCardId(lastId); setSession(null); startRefresh(() => router.refresh()) }} />

  // Die eine Hauptaktion. Ist nichts fällig, tritt an ihre Stelle kein
  // ausgegrauter Knopf, sondern eine klare Auskunft mit dem nächsten Schritt.
  const action = due > 0
    ? <div className="flex flex-col items-center gap-3">
        <motion.button type="button" disabled={refreshing} onClick={() => setSession(initialCards)} className="lb-cta" data-sitov-surface
          whileHover={reduced ? undefined : { y: -2 }} whileTap={reduced ? undefined : { scale: PRESS_SCALE }} transition={{ duration: MOTION.fast }}>
          <span className="lb-cta__icon" aria-hidden="true"><ArrowRight size={24} strokeWidth={2.75} /></span>
          <span>{copy.practice}</span>
        </motion.button>
      </div>
    : empty
      ? <div className="flex flex-col items-center gap-4 text-center" role="status">
          <p className="max-w-md text-lg text-[var(--foreground)]">{s('box_empty_text')}</p>
          <Link href={lessons} className="lb-cta" data-sitov-surface>
            <span className="lb-cta__icon" aria-hidden="true"><ListChecks size={22} strokeWidth={2.5} /></span>
            <span>{s('areas_to_lessons')}</span>
          </Link>
        </div>
      : <div className="lb-done" role="status">
          <p className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
            <CircleCheckBig size={22} aria-hidden="true" className="shrink-0 text-[var(--success)]" />
            {t('lernkasten_all_done_hint')}
          </p>
          <Link href={lessons} className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface)] px-5 text-base font-semibold text-[var(--foreground)] hover:border-[var(--accent)]">
            <ListChecks size={18} aria-hidden="true" />{s('areas_to_lessons')}
          </Link>
        </div>

  return <div className="mx-auto w-full max-w-5xl space-y-10 text-[var(--foreground)]">
    {/* Auf dem Telefon ohne Karte (siehe .lb-hero): Die Box reicht mit
        --lb-bleed über den Seitenrand der academy-container bis an den
        Bildschirmrand. */}
    <section className={`lb-hero sl-glass sl-hero ${styles.sitovHero} [--lb-bleed:1rem] sm:p-8 sm:[--lb-bleed:0px]`} aria-label={t('lernkasten_title')}>
      <div className="relative">
        <SitovMotionStage className={styles.sitovHeading}>
        <div className={styles.sitovHeadingText}>
        {due > 0
          ? <h2 className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <motion.span key={due} initial={reduced ? false : { opacity: 0, y: 8 }} animate={reduced ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: MOTION.slow, ease: EASE_OUT_SOFT }} className="text-5xl font-bold leading-none tracking-tight tabular-nums sm:text-6xl">{due}</motion.span>
              <span className="text-xl font-semibold leading-tight sm:text-3xl">{t('due_now')}</span>
            </h2>
          : <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{empty ? s('box_empty_title') : t('all_done')}</h2>}
        </div>
        <SitovVocabularyDeck />
        </SitovMotionStage>

        <div className="mt-4 sm:mt-2">
          <LeitnerBoxOverview summary={boxSummary} level={level} uiLanguage={lang} translations={translations} action={action} carryover={carryover} />
        </div>

        <div className="mt-3 flex justify-end">
          <Link href={`/${lang}/dashboard/profile#trainers`} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
            <Settings2 size={17} aria-hidden="true" />{copy.settings}
          </Link>
        </div>
      </div>
    </section>
  </div>
}
