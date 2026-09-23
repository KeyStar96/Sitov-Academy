'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, BookOpenCheck, Check, CheckCircle2, ChevronRight, CloudOff, Loader2, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import FillInBlankExerciseCard, { type GrammarInputMode } from '@/components/exercises/FillInBlankExercise'
import MultipleChoiceExerciseCard from '@/components/exercises/MultipleChoiceExercise'
import { ArticleLegend, EndingsCard, exerciseUsesArticles, exerciseUsesConjugation } from '@/components/exercises/GrammarAids'
import LearningScreen, { LearningStats, type LearningScreenKey } from '@/components/vocabulary/LearningScreen'
import ProgressRing from '@/components/ui/ProgressRing'
import { finishExerciseSession, recordExerciseAttempt } from '@/app/actions/exercises'
import { createExerciseTranslator, type ExerciseTranslations } from '@/lib/exercise-i18n'
import { grammarTranslator } from '@/lib/grammar-i18n'
import { createGrammarSession, groupGrammarTopics } from '@/lib/grammar-session'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { ConfirmedExerciseAttempt, RecordExerciseAttemptInput, StudentExercise } from '@/lib/types/exercise'

const INPUT_MODE_KEY = 'sitov:grammar-input'

function loadInputMode(): GrammarInputMode {
  try { return window.localStorage.getItem(INPUT_MODE_KEY) === 'typing' ? 'typing' : 'tiles' } catch { return 'tiles' }
}

interface ExerciseClientProps {
  exercises: StudentExercise[]
  translations?: ExerciseTranslations
  lang: string
  level: string
  /** Rahmen-Texte des Lernbildschirms (Theme-Knopf, Fortschritt); ohne sie gelten die deutschen Standardtexte. */
  learningLabels?: Partial<Record<LearningScreenKey, string>>
}

const DEFAULT_LEARNING_LABELS: Record<LearningScreenKey, string> = {
  exit_learning: 'Zurück', theme_light: 'Helles Design', theme_dark: 'Dunkles Design', overall_progress_label: 'Fortschritt',
}

/**
 * Grammatikstudio: ein Themenregal mit Fortschrittsringen und — wie bei den
 * Vokabeln — ein fokussierter Lernbildschirm für die Übung selbst. Große
 * Knöpfe, Fortschrittsband oben, Kärtchen statt Tastatur als Standard, und
 * je nach Thema anschauliche Hilfen (Artikelfarben, Endungs-Tabelle).
 */
export default function ExerciseClient({ exercises, translations = {}, lang, level, learningLabels }: ExerciseClientProps) {
  const [library, setLibrary] = useState(exercises)
  const [session, setSession] = useState<StudentExercise[] | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [saveFailed, setSaveFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingAttempt, setPendingAttempt] = useState<RecordExerciseAttemptInput | null>(null)
  const [confirmedAttempt, setConfirmedAttempt] = useState<(ConfirmedExerciseAttempt & { exerciseId: string }) | null>(null)
  const [inputMode, setInputMode] = useState<GrammarInputMode>('tiles')
  const savingRef = useRef(false)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const t = useMemo(() => createExerciseTranslator(translations), [translations])
  const g = useMemo(() => grammarTranslator(lang), [lang])
  const s = useMemo(() => studentTranslator(lang), [lang])
  const reduced = useReducedMotion() ?? false
  const topics = useMemo(() => groupGrammarTopics(library), [library])
  const completed = library.filter(exercise => exercise.completed).length
  const allSolved = library.length > 0 && completed === library.length
  const currentExercise = session?.[currentIndex]
  const headingRef = useRef<HTMLHeadingElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const labels = { ...DEFAULT_LEARNING_LABELS, ...learningLabels }

  useEffect(() => { setInputMode(loadInputMode()) }, [])

  useEffect(() => {
    if (!session || !headingRef.current) return
    // Jede neue Aufgabe beginnt oben im Arbeitsbereich; der Fokus springt auf
    // ihre Überschrift, damit Screenreader die neue Aufgabe vorlesen. Ein
    // Effekt (kein Layout-Effekt), damit er nach dem Lernbildschirm läuft,
    // der beim Öffnen sich selbst fokussiert.
    headingRef.current.focus({ preventScroll: true })
    workspaceRef.current?.scrollTo?.({ top: 0, behavior: reduced ? 'instant' : 'smooth' })
  }, [session, currentIndex, reduced])

  const startSession = useCallback((topic?: string, review = false) => {
    const next = createGrammarSession(library, { topic, review })
    setSession(next)
    setCurrentIndex(0)
    setConfirmedAttempt(null)
    setPendingAttempt(null)
    setSaveFailed(false)
  }, [library])

  const saveAttempt = useCallback((input: RecordExerciseAttemptInput) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveFailed(false)
    setPendingAttempt(null)
    setConfirmedAttempt(null)
    saveQueue.current = (async () => {
      try {
        const result = await recordExerciseAttempt(input)
        if (!result.success) {
          setSaveFailed(true)
          setPendingAttempt(input)
          return
        }
        setConfirmedAttempt({ exerciseId: input.exerciseId, answer: input.answer, result })
        setLibrary(previous => previous.map(exercise => exercise.id === input.exerciseId
          ? { ...exercise, completed: exercise.completed || result.isCorrect, attempts: result.attempts, score: result.score } : exercise))
      } catch {
        setSaveFailed(true)
        setPendingAttempt(input)
      } finally {
        savingRef.current = false
        setSaving(false)
      }
    })()
  }, [])

  const handleAttempt = useCallback((exerciseId: string, hintShown: boolean, answer: string) => {
    saveAttempt({ exerciseId, answer, hintShown })
  }, [saveAttempt])

  const retrySave = () => {
    if (pendingAttempt) saveAttempt(pendingAttempt)
  }

  const handleNext = useCallback(() => {
    if (savingRef.current || !confirmedAttempt?.result.isCorrect || confirmedAttempt.exerciseId !== currentExercise?.id) return
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    setConfirmedAttempt(null)
    if (session && nextIndex >= session.length) {
      void saveQueue.current.then(async () => {
        try { await finishExerciseSession(level) } catch { setSaveFailed(true) }
      })
    }
  }, [confirmedAttempt, currentExercise?.id, currentIndex, level, session])

  function changeInputMode(mode: GrammarInputMode) {
    setInputMode(mode)
    try { window.localStorage.setItem(INPUT_MODE_KEY, mode) } catch { /* nur Bequemlichkeit */ }
  }

  const notices = <>
    {/* Async save updates must not move the exercise while it is being read. */}
    {saveFailed && <div role="status" className="st-grammar-notice">
      <CloudOff className="shrink-0" size={20} aria-hidden="true" />
      <span>{g('saveFailed')}</span>
      {pendingAttempt && <button type="button" disabled={saving} onClick={retrySave} className="st-button st-button--soft st-press">{t('error_retry')}</button>}
    </div>}
    {saving && <p role="status" className="st-grammar-notice"><Loader2 size={18} className="animate-spin" aria-hidden="true" />{g('saving')}</p>}
  </>

  if (library.length === 0) {
    return <div className="st-empty st-empty--hero">
      <BookOpenCheck className="mx-auto text-[var(--violet)]" size={38} aria-hidden="true" />
      <h2>{t('no_exercises')}</h2><p>{t('no_exercises_hint')}</p>
    </div>
  }

  return (
    <section className="space-y-8 text-[var(--foreground)]">
      <div className="st-path-hero sl-glass sl-hero">
        <div className="relative">
          <p className="st-eyebrow !mt-0">{s('areas_level', { level })}</p>
          <div className="st-path-hero__row">
            <div className="min-w-0 flex-1">
              <h1 className="st-path-hero__title">{g('title')}</h1>
              <p className="st-path-hero__text">{allSolved ? g('noOpen') : g('sessionHint')}</p>
            </div>
            <ProgressRing value={completed / library.length} size={84} stroke={8} tone={allSolved ? 'success' : 'accent'}
              label={s('grammar_ring', { done: completed, total: library.length })}>
              <strong className="text-xl font-extrabold tabular-nums">{completed}</strong>
              <small className="text-sm font-semibold text-[var(--muted)]">/ {library.length}</small>
            </ProgressRing>
          </div>
          <button type="button" onClick={() => startSession(undefined, allSolved)} className="st-cta st-press w-full text-left"
            aria-labelledby="grammar-start-label" aria-describedby="grammar-start-hint">
            <span className="st-cta__text">
              <span id="grammar-start-label" className="st-cta__label">{allSolved ? g('repeat') : g('start')}</span>
              <span id="grammar-start-hint" className="st-cta__hint">{g('open', { count: library.length - completed })} · {g('topics')}: {topics.length}</span>
            </span>
            <span className="st-cta__arrow" aria-hidden="true">{allSolved ? <RotateCcw size={22} /> : <ArrowRight size={24} />}</span>
          </button>
        </div>
      </div>

      <section aria-labelledby="grammar-topics-title">
        <div className="st-section-head">
          <div><h2 id="grammar-topics-title" className="st-section-title">{s('grammar_topics')}</h2>
            <p className="st-section-sub">{g('open', { count: library.length - completed })}</p></div>
        </div>
        <ul className="st-topics">
          {topics.map((topic, index) => {
            const done = topic.completed === topic.total
            return (
              <li key={topic.name} className="st-rise" style={{ '--i': Math.min(index, 8) } as CSSProperties}>
                <button type="button" className="st-topic st-press" data-done={done} onClick={() => startSession(topic.name, done)}
                  aria-label={`${topic.name}: ${done ? g('review') : g('practice')}`}>
                  <span className="st-topic__numeral" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <ProgressRing value={topic.completed / topic.total} size={56} stroke={6} tone={done ? 'success' : 'accent'}>
                    {done ? <Check size={22} strokeWidth={3} className="text-[var(--success)]" aria-hidden="true" />
                      : <span className="text-sm font-extrabold tabular-nums">{topic.completed}/{topic.total}</span>}
                  </ProgressRing>
                  <span className="st-topic__body">
                    <span className="st-topic__name">{topic.name}</span>
                    <span className="st-topic__status">{done ? s('grammar_solved') : g('topicProgress', { done: topic.completed, total: topic.total })}</span>
                  </span>
                  <ChevronRight size={20} aria-hidden="true" className="st-topic__chevron" />
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      {!session && notices}

      {session && (
        <LearningScreen title={s('grammar_title')} t={key => labels[key]}
          progress={session.length ? (currentIndex / session.length) * 100 : 100} onExit={() => setSession(null)} exitDisabled={saving}
          workspaceRef={workspaceRef}>
          {!currentExercise ? (
            <div className="learning-card learning-complete" aria-live="polite">
              <ProgressRing value={1} size={104} stroke={9} tone="success">
                <CheckCircle2 size={44} className="text-[var(--success)]" aria-hidden="true" />
              </ProgressRing>
              <h2 ref={headingRef} tabIndex={-1}>{g('finished')}</h2>
              <p>{g('finishedHint', { count: session.length })}</p>
              <button type="button" onClick={() => setSession(null)} className="learning-button learning-button-primary learning-button-wide">
                {g('back')}<ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          ) : <>
            <div className="learning-meta">
              <div className="learning-meta-pills"><span className="learning-pill">{currentExercise.topic}</span></div>
              <LearningStats label={t('progress_label', { current: currentIndex + 1, total: session.length })}
                items={[{ label: s('grammar_task'), value: `${currentIndex + 1}/${session.length}` }]} />
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={currentExercise.id} className="st-grammar-card"
                initial={reduced ? false : { opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: -28 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
                <h2 ref={headingRef} tabIndex={-1} className="sr-only">{currentExercise.topic}</h2>
                {exerciseUsesArticles(currentExercise) && <ArticleLegend lang={lang} />}
                {currentExercise.type === 'fill_in_blank'
                  ? <FillInBlankExerciseCard key={currentExercise.id} exercise={currentExercise} t={t} lang={lang}
                      attempt={confirmedAttempt?.exerciseId === currentExercise.id ? confirmedAttempt : undefined} submitting={saving} softErrorTranslations={translations.soft_error}
                      nextLabel={currentIndex + 1 >= session.length ? g('finish') : t('next_exercise')}
                      inputMode={inputMode} onInputModeChange={changeInputMode}
                      onAttempt={(hint, answer) => handleAttempt(currentExercise.id, hint, answer)} onNext={handleNext} />
                  : <MultipleChoiceExerciseCard key={currentExercise.id} exercise={currentExercise} t={t} lang={lang}
                      attempt={confirmedAttempt?.exerciseId === currentExercise.id ? confirmedAttempt : undefined} submitting={saving} softErrorTranslations={translations.soft_error}
                      nextLabel={currentIndex + 1 >= session.length ? g('finish') : t('next_exercise')}
                      onAttempt={(hint, answer) => handleAttempt(currentExercise.id, hint, answer)} onNext={handleNext} />}
                {exerciseUsesConjugation(currentExercise) && (
                  <div className="px-5 pb-5 sm:px-10 sm:pb-8">
                    <EndingsCard lang={lang} sentence={currentExercise.type === 'fill_in_blank' ? currentExercise.content.text_before : currentExercise.content.question} />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </>}
          {notices}
        </LearningScreen>
      )}
    </section>
  )
}
