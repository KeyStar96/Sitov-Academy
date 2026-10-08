'use client'

import { useMemo, useRef, useState } from 'react'
import VerbTrainerClient, { type SitovVerbTrainerActions } from './VerbTrainerClient'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import { getSitovVerbCatalog } from '@/lib/verbs/catalog'
import { buildSitovVerbExercise, gradeSitovVerbAnswer, getSitovVerbPreviousIds, getSitovVerbTenses, prioritizeSitovVerbTasks } from '@/lib/verbs/engine'
import { pickWeightedRandomOrder, selectionWeightForBox } from '@/lib/leitner'
import { buildSitovVerbLearningBox } from '@/lib/verbs/learning-box'
import { applySitovVerbReview, sitovVerbCalendarDay } from '@/lib/verbs/review'
import { SITOV_VERB_TRAINER_LEVELS, type SitovVerbExercise, type SitovVerbTrainerLevel, type SitovVerbProgress } from '@/lib/verbs/types'
import type { SitovVerbReviewResult, SitovVerbTrainerState } from '@/lib/verbs/contracts'
import { toUiLocale } from '@/lib/locale-routing'

/** Local fixtures behind the development-only route. No learner state is written. */
function SitovVerbFixture({ level, lang, empty }: { level: SitovVerbTrainerLevel; lang: string; empty: boolean }) {
  const verbs = useMemo(() => getSitovVerbCatalog(level).map(verb => ({ ...verb, unitId: verb.id })), [level])
  const initial = useMemo<SitovVerbTrainerState>(() => {
    const selectedIds = empty ? [] : verbs.filter(verb => ['sprechen', 'fahren', 'anrufen', 'sich freuen', 'sein', 'schreiben', 'abfahren', 'sich anziehen'].includes(verb.infinitive)).map(verb => verb.id)
    const progress = selectedIds.flatMap((verbId, index) => {
      const verb = verbs.find(verb => verb.id === verbId)!
      return getSitovVerbTenses(level, verb).map((tense, tenseIndex) => {
        const box = index === 0 ? tenseIndex === 0 ? 6 : 1 : Math.min(7, index + 1)
        return { verbId, tense, box, attempts: box === 1 ? 0 : box + 2, correct: box === 1 ? 0 : box + 1, lapses: 0,
          nextReviewAt: box === 7 ? null : index % 2 ? '2099-01-01T10:00:00Z' : '2026-10-01T10:00:00Z',
          lastAnsweredAt: box === 1 ? null : new Date(Date.parse('2026-09-30T10:00:00Z') + index * 60000).toISOString() }
      })
    })
    return { learnerId: 'sitov-development-preview', level,
      authorizedLevels: SITOV_VERB_TRAINER_LEVELS.filter(item => SITOV_VERB_TRAINER_LEVELS.indexOf(item) <= SITOV_VERB_TRAINER_LEVELS.indexOf(level)),
      tenses: getSitovVerbTenses(level), verbs, selectedIds, progress }
  }, [level, verbs, empty])
  const selected = useRef(initial.selectedIds)
  const challenges = useRef(new Map<string, { exercise: SitovVerbExercise; answer?: string[]; result?: SitovVerbReviewResult }>())
  const progress = useRef<SitovVerbProgress[]>(initial.progress)
  const iteration = useRef(0)
  const actions = useMemo<SitovVerbTrainerActions>(() => ({
    box: async ({ verbIds, selected: add }) => {
      selected.current = add ? [...new Set([...selected.current, ...verbIds])] : selected.current.filter(id => !verbIds.includes(id))
      return { data: { selectedIds: [...selected.current] } }
    },
    next: async ({ tenses, excludeVerbId, box, verbIds }) => {
      const state = { ...initial, selectedIds: selected.current, progress: progress.current }
      if (box === 7) return { data: null }
      const snapshot = verbIds ? new Set(verbIds) : null
      const pool = snapshot ? verbs.filter(verb => snapshot.has(verb.id) && selected.current.includes(verb.id))
        : box == null ? verbs.filter(verb => selected.current.includes(verb.id))
        : buildSitovVerbLearningBox(state).cards.filter(card => card.box === box).map(card => card.verb)
      const previous = new Set(getSitovVerbPreviousIds(progress.current))
      if (excludeVerbId) previous.add(excludeVerbId)
      const tasks = pickWeightedRandomOrder(prioritizeSitovVerbTasks(pool, progress.current, level, tenses)
        .filter(task => !previous.has(task.verbId)), task => selectionWeightForBox(task.progress?.box))
      const task = tasks[0]
      if (!task) return { data: null }
      const index = iteration.current++
      const verb = verbs.find(verb => verb.id === task.verbId)!
      const exercise = buildSitovVerbExercise(verb, task.tense, { seed: index + 32 })
      const id = `sitov-preview-${index}`
      challenges.current.set(id, { exercise })
      return { data: { exerciseId: id, verbId: verb.id, infinitive: verb.infinitive, translation: verb.translations[toUiLocale(lang)],
        tense: exercise.tense, kind: exercise.kind, prompt: exercise.prompt, parts: exercise.parts, person: exercise.person } }
    },
    answer: async ({ exerciseId, answer }): ReturnType<SitovVerbTrainerActions['answer']> => {
      const challenge = challenges.current.get(exerciseId)
      if (!challenge) return { error: 'not_found' }
      if (challenge.result) return JSON.stringify(challenge.answer) === JSON.stringify(answer) ? { data: challenge.result } : { error: 'conflict' }
      const { exercise } = challenge
      if (getSitovVerbPreviousIds(progress.current).includes(exercise.verbId)) return { error: 'spacing_required' }
      const grade = gradeSitovVerbAnswer(exercise, answer)
      const previous = progress.current.find(item => item.verbId === exercise.verbId && item.tense === exercise.tense)
        ?? { verbId: exercise.verbId, tense: exercise.tense, box: 1, attempts: 0, correct: 0, lapses: 0, nextReviewAt: null, lastAnsweredAt: null }
      let updated: SitovVerbProgress
      try { updated = applySitovVerbReview(previous, grade.correct, new Date(), !!grade.softError) }
      catch { return { error: 'review_not_due' } }
      progress.current = [...progress.current.filter(item => item.verbId !== updated.verbId || item.tense !== updated.tense), updated]
      challenge.answer = [...answer]
      challenge.result = { ...grade, solution: exercise.solution, progress: updated, retry: false }
      return { data: challenge.result }
    },
    retry: async ({ exerciseId, answer }): ReturnType<SitovVerbTrainerActions['answer']> => {
      const challenge = challenges.current.get(exerciseId)
      if (!challenge) return { error: 'not_found' }
      const { exercise, result } = challenge
      if (!result || result.correct || !result.progress.lastAnsweredAt
        || sitovVerbCalendarDay(new Date(result.progress.lastAnsweredAt)) !== sitovVerbCalendarDay(new Date())) return { error: 'retry_not_available' }
      const current = progress.current.find(item => item.verbId === exercise.verbId && item.tense === exercise.tense)
      if (!current || current.lastAnsweredAt !== result.progress.lastAnsweredAt) return { error: 'retry_not_available' }
      return { data: { ...gradeSitovVerbAnswer(exercise, answer), solution: exercise.solution, progress: current, retry: true } }
    },
  }), [verbs, level, lang, initial])
  return <VerbTrainerClient initialState={initial} lang={lang} actions={actions} />
}

export default function VerbTrainerPreview({ lang }: { lang: string }) {
  const [level, setLevel] = useState<SitovVerbTrainerLevel>('A1.2')
  const [empty, setEmpty] = useState(false)
  return <div className="academy-container space-y-5 py-8">
    <p className="text-sm text-[var(--muted)]">Sitov Academy · Development preview · local practice only</p>
    <SitovPreviewAppearance />
    <div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2">Level <select value={level} onChange={event => setLevel(event.target.value as SitovVerbTrainerLevel)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">{SITOV_VERB_TRAINER_LEVELS.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={empty} onChange={event => setEmpty(event.target.checked)} />Empty box</label></div>
    <SitovVerbFixture key={`${level}:${empty}`} level={level} lang={lang} empty={empty} />
  </div>
}
