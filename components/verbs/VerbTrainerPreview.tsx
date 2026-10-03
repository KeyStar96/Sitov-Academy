'use client'

import { useMemo, useRef, useState } from 'react'
import VerbTrainerClient, { type SitovVerbTrainerActions } from './VerbTrainerClient'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import { getSitovVerbCatalog } from '@/lib/verbs/catalog'
import { buildSitovVerbExercise, evaluateSitovVerbAnswer, getSitovVerbTenses } from '@/lib/verbs/engine'
import { SITOV_VERB_LEVELS, type SitovVerbExercise, type SitovVerbLevel, type SitovVerbProgress } from '@/lib/verbs/types'
import type { SitovVerbTrainerState } from '@/lib/verbs/contracts'
import { toUiLocale } from '@/lib/locale-routing'

/** Local fixtures behind the development-only route. No learner state is written. */
function SitovVerbFixture({ level, lang, empty }: { level: SitovVerbLevel; lang: string; empty: boolean }) {
  const verbs = useMemo(() => getSitovVerbCatalog(level).map(verb => ({ ...verb, unitId: verb.id })), [level])
  const initial = useMemo<SitovVerbTrainerState>(() => ({ learnerId: 'sitov-development-preview', level,
    authorizedLevels: SITOV_VERB_LEVELS.filter(item => SITOV_VERB_LEVELS.indexOf(item) <= SITOV_VERB_LEVELS.indexOf(level)),
    tenses: getSitovVerbTenses(level), verbs,
    selectedIds: empty ? [] : verbs.filter(verb => ['sprechen', 'fahren', 'anrufen', 'sich freuen', 'sein', 'schreiben', 'abfahren', 'sich anziehen'].includes(verb.infinitive)).map(verb => verb.id), progress: [] }), [level, verbs, empty])
  const selected = useRef(initial.selectedIds)
  const challenges = useRef(new Map<string, SitovVerbExercise>())
  const progress = useRef<SitovVerbProgress[]>([])
  const iteration = useRef(0)
  const actions = useMemo<SitovVerbTrainerActions>(() => ({
    box: async ({ verbIds, selected: add }) => {
      selected.current = add ? [...new Set([...selected.current, ...verbIds])] : selected.current.filter(id => !verbIds.includes(id))
      return { data: { selectedIds: [...selected.current] } }
    },
    next: async ({ tenses, excludeVerbId }) => {
      const pool = verbs.filter(verb => selected.current.includes(verb.id))
      if (!pool.length) return { data: null }
      const others = pool.filter(verb => verb.id !== excludeVerbId)
      const candidates = others.length ? others : pool
      const index = iteration.current++
      const verb = candidates[index % candidates.length]
      const allowed = getSitovVerbTenses(level, verb).filter(tense => !tenses || tenses.includes(tense))
      if (!allowed.length) return { data: null }
      const exercise = buildSitovVerbExercise(verb, allowed[index % allowed.length], { seed: index + 32 })
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
      const updated: SitovVerbProgress = { verbId: exercise.verbId, tense: exercise.tense, box: correct ? Math.min(7, (previous?.box ?? 1) + 1) : 1,
        attempts: (previous?.attempts ?? 0) + 1, correct: (previous?.correct ?? 0) + Number(correct), lapses: (previous?.lapses ?? 0) + Number(!correct),
        nextReviewAt: new Date(Date.now() + (correct ? 86400000 : 600000)).toISOString(), lastAnsweredAt: new Date().toISOString() }
      progress.current = [...progress.current.filter(item => item.verbId !== updated.verbId || item.tense !== updated.tense), updated]
      return { data: { correct, solution: exercise.solution, progress: updated } }
    },
  }), [verbs, level, lang])
  return <VerbTrainerClient initialState={initial} lang={lang} actions={actions} />
}

export default function VerbTrainerPreview({ lang }: { lang: string }) {
  const [level, setLevel] = useState<SitovVerbLevel>('A1.2')
  const [empty, setEmpty] = useState(false)
  return <div className="academy-container space-y-5 py-8">
    <p className="text-sm text-[var(--muted)]">Sitov Academy · Development preview · local practice only</p>
    <SitovPreviewAppearance />
    <div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2">Level <select value={level} onChange={event => setLevel(event.target.value as SitovVerbLevel)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">{SITOV_VERB_LEVELS.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={empty} onChange={event => setEmpty(event.target.checked)} />Empty box</label></div>
    <SitovVerbFixture key={`${level}:${empty}`} level={level} lang={lang} empty={empty} />
  </div>
}
