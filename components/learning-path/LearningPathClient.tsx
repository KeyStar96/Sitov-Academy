'use client'

import { modeHref } from '@/lib/mode-targets'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCheck, CircleCheck, ListChecks, Play, RotateCcw, Target, Trophy } from 'lucide-react'
import { getLearningPath, startLearningNode, submitLearningAnswer, startLearningTest, saveLearningTestAnswer, finishLearningTest, getLearningTestReview } from '@/app/actions/learning-path'
import type { PathAnswer, PathMap, PathNode, PracticeRun, PracticeResult, PathTest, TestResult, TestReview as TestReviewData, PathGrade } from '@/lib/learning-path-contract'
import { pathErrorText, pathTranslator } from '@/lib/learning-path-i18n'
import { OrthographyNote } from '@/components/exercises/SoftErrorBadge'
import FeedbackMotion from '@/components/motion/FeedbackMotion'
import { useLearningNew } from '@/components/dashboard/useLearningNew'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { LearningNewItems } from '@/lib/learning-new'
import LearningScreen from '@/components/vocabulary/LearningScreen'
import BottomSheet from '@/components/ui/BottomSheet'
import RuleCard from './RuleCard'
import PathExerciseForm from './PathExerciseForm'
import PathTrail from './PathTrail'
import TestOutcome from './TestOutcome'
import TestReview from './TestReview'
import styles from './learning-path.module.css'

type Selection = { node: PathNode; title: string; pathId: string }
type Review = TestResult & Pick<Partial<TestReviewData>, 'completed_at'>

/** Übersetzungshilfe bleibt für die nächsten Aufgaben offen oder zu (nur Bequemlichkeit). */
const TRANSLATION_KEY = 'sitov:path-translation'

/** Der letzte abgeschlossene Versuch eines Tests (Liste kommt neueste zuerst). */
function lastCompleted(node: PathNode) {
  return node.kind === 'test' ? node.tests.find(attempt => attempt.status === 'completed' && attempt.percentage !== null) : undefined
}

function GradeFeedback({ grade, solution, lang, isTest = false }: { grade: PathGrade; solution: PracticeResult['solution']; lang: string; isTest?: boolean }) {
  const t = pathTranslator(lang)
  return <FeedbackMotion correct={grade.correct} className={styles.feedback}>
    <p className={`${styles.instruction} ${styles.verdict}`} data-correct={grade.correct} role="status">
      {grade.correct ? <CircleCheck size={28} aria-hidden="true" /> : <RotateCcw size={26} aria-hidden="true" />}
      <span>{t(grade.correct ? 'correct' : isTest ? 'incorrect_test' : 'incorrect')}</span>
    </p>
    {grade.fields.map(field => <div key={field.id}>
      {field.reason && <p>{t(field.reason)}</p>}
      {field.hint && <OrthographyNote lang={lang} solution={field.matched ?? solution.content.correct_answer} />}
    </div>)}
    <p><strong>{t('solution')}: </strong><span lang="de" translate="no">{solution.content.correct_answer}</span></p>
    {solution.explanation && <p>{solution.explanation}</p>}
  </FeedbackMotion>
}

export default function LearningPathClient({ initialPath, initialError, lang, level, newItems }: {
  initialPath?: PathMap; initialError?: string; lang: string; level: string
  /** Neue Pfade und Zweige (Phase 6.1); der Pfad gilt als gesehen, sobald einer seiner Knoten geöffnet wird. */
  newItems?: LearningNewItems
}) {
  const t = pathTranslator(lang)
  const newLabel = studentTranslator(lang)('media_new')
  const news = useLearningNew(newItems)
  const [map, setMap] = useState(initialPath)
  const [error, setError] = useState(initialError ?? null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [run, setRun] = useState<PracticeRun | null>(null)
  const [test, setTest] = useState<PathTest | null>(null)
  const [cardShown, setCardShown] = useState(false)
  const [feedback, setFeedback] = useState<PracticeResult | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [choice, setChoice] = useState<Selection | null>(null)
  const [translationOpen, setTranslationOpen] = useState(false)
  const [step, setStep] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const workspace = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const pending = useRef<{ key: string; requestId: string } | null>(null)
  const exercise = run ? run.exercises.find(item => item.id === run.queue[0])
    : test?.exercises.find(item => item.answer === null)
  const selectedPath = map?.paths.find(path => path.id === selection?.pathId)
  const pathNodes = selectedPath?.nodes ?? []
  const view = !selection ? 'map' : review ? 'review' : cardShown ? 'rule' : feedback ? 'feedback' : testResult ? 'result' : exercise?.id ?? 'finish'

  useEffect(() => {
    try { setTranslationOpen(window.localStorage.getItem(TRANSLATION_KEY) === 'open') } catch { /* nur Bequemlichkeit */ }
  }, [])

  function toggleTranslation() {
    setTranslationOpen(previous => {
      try { window.localStorage.setItem(TRANSLATION_KEY, previous ? 'closed' : 'open') } catch { /* nur Bequemlichkeit */ }
      return !previous
    })
  }

  useEffect(() => {
    // Zurück auf der Karte bleibt die Stelle, an der man war.
    if (view === 'map') { heading.current?.focus({ preventScroll: true }); return }
    // Jeder neue Schritt beginnt oben im Vollbild. Ein autofokussiertes Eingabefeld behält den Fokus.
    workspace.current?.scrollTo({ top: 0 })
    const target = view === 'feedback' ? feedbackRef.current : stage.current
    if (!target?.contains(document.activeElement)) target?.focus({ preventScroll: true })
  }, [view])

  async function perform(task: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true); setError(null)
    try { await task() } catch { setError('request_failed') }
    finally { busyRef.current = false; setBusy(false) }
  }

  async function refreshMap() {
    const result = await getLearningPath(level, lang)
    if (result.error) { setError(result.error); return }
    setMap(result.data); setSelection(null); setRun(null); setTest(null); setFeedback(null); setTestResult(null); setReview(null)
    pending.current = null
    news.flush()
  }

  function openNode(node: PathNode, title: string, pathId: string, start = false) {
    // Ein schon absolvierter Test: erst fragen — Auswertung ansehen oder erneut starten.
    if (!start && lastCompleted(node)) { setError(null); setChoice({ node, title, pathId }); return }
    setChoice(null)
    void perform(async () => {
      if (node.kind === 'test') {
        const result = await startLearningTest(node.id, lang)
        if (result.error) { setError(result.error); return }
        setTest(result.data); setRun(null); setCardShown(false)
      } else {
        const result = await startLearningNode(node.id, lang)
        if (result.error) { setError(result.error); return }
        setRun(result.data); setTest(null); setCardShown(Boolean(result.data.merkkarte))
      }
      setSelection({ node, title, pathId }); setFeedback(null); setTestResult(null); setReview(null); setStep(0); pending.current = null
      // Erst wenn der Knoten wirklich offen ist, gilt er als geöffnet; die Zähler folgen beim Zurück zur Karte.
      news.mark('path', pathId, { refresh: false })
      if (node.kind === 'special') news.mark('special_branch', node.id, { refresh: false })
    })
  }

  function submit(answer: PathAnswer) {
    if (!exercise) return
    void perform(async () => {
      if (run) {
        const key = JSON.stringify([run.run_id, exercise.id, answer])
        // Reuse the receipt ID on a network retry; a lost response cannot count twice.
        if (pending.current?.key !== key) pending.current = { key, requestId: crypto.randomUUID() }
        const result = await submitLearningAnswer({ runId: run.run_id, exerciseId: exercise.id,
          answer, requestId: pending.current.requestId, locale: lang })
        if (result.error) { setError(result.error); return }
        setFeedback(result.data)
      } else if (test) {
        const result = await saveLearningTestAnswer({ attemptId: test.attempt_id, exerciseId: exercise.id, answer })
        if (result.error) { setError(result.error); return }
        setTest({ ...test, exercises: test.exercises.map(item => item.id === exercise.id ? { ...item, answer } : item) })
        setStep(previous => previous + 1)
      }
    })
  }

  function next() {
    if (!feedback || !run) return
    if (feedback.completed) { void perform(refreshMap); return }
    setRun({ ...run, queue: feedback.queue }); setFeedback(null); setStep(previous => previous + 1); pending.current = null
  }

  function showReview(target: Selection) {
    setChoice(null)
    void perform(async () => {
      const result = await getLearningTestReview(target.node.id, lang)
      if (result.error) { setError(result.error); return }
      setRun(null); setTest(null); setCardShown(false); setFeedback(null); setTestResult(null)
      setSelection(target); setReview(result.data)
      news.mark('path', target.pathId, { refresh: false })
    })
  }

  function finish() {
    if (!test) return
    void perform(async () => {
      const result = await finishLearningTest(test.attempt_id, lang)
      if (result.error) { setError(result.error); return }
      setTestResult(result.data)
    })
  }

  if (selection) {
    const done = run ? run.total - run.queue.length : test?.exercises.filter(item => item.answer !== null).length ?? 0
    const total = run?.total ?? test?.total ?? 0
    return <section className={styles.root} aria-busy={busy}>
      <LearningScreen title={selection.node.title} subtitle={review ? t('review_title') : total && !testResult ? `${done} / ${total}` : undefined}
        progress={testResult || review ? 100 : total ? (done / total) * 100 : 0} onExit={() => void perform(refreshMap)} exitDisabled={busy}
        t={key => t(key)} workspaceRef={workspace}>
        <div ref={stage} tabIndex={-1} className={styles.stage}>
          {error && <div className={styles.error} role="alert"><p>{pathErrorText(lang, error)}</p></div>}
          {review ? <TestReview review={review} lang={lang} actions={<>
            <button type="button" data-testid="path-review-back" className={styles.secondary} disabled={busy} onClick={() => void perform(refreshMap)}>{t('back')}</button>
            <button type="button" data-testid="path-review-restart" className={styles.primary} disabled={busy}
              onClick={() => openNode(selection.node, selection.title, selection.pathId, true)}><RotateCcw size={18} aria-hidden="true" />{t('review_restart')}</button>
          </>} />
          : cardShown && run?.merkkarte ? <>
            <RuleCard card={run.merkkarte} lang={lang} />
            <div className={`${styles.actions} ${styles.dock}`}><button data-testid="path-rule-continue" className={styles.primary} onClick={() => setCardShown(false)}>{t('begin')}</button></div>
          </> : testResult ? <TestOutcome result={testResult} lang={lang}
            lessons={pathNodes.filter(node => node.kind === 'practice' || node.kind === 'review')}
            recommended={pathNodes.filter(node => testResult.recommended_nodes.includes(node.id))}
            actions={<div className={`${styles.actions} !justify-center`}>
              {testResult.answers.length > 0 && <button type="button" data-testid="path-outcome-review" className={styles.secondary} disabled={busy}
                onClick={() => setReview(testResult)}><ListChecks size={18} aria-hidden="true" />{t('review_open')}</button>}
              <button data-testid="path-outcome-back" className={styles.primary} disabled={busy} onClick={() => void perform(refreshMap)}>{t('back')}</button>
            </div>} />
          : feedback ? <div ref={feedbackRef} tabIndex={-1} data-testid="path-feedback" className={styles.stage}>
            <GradeFeedback grade={feedback.grade} solution={feedback.solution} lang={lang} />
            {feedback.completed && <p className={styles.nodeDone}><CheckCheck size={24} aria-hidden="true" />{t('node_done')}<span className="sr-only">, {t('stars', { count: feedback.stars ?? 0 })}</span>
              <span aria-hidden="true" className={styles.nodeDoneStars}>{'★'.repeat(feedback.stars ?? 0)}{'☆'.repeat(3 - (feedback.stars ?? 0))}</span></p>}
            <div className={`${styles.actions} ${styles.dock}`}><button data-testid="path-next" className={styles.primary} disabled={busy} onClick={next}>{t(feedback.completed ? 'back' : 'next')}</button></div>
          </div> : <>
            <p className="sr-only" role="status">{t('progress', { done, total })}</p>
            {test && done === 0 && <p className={styles.goalChip}><Target size={18} aria-hidden="true" /><span className="sr-only">{t('goal')}</span><span aria-hidden="true">80&thinsp;%</span></p>}
            {exercise ? <PathExerciseForm key={`${exercise.id}-${step}`} exercise={exercise} lang={lang} busy={busy} onSubmit={submit} isTest={Boolean(test)}
              translationOpen={translationOpen} onTranslationToggle={toggleTranslation} />
              : test && <div className={styles.ready}>
                <CheckCheck size={56} aria-hidden="true" />
                <p className="sr-only">{t('test_ready')}</p>
                <div className={`${styles.actions} ${styles.dock}`}><button data-testid="path-test-finish" className={styles.primary} disabled={busy} onClick={finish}>{t('finish')}</button></div>
              </div>}
          </>}
        </div>
      </LearningScreen>
    </section>
  }

  return <section className={styles.root} aria-busy={busy}>
    <h2 ref={heading} tabIndex={-1} className="sr-only">{t('title')}</h2>
    {error && <div className={styles.error} role="alert">
      <p>{pathErrorText(lang, error)}</p>
      <button className={styles.secondary} disabled={busy} onClick={() => void perform(refreshMap)}>{t('retry')}</button>
    </div>}
    <div data-testid="path-map" className={styles.map}>
      {map?.completed && <div className={styles.card}>
        <p>{t('all_done')}</p>
        {map.next_level && (map.next_level_available
          ? <Link className={styles.primary} href={modeHref(lang, map.next_level, 'path')}>{t('next_level', { level: map.next_level })}</Link>
          : <p>{t('teacher_level')}</p>)}
      </div>}
      {map && map.paths.length > 0 && <PathTrail map={map} lang={lang} busy={busy}
        onOpen={(node, path) => openNode(node, path.title, path.id)}
        isNewPath={id => news.isNew('path', id)} isNewBranch={id => news.isNew('special_branch', id)} newLabel={newLabel} />}
      {map && map.paths.length === 0 && <p>{t('empty')}</p>}
    </div>
    <TestChoice choice={choice} lang={lang} busy={busy} onClose={() => setChoice(null)}
      onReview={target => showReview(target)} onStart={target => openNode(target.node, target.title, target.pathId, true)} />
  </section>
}

/**
 * Klick auf einen schon absolvierten Test: das letzte Ergebnis und zwei klare
 * Wege — die Auswertung ansehen oder den Test erneut starten (ein offener
 * Versuch wird fortgesetzt).
 */
function TestChoice({ choice, lang, busy, onClose, onReview, onStart }: {
  choice: Selection | null; lang: string; busy: boolean; onClose: () => void
  onReview: (target: Selection) => void; onStart: (target: Selection) => void
}) {
  const t = pathTranslator(lang)
  const last = choice ? lastCompleted(choice.node) : undefined
  const resumes = Boolean(choice?.node.tests.some(attempt => attempt.status === 'active'))
  const value = last?.percentage === null || last?.percentage === undefined ? null : Math.floor(last.percentage)
  return <BottomSheet open={Boolean(choice)} onClose={onClose} title={choice?.node.title ?? ''} closeLabel={t('exit_learning')}
    icon={<Trophy size={24} />}>
    {choice && <div className={styles.choiceList} data-testid="path-test-choice">
      {last && value !== null && <p className={styles.choiceResult} data-passed={Boolean(last.passed)}>
        <span className="sr-only">{t('review_last', { value })}</span>
        <span className={styles.choicePercent} aria-hidden="true">{value}&thinsp;%</span>
        <span className={styles.chip} data-tone={last.passed ? 'success' : 'path'}>{t(last.passed ? 'passed' : 'goal')}</span>
      </p>}
      <button type="button" className={styles.choice} data-tone="review" data-testid="path-choice-review" disabled={busy} onClick={() => onReview(choice)}>
        <span className={styles.choiceIcon} aria-hidden="true"><ListChecks size={24} /></span>
        <span>{t('review_open')}</span>
      </button>
      <button type="button" className={styles.choice} data-tone="start" data-testid="path-choice-start" disabled={busy} onClick={() => onStart(choice)}>
        <span className={styles.choiceIcon} aria-hidden="true">{resumes ? <Play size={24} /> : <RotateCcw size={24} />}</span>
        <span>{t(resumes ? 'review_continue' : 'review_restart')}</span>
      </button>
    </div>}
  </BottomSheet>
}
