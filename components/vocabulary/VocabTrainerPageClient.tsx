'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, BookOpen, Check, CircleCheckBig, Map as MapIcon, PenLine } from 'lucide-react'
import { initializeLesson } from '@/app/actions/vocabulary'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { isOwnWordsLesson, lessonTitle, OWN_WORDS_LESSON } from '@/lib/vocabulary-own-words'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { DueVocabularyCard, LessonStat, VocabularyBoxSummary } from '@/lib/types/vocabulary'
import type { SoftErrorReason } from '@/lib/answer-grading'
import VocabCardSession from './VocabCardSession'
import LessonCardsModal from './LessonCardsModal'
import LeitnerBoxOverview from './LeitnerBoxOverview'
import './lernkasten.css'

const EASE = [0.22, 1, 0.36, 1] as const
const OWN_ID = 'lernkasten-eigene-woerter'
const COUNT_SLOT = '\u0000'
/** „Eigene Wörter" steht immer da — auch bevor das erste Wort existiert. */
const EMPTY_OWN_WORDS: LessonStat = { lesson: OWN_WORDS_LESSON, total: 0, active: 0, learned: 0, untouched: 0, due: 0 }

interface Props {
  learnerId: string | null
  initialCards: DueVocabularyCard[]
  lessonStats: LessonStat[]
  /** Verteilung über die sechs Phasen — serverseitig gezählt, siehe getVocabularyBoxSummary. */
  boxSummary: VocabularyBoxSummary
  translations?: VocabularyTranslations
  softErrorTranslations?: Partial<Record<SoftErrorReason, string>>
  lang: string
  level: string
  initialDeferredCount?: number
  initialPreviousCardId?: string | null
}

/**
 * Übersicht des Vokabeltrainers.
 *
 * Die Seite beantwortet zuerst eine einzige Frage: „Was muss ich jetzt tun?"
 * Oben steht, wie viel heute wartet, darunter die Lernbox als Gegenstand und
 * direkt darunter der eine große Start-Knopf. Geübt wird alles, was aus den
 * aufgenommenen Lektionen fällig ist — Lektionen starten und ansehen geht auf
 * dem Lernweg des Niveaus. Hier bleibt nur die private Lektion „Eigene Wörter"
 * zum Eintragen und Einschalten.
 */
export default function VocabTrainerPageClient({ learnerId, initialCards, lessonStats, boxSummary, translations = {}, softErrorTranslations, lang, level, initialDeferredCount = 0, initialPreviousCardId = null }: Props) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const overview = `/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary`
  const s = studentTranslator(lang)
  const [session, setSession] = useState<DueVocabularyCard[] | null>(null)
  const [previousCardId, setPreviousCardId] = useState<string | null>(initialPreviousCardId)
  const [openLesson, setOpenLesson] = useState<string | null>(null)
  // Optimistisch eingeschaltet, bis der Server die Aufnahme bestätigt.
  const [ownActivated, setOwnActivated] = useState(false)
  const [ownPending, setOwnPending] = useState(false)
  const [ownError, setOwnError] = useState(false)
  const reduced = useReducedMotion() ?? false
  useEffect(() => { setPreviousCardId(initialPreviousCardId) }, [initialPreviousCardId])
  const due = initialCards.length
  const dueLessons = new Set(initialCards.map(item => item.card.lesson)).size
  const own = lessonStats.find(lesson => isOwnWordsLesson(lesson.lesson)) ?? EMPTY_OWN_WORDS
  const ownEmpty = own.total === 0
  const ownInBox = ownActivated || own.active + own.learned > 0
  const ownDue = initialCards.filter(item => isOwnWordsLesson(item.card.lesson)).length
  const ownLearnedPercent = own.total ? Math.round(own.learned / own.total * 100) : 0
  // „{count} fällig" — dieselben Worte wie am Fach der Lernbox, die Zahl fett.
  const [duePrefix = '', dueSuffix = ''] = t('box_due_badge', { count: COUNT_SLOT }).split(COUNT_SLOT)

  // Eigene Wörter brauchen keine Einstufung: Beim Einschalten landen alle noch
  // nicht aufgenommenen Wörter direkt in Phase 1. Später eingetragene Wörter
  // legt die Datenbank selbst in Phase 1, sobald die Lektion einmal lief.
  async function activateOwnWords() {
    if (!learnerId || ownPending || ownEmpty || ownInBox) return
    setOwnPending(true)
    setOwnError(false)
    setOwnActivated(true)
    try {
      const result = await initializeLesson(own.lesson, level, learnerId)
      if (!result.success) throw new Error('own_words_activation_failed')
      startRefresh(() => router.refresh())
    } catch {
      setOwnActivated(false)
      setOwnError(true)
    } finally { setOwnPending(false) }
  }

  if (session) return <VocabCardSession key={learnerId} learnerId={learnerId} cards={session} translations={translations} softErrorTranslations={softErrorTranslations} uiLanguage={lang} previousCardId={previousCardId} initialDeferredCount={initialDeferredCount} overviewHref={overview}
    onBackToLernkasten={lastId => { setPreviousCardId(lastId); setSession(null); startRefresh(() => router.refresh()) }} />

  // Die eine Hauptaktion. Ist nichts fällig, tritt an ihre Stelle kein
  // ausgegrauter Knopf, sondern eine klare Auskunft mit dem nächsten Schritt.
  const action = due > 0
    ? <div className="flex flex-col items-center gap-3">
        <motion.button type="button" disabled={refreshing} onClick={() => setSession(initialCards)} className="lb-cta"
          whileHover={reduced ? undefined : { y: -2 }} whileTap={reduced ? undefined : { scale: 0.98 }}>
          <span className="lb-cta__icon" aria-hidden="true"><ArrowRight size={24} strokeWidth={2.75} /></span>
          <span>{due === 1 ? t('lernkasten_start_count_one') : t('lernkasten_start_count', { count: due })}</span>
        </motion.button>
        <p className="text-center text-base text-[var(--muted)]">
          {dueLessons === 1 ? t('lernkasten_from_lessons_one') : t('lernkasten_from_lessons', { count: dueLessons })}
        </p>
      </div>
    : <div className="lb-done" role="status">
        <p className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
          <CircleCheckBig size={22} aria-hidden="true" className="shrink-0 text-[var(--success)]" />
          {t('lernkasten_all_done_hint')}
        </p>
        <Link href={`/${lang}/dashboard/level/${encodeURIComponent(level)}`} className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface)] px-5 text-base font-semibold text-[var(--foreground)] hover:border-[var(--accent)]">
          <MapIcon size={18} aria-hidden="true" />{s('areas_to_path')}
        </Link>
      </div>

  return <div className="mx-auto w-full max-w-5xl space-y-10 text-[var(--foreground)]">
    {/* Auf dem Telefon ohne Karte (siehe .lb-hero): Die Box reicht mit
        --lb-bleed über den Seitenrand der academy-container bis an den
        Bildschirmrand. */}
    <section className="lb-hero sl-glass sl-hero [--lb-bleed:1rem] sm:p-8 sm:[--lb-bleed:0px]" aria-label={t('lernkasten_title')}>
      <div className="relative">
        <p className="flex items-center gap-2 text-base font-semibold text-[var(--muted)]">
          {due > 0 && <span className="sl-due-dot" aria-hidden="true" />}
          {t('lernkasten_title')}
        </p>
        {due > 0
          ? <h2 className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <motion.span key={due} initial={reduced ? false : { opacity: 0, y: 8 }} animate={reduced ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }} className="text-5xl font-bold leading-none tracking-tight tabular-nums sm:text-6xl">{due}</motion.span>
              <span className="text-xl font-semibold leading-tight sm:text-3xl">{due === 1 ? t('lernkasten_due_headline_one') : t('lernkasten_due_headline')}</span>
            </h2>
          : <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{t('all_done')}</h2>}

        <div className="mt-4 sm:mt-2">
          <LeitnerBoxOverview summary={boxSummary} level={level} uiLanguage={lang} translations={translations} action={action} />
        </div>

        {initialDeferredCount > 0 && <p className="mt-4 text-base text-[var(--muted)]">{t('repetition_gap_hint')}</p>}
      </div>
    </section>

    <section id={OWN_ID} aria-label={lessonTitle(own.lesson, t)} className="scroll-mt-24">
      <motion.article data-selected={ownInBox} data-own className="sl-card flex min-w-0 flex-col gap-4 p-5 sm:p-6"
        initial={reduced ? false : { opacity: 0, y: 12 }} animate={reduced ? undefined : { opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-start gap-3">
            <span className="sl-icon-tile h-11 w-11" aria-hidden="true"><PenLine size={20} /></span>
            <div className="min-w-0">
              <h3 className="break-words text-xl font-semibold">{lessonTitle(own.lesson, t)}</h3>
              <p className="mt-1 flex flex-wrap gap-x-2 text-base text-[var(--muted)]">
                {ownEmpty ? <span>{t('own_words_empty')}</span> : <>
                  <span>{t('set_words_total', { count: own.total })}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('set_learned_share', { percent: ownLearnedPercent })}</span>
                </>}
              </p>
            </div>
          </div>
          {ownEmpty ? null : ownDue > 0
            ? <span className="shrink-0 rounded-full bg-[var(--accent)]/10 px-3 py-1 text-base font-semibold text-[var(--accent-text)]">{duePrefix}<b>{ownDue}</b>{dueSuffix}</span>
            : <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-base text-[var(--muted)]">{t('lernkasten_no_due_badge')}</span>}
        </div>
        {!ownEmpty && <div className="sl-bar h-2" data-tone="success" aria-hidden="true"><span style={{ width: `${ownLearnedPercent}%` }} /></div>}
        <button type="button" role="switch" aria-checked={ownInBox} data-selected={ownInBox} onClick={() => void activateOwnWords()} className="lb-switch"
          disabled={ownEmpty || ownPending || ownInBox} aria-label={t('lernkasten_switch_aria', { lesson: lessonTitle(own.lesson, t) })}>
          <span className="lb-switch__track" aria-hidden="true">
            <span className="lb-switch__thumb">{ownInBox && <Check size={16} strokeWidth={3} />}</span>
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-lg font-semibold leading-snug">{t(ownInBox ? 'lernkasten_in_box' : 'lernkasten_not_in_box')}</span>
            {!ownInBox && <span className="text-sm text-[var(--muted)]">{ownEmpty ? t('own_words_switch_disabled') : t('lernkasten_tap_to_add')}</span>}
          </span>
        </button>
        {ownError && <p role="alert" className="text-base text-[var(--danger)]">{t('own_words_activate_failed')}</p>}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--border)] pt-2">
          <button type="button" onClick={() => setOpenLesson(own.lesson)} className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-[var(--accent-text)]"><PenLine size={18} aria-hidden="true" />{t(ownEmpty ? 'own_words_add_first' : 'own_words_manage')}</button>
        </div>
      </motion.article>
    </section>

    <details className="sl-glass rounded-2xl px-5 sm:px-7">
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 py-3 text-lg font-semibold"><BookOpen size={20} aria-hidden="true" className="text-[var(--accent-text)]" />{t('method_title')}</summary>
      <div className="space-y-3 border-t border-[var(--border)] py-5 text-base leading-relaxed text-[var(--muted)]">
        <p>{t('method_progress')}</p><p>{t('method_intervals')}</p><p>{t('method_learned')}</p><p>{t('method_assessment')}</p>
      </div>
    </details>

    {openLesson && <LessonCardsModal lesson={openLesson} level={level} uiLanguage={lang} translations={translations} onClose={() => setOpenLesson(null)} onCardAdded={() => router.refresh()} />}
  </div>
}
