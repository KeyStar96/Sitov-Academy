'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, BookOpen, Check, Plus } from 'lucide-react'
import { initializeLesson } from '@/app/actions/vocabulary'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { loadLernkastenSelection, saveLernkastenSelection } from '@/lib/vocabulary-lernkasten'
import type { DueVocabularyCard, LessonStat } from '@/lib/types/vocabulary'
import { stripLessonPrefix } from '@/lib/utils'
import VocabCardSession from './VocabCardSession'
import LessonCardsModal from './LessonCardsModal'

interface Props {
  learnerId: string | null
  initialCards: DueVocabularyCard[]
  lessonStats: LessonStat[]
  translations?: VocabularyTranslations
  lang: string
  level: string
  initialDeferredCount?: number
  initialPreviousCardId?: string | null
}

export default function VocabTrainerPageClient({ learnerId, initialCards, lessonStats, translations = {}, lang, level, initialDeferredCount = 0, initialPreviousCardId = null }: Props) {
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
      router.push(`${overview}/train?lesson=${encodeURIComponent(lesson)}`)
    } catch {
      setSelection(previous => previous.filter(item => item !== lesson))
      setError(true)
    } finally { setPending(false) }
  }

  if (session) return <VocabCardSession key={learnerId} learnerId={learnerId} cards={session} translations={translations} uiLanguage={lang} previousCardId={previousCardId} initialDeferredCount={initialDeferredCount} overviewHref={overview}
    onBackToLernkasten={lastId => { setPreviousCardId(lastId); setSession(null); startRefresh(() => router.refresh()) }} />

  return <div className="mx-auto w-full max-w-5xl space-y-8 text-[var(--foreground)]">
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7" aria-label={t('lernkasten_title')}>
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div><p className="text-base text-[var(--muted)]">{t('due_now')}</p><p className="mt-1 text-5xl font-semibold tracking-tighter tabular-nums">{selectedCards.length}</p></div>
        <button type="button" disabled={!ready || refreshing || selectedCards.length === 0} onClick={() => setSession(selectedCards)}
          className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] disabled:opacity-50 sm:w-auto">
          {t('lernkasten_start')}<ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-5 border-t border-[var(--border)] pt-4 text-base leading-relaxed text-[var(--muted)]">{selectedCards.length ? t('lernkasten_summary', { lessons: selection.length, cards: selectedCards.length }) : t('lernkasten_start_hint_nothing_due')}</p>
      {initialDeferredCount > 0 && <p className="mt-2 text-base text-[var(--muted)]">{t('repetition_gap_hint')}</p>}
    </section>
    <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 sm:px-7">
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 py-3 font-semibold"><BookOpen size={18} aria-hidden="true" />{t('method_title')}</summary>
      <div className="space-y-3 border-t border-[var(--border)] py-5 text-base leading-relaxed text-[var(--muted)]">
        <p>{t('method_progress')}</p><p>{t('method_intervals')}</p><p>{t('method_learned')}</p><p>{t('method_assessment')}</p>
      </div>
    </details>
    <section aria-label={t('your_sets')}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">{t('your_sets')}</h2>
        <button type="button" onClick={() => setSelection(Array.from(dueByLesson.keys()))} className="min-h-12 rounded-xl px-3 text-base font-semibold text-[var(--accent)]">{t('lernkasten_select_all')}</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {lessonStats.map(lesson => <article key={lesson.lesson} className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-base text-[var(--muted)]">{t('lesson_label', { lesson: stripLessonPrefix(lesson.lesson) })}</p><h3 className="mt-1 break-words text-lg font-semibold">{lesson.lesson}</h3></div>
            <button type="button" onClick={() => toggle(lesson)} aria-pressed={selection.includes(lesson.lesson)} aria-label={t(selection.includes(lesson.lesson) ? 'lernkasten_remove_aria' : 'lernkasten_add_aria', { lesson: lesson.lesson })}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--accent)]">{selection.includes(lesson.lesson) ? <Check size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}</button>
          </div>
          <p className="mt-3 text-base text-[var(--muted)]">{t('lernkasten_lesson_meta', { due: dueByLesson.get(lesson.lesson) ?? 0, total: lesson.total })}</p>
          <div className="mt-4 h-1 rounded-full bg-[var(--surface-muted)]" aria-hidden="true"><div className="h-full rounded-full bg-[var(--violet)]" style={{ width: `${lesson.total ? lesson.learned / lesson.total * 100 : 0}%` }} /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpenLesson(lesson.lesson)} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-base font-semibold"><BookOpen size={16} aria-hidden="true" />{t('show_cards')}</button>
            {lesson.untouched > 0 && <Link className="inline-flex min-h-12 items-center rounded-xl px-2 text-base font-semibold text-[var(--accent)]" href={`${overview}/assess?lesson=${encodeURIComponent(lesson.lesson)}`}>{t('assess_set')}</Link>}
          </div>
        </article>)}
      </div>
      {lessonStats.length === 0 && <p className="py-10 text-[var(--muted)]">{t('no_sets')}</p>}
    </section>
    {onboarding && <dialog ref={onboardingDialog} onCancel={event => { event.preventDefault(); if (!pending) setOnboarding(null) }} aria-labelledby="onboarding-title" className="w-[calc(100%_-_2rem)] max-h-[calc(100dvh_-_2rem)] overflow-y-auto overscroll-contain max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 text-[var(--foreground)] backdrop:bg-black/50">
        <h2 id="onboarding-title" className="text-2xl font-semibold">{t('onboarding_choice_title')}</h2><p className="mt-3 text-[var(--muted)]">{t('onboarding_choice_hint')}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" disabled={pending} onClick={() => router.push(`${overview}/assess?lesson=${encodeURIComponent(onboarding)}`)} className="flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] p-3 text-center font-semibold text-[var(--accent-foreground)] disabled:opacity-60">{t('assess_set')}</button>
          <button type="button" onClick={() => void initialize()} disabled={pending} className="min-h-12 rounded-xl border border-[var(--border)] p-3 font-semibold">{t('start_all_words')}</button>
          <button type="button" onClick={() => setOnboarding(null)} disabled={pending} className="min-h-12 rounded-xl p-2 text-base">{t('cancel_selection')}</button>
        </div>
        <p role="status" className="mt-3 text-base">{error ? t('manual_add_failed') : pending ? t('saving_progress') : ''}</p>
    </dialog>}
    {openLesson && <LessonCardsModal lesson={openLesson} level={level} translations={translations} onClose={() => setOpenLesson(null)} onCardAdded={() => router.refresh()} />}
  </div>
}
