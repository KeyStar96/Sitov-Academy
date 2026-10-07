import { sitovPronunciationProgress } from '@/lib/sitov-pronunciation-progress'
import { SITOV_PRONUNCIATION_REQUIREMENTS, type SitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness'

const readiness: SitovPronunciationReadiness = {
  level: 'A1.1', mode: 'logical', tier: 0, requirements: [...SITOV_PRONUNCIATION_REQUIREMENTS], texts: [],
  stats: { knownWords: 15, grammarNodes: 1, passedTests: 0, legacyGrammarExercises: 0, legacyGrammarTopics: 0, confidentVerbForms: 1, verbEvidenceRequired: true },
}

it('computes current and missing counts independently for every requirement', () => {
  const progress = sitovPronunciationProgress(readiness, 1)!
  expect(progress.words).toMatchObject({ current: 15, required: 30, remaining: 15, fraction: .5, met: false })
  expect(progress.nodes).toMatchObject({ remaining: 1, fraction: .5 })
  expect(progress.verbs).toMatchObject({ current: 1, required: 3, remaining: 2 })
  expect(progress).toMatchObject({ completed: 0, total: 3, percent: 44, grammarMet: false, grammarFraction: .5 })
})

it('requires a complete grammar route rather than combining evidence between routes', () => {
  const progress = sitovPronunciationProgress({ ...readiness, stats: { ...readiness.stats, grammarNodes: 5, passedTests: 0, legacyGrammarExercises: 0, legacyGrammarTopics: 3 } }, 2)!
  expect(progress.grammarFraction).toBe(0)
  expect(progress.grammarMet).toBe(false)
  const historical = sitovPronunciationProgress({ ...readiness, stats: { ...readiness.stats, legacyGrammarExercises: 20, legacyGrammarTopics: 3 } }, 2)!
  expect(historical.grammarFraction).toBe(1)
  expect(historical.grammarMet).toBe(true)
})

it('honors adjusted verb requirements and omits unavailable verb evidence', () => {
  const adjusted = { ...readiness, requirements: readiness.requirements.map(row => ({ ...row, confidentVerbForms: 1 })) }
  expect(sitovPronunciationProgress(adjusted, 1)!.verbs).toMatchObject({ met: true, remaining: 0, required: 1 })
  const noVerbs = sitovPronunciationProgress({ ...readiness, stats: { ...readiness.stats, verbEvidenceRequired: false } }, 1)!
  expect(noVerbs.verbs).toBeNull()
  expect(noVerbs.total).toBe(2)
  expect(noVerbs.percent).toBe(50)
})

it('never rounds an unfinished step to 100% or claims more than 100%', () => {
  const stats = { ...readiness.stats, knownWords: 159, grammarNodes: 10, passedTests: 2, confidentVerbForms: 15 }
  expect(sitovPronunciationProgress({ ...readiness, stats }, 3)!.percent).toBe(99)
  const completed = sitovPronunciationProgress({ ...readiness, stats: { ...stats, knownWords: 999 } }, 3)!
  expect(completed).toMatchObject({ percent: 100, completed: 3, total: 3 })
  expect(completed.words.remaining).toBe(0)
})

it('does not invent a missing server requirement', () => {
  expect(sitovPronunciationProgress(readiness, 4)).toBeNull()
})
