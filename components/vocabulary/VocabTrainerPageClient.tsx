'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowRight, BookOpen, Check, CircleCheckBig, ListChecks, Sparkles } from 'lucide-react'
import { initializeLesson } from '@/app/actions/vocabulary'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { loadLernkastenSelection, saveLernkastenSelection } from '@/lib/vocabulary-lernkasten'
import type { DueVocabularyCard, LessonStat, VocabularyBoxSummary } from '@/lib/types/vocabulary'
import type { SoftErrorReason } from '@/lib/answer-grading'
import VocabCardSession from './VocabCardSession'
import LessonCardsModal from './LessonCardsModal'
import LeitnerBoxOverview from './LeitnerBoxOverview'
import './lernkasten.css'

const EASE = [0.22, 1, 0.36, 1] as const
const LESSONS_ID = 'lernkasten-lektionen'
const COUNT_SLOT = '\u0000'

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

function countDueByLesson(cards: readonly DueVocabularyCard[]): Map<string, number> {
  const counts = new Map<string, number>()
  cards.forEach(item => counts.set(item.card.lesson, (counts.get(item.card.lesson) ?? 0) + 1))
  return counts
}

/**
 * Übersicht des Vokabeltrainers.
 *
 * Die Seite beantwortet zuerst eine einzige Frage: „Was muss ich jetzt tun?"
 * Oben steht, wie viel heute wartet, darunter die Lernbox als Gegenstand und
 * direkt darunter der eine große Start-Knopf. Erst danach folgen die Lektionen
 * zum Ein- und Ausschalten.
 */
export default function VocabTrainerPageClient({ learnerId, initialCards, lessonStats, boxSummary, translations = {}, softErrorTranslations, lang, level, initialDeferredCount = 0, initialPreviousCardId = null }: Props) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const overview = `/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary`
  const dueByLesson = useMemo(() => countDueByLesson(initialCards), [initialCards])
  // Erstbesuch: alle Lektionen mit fälligen Aufgaben liegen schon im Kasten.
  // Schon beim Server-Rendern, damit der Start-Knopf nicht erst nach dem
  // Hydrieren von „Alles erledigt" auf die echte Zahl springt.
  const [selection, setSelection] = useState<string[]>(() => Array.from(countDueByLesson(initialCards).keys()))
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<DueVocabularyCard[] | null>(null)
  const [previousCardId, setPreviousCardId] = useState<string | null>(initialPreviousCardId)
  const [openLesson, setOpenLesson] = useState<string | null>(null)
  const [onboarding, setOnboarding] = useState<string | null>(null)
  const onboardingDialog = useRef<HTMLDialogElement>(null)
  const lessonsHeading = useRef<HTMLHeadingElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const reduced = useReducedMotion() ?? false
  useEffect(() => {
    const saved = loadLernkastenSelection(level)
    if (saved) setSelection(saved)
    setReady(true)
  }, [level]) // Persisted choice must not reset after each server refresh.
  useEffect(() => { if (ready) saveLernkastenSelection(level, selection) }, [level, ready, selection])
  useEffect(() => { if (onboarding) onboardingDialog.current?.showModal() }, [onboarding])
  useEffect(() => { setPreviousCardId(initialPreviousCardId) }, [initialPreviousCardId])
  const selectedCards = initialCards.filter(item => selection.includes(item.card.lesson))
  const due = selectedCards.length
  const selectedLessons = new Set(selectedCards.map(item => item.card.lesson)).size
  const dueElsewhere = initialCards.length - due
  // „{count} fällig" — dieselben Worte wie am Fach der Lernbox, die Zahl fett.
  const [duePrefix = '', dueSuffix = ''] = t('box_due_badge', { count: COUNT_SLOT }).split(COUNT_SLOT)

  function toggle(lesson: LessonStat) {
    if (selection.includes(lesson.lesson)) setSelection(selection.filter(entry => entry !== lesson.lesson))
    else if (!lesson.active && !lesson.learned && lesson.untouched) setOnboarding(lesson.lesson)
    else setSelection([...selection, lesson.lesson])
  }
  function selectAllDue() {
    setSelection(previous => [...new Set([...previous, ...dueByLesson.keys()])])
  }
  function showLessons() {
    document.getElementById(LESSONS_ID)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    lessonsHeading.current?.focus({ preventScroll: true })
  }
  async function initialize() {
    if (!learnerId || !onboarding || pending) return
    setPending(true)
    setError(false)
    const lesson = onboarding
    setSelection(previous => [...new Set([...previous, lesson])])
    try {
      const result = await initializeLesson(lesson, level, learnerId ?? undefined)
      if (!result.success) throw new Error('lesson_init_failed')
      setOnboarding(null)
      startRefresh(() => router.refresh())
    } catch {
      setSelection(previous => previous.filter(item => item !== lesson))
      setError(true)
    } finally { setPending(false) }
  }

  if (session) return <VocabCardSession key={learnerId} learnerId={learnerId} cards={session} translations={translations} softErrorTranslations={softErrorTranslations} uiLanguage={lang} previousCardId={previousCardId} initialDeferredCount={initialDeferredCount} overviewHref={overview}
    onBackToLernkasten={lastId => { setPreviousCardId(lastId); setSession(null); startRefresh(() => router.refresh()) }} />

  // Die eine Hauptaktion. Ist nichts fällig, tritt an ihre Stelle kein
  // ausgegrauter Knopf, sondern eine klare Auskunft mit dem nächsten Schritt.
  const action = due > 0
    ? <div className="flex flex-col items-center gap-3">
        <motion.button type="button" disabled={refreshing} onClick={() => setSession(selectedCards)} className="lb-cta"
          whileHover={reduced ? undefined : { y: -2 }} whileTap={reduced ? undefined : { scale: 0.98 }}>
          <span className="lb-cta__icon" aria-hidden="true"><ArrowRight size={24} strokeWidth={2.75} /></span>
          <span>{due === 1 ? t('lernkasten_start_count_one') : t('lernkasten_start_count', { count: due })}</span>
        </motion.button>
        <p className="text-center text-base text-[var(--muted)]">
          {selectedLessons === 1 ? t('lernkasten_from_lessons_one') : t('lernkasten_from_lessons', { count: selectedLessons })}
        </p>
      </div>
    : <div className="lb-done" role="status">
        <p className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
          <CircleCheckBig size={22} aria-hidden="true" className="shrink-0 text-[var(--success)]" />
          {dueElsewhere > 0 ? t('lernkasten_due_elsewhere', { count: dueElsewhere }) : t('lernkasten_all_done_hint')}
        </p>
        {dueElsewhere > 0
          ? <button type="button" onClick={selectAllDue} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 text-base font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-strong-hover)]">
              <Sparkles size={18} aria-hidden="true" />{t('lernkasten_select_all')}
            </button>
          : <button type="button" onClick={showLessons} className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface)] px-5 text-base font-semibold text-[var(--foreground)] hover:border-[var(--accent)]">
              {t('lernkasten_choose_lessons')}<ArrowDown size={18} aria-hidden="true" />
            </button>}
      </div>

  return <div className="mx-auto w-full max-w-5xl space-y-10 text-[var(--foreground)]">
    <section className="sl-glass sl-hero px-4 py-6 [--lb-bleed:0.75rem] sm:p-8 sm:[--lb-bleed:0px]" aria-label={t('lernkasten_title')}>
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

    <section id={LESSONS_ID} aria-labelledby={`${LESSONS_ID}-title`} className="scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`${LESSONS_ID}-title`} ref={lessonsHeading} tabIndex={-1} className="text-2xl font-semibold outline-none">{t('lessons_title')}</h2>
          <p className="mt-1 max-w-prose text-base leading-relaxed text-[var(--muted)]">{t('lessons_hint')}</p>
        </div>
        {dueByLesson.size > 0 && <button type="button" onClick={selectAllDue}
          className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-[var(--border)] px-5 text-base font-semibold text-[var(--accent-text)] hover:border-[var(--accent)]">
          <Sparkles size={18} aria-hidden="true" />{t('lernkasten_select_all')}
        </button>}
      </div>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {lessonStats.map((lesson, index) => {
          const selected = selection.includes(lesson.lesson)
          const lessonDue = dueByLesson.get(lesson.lesson) ?? 0
          const learnedPercent = lesson.total ? Math.round(lesson.learned / lesson.total * 100) : 0
          return <motion.article key={lesson.lesson} data-selected={selected} className="sl-card flex min-w-0 flex-col gap-4 p-5 sm:p-6"
            initial={reduced ? false : { opacity: 0, y: 12 }} animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: reduced ? 0 : Math.min(index, 7) * 0.04 }}>
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <div className="min-w-0">
                <h3 className="break-words text-xl font-semibold">{lesson.lesson}</h3>
                <p className="mt-1 flex flex-wrap gap-x-2 text-base text-[var(--muted)]">
                  <span>{t('set_words_total', { count: lesson.total })}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('set_learned_share', { percent: learnedPercent })}</span>
                </p>
              </div>
              {/* Fällige Aufgaben sind der Grund, ein Set auszuwählen — sie
                  tragen deshalb Akzentfarbe, ein leeres Set bleibt ruhig. */}
              {lessonDue > 0
                ? <span className="shrink-0 rounded-full bg-[var(--accent)]/10 px-3 py-1 text-base font-semibold text-[var(--accent-text)]">{duePrefix}<b>{lessonDue}</b>{dueSuffix}</span>
                : <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-base text-[var(--muted)]">{t('lernkasten_no_due_badge')}</span>}
            </div>
            <div className="sl-bar h-2" data-tone="success" aria-hidden="true"><span style={{ width: `${learnedPercent}%` }} /></div>
            <button type="button" role="switch" aria-checked={selected} data-selected={selected} onClick={() => toggle(lesson)} className="lb-switch"
              aria-label={t('lernkasten_switch_aria', { lesson: lesson.lesson })}>
              <span className="lb-switch__track" aria-hidden="true">
                <span className="lb-switch__thumb">{selected && <Check size={16} strokeWidth={3} />}</span>
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-lg font-semibold leading-snug">{t(selected ? 'lernkasten_in_box' : 'lernkasten_not_in_box')}</span>
                <span className="text-sm text-[var(--muted)]">{t(selected ? 'lernkasten_tap_to_remove' : 'lernkasten_tap_to_add')}</span>
              </span>
            </button>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--border)] pt-2">
              <button type="button" onClick={() => setOpenLesson(lesson.lesson)} className="inline-flex min-h-12 items-center gap-2 text-base font-semibold"><BookOpen size={18} aria-hidden="true" />{t('show_cards')}</button>
              {lesson.untouched > 0 && <Link className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-[var(--accent-text)]" href={`${overview}/assess?lesson=${encodeURIComponent(lesson.lesson)}`}><ListChecks size={18} aria-hidden="true" />{t('assess_set')}</Link>}
            </div>
          </motion.article>
        })}
      </div>
      {lessonStats.length === 0 && <p className="py-10 text-lg text-[var(--muted)]">{t('no_sets')}</p>}
    </section>

    <details className="sl-glass rounded-2xl px-5 sm:px-7">
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 py-3 text-lg font-semibold"><BookOpen size={20} aria-hidden="true" className="text-[var(--accent-text)]" />{t('method_title')}</summary>
      <div className="space-y-3 border-t border-[var(--border)] py-5 text-base leading-relaxed text-[var(--muted)]">
        <p>{t('method_progress')}</p><p>{t('method_intervals')}</p><p>{t('method_learned')}</p><p>{t('method_assessment')}</p>
      </div>
    </details>

    {onboarding && <dialog ref={onboardingDialog} onCancel={event => { event.preventDefault(); if (!pending) setOnboarding(null) }} aria-labelledby="onboarding-title" className="w-[calc(100%_-_2rem)] max-h-[calc(100dvh_-_2rem)] overflow-y-auto overscroll-contain max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7 text-[var(--foreground)] backdrop:bg-black/50">
        <h2 id="onboarding-title" className="text-2xl font-semibold">{t('onboarding_choice_title')}</h2><p className="mt-3 text-lg text-[var(--muted)]">{t('onboarding_choice_hint')}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" disabled={pending} onClick={() => router.push(`${overview}/assess?lesson=${encodeURIComponent(onboarding)}`)} className="flex min-h-14 items-center justify-center rounded-2xl bg-[var(--accent-strong)] p-3 text-center text-lg font-semibold text-[var(--accent-foreground)] disabled:opacity-60">{t('assess_set')}</button>
          <button type="button" onClick={() => void initialize()} disabled={pending} className="min-h-14 rounded-2xl border-2 border-[var(--border-strong)] p-3 text-lg font-semibold">{t('start_all_words')}</button>
          <button type="button" onClick={() => setOnboarding(null)} disabled={pending} className="min-h-12 rounded-2xl p-2 text-base">{t('cancel_selection')}</button>
        </div>
        <p role="status" className="mt-3 text-base">{error ? t('manual_add_failed') : pending ? t('saving_progress') : ''}</p>
    </dialog>}
    {openLesson && <LessonCardsModal lesson={openLesson} level={level} uiLanguage={lang} translations={translations} onClose={() => setOpenLesson(null)} onCardAdded={() => router.refresh()} />}
  </div>
}
