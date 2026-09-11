'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, CloudOff, Loader2, RotateCcw } from 'lucide-react'
import FillInBlankExerciseCard from '@/components/exercises/FillInBlankExercise'
import MultipleChoiceExerciseCard from '@/components/exercises/MultipleChoiceExercise'
import { finishExerciseSession, recordExerciseAttempt } from '@/app/actions/exercises'
import { createExerciseTranslator, type ExerciseTranslations } from '@/lib/exercise-i18n'
import { grammarTranslator } from '@/lib/grammar-i18n'
import { createGrammarSession, groupGrammarTopics } from '@/lib/grammar-session'
import type { StudentExercise } from '@/lib/types/exercise'
import styles from './GrammarStudio.module.css'

interface ExerciseClientProps {
  exercises: StudentExercise[]
  translations?: ExerciseTranslations
  lang: string
  level: string
}

export default function ExerciseClient({ exercises, translations = {}, lang, level }: ExerciseClientProps) {
  const [library, setLibrary] = useState(exercises)
  const [session, setSession] = useState<StudentExercise[] | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [saveFailed, setSaveFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingAttempts, setPendingAttempts] = useState<Array<{ exerciseId: string; answer: string; hintShown: boolean }>>([])
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const t = useMemo(() => createExerciseTranslator(translations), [translations])
  const g = useMemo(() => grammarTranslator(lang), [lang])
  const topics = useMemo(() => groupGrammarTopics(library), [library])
  const completed = library.filter(exercise => exercise.completed).length
  const currentExercise = session?.[currentIndex]
  const headingRef = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    if (!session || !headingRef.current) return

    // Focus alone does not reposition a heading that remains mounted between cards.
    // Measure the real header so wrapped breadcrumbs and larger text stay clear.
    const heading = headingRef.current
    const header = document.querySelector<HTMLElement>('.academy-student-header')
    const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0)
    heading.focus({ preventScroll: true })
    window.scrollTo({
      top: Math.max(0, window.scrollY + heading.getBoundingClientRect().top - headerBottom - 16),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }, [session, currentIndex])

  const startSession = useCallback((topic?: string, review = false) => {
    const next = createGrammarSession(library, { topic, review })
    setSession(next)
    setCurrentIndex(0)
  }, [library])

  const saveAttempt = useCallback((input: { exerciseId: string; answer: string; hintShown: boolean }) => {
    setSaving(true)
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const result = await recordExerciseAttempt(input)
        if (!result.success) {
          setSaveFailed(true)
          setPendingAttempts(previous => [...previous, input])
          return
        }
        if (result.isCorrect) setLibrary(previous => previous.map(exercise => exercise.id === input.exerciseId
          ? { ...exercise, completed: true, attempts: result.attempts } : exercise))
      } catch {
        setSaveFailed(true)
        setPendingAttempts(previous => [...previous, input])
      }
    })
    const currentQueue = saveQueue.current
    void currentQueue.finally(() => { if (saveQueue.current === currentQueue) setSaving(false) })
  }, [])

  const handleAttempt = useCallback((exerciseId: string, _isCorrect: boolean, hintShown: boolean, answer: string) => {
    saveAttempt({ exerciseId, answer, hintShown })
  }, [saveAttempt])

  const retrySave = () => {
    setPendingAttempts([])
    setSaveFailed(false)
    for (const input of pendingAttempts) saveAttempt(input)
  }

  const handleNext = useCallback(() => {
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    if (session && nextIndex >= session.length) {
      void saveQueue.current.then(async () => {
        try { await finishExerciseSession(level) } catch { setSaveFailed(true) }
      })
    }
  }, [currentIndex, level, session])

  return (
    <section className={styles.shell}>
      {!session && library.length > 0 && <div className={`${styles.stats} mb-6`}>
        <div className={styles.stat}><strong>{library.length}</strong><span>{g('total')}</span></div>
        <div className={styles.stat}><strong>{topics.length}</strong><span>{g('topics')}</span></div>
        <div className={styles.stat}><strong>{completed}</strong><span>{g('solved')}</span></div>
      </div>}

      {library.length === 0 ? <div className={styles.empty}>
        <BookOpenCheck className="mx-auto text-[var(--violet)]" size={38} aria-hidden="true" />
        <h2>{t('no_exercises')}</h2><p>{t('no_exercises_hint')}</p>
      </div> : !session ? <>
        <div className={styles.sessionBanner}>
          <div><h2>{g('session')}</h2><p>{completed === library.length ? g('noOpen') : g('sessionHint')}</p></div>
          <div className={styles.actions}>
            <button type="button" onClick={() => startSession(undefined, completed === library.length)} className="academy-button academy-button-primary">
              {completed === library.length ? <RotateCcw size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
              {completed === library.length ? g('repeat') : g('start')}
            </button>
          </div>
        </div>
        <div className={styles.sectionHeading}><h2>{g('library')}</h2><span className="text-base text-[var(--muted)]">{g('open', { count: library.length - completed })}</span></div>
        <div className={styles.grid}>
          {topics.map((topic, index) => <button type="button" key={topic.name} className={styles.topicCard} onClick={() => startSession(topic.name, topic.completed === topic.total)} aria-label={`${topic.name}: ${topic.completed === topic.total ? g('review') : g('practice')}`}>
            <span className={styles.topicTop}><span className={styles.topicNumber}>{String(index + 1).padStart(2, '0')}</span><span>{topic.completed === topic.total ? <CheckCircle2 size={20} aria-hidden="true" /> : g('open', { count: topic.total - topic.completed })}</span></span>
            <h3>{topic.name}</h3>
            <span className={styles.topicFooter}><span>{g('topicProgress', { done: topic.completed, total: topic.total })}</span><ArrowRight size={19} aria-hidden="true" /></span>
            <span className={styles.progress} aria-hidden="true"><span style={{ width: `${topic.completed / topic.total * 100}%` }} /></span>
          </button>)}
        </div>
      </> : !currentExercise ? <div className={styles.empty}>
        <CheckCircle2 size={44} className="mx-auto text-[var(--violet)]" aria-hidden="true" />
        <h2 ref={headingRef} tabIndex={-1}>{g('finished')}</h2><p>{g('finishedHint', { count: session.length })}</p>
        <button type="button" onClick={() => setSession(null)} className="academy-button academy-button-primary">{g('back')}<ArrowRight size={18} aria-hidden="true" /></button>
      </div> : <>
        <button type="button" onClick={() => setSession(null)} className="academy-button academy-button-secondary mb-4"><ArrowLeft size={18} aria-hidden="true" />{g('back')}</button>
        <div className={styles.practice}>
          <header className={styles.practiceHeader}>
            <div className={styles.practiceMeta}><h2 ref={headingRef} tabIndex={-1} className="font-medium">{currentExercise.topic}</h2><span>{t('progress_label', { current: currentIndex + 1, total: session.length })}</span></div>
            <div className={styles.progress} role="progressbar" aria-valuenow={currentIndex} aria-valuemin={0} aria-valuemax={session.length} aria-label={t('completed_count')}><span style={{ width: `${currentIndex / session.length * 100}%` }} /></div>
          </header>
          {currentExercise.type === 'fill_in_blank' ? <FillInBlankExerciseCard key={currentExercise.id} exercise={currentExercise} t={t} lang={lang}
            nextLabel={currentIndex + 1 >= session.length ? g('finish') : t('next_exercise')}
            onAttempt={(correct, hint, answer) => handleAttempt(currentExercise.id, correct, hint, answer)} onNext={handleNext} />
            : <MultipleChoiceExerciseCard key={currentExercise.id} exercise={currentExercise} t={t} lang={lang}
              nextLabel={currentIndex + 1 >= session.length ? g('finish') : t('next_exercise')}
              onAttempt={(correct, hint, answer) => handleAttempt(currentExercise.id, correct, hint, answer)} onNext={handleNext} />}
        </div>
      </>}
      {/* Async save updates must not move the exercise while it is being read. */}
      {saveFailed && <div role="status" className={styles.notice}>
        <CloudOff className="shrink-0" size={20} aria-hidden="true" />
        <span>{g('saveFailed')}</span>
        {pendingAttempts.length > 0 && <button type="button" disabled={saving} onClick={retrySave} className="academy-button academy-button-secondary">{t('error_retry')}</button>}
      </div>}
      {saving && <p role="status" className={styles.notice}><Loader2 size={18} className="animate-spin" aria-hidden="true" />{g('saving')}</p>}
    </section>
  )
}
