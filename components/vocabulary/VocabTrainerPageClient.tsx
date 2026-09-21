'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, BookOpen, Check, ListChecks, Plus, Sparkles } from 'lucide-react'
import { initializeLesson } from '@/app/actions/vocabulary'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { loadLernkastenSelection, saveLernkastenSelection } from '@/lib/vocabulary-lernkasten'
import type { DueVocabularyCard, LessonStat, VocabularyBoxSummary } from '@/lib/types/vocabulary'
import { stripLessonPrefix } from '@/lib/utils'
import type { SoftErrorReason } from '@/lib/answer-grading'
import VocabCardSession from './VocabCardSession'
import LessonCardsModal from './LessonCardsModal'
import LeitnerBoxOverview from './LeitnerBoxOverview'
import './lernkasten.css'

const EASE = [0.22, 1, 0.36, 1] as const

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

export default function VocabTrainerPageClient({ learnerId, initialCards, lessonStats, boxSummary, translations = {}, softErrorTranslations, lang, level, initialDeferredCount = 0, initialPreviousCardId = null }: Props) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const overview = `/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary`
  const [selection, setSelection] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<DueVocabularyCard[] | null>(null)
  const [previousCardId, setPreviousCardId] = useState<string | null>(initialPreviousCardId)
  const [openLesson, setOpenLesson] = useState<string | null>(null)
  const [onboarding, setOnboarding] = useState<string | null>(null)
  const onboardingDialog = useRef<HTMLDialogElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const reduced = useReducedMotion() ?? false
  const dueByLesson = useMemo(() => {
    const counts = new Map<string, number>()
    initialCards.forEach(item => counts.set(item.card.lesson, (counts.get(item.card.lesson) ?? 0) + 1))
    return counts
  }, [initialCards])
  useEffect(() => {
    const saved = loadLernkastenSelection(level)
    setSelection(saved ?? Array.from(dueByLesson.keys()))
    setReady(true)
  }, [level]) // Persisted choice must not reset after each server refresh.
  useEffect(() => { if (ready) saveLernkastenSelection(level, selection) }, [level, ready, selection])
  useEffect(() => { if (onboarding) onboardingDialog.current?.showModal() }, [onboarding])
  useEffect(() => { setPreviousCardId(initialPreviousCardId) }, [initialPreviousCardId])
  const selectedCards = initialCards.filter(item => selection.includes(item.card.lesson))

  function toggle(lesson: LessonStat) {
    if (selection.includes(lesson.lesson)) setSelection(selection.filter(entry => entry !== lesson.lesson))
    else if (!lesson.active && !lesson.learned && lesson.untouched) setOnboarding(lesson.lesson)
    else setSelection([...selection, lesson.lesson])
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

  return <div className="mx-auto w-full max-w-5xl space-y-8 text-[var(--foreground)]">
    <section className="vocab-glass vocab-hero p-5 sm:p-7" aria-label={t('lernkasten_title')}>
      <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-semibold text-[var(--muted)]">
            {selectedCards.length > 0 && <span className="vocab-due-dot" aria-hidden="true" />}
            {t('due_now')}
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
            <motion.span
              key={selectedCards.length}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="text-6xl font-semibold leading-none tracking-tighter tabular-nums"
            >{selectedCards.length}</motion.span>
            <span className="text-base text-[var(--muted)]">{t('due_tasks_label')}</span>
          </p>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-[var(--muted)]">
            {selectedCards.length ? t('lernkasten_summary', { lessons: selection.length, cards: selectedCards.length }) : t('lernkasten_start_hint_nothing_due')}
          </p>
        </div>
        <motion.button type="button" disabled={!ready || refreshing || selectedCards.length === 0} onClick={() => setSession(selectedCards)}
          whileHover={reduced ? undefined : { y: -2 }} whileTap={reduced ? undefined : { scale: 0.99 }}
          className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--accent-strong)] px-6 py-3 text-lg font-semibold text-[var(--accent-foreground)] shadow-[var(--shadow-md)] disabled:opacity-50 disabled:shadow-none sm:w-auto">
          {t('lernkasten_start')}<ArrowRight size={18} aria-hidden="true" />
        </motion.button>
      </div>
      {initialDeferredCount > 0 && <p className="relative mt-5 border-t border-[var(--border)] pt-4 text-base text-[var(--muted)]">{t('repetition_gap_hint')}</p>}
    </section>
    <LeitnerBoxOverview summary={boxSummary} level={level} uiLanguage={lang} translations={translations} />
    <details className="vocab-glass rounded-2xl px-5 sm:px-7">
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 py-3 font-semibold"><BookOpen size={18} aria-hidden="true" className="text-[var(--accent-text)]" />{t('method_title')}</summary>
      <div className="space-y-3 border-t border-[var(--border)] py-5 text-base leading-relaxed text-[var(--muted)]">
        <p>{t('method_progress')}</p><p>{t('method_intervals')}</p><p>{t('method_learned')}</p><p>{t('method_assessment')}</p>
      </div>
    </details>
    <section aria-label={t('your_sets')}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t('your_sets')}</h2>
        <button type="button" onClick={() => setSelection(Array.from(dueByLesson.keys()))}
          className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-base font-semibold text-[var(--accent-text)]">
          <Sparkles size={16} aria-hidden="true" />{t('lernkasten_select_all')}
        </button>
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {lessonStats.map((lesson, index) => {
          const selected = selection.includes(lesson.lesson)
          const due = dueByLesson.get(lesson.lesson) ?? 0
          const learnedPercent = lesson.total ? Math.round(lesson.learned / lesson.total * 100) : 0
          return <motion.article key={lesson.lesson} data-selected={selected} className="vocab-set-card min-w-0 p-4 pl-5 sm:p-5 sm:pl-6"
            initial={reduced ? false : { opacity: 0, y: 12 }} animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: reduced ? 0 : Math.min(index, 7) * 0.04 }}>
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-3">
              <div className="min-w-0">
                <h3 className="break-words text-lg font-semibold">{lesson.lesson}</h3>
                {/* Fällige Aufgaben sind der Grund, ein Set auszuwählen — sie
                    tragen deshalb Akzentfarbe, ein leeres Set bleibt ruhig. */}
                <p className="mt-1 text-base">
                  {due > 0
                    ? <><span className="font-semibold text-[var(--accent-text)]">{due}</span> <span className="text-[var(--muted)]">{t('due_tasks_label')} · {t('set_words_total', { count: lesson.total })}</span></>
                    : <span className="text-[var(--muted)]">{t('lernkasten_no_due_badge')} · {t('set_words_total', { count: lesson.total })}</span>}
                </p>
              </div>
              <button type="button" onClick={() => toggle(lesson)} data-selected={selected} className="vocab-chip shrink-0"
                aria-pressed={selected} aria-label={t(selected ? 'lernkasten_remove_aria' : 'lernkasten_add_aria', { lesson: lesson.lesson })}>
                {selected ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                {t(selected ? 'lernkasten_in_box' : 'set_add_short')}
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="vocab-set-bar min-w-0 flex-1" aria-hidden="true"><span style={{ width: `${learnedPercent}%` }} /></div>
              <span className="shrink-0 text-sm tabular-nums text-[var(--muted)]">{t('set_learned_share', { percent: learnedPercent })}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border)] pt-3">
              <button type="button" onClick={() => setOpenLesson(lesson.lesson)} className="inline-flex min-h-12 items-center gap-2 text-base font-semibold"><BookOpen size={16} aria-hidden="true" />{t('show_cards')}</button>
              {lesson.untouched > 0 && <Link className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-[var(--accent-text)]" href={`${overview}/assess?lesson=${encodeURIComponent(lesson.lesson)}`}><ListChecks size={16} aria-hidden="true" />{t('assess_set')}</Link>}
            </div>
          </motion.article>
        })}
      </div>
      {lessonStats.length === 0 && <p className="py-10 text-[var(--muted)]">{t('no_sets')}</p>}
    </section>
    {onboarding && <dialog ref={onboardingDialog} onCancel={event => { event.preventDefault(); if (!pending) setOnboarding(null) }} aria-labelledby="onboarding-title" className="w-[calc(100%_-_2rem)] max-h-[calc(100dvh_-_2rem)] overflow-y-auto overscroll-contain max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 text-[var(--foreground)] backdrop:bg-black/50">
        <h2 id="onboarding-title" className="text-2xl font-semibold">{t('onboarding_choice_title')}</h2><p className="mt-3 text-[var(--muted)]">{t('onboarding_choice_hint')}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" disabled={pending} onClick={() => router.push(`${overview}/assess?lesson=${encodeURIComponent(onboarding)}`)} className="flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent-strong)] p-3 text-center font-semibold text-[var(--accent-foreground)] disabled:opacity-60">{t('assess_set')}</button>
          <button type="button" onClick={() => void initialize()} disabled={pending} className="min-h-12 rounded-xl border border-[var(--border)] p-3 font-semibold">{t('start_all_words')}</button>
          <button type="button" onClick={() => setOnboarding(null)} disabled={pending} className="min-h-12 rounded-xl p-2 text-base">{t('cancel_selection')}</button>
        </div>
        <p role="status" className="mt-3 text-base">{error ? t('manual_add_failed') : pending ? t('saving_progress') : ''}</p>
    </dialog>}
    {openLesson && <LessonCardsModal lesson={openLesson} level={level} uiLanguage={lang} translations={translations} onClose={() => setOpenLesson(null)} onCardAdded={() => router.refresh()} />}
  </div>
}
