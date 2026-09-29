'use client'

import { modeHref } from '@/lib/mode-targets'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { getLearningPath, startLearningNode, submitLearningAnswer, startLearningTest, saveLearningTestAnswer, finishLearningTest } from '@/app/actions/learning-path'
import type { PathAnswer, PathMap, PathNode, PracticeRun, PracticeResult, PathTest, TestResult, PathGrade } from '@/lib/learning-path-contract'
import { pathErrorText, pathTranslator } from '@/lib/learning-path-i18n'
import { OrthographyNote } from '@/components/exercises/SoftErrorBadge'
import FeedbackMotion from '@/components/motion/FeedbackMotion'
import { useLearningNew } from '@/components/dashboard/useLearningNew'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { LearningNewItems } from '@/lib/learning-new'
import RuleCard from './RuleCard'
import PathExerciseForm from './PathExerciseForm'
import PathTrail from './PathTrail'
import TestOutcome from './TestOutcome'
import styles from './learning-path.module.css'

type Selection = { node: PathNode; title: string; pathId: string }

function GradeFeedback({ grade, solution, lang, isTest = false }: { grade: PathGrade; solution: PracticeResult['solution']; lang: string; isTest?: boolean }) {
  const t = pathTranslator(lang)
  return <FeedbackMotion correct={grade.correct} className={styles.feedback}>
    <p className={styles.instruction} role="status">{t(grade.correct ? 'correct' : isTest ? 'incorrect_test' : 'incorrect')}</p>
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
  const [step, setStep] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const pending = useRef<{ key: string; requestId: string } | null>(null)
  const exercise = run ? run.exercises.find(item => item.id === run.queue[0])
    : test?.exercises.find(item => item.answer === null)
  const selectedPath = map?.paths.find(path => path.id === selection?.pathId)
  const pathNodes = selectedPath?.nodes ?? []
  const hasNextPath = Boolean(selectedPath && map && map.paths.indexOf(selectedPath) < map.paths.length - 1)
  const view = !selection ? 'map' : cardShown ? 'rule' : feedback ? 'feedback' : testResult ? 'result' : exercise?.id ?? 'finish'

  useEffect(() => {
    if (view === 'feedback') feedbackRef.current?.focus()
    else heading.current?.focus()
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
    setMap(result.data); setSelection(null); setRun(null); setTest(null); setFeedback(null); setTestResult(null)
    pending.current = null
    news.flush()
  }

  function openNode(node: PathNode, title: string, pathId: string) {
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
      setSelection({ node, title, pathId }); setFeedback(null); setTestResult(null); setStep(0); pending.current = null
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

  function finish() {
    if (!test) return
    void perform(async () => {
      const result = await finishLearningTest(test.attempt_id, lang)
      if (result.error) { setError(result.error); return }
      setTestResult(result.data)
    })
  }

  return <section className={styles.root} aria-busy={busy}>
    <header className={styles.header}>
      {selection && <button className={styles.secondary} disabled={busy} onClick={() => void perform(refreshMap)}>{t('back')}</button>}
      <h2 ref={heading} tabIndex={-1}>{selection ? selection.node.title : t('title')}</h2>
      <p>{selection ? `${selection.title} › ${t(selection.node.kind)}` : t('intro')}</p>
    </header>
    {error && <div className={styles.error} role="alert">
      <p>{pathErrorText(lang, error)}</p>
      {!selection && <button className={styles.secondary} disabled={busy} onClick={() => void perform(refreshMap)}>{t('retry')}</button>}
    </div>}
    {!selection && <div data-testid="path-map" className={styles.map}>
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
    </div>}
    {selection && <div className={testResult ? undefined : styles.card}>
      {cardShown && run?.merkkarte ? <>
        <RuleCard card={run.merkkarte} lang={lang} />
        <div className={styles.actions}><button data-testid="path-rule-continue" className={styles.primary} onClick={() => setCardShown(false)}>{t('begin')}</button></div>
      </> : testResult ? <TestOutcome result={testResult} lang={lang} hasNextPath={hasNextPath}
        lessons={pathNodes.filter(node => node.kind === 'practice' || node.kind === 'review')}
        recommended={pathNodes.filter(node => testResult.recommended_nodes.includes(node.id))}
        actions={<div className={`${styles.actions} !justify-center`}><button data-testid="path-outcome-back" className={styles.primary} disabled={busy} onClick={() => void perform(refreshMap)}>{t('back')}</button></div>}>
        <h3 className="!mt-8">{t('results')}</h3>
        {testResult.answers.map((item, index) => <details key={item.id} className={styles.result}>
          <summary>{index + 1}. {item.content.instruction || t('answer')}</summary>
          <p lang="de" translate="no">{item.type === 'fill_in_blank' ? `${item.content.text_before} … ${item.content.text_after}` : item.type === 'multiple_choice' ? item.content.question : item.content.parts.join(' · ')}</p>
          <p>{t('answer')}: <span lang="de" translate="no">{'text' in item.answer ? item.answer.text
            : 'index' in item.answer && item.type === 'multiple_choice' ? item.content.options[item.answer.index]
              : 'indices' in item.answer && item.type === 'sentence_building' ? item.answer.indices.map(index => item.content.parts[index]).join(' ') : ''}</span></p>
          <GradeFeedback grade={item.result} solution={item.solution} lang={lang} isTest />
        </details>)}
      </TestOutcome> : feedback ? <div ref={feedbackRef} tabIndex={-1} data-testid="path-feedback">
        <GradeFeedback grade={feedback.grade} solution={feedback.solution} lang={lang} />
        {feedback.completed && <><h3>{t('node_done')}</h3><p>{t('stars', { count: feedback.stars ?? 0 })}</p></>}
        <div className={styles.actions}><button data-testid="path-next" className={styles.primary} disabled={busy} onClick={next}>{t(feedback.completed ? 'back' : 'next')}</button></div>
      </div> : <>
        {test && <div className={styles.callout}><Trophy size={22} aria-hidden="true" /><p className="!m-0">{t('test_hint')} {t('test_intro')}</p></div>}
        <p role="status">{t('progress', { done: run ? run.total - run.queue.length : test?.exercises.filter(item => item.answer !== null).length ?? 0, total: run?.total ?? test?.total ?? 0 })}</p>
        {exercise ? <PathExerciseForm key={`${exercise.id}-${step}`} exercise={exercise} lang={lang} busy={busy} onSubmit={submit} isTest={Boolean(test)} />
          : test && <><p>{t('test_ready')}</p><div className={styles.actions}><button data-testid="path-test-finish" className={styles.primary} disabled={busy} onClick={finish}>{t('finish')}</button></div></>}
      </>}
    </div>}
  </section>
}
