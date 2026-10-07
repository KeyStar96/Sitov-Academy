'use client'

import { useMemo, useRef, useState } from 'react'
import VerbTrainerClient, { type SitovVerbTrainerActions } from './VerbTrainerClient'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import { getSitovVerbCatalog } from '@/lib/verbs/catalog'
import { buildSitovVerbExercise, evaluateSitovVerbAnswer, getSitovVerbTenses, prioritizeSitovVerbTasks } from '@/lib/verbs/engine'
import { buildSitovVerbLearningBox, SITOV_VERB_REVIEW_DAYS } from '@/lib/verbs/learning-box'
import { SITOV_VERB_TRAINER_LEVELS, type SitovVerbExercise, type SitovVerbTrainerLevel, type SitovVerbProgress } from '@/lib/verbs/types'
import type { SitovVerbTrainerState } from '@/lib/verbs/contracts'
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
          nextReviewAt: index % 2 ? '2099-01-01T10:00:00Z' : '2026-10-01T10:00:00Z', lastAnsweredAt: box === 1 ? null : '2026-09-30T10:00:00Z' }
      })
    })
    return { learnerId: 'sitov-development-preview', level,
      authorizedLevels: SITOV_VERB_TRAINER_LEVELS.filter(item => SITOV_VERB_TRAINER_LEVELS.indexOf(item) <= SITOV_VERB_TRAINER_LEVELS.indexOf(level)),
      tenses: getSitovVerbTenses(level), verbs, selectedIds, progress }
  }, [level, verbs, empty])
  const selected = useRef(initial.selectedIds)
  const challenges = useRef(new Map<string, SitovVerbExercise>())
  const progress = useRef<SitovVerbProgress[]>(initial.progress)
  const iteration = useRef(0)
  const actions = useMemo<SitovVerbTrainerActions>(() => ({
    box: async ({ verbIds, selected: add }) => {
      selected.current = add ? [...new Set([...selected.current, ...verbIds])] : selected.current.filter(id => !verbIds.includes(id))
      return { data: { selectedIds: [...selected.current] } }
    },
    next: async ({ tenses, excludeVerbId, box }) => {
      const state = { ...initial, selectedIds: selected.current, progress: progress.current }
      const pool = box == null ? verbs.filter(verb => selected.current.includes(verb.id))
        : buildSitovVerbLearningBox(state).cards.filter(card => card.box === box).map(card => card.verb)
      const tasks = prioritizeSitovVerbTasks(pool, progress.current, level, tenses)
      const others = tasks.filter(task => task.verbId !== excludeVerbId)
      const task = (others.length ? others : tasks)[0]
      if (!task) return { data: null }
      const index = iteration.current++
      const verb = verbs.find(verb => verb.id === task.verbId)!
      const exercise = buildSitovVerbExercise(verb, task.tense, { seed: index + 32 })
      const id = `sitov-preview-${index}`
      challenges.current.set(id, exercise)
      return { data: { exerciseId: id, verbId: verb.id, infinitive: verb.infinitive, translation: verb.translations[toUiLocale(lang)],
        tense: exercise.tense, kind: exercise.kind, prompt: exercise.prompt, parts: exercise.parts, person: exercise.person } }
    },
    answer: async ({ exerciseId, answer }): ReturnType<SitovVerbTrainerActions['answer']> => {
      const exercise = challenges.current.get(exerciseId)
      if (!exercise) return { error: 'not_found' }
      const correct = evaluateSitovVerbAnswer(exercise, answer)
      const previous = progress.current.find(item => item.verbId === exercise.verbId && item.tense === exercise.tense)
      const due = !previous?.nextReviewAt || Date.parse(previous.nextReviewAt) <= Date.now()
      const box = correct ? !previous ? 2 : due ? Math.min(7, previous.box + 1) : previous.box : 1
      const updated: SitovVerbProgress = { verbId: exercise.verbId, tense: exercise.tense, box,
        attempts: (previous?.attempts ?? 0) + 1, correct: (previous?.correct ?? 0) + Number(correct), lapses: (previous?.lapses ?? 0) + Number(!correct),
        nextReviewAt: correct && previous && !due ? previous.nextReviewAt : new Date(Date.now() + (correct ? SITOV_VERB_REVIEW_DAYS[box - 1] * 86400000 : 300000)).toISOString(), lastAnsweredAt: new Date().toISOString() }
      progress.current = [...progress.current.filter(item => item.verbId !== updated.verbId || item.tense !== updated.tense), updated]
      return { data: { correct, solution: exercise.solution, progress: updated } }
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
